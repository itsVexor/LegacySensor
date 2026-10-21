"""JD Motion Bridge - wrzuć do folderu LegacySensor-main (obok webapp.html).
Uruchom:  python motion_bridge.py            (klawisze + parowanie)
          python motion_bridge.py --pose     (+ ruch ręki jako poza Kinect, eksperymentalne)
Wymaga: aiohttp, cryptography (jak LegacySensor), opcjonalnie qrcode."""
import asyncio, json, os, ssl, struct, sys, time, socket, ctypes
from pathlib import Path
from aiohttp import web, ClientSession, ClientTimeout, WSMsgType

BASE = Path(__file__).resolve().parent
PORT = 8766
JD = [os.environ.get('JD_BASE', 'http://jd-next.local:5085'), 'http://127.0.0.1:5086']
POSE = '--pose' in sys.argv

# ---------- klawisze (Windows SendInput) ----------
VK = {'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27, 'enter': 0x0D, 'escape': 0x1B,
      'space': 0x20, 'tab': 0x09, 'backspace': 0x08, 'f1': 0x70, 'f2': 0x71, 'f5': 0x74}
SC = {0x26: 0x48, 0x28: 0x50, 0x25: 0x4B, 0x27: 0x4D, 0x0D: 0x1C, 0x1B: 0x01, 0x20: 0x39, 0x09: 0x0F, 0x08: 0x0E}
EXT = {0x26, 0x28, 0x25, 0x27}

class KI(ctypes.Structure):
    _fields_ = [('wVk', ctypes.c_ushort), ('wScan', ctypes.c_ushort), ('dwFlags', ctypes.c_ulong),
                ('time', ctypes.c_ulong), ('dwExtraInfo', ctypes.c_size_t)]
class IN(ctypes.Structure):
    class _U(ctypes.Union):
        _fields_ = [('ki', KI), ('pad', ctypes.c_byte * 32)]
    _anonymous_ = ('u',)
    _fields_ = [('type', ctypes.c_ulong), ('u', _U)]

def press(name, hold=0.05):
    vk = VK.get(name)
    if vk is None: return
    if os.name != 'nt':
        print('[KEY]', name, '(tylko Windows wysyła klawisze)'); return
    sc = SC.get(vk, 0)
    fl = 0x0008 | (0x0001 if vk in EXT else 0)  # SCANCODE (+EXTENDED) - gry często ignorują czyste VK
    def send(up):
        i = IN(type=1); i.ki = KI(0, sc, fl | (0x0002 if up else 0), 0, 0)
        ctypes.windll.user32.SendInput(1, ctypes.byref(i), ctypes.sizeof(IN))
    send(False); time.sleep(hold); send(True)

# ---------- poza Kinect (ten sam układ co phone_server.py z LegacySensor) ----------
JC, HDR = 20, '<IIIIQ'
shared, seq = None, 0
SIZE = struct.calcsize(HDR) + JC * 16
# kolejność Kinect v1: 0 HipC 1 Spine 2 ShoulderC 3 Head 4 ShL 5 ElL 6 WrL 7 HandL 8 ShR 9 ElR 10 WrR 11 HandR 12 HipL 13 KnL 14 AnL 15 FtL 16 HipR 17 KnR 18 AnR 19 FtR
REST = [(0, 0, 2), (0, .25, 2), (0, .5, 2), (0, .7, 2), (-.2, .45, 2), (-.25, .2, 2), (-.27, 0, 2), (-.28, -.07, 2),
        (.2, .45, 2), (.25, .2, 2), (.27, 0, 2), (.28, -.07, 2), (-.1, -.05, 2), (-.1, -.5, 2), (-.1, -.9, 2), (-.1, -.95, 2),
        (.1, -.05, 2), (.1, -.5, 2), (.1, -.9, 2), (.1, -.95, 2)]

def open_shared():
    global shared
    if not POSE or os.name != 'nt': return
    try:
        import mmap
        shared = mmap.mmap(-1, SIZE, tagname='Local\\LegacyWebcamKinectPose'); print('[OK] pamięć współdzielona Kinect')
    except Exception as e: print('[WARN] brak pamięci współdzielonej (uruchom Legacy Sensor/FakeKinect10 najpierw):', e)

def write_pose(hx, hy, hz):
    """hx,hy,hz: -1..1 pozycja prawej dłoni względem barku (z orientacji telefonu)."""
    global seq
    if shared is None: return
    j = [list(p) + [1.0] for p in REST]
    sh = REST[8]; reach = .6
    for idx, f in ((10, .8), (11, 1.0)):
        j[idx][0] = sh[0] + hx * reach * f + .05
        j[idx][1] = sh[1] + hy * reach * f
        j[idx][2] = sh[2] - hz * reach * f
    j[9][0] = sh[0] + hx * reach * .5; j[9][1] = sh[1] + hy * reach * .5 - .1; j[9][2] = sh[2] - hz * reach * .5
    seq = (seq + 2) | 1
    shared.seek(0); shared.write(struct.pack(HDR, 0x3150444A, 1, seq, 1, int(time.time() * 1000)))
    for p in j: shared.write(struct.pack('<ffff', *p))
    seq += 1; shared.seek(8); shared.write(struct.pack('<I', seq)); shared.flush()

# ---------- HTTP ----------
async def pair(req):
    code = ''.join(c for c in req.query.get('code', '') if c.isalnum())
    if not code: return web.json_response({'ok': False, 'error': 'brak kodu'}, status=400)
    err = []
    async with ClientSession(timeout=ClientTimeout(total=6)) as s:
        for b in JD:
            for path in (f'/session/v2/pairing-info?code={code}', f'/v1/session/pairing-info?code={code}'):
                try:
                    async with s.get(b + path, headers={'Accept': 'application/json'}) as r:
                        t = await r.text()
                        if r.status == 200:
                            try: data = json.loads(t)
                            except Exception: data = {'raw': t}
                            print('[PAIR]', code, '->', b, len(t), 'B'); return web.json_response({'ok': True, 'server': b, 'data': data})
                        err.append(f'{b}{path.split("?")[0]} HTTP {r.status}')
                except Exception as e: err.append(f'{b}: {type(e).__name__}')
    return web.json_response({'ok': False, 'error': '; '.join(err)}, status=502)

async def ws(req):
    w = web.WebSocketResponse(heartbeat=10); await w.prepare(req); print('[TEL] połączony', req.remote)
    async for m in w:
        if m.type != WSMsgType.TEXT: continue
        try: d = json.loads(m.data)
        except Exception: continue
        t = d.get('t')
        if t == 'key': await asyncio.to_thread(press, d.get('k', ''))
        elif t == 'hand': write_pose(d.get('x', 0), d.get('y', 0), d.get('z', 0))
    print('[TEL] rozłączony'); return w

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try: s.connect(('1.1.1.1', 80)); return s.getsockname()[0]
    except Exception: return '127.0.0.1'
    finally: s.close()

def ctx():
    c, k = BASE / 'phone_server_cert.pem', BASE / 'phone_server_key.pem'   # ten sam cert co LegacySensor (Safari już mu ufa)
    if not (c.exists() and k.exists()):
        sys.exit('Brak phone_server_cert.pem - uruchom najpierw phone_server.py raz, albo skopiuj certyfikat.')
    x = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); x.load_cert_chain(c, k); return x

async def main():
    open_shared()
    app = web.Application(); app.router.add_get('/api/pair', pair); app.router.add_get('/motion-ws', ws)
    app.router.add_get('/', lambda r: web.HTTPFound('/motion.html')); app.router.add_static('/', BASE)
    r = web.AppRunner(app); await r.setup(); await web.TCPSite(r, '0.0.0.0', PORT, ssl_context=ctx()).start()
    print(f'\n=== JD MOTION BRIDGE ===\nOtwórz na telefonie: https://{lan_ip()}:{PORT}/motion.html\nCtrl+C aby zakończyć.\n')
    while True: await asyncio.sleep(3600)

if __name__ == '__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
