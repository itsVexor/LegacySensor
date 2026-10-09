# Legacy Sensor Phone Sensor v1.5.0 BETA  (+ multi-phone slots, step 1)
import asyncio, json, mmap, os, secrets, socket, ssl, struct, subprocess, threading, time, ipaddress
from datetime import datetime, timedelta
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse



def _portable_shared_mmap(name, size):
    """Windows named mmap; Linux file-backed mmap in /dev/shm (fallback /tmp)."""
    if os.name == "nt":
        return mmap.mmap(-1, size, tagname=name)
    import re
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(name)).strip("_") or "LegacySensor"
    root = "/dev/shm" if os.path.isdir("/dev/shm") and os.access("/dev/shm", os.W_OK) else "/tmp"
    path = os.path.join(root, safe + ".mmap")
    fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        os.ftruncate(fd, size)
        mm = mmap.mmap(fd, size, access=mmap.ACCESS_WRITE)
    finally:
        os.close(fd)
    return mm

SHARED_NAME = r"Local\LegacyWebcamKinectPose"
MAGIC = 0x3150444A
VERSION = 1
JOINT_COUNT = 20
HEADER_FMT = '<IIIIQ'
JOINT_FMT = '<ffff'
SHARED_SIZE = struct.calcsize(HEADER_FMT) + JOINT_COUNT * struct.calcsize(JOINT_FMT)

# Coach-selection bridge. This is deliberately separate from the pose map:
# the phone scoring conversion in Kinect10.dll recenters the pose around Hip,
# so a pre-conversion X translation would be cancelled out. The old Legacy
# Sensor coach-slot behavior is therefore sent as a tiny side-channel and
# applied AFTER the phone pose has been converted to Kinect sensor space.
COACH_SHARED_NAME = r"Local\LegacyWebcamKinectCoachX"
COACH_MAGIC = 0x3143584A
COACH_VERSION = 1
COACH_HEADER_FMT = "<IIIIfQ"  # magic, version, seq, enabled, x, timestampMs
COACH_SHARED_SIZE = struct.calcsize(COACH_HEADER_FMT)

# Image bridge: lets Kinect10.dll draw the yellow player-silhouette outline
# in the game's camera preview, exactly like the webcam path already does.
# Same shared-memory contract as LegacySensor_v1_5_0_BETA_PHONE_SENSOR.py's
# SharedImageWriter - duplicated here (not imported) so this module stays a
# standalone drop-in, the same pattern already used for PhoneSharedWriter.
IMAGE_SHARED_NAME = r"Local\LegacyWebcamKinectImage"
IMAGE_MAGIC = 0x31494D4A
IMAGE_VERSION = 1
IMAGE_W = 640
IMAGE_H = 480
MASK_W = 320
MASK_H = 240
IMAGE_HEADER_FMT = "<IIIIIIQ"  # magic, version, seq, tracked, width, height, timestampMs
IMAGE_HEADER_SIZE = struct.calcsize(IMAGE_HEADER_FMT)
IMAGE_BGRA_SIZE = IMAGE_W * IMAGE_H * 4
IMAGE_MASK_SIZE = MASK_W * MASK_H
IMAGE_SHARED_SIZE = IMAGE_HEADER_SIZE + IMAGE_BGRA_SIZE + IMAGE_MASK_SIZE


def _flip_mask_horizontal(mask320):
    # Phone WebApp preview is mirrored for the player. The Kinect10 image
    # stream consumes the shared mask in the opposite horizontal orientation,
    # so flip ONLY the visual mask here. Pose/world landmarks stay untouched.
    if mask320 is None:
        return None
    try:
        import numpy as np
        arr = np.frombuffer(mask320, dtype=np.uint8).reshape(MASK_H, MASK_W)
        return np.ascontiguousarray(arr[:, ::-1]).tobytes()
    except Exception:
        return mask320


class PhoneImageWriter:
    """Writes an (empty) BGRA frame + a 320x240 player mask so Kinect10.dll's
    existing FillFromWebcam()/SnapshotImage() path has something to read.

    Phone Sensor mode does not need to send the real camera picture back to
    the PC (the phone is the camera), so the BGRA plane is always kept
    black; only the mask (the actual silhouette shape) matters for the
    in-game preview.
    """

    def __init__(self):
        self.mm = _portable_shared_mmap(IMAGE_SHARED_NAME, IMAGE_SHARED_SIZE)
        self.seq = 0
        self.lock = threading.Lock()
        self._blank_bgra = b"\x00" * IMAGE_BGRA_SIZE
        self.write(None, False)

    def write(self, mask320, tracked, bgra=None):
        with self.lock:
            self.seq += 1
            if not (self.seq & 1):
                self.seq += 1
            ts_ms = int(time.time() * 1000)
            self.mm.seek(0)
            self.mm.write(struct.pack(
                IMAGE_HEADER_FMT,
                IMAGE_MAGIC, IMAGE_VERSION, self.seq,
                1 if tracked else 0,
                IMAGE_W, IMAGE_H, ts_ms
            ))
            if bgra is None:
                self.mm.write(self._blank_bgra)
            else:
                try:
                    import numpy as np
                    arr = np.ascontiguousarray(bgra, dtype=np.uint8)
                    if arr.shape == (IMAGE_H, IMAGE_W, 4):
                        self.mm.write(arr.tobytes())
                    else:
                        self.mm.write(self._blank_bgra)
                except Exception:
                    self.mm.write(self._blank_bgra)
            if mask320 is None:
                self.mm.write(b"\x00" * IMAGE_MASK_SIZE)
            else:
                self.mm.write(_flip_mask_horizontal(mask320))
            self.seq += 1
            self.mm.seek(8)
            self.mm.write(struct.pack('<I', self.seq))

    def close(self):
        try:
            self.mm.close()
        except Exception:
            pass



class CoachXWriter:
    """Publishes the Legacy coach-slot X offset in Kinect-space metres."""
    def __init__(self):
        self.mm = _portable_shared_mmap(COACH_SHARED_NAME, COACH_SHARED_SIZE)
        self.seq = 0
        self.lock = threading.Lock()
        self.write(0.0, False)

    def write(self, x, enabled=True):
        with self.lock:
            self.seq += 1
            if not (self.seq & 1):
                self.seq += 1
            self.mm.seek(0)
            self.mm.write(struct.pack(
                COACH_HEADER_FMT,
                COACH_MAGIC, COACH_VERSION, self.seq,
                1 if enabled else 0, float(x), int(time.time()*1000)
            ))
            self.seq += 1
            self.mm.seek(8)
            self.mm.write(struct.pack('<I', self.seq))

    def close(self):
        try:
            self.mm.close()
        except Exception:
            pass


# V10.7/V9.3 coach-slot settings retained from the older Legacy Sensor path.
COACH_CFG = {
    "camera_x_slot_tracking": True,
    "camera_x_reverse_for_coach_selection": True,
    "camera_x_range_m": 2.20,
    "camera_x_deadzone": 0.025,
    "camera_x_smoothing": 0.42,
    "coach_assist_enabled": True,
    "coach_assist_multiplier": 1.35,
    "coach_assist_max_m": 1.35,
    "slot_snap_enabled": True,
    "slot_snap_gain": 1.35,
    "slot_snap_deadzone": 0.06,
}


class CameraSpaceXTracker:
    """Exact old coach-slot X behavior, adapted to WebApp norm dictionaries."""
    LEFT_HIP = 23
    RIGHT_HIP = 24

    def __init__(self, cfg=None):
        self.cfg = dict(COACH_CFG if cfg is None else cfg)
        self.offset = 0.0
        self.valid = False

    def reset(self):
        self.offset = 0.0
        self.valid = False

    def update(self, norm):
        if norm is None or not self.cfg.get("camera_x_slot_tracking", True):
            return 0.0
        try:
            cam_x = (
                float(norm[self.LEFT_HIP].get("x", 0.5)) +
                float(norm[self.RIGHT_HIP].get("x", 0.5))
            ) * 0.5
        except Exception:
            return self.offset if self.valid else 0.0

        if self.cfg.get("camera_x_reverse_for_coach_selection", True):
            centered = 0.5 - cam_x
        else:
            centered = cam_x - 0.5

        dz = float(self.cfg.get("camera_x_deadzone", 0.025))
        if abs(centered) < dz:
            centered = 0.0
        else:
            centered = (abs(centered) - dz) * (1.0 if centered > 0 else -1.0)

        target = centered * float(self.cfg.get("camera_x_range_m", 2.20))

        if self.cfg.get("coach_assist_enabled", True):
            target *= float(self.cfg.get("coach_assist_multiplier", 1.35))
            max_m = float(self.cfg.get("coach_assist_max_m", 1.35))
            target = max(-max_m, min(max_m, target))

        alpha = max(0.05, min(1.0, float(
            self.cfg.get("camera_x_smoothing", 0.42)
        )))
        if not self.valid:
            self.offset = target
            self.valid = True
        else:
            self.offset = self.offset * (1.0 - alpha) + target * alpha
        return self.offset

# ---------------------------------------------------------------------------
# Multi-phone support (experimental). Each phone gets a slot (0..N-1).
# Slot 0 keeps feeding the proven V1 maps exactly as before; the V2 maps
# (same layout the PC camera 2-player mode uses) are only created once a
# SECOND phone joins, so single-phone use is unchanged.
# ---------------------------------------------------------------------------
MAX_PHONE_PLAYERS = 2          # V2 map / Kinect10 V10.7 currently carry 2 bodies
SLOT_TIMEOUT = 2.5             # seconds without poses -> slot counts as not connected
SLOT_FREE_AFTER = 30.0         # seconds of silence before a slot can be given away
MULTI_SHARED_NAME = r"Local\LegacyWebcamKinectPoseV2"
MULTI_MAGIC = 0x3250444A
MULTI_VERSION = 2
MULTI_SHARED_SIZE = struct.calcsize(HEADER_FMT) + MAX_PHONE_PLAYERS * JOINT_COUNT * struct.calcsize(JOINT_FMT)
MULTI_IMAGE_SHARED_NAME = r"Local\LegacyWebcamKinectImageV2"
MULTI_IMAGE_MAGIC = 0x32494D4A
MULTI_IMAGE_VERSION = 2


class PhoneMultiPoseWriter:
    """Same layout as SharedMultiWriter in the main app (V2 pose map)."""
    def __init__(self):
        self.mm = _portable_shared_mmap(MULTI_SHARED_NAME, MULTI_SHARED_SIZE)
        self.seq = 0
        self.lock = threading.Lock()
        self.write([None] * MAX_PHONE_PLAYERS)

    def write(self, players):
        with self.lock:
            bodies = list(players[:MAX_PHONE_PLAYERS])
            while len(bodies) < MAX_PHONE_PLAYERS:
                bodies.append(None)
            tracked_mask = sum((1 << i) for i, j in enumerate(bodies) if j is not None)
            self.seq += 1
            if not (self.seq & 1):
                self.seq += 1
            self.mm.seek(0)
            self.mm.write(struct.pack(HEADER_FMT, MULTI_MAGIC, MULTI_VERSION, self.seq,
                                      tracked_mask, int(time.time() * 1000)))
            for joints in bodies:
                if joints is None:
                    for _ in range(JOINT_COUNT):
                        self.mm.write(struct.pack(JOINT_FMT, 0, 0, 0, 0))
                else:
                    for joint in joints[:JOINT_COUNT]:
                        self.mm.write(struct.pack(JOINT_FMT, *joint))
            self.seq += 1
            self.mm.seek(8)
            self.mm.write(struct.pack('<I', self.seq))

    def close(self):
        try: self.mm.close()
        except Exception: pass


class PhoneMultiImageWriter:
    """V2 image map: black BGRA + byte-valued player-index mask (0 = none, 1 = P1, 2 = P2)."""
    def __init__(self):
        self.mm = _portable_shared_mmap(MULTI_IMAGE_SHARED_NAME, IMAGE_SHARED_SIZE)
        self.seq = 0
        self.lock = threading.Lock()
        self.write(None, None, 0)

    def write(self, bgra, index_mask320, tracked_mask):
        with self.lock:
            self.seq += 1
            if not (self.seq & 1):
                self.seq += 1
            self.mm.seek(0)
            self.mm.write(struct.pack(IMAGE_HEADER_FMT, MULTI_IMAGE_MAGIC, MULTI_IMAGE_VERSION, self.seq,
                                      int(tracked_mask) & 0x3, IMAGE_W, IMAGE_H, int(time.time() * 1000)))
            ok = False
            if bgra is not None:
                try:
                    import numpy as np
                    arr = np.ascontiguousarray(bgra, dtype=np.uint8)
                    if arr.shape == (IMAGE_H, IMAGE_W, 4):
                        self.mm.write(arr.tobytes()); ok = True
                except Exception:
                    pass
            if not ok:
                self.mm.write(b"\x00" * IMAGE_BGRA_SIZE)
            self.mm.write(index_mask320 if index_mask320 is not None else b"\x00" * IMAGE_MASK_SIZE)
            self.seq += 1
            self.mm.seek(8)
            self.mm.write(struct.pack('<I', self.seq))

    def close(self):
        try: self.mm.close()
        except Exception: pass


def _clean_nick(nick):
    nick = ''.join(ch for ch in str(nick or '') if ch.isprintable()).strip()
    return nick[:16] or 'Player'


def _find_tailscale_ip():
    """Tailscale IPv4 of this PC (100.64.0.0/10) or None. Override with LEGACY_PUBLIC_IP."""
    forced = os.environ.get('LEGACY_PUBLIC_IP', '').strip()
    cands = []
    if forced:
        cands.append(forced)
    for exe in ('tailscale', r'C:\Program Files\Tailscale\tailscale.exe', '/usr/bin/tailscale', '/usr/local/bin/tailscale'):
        try:
            out = subprocess.run([exe, 'ip', '-4'], capture_output=True, text=True, timeout=3).stdout
            cands += out.split()
            if out.strip():
                break
        except Exception:
            continue
    net = ipaddress.ip_network('100.64.0.0/10')
    for c in cands:
        try:
            a = ipaddress.ip_address(c.strip())
            if forced and c == forced:
                return str(a)
            if a in net:
                return str(a)
        except Exception:
            continue
    return None


def _decode_frame(frame_b64):
    """Base64 JPEG/PNG from the iPhone -> fixed 640x480 BGRA frame."""
    if not frame_b64:
        return None
    try:
        import base64
        import numpy as np
        import cv2
        raw=base64.b64decode(frame_b64)
        arr=np.frombuffer(raw,dtype=np.uint8)
        bgr=cv2.imdecode(arr,cv2.IMREAD_COLOR)
        if bgr is None:
            return None
        if bgr.shape[1] != IMAGE_W or bgr.shape[0] != IMAGE_H:
            bgr=cv2.resize(bgr,(IMAGE_W,IMAGE_H),interpolation=cv2.INTER_LINEAR)
        return cv2.cvtColor(bgr,cv2.COLOR_BGR2BGRA)
    except Exception as e:
        print('[PHONE SENSOR] frame decode warning:',e)
        return None

def _decode_mask(mask_b64, mask_w, mask_h):
    """Base64 -> raw 320x240x1 bytes matching MASK_W x MASK_H, or None."""
    if not mask_b64:
        return None
    try:
        import base64
        raw = base64.b64decode(mask_b64)
        if int(mask_w) == MASK_W and int(mask_h) == MASK_H and len(raw) == IMAGE_MASK_SIZE:
            return raw
        # Defensive resize path in case the phone ever sends a different
        # resolution (e.g. a future WebApp build) - avoid corrupting the
        # shared memory layout, which Kinect10.dll assumes is fixed-size.
        import numpy as np
        arr = np.frombuffer(raw, dtype=np.uint8).reshape(int(mask_h), int(mask_w))
        if arr.shape != (MASK_H, MASK_W):
            try:
                import cv2
                arr = cv2.resize(arr, (MASK_W, MASK_H), interpolation=cv2.INTER_NEAREST)
            except Exception:
                return None
        return arr.tobytes()
    except Exception as e:
        print('[PHONE SENSOR] mask decode warning:', e)
        return None

class PhoneSharedWriter:
    def __init__(self):
        self.mm = _portable_shared_mmap(SHARED_NAME, SHARED_SIZE)
        self.seq = 0
        self.lock = threading.Lock()
        self.write(None)
    def write(self, joints):
        with self.lock:
            tracked = 1 if joints is not None else 0
            self.seq += 1
            if not (self.seq & 1): self.seq += 1
            self.mm.seek(0)
            self.mm.write(struct.pack(HEADER_FMT, MAGIC, VERSION, self.seq, tracked, int(time.time()*1000)))
            if joints is None:
                joints = [(0.0,0.0,0.0,0.0)] * JOINT_COUNT
            for j in joints[:JOINT_COUNT]:
                self.mm.write(struct.pack(JOINT_FMT, *j))
            self.seq += 1
            self.mm.seek(8)
            self.mm.write(struct.pack('<I', self.seq))
    def close(self):
        try: self.mm.close()
        except Exception: pass

def _avg(a,b): return tuple((a[i]+b[i])*0.5 for i in range(4))
def _lerp(a,b,t): return tuple(a[i]+(b[i]-a[i])*t for i in range(4))

def _raw_kinect(world, norm):
    if not isinstance(world,list) or not isinstance(norm,list) or len(world)<33 or len(norm)<33: return None
    def p(i):
        w=world[i]; n=norm[i]
        c=min(float(n.get('visibility',1)), float(n.get('presence',1)))
        return (float(w[0]),float(w[1]),float(w[2]),max(0,min(1,c)))
    lh,rh,ls,rs=p(23),p(24),p(11),p(12)
    hip=_avg(lh,rh); sh=_avg(ls,rs); spine=_lerp(hip,sh,.52)
    ear=_avg(p(7),p(8)); nose=p(0)
    head=((ear[0]+nose[0])*.5,(ear[1]+nose[1])*.5,(ear[2]+nose[2])*.5,min(ear[3],nose[3]))
    return [hip,spine,sh,head,ls,p(13),p(15),p(19),rs,p(14),p(16),p(20),lh,p(25),p(27),p(31),rh,p(26),p(28),p(32)]

WEBAPP_REMOTE_URL = os.environ.get('LEGACY_WEBAPP_URL', 'https://itsvexor.github.io/LegacySensor/webapp.html').strip()
if WEBAPP_REMOTE_URL.lower() == 'local':
    WEBAPP_REMOTE_URL = ''


class PhoneSensorService:
    def __init__(self, web_root):
        self.web_root = os.path.abspath(web_root)
        self.writer = PhoneSharedWriter()
        self.image_writer = PhoneImageWriter()
        self.coach_writer = CoachXWriter()
        self.coach_tracker = CameraSpaceXTracker()
        self.httpd = None
        self.ws_loop = None
        self.ws_server = None
        self.http_thread = None
        self.ws_thread = None
        self.client_count = 0
        self.last_joints = None
        self.last_norm = None    # raw iPhone landmarks (for motion menu)
        self.last_world = None
        self.last_bgra = None
        self.last_fps = 0.0
        self._count = 0
        self._last_fps_t = time.perf_counter()
        self.last_seen = 0.0
        self.last_transport = ''
        self.lock = threading.RLock()
        self.slots = [self._empty_slot() for _ in range(MAX_PHONE_PLAYERS)]
        self.multi_writer = None
        self.multi_image_writer = None
        self._multi_alive_mask = 0
        self.tailscale_ip = None
        self.remote_url = None
        self._stopped = threading.Event()
        self._started = False
        self.ip = self._get_ip()
        self.http_port = 8766
        self.ws_port = 8765
        self.cert = os.path.join(self.web_root,'phone_cert.pem')
        self.key = os.path.join(self.web_root,'phone_key.pem')

    # ---- multi-phone slots -------------------------------------------------
    @staticmethod
    def _empty_slot():
        return {'token': None, 'nick': '', 'joined_at': 0.0, 'last_seen': 0.0,
                'joints': None, 'norm': None, 'world': None, 'mask': None}

    def _slot_alive(self, i, now=None):
        now = time.perf_counter() if now is None else now
        s = self.slots[i]
        return s['joints'] is not None and (now - s['last_seen']) < SLOT_TIMEOUT

    def join(self, nick='', token=None):
        """Give a phone a slot. Returns (slot, token) or (None, error)."""
        nick = _clean_nick(nick)
        with self.lock:
            now = time.perf_counter()
            if token:
                for i, s in enumerate(self.slots):
                    if s['token'] == token:
                        s['nick'] = nick
                        return i, token
            for i, s in enumerate(self.slots):
                idle = now - max(s['last_seen'], s['joined_at'])
                if s['token'] is None or idle > SLOT_FREE_AFTER:
                    self.slots[i] = self._empty_slot()
                    self.slots[i].update({'token': secrets.token_hex(8), 'nick': nick, 'joined_at': now})
                    if i >= 1:
                        self._ensure_multi()
                    print(f'[PHONE SENSOR] {nick} joined as Player {i+1}')
                    return i, self.slots[i]['token']
        return None, 'lobby full'

    def players_summary(self):
        with self.lock:
            now = time.perf_counter()
            return [{'slot': i, 'player': i + 1, 'nick': s['nick'],
                     'joined': s['token'] is not None, 'connected': self._slot_alive(i, now)}
                    for i, s in enumerate(self.slots)]

    def _ensure_multi(self):
        if self.multi_writer is not None:
            return
        try:
            self.multi_writer = PhoneMultiPoseWriter()
            self.multi_image_writer = PhoneMultiImageWriter()
            print('[PHONE SENSOR] 2nd phone joined: V2 multi-player maps enabled')
        except Exception as e:
            self.multi_writer = None; self.multi_image_writer = None
            print('[PHONE SENSOR] could not create V2 maps:', e)

    def _write_multi(self):
        """Caller holds self.lock. Writes both slots to the V2 pose + image maps."""
        if self.multi_writer is None:
            return
        now = time.perf_counter()
        bodies, alive = [], 0
        label = None
        try:
            import numpy as np
            label = np.zeros((MASK_H, MASK_W), dtype=np.uint8)
        except Exception:
            pass
        for i, s in enumerate(self.slots):
            if self._slot_alive(i, now):
                bodies.append(s['joints']); alive |= (1 << i)
                if label is not None and s['mask'] is not None and len(s['mask']) == IMAGE_MASK_SIZE:
                    m = np.frombuffer(s['mask'], dtype=np.uint8).reshape(MASK_H, MASK_W)
                    label[m > 0] = i + 1
            else:
                bodies.append(None)
        self._multi_alive_mask = alive
        self.multi_writer.write(bodies)
        if self.multi_image_writer is not None:
            self.multi_image_writer.write(self.last_bgra, label.tobytes() if label is not None else None, alive)

    def _reaper_loop(self):
        while not self._stopped.is_set():
            time.sleep(0.5)
            try:
                with self.lock:
                    if self.multi_writer is None:
                        continue
                    now = time.perf_counter()
                    alive = sum((1 << i) for i in range(len(self.slots)) if self._slot_alive(i, now))
                    if alive != self._multi_alive_mask:
                        self._write_multi()
            except Exception as e:
                print('[PHONE SENSOR] reaper warning:', e)

    def _handle_pose(self, data, transport, bound_token=None):
        """One pose packet from any phone (HTTP or WSS). Raises ValueError on bad input."""
        token = data.get('token') or bound_token
        idx = 0
        if token:
            with self.lock:
                idx = next((i for i, s in enumerate(self.slots) if s['token'] == token), None)
            if idx is None:
                raise ValueError('unknown token - rejoin')
        joints = _raw_kinect(data.get('world'), data.get('norm'))
        if not joints:
            raise ValueError('invalid pose')
        mask = _decode_mask(data.get('mask'), data.get('maskW', MASK_W), data.get('maskH', MASK_H))
        frame = _decode_frame(data.get('frame')) if idx == 0 else None
        with self.lock:
            now = time.perf_counter()
            s = self.slots[idx]
            s.update({'joints': joints, 'norm': data.get('norm'), 'world': data.get('world'),
                      'mask': mask, 'last_seen': now})
            if idx == 0:
                coach_x = self.coach_tracker.update(data.get('norm'))
                self.coach_writer.write(coach_x, True)
                self.last_joints = joints; self.last_norm = data.get('norm'); self.last_world = data.get('world')
                self.writer.write(joints)
                if frame is not None:
                    self.last_bgra = frame
                self.image_writer.write(mask, True, self.last_bgra)
            self.last_seen = now
            self.last_transport = transport
            if transport == 'HTTP':
                self.client_count = max(self.client_count, 1)
            self._count += 1
            if now - self._last_fps_t >= 1:
                self.last_fps = self._count / (now - self._last_fps_t); self._count = 0; self._last_fps_t = now
            self._write_multi()

    @staticmethod
    def _get_ip():
        s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8',80)); return s.getsockname()[0]
        except Exception: return '127.0.0.1'
        finally: s.close()

    def _ensure_cert(self):
        if os.path.exists(self.cert) and os.path.exists(self.key):
            if not self.tailscale_ip: return
            try:
                from cryptography import x509
                c0 = x509.load_pem_x509_certificate(Path(self.cert).read_bytes())
                san = c0.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
                if ipaddress.ip_address(self.tailscale_ip) in san.get_values_for_type(x509.IPAddress): return
            except Exception:
                pass  # cannot verify -> regenerate below
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
        k=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,self.ip)])
        c=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(k.public_key())
           .serial_number(x509.random_serial_number()).not_valid_before(datetime.utcnow()-timedelta(minutes=1))
           .not_valid_after(datetime.utcnow()+timedelta(days=30))
           .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.IPAddress(ipaddress.ip_address(self.ip))]+([x509.IPAddress(ipaddress.ip_address(self.tailscale_ip))] if self.tailscale_ip and self.tailscale_ip!=self.ip else [])),critical=False)
           .sign(k,hashes.SHA256()))
        Path(self.cert).write_bytes(c.public_bytes(Encoding.PEM))
        Path(self.key).write_bytes(k.private_bytes(Encoding.PEM,PrivateFormat.TraditionalOpenSSL,NoEncryption()))

    def start(self):
        if self._started:
            return getattr(self, 'phone_service_url', f'https://{self.ip}:{self.http_port}/webapp.html')
        self._stopped.clear()
        self.tailscale_ip = _find_tailscale_ip()
        self._ensure_cert()
        self.http_thread=threading.Thread(target=self._http_loop,daemon=True); self.http_thread.start()
        self.ws_thread=threading.Thread(target=self._ws_loop_thread,daemon=True); self.ws_thread.start()
        self.phone_service_url = f'https://{self.ip}:{self.http_port}/webapp.html?bridge={self.ip}&bridgePort={self.ws_port}&httpPort={self.http_port}&return=https%3A%2F%2Fitsvexor.github.io%2FLegacySensor%2F'
        if self.tailscale_ip:
            tip = self.tailscale_ip
            self.remote_url = f'https://{tip}:{self.http_port}/webapp.html?bridge={tip}&bridgePort={self.ws_port}&httpPort={self.http_port}&return=https%3A%2F%2Fitsvexor.github.io%2FLegacySensor%2F'
            print('[PHONE SENSOR] Tailscale link for friends (they need Tailscale):', self.remote_url)
        threading.Thread(target=self._reaper_loop, daemon=True).start()
        self._started = True
        return self.phone_service_url

    def _http_loop(self):
        os.chdir(self.web_root)
        service=self
        class Handler(SimpleHTTPRequestHandler):
            def log_message(self,*args): pass
            def _json(self, code, obj):
                raw=json.dumps(obj).encode('utf-8')
                self.send_response(code); self.send_header('Content-Type','application/json')
                self.send_header('Access-Control-Allow-Origin','*')
                self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
                self.send_header('Access-Control-Allow-Headers','Content-Type, Cache-Control, Pragma, Accept'); self.send_header('Access-Control-Allow-Private-Network','true'); self.send_header('Access-Control-Max-Age','600')
                self.send_header('Content-Length',str(len(raw))); self.send_header('Cache-Control','no-store')
                self.end_headers(); self.wfile.write(raw)
            def do_OPTIONS(self):
                self.send_response(204); self.send_header('Access-Control-Allow-Origin','*')
                self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
                self.send_header('Access-Control-Allow-Headers','Content-Type, Cache-Control, Pragma, Accept'); self.send_header('Access-Control-Allow-Private-Network','true'); self.send_header('Access-Control-Max-Age','600')
                self.end_headers()
            def do_GET(self):
                _route=self.path.split('?',1)[0]
                if WEBAPP_REMOTE_URL and _route in ('/', '/webapp.html'):
                    # The QR still opens the PC first (so Safari accepts the bridge
                    # certificate), then instantly forwards to the NEWEST web app on
                    # GitHub Pages with the same bridge parameters. No stale local copy.
                    page=("<!doctype html><html><head><meta charset='utf-8'>"
                          "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                          "<meta name='theme-color' content='#101014'><title>Legacy Sensor</title></head>"
                          "<body style='margin:0;background:#101014;color:#fff;font:16px system-ui,sans-serif;"
                          "display:grid;place-items:center;min-height:100vh'><div>Opening Legacy Sensor...</div>"
                          "<script>var q=location.search||'';q+=(q?'&':'?')+'_cb='+Date.now();"
                          "location.replace("+json.dumps(WEBAPP_REMOTE_URL)+"+q);</script></body></html>").encode('utf-8')
                    self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8')
                    self.send_header('Content-Length',str(len(page))); self.send_header('Cache-Control','no-store')
                    self.end_headers(); self.wfile.write(page)
                    return
                if _route in ('/status','/ping'):
                    alive=(time.perf_counter()-service.last_seen) < 2.5
                    self._json(200, {'ok':True,'connected':alive,'fps':service.last_fps,'port':service.http_port,'transport':service.last_transport,'players':service.players_summary(),'max':MAX_PHONE_PLAYERS})
                    return
                if _route == '/lobby':
                    self._json(200, {'ok':True,'players':service.players_summary(),'max':MAX_PHONE_PLAYERS})
                    return
                return super().do_GET()
            def do_POST(self):
                _route=self.path.split('?',1)[0]
                if _route not in ('/pose','/join'):
                    self.send_error(404); return
                try:
                    n=int(self.headers.get('Content-Length','0')); raw=self.rfile.read(n)
                    data=json.loads(raw.decode('utf-8') or '{}')
                    if _route == '/join':
                        slot, tok = service.join(data.get('nick'), data.get('token'))
                        if slot is None:
                            self._json(200, {'ok':False,'error':tok}); return
                        self._json(200, {'ok':True,'slot':slot,'player':slot+1,'token':tok,'nick':service.slots[slot]['nick'],'max':MAX_PHONE_PLAYERS}); return
                    service._handle_pose(data, 'HTTP')
                    self._json(200, {'ok':True})
                except Exception as e:
                    self._json(400, {'ok':False,'error':str(e)})
        self.httpd=ThreadingHTTPServer(('0.0.0.0',self.http_port),Handler)
        ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(self.cert,self.key)
        self.httpd.socket=ctx.wrap_socket(self.httpd.socket,server_side=True)
        self.httpd.serve_forever()

    def _ws_loop_thread(self):
        asyncio.run(self._ws_main())

    async def _ws_main(self):
        import websockets
        self.ws_loop=asyncio.get_running_loop()
        ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(self.cert,self.key)
        async with websockets.serve(self._ws_handler,'0.0.0.0',self.ws_port,max_size=4*2**20,ping_interval=10,ping_timeout=10,ssl=ctx):
            # The test WebApp currently opens WSS on port 8765.
            while not self._stopped.is_set(): await asyncio.sleep(.25)

    async def _ws_handler(self, websocket):
        self.client_count += 1
        self.last_seen = time.perf_counter()
        print('[PHONE SENSOR] Phone connected:', websocket.remote_address)
        bound_token=None
        try:
            async for msg in websocket:
                try:
                    data=json.loads(msg.decode('utf-8') if isinstance(msg,(bytes,bytearray)) else msg)
                    if data.get('type')=='join':
                        slot, tok = self.join(data.get('nick'), data.get('token'))
                        if slot is None:
                            await websocket.send(json.dumps({'type':'joined','ok':False,'error':tok}))
                        else:
                            bound_token=tok
                            await websocket.send(json.dumps({'type':'joined','ok':True,'slot':slot,'player':slot+1,'token':tok}))
                        continue
                    if data.get('type')!='pose': continue
                    self._handle_pose(data, 'WSS', bound_token)
                except Exception as e:
                    print('[PHONE SENSOR] pose warning:',e)
        except Exception as e:
            print('[PHONE SENSOR] disconnected:',e)
        finally:
            self.client_count=max(0,self.client_count-1)
            if bound_token:
                with self.lock:
                    for i,sl in enumerate(self.slots):
                        if sl['token']==bound_token:
                            sl['joints']=None; sl['mask']=None; sl['last_seen']=0.0
                    self._write_multi()
            if self.client_count==0:
                self.last_joints=None; self.last_norm=None; self.last_world=None; self.last_bgra=None; self.writer.write(None)
                self.coach_tracker.reset(); self.coach_writer.write(0.0, False)
                self.image_writer.write(None, False)
            print('[PHONE SENSOR] Phone disconnected')

    def stop(self):
        self._stopped.set()
        self._started = False
        try:
            if self.httpd: self.httpd.shutdown()
        except Exception: pass
        try: self.writer.write(None); self.writer.close()
        except Exception: pass
        try: self.image_writer.write(None, False); self.image_writer.close()
        except Exception: pass
        try: self.coach_writer.write(0.0, False); self.coach_writer.close()
        except Exception: pass
        for _w in (self.multi_writer, self.multi_image_writer):
            try:
                if _w: _w.close()
            except Exception: pass
        self.multi_writer = None; self.multi_image_writer = None
