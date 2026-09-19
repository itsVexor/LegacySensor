import asyncio, datetime, ipaddress, os, socket, ssl, struct, subprocess, sys, time
from pathlib import Path
from aiohttp import web
import qrcode

BASE=Path(__file__).resolve().parent
PORT=8765
WS_PATH='/ws'
MAGIC=0x3150534c  # LSP1
JOINT_COUNT=20
JOINT_FMT='<ffff'
HEADER_FMT='<IIIIQ'
SHARED_NAME='Local\\LegacyWebcamKinectPose'
SHARED_MAGIC=0x3150444A
SHARED_VERSION=1
SHARED_SIZE=struct.calcsize(HEADER_FMT)+JOINT_COUNT*struct.calcsize(JOINT_FMT)

clients=set()
shared=None
seq=0

def lan_ip():
    s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    try:
        s.connect(('1.1.1.1',80)); return s.getsockname()[0]
    except Exception: return '127.0.0.1'
    finally: s.close()

def ensure_cert():
    cert=BASE/'phone_server_cert.pem'; key=BASE/'phone_server_key.pem'
    if cert.exists() and key.exists(): return cert,key
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
        key_obj=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Legacy Sensor Phone Sensor')])
        ip=lan_ip()
        cert_obj=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key_obj.public_key())
          .serial_number(x509.random_serial_number()).not_valid_before(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=2))
          .not_valid_after(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=365))
          .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.IPAddress(ipaddress.ip_address(ip))]),critical=False)
          .sign(key_obj,hashes.SHA256()))
        key.write_bytes(key_obj.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.TraditionalOpenSSL,serialization.NoEncryption()))
        cert.write_bytes(cert_obj.public_bytes(serialization.Encoding.PEM))
        return cert,key
    except Exception as e:
        print('[ERROR] Certificate generation failed:',e)
        print('Install cryptography: python -m pip install cryptography')
        raise

def open_shared():
    global shared
    if os.name!='nt':
        print('[INFO] Shared-memory Kinect bridge is Windows-only; WebSocket tracking will still run.')
        return
    try:
        import mmap
        shared=mmap.mmap(-1,SHARED_SIZE,tagname=SHARED_NAME)
        write_shared(None)
        print('[OK] Connected to shared memory:',SHARED_NAME)
    except Exception as e:
        print('[WARN] Could not open shared memory. Start Legacy Sensor/FakeKinect10 first if required:',e)

def write_shared(joints):
    global seq
    if shared is None: return
    tracked=1 if joints else 0
    seq=(seq+2)|1
    shared.seek(0); shared.write(struct.pack(HEADER_FMT,SHARED_MAGIC,SHARED_VERSION,seq,tracked,int(time.time()*1000)))
    if joints:
        for j in joints[:JOINT_COUNT]: shared.write(struct.pack(JOINT_FMT,*j))
    else:
        for _ in range(JOINT_COUNT): shared.write(struct.pack(JOINT_FMT,0,0,0,0))
    seq+=1; shared.seek(8); shared.write(struct.pack('<I',seq)); shared.flush()

def parse_packet(data):
    if len(data)!=24+JOINT_COUNT*16: return None
    magic,ver,seq_in,tracked,ts=struct.unpack('<IIIIQ',data[:24])
    if magic!=MAGIC or ver!=1 or not tracked: return None
    vals=struct.unpack('<'+('f'*JOINT_COUNT*4),data[24:])
    return [vals[i:i+4] for i in range(0,len(vals),4)]

async def ws_handler(request):
    ws=web.WebSocketResponse(heartbeat=10,autoping=True,max_msg_size=65536)
    await ws.prepare(request); clients.add(ws)
    print('[PHONE] connected:',request.remote)
    try:
        async for msg in ws:
            if msg.type==web.WSMsgType.BINARY:
                joints=parse_packet(msg.data)
                if joints:
                    write_shared(joints)
            elif msg.type==web.WSMsgType.ERROR: break
    finally:
        clients.discard(ws); print('[PHONE] disconnected:',request.remote); write_shared(None)
    return ws

async def health(_): return web.json_response({'ok':True,'clients':len(clients),'bridge':'shared-memory' if shared else 'websocket-only'})

async def main():
    global shared
    open_shared()
    ip=lan_ip(); url=f'https://{ip}:{PORT}/webapp.html'; pair=f'https://{ip}:{PORT}/pair.html'
    qr=qrcode.make(url); qr.save(BASE/'pairing_qr.png')
    app=web.Application(); app.router.add_get(WS_PATH,ws_handler); app.router.add_get('/health',health); app.router.add_static('/',BASE,show_index=False)
    cert,key=ensure_cert(); ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cert,key)
    runner=web.AppRunner(app); await runner.setup(); site=web.TCPSite(runner,'0.0.0.0',PORT,ssl_context=ctx); await site.start()
    print('\n=== LEGACY SENSOR PHONE SENSOR v1.5.0 BETA ===')
    print('WebApp :',url); print('Pair QR:',pair); print('Open the Pair QR page on the PC and scan it with the iPhone.'); print('Press Ctrl+C to stop.\n')
    try:
        if os.name=='nt': subprocess.Popen(['cmd','/c','start','',pair],shell=False)
        else: webbrowser.open(pair)
    except Exception: pass
    while True: await asyncio.sleep(3600)

if __name__=='__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
