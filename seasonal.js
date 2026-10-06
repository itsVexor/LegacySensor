/* Legacy Sensor - seasonal events.
   Halloween: October 1-31.  Christmas: December 1-31.  Every year, decided by the device date.
   Outside those dates this file does nothing and the normal UI is shown.

   Safety rules (camera / tracking / FPS must never suffer):
   - one lightweight canvas, capped at 30 FPS, sprites pre-rendered, paused when the tab is hidden
   - while the camera is running (tracking) everything switches to "calm": no canvas, no animation
   - frame-time governor: slow device -> fewer particles -> particles off
   - prefers-reduced-motion -> static decoration only
   - pointer-events:none everywhere, nothing is ever placed over buttons it could block
   Preview any time:  ?season=halloween  ?season=christmas  ?season=off                                */
(function () {
  'use strict';
  if (window.LegacySeasonal) return;
  try { run(); } catch (e) { try { console.warn('[seasonal] disabled:', e); } catch (_) {} }

  function run() {
    var doc = document, root = doc.documentElement;
    var script = doc.currentScript;
    var BASE = (script && script.src ? script.src : location.href).replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
    var AS = BASE + 'assets/seasonal/';

    var SEASONS = {
      halloween: { emoji: '\uD83C\uDF83', name: 'Halloween Event', until: 'October 31',
        bg: AS + 'halloween-bg.jpg', bgPhone: AS + 'halloween-bg-phone.jpg',
        bulbs: ['#ff8a1f', '#a560ff', '#b6ff3c', '#ff8a1f', '#ff4fb0'], wire: '#241046' },
      christmas: { emoji: '\uD83C\uDF84', name: 'Winter Event', until: 'December 31',
        bg: AS + 'christmas-bg.jpg', bgPhone: AS + 'christmas-bg-phone.jpg',
        bulbs: ['#ff3b4e', '#ffd23c', '#2bd96b', '#35c4ff', '#ff4fd0'], wire: '#0b4d27' }
    };

    var LS = {
      get: function (k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
    };
    var isApp = !!doc.getElementById('tab-sensor');            // the phone WebApp
    var isSite = !isApp && !!doc.querySelector('.topbar');      // the website
    if (!isApp && !isSite) return;
    var PROFILE = isApp ? 'app' : 'site';
    var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    /* ------------------------------------------------------------------ date logic */
    function seasonOfDate(d) { var m = d.getMonth(); return m === 9 ? 'halloween' : (m === 11 ? 'christmas' : null); }
    function queryOverride() {
      try { var q = (new URLSearchParams(location.search).get('season') || '').toLowerCase(); return q || null; } catch (_) { return null; }
    }
    function eventToday() {                       // which event exists today (ignores the user's switch)
      var q = queryOverride();
      if (q === 'off') return null;
      if (q === 'halloween' || q === 'christmas') return q;
      return seasonOfDate(new Date());
    }
    function userOff() { return LS.get('ls_season_off') === '1'; }

    /* ------------------------------------------------------------------ state */
    var S = { season: null, on: false, calm: false, raf: 0, last: 0, parts: [], sparks: [], bats: 0, dead: false,
              W: 0, H: 0, dc: 1, ctx: null, canvas: null, fx: null, bgEl: null, sprites: {}, ema: 0, slow: 0, target: 0,
              frames: 0, lastFrames: 0, fps: 0, batTimer: 0, resizeT: 0, cut: 0 };

    /* ------------------------------------------------------------------ helpers */
    function el(tag, cls, parent) { var e = doc.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[(Math.random() * a.length) | 0]; }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function isPortrait() { return window.matchMedia ? window.matchMedia('(max-aspect-ratio: 1/1)').matches : (innerHeight >= innerWidth); }

    /* ------------------------------------------------------------------ start / stop */
    function start(season) {
      if (S.on || S.dead) return;
      var cfg = SEASONS[season]; if (!cfg) return;
      S.season = season; S.on = true;
      root.classList.add('ls-' + PROFILE);
      root.classList.add('ls-' + season);
      root.style.setProperty('--ls-bg-land', 'url("' + cfg.bg + '")');
      root.style.setProperty('--ls-bg-port', 'url("' + cfg.bgPhone + '")');
      root.style.setProperty('--ls-bg-dark', 'url("' + (isPortrait() ? cfg.bgPhone : cfg.bg) + '")');
      root.classList.add('ls-on');

      if (isApp && !S.bgEl) { S.bgEl = el('div'); S.bgEl.id = 'ls-bg'; doc.body.insertBefore(S.bgEl, doc.body.firstChild); }
      S.fx = el('div'); S.fx.id = 'ls-fx'; S.fx.setAttribute('aria-hidden', 'true'); doc.body.appendChild(S.fx);

      // fade in only after the picture is decoded (no flash of a half-loaded background)
      var img = new Image(), shown = false;
      function reveal() { if (shown || !S.on) return; shown = true; requestAnimationFrame(function () { root.classList.add('ls-show'); }); }
      img.onload = reveal; img.onerror = reveal;
      img.src = isPortrait() ? cfg.bgPhone : cfg.bg;
      setTimeout(reveal, 2500);

      buildAll();
      watchers(true);
      scheduleBat(7000);
      maybeToast();
    }

    function stop(instant) {
      if (!S.on) return;
      S.on = false;
      cancelAnimationFrame(S.raf); S.raf = 0; clearTimeout(S.batTimer);
      watchers(false);
      root.classList.remove('ls-show');
      var done = function () {
        ['ls-on', 'ls-halloween', 'ls-christmas', 'ls-app', 'ls-site', 'ls-calm', 'ls-show'].forEach(function (c) { root.classList.remove(c); });
        ['--ls-bg-land', '--ls-bg-port', '--ls-bg-dark'].forEach(function (p) { root.style.removeProperty(p); });
        if (S.fx && S.fx.parentNode) S.fx.parentNode.removeChild(S.fx);
        if (S.bgEl && S.bgEl.parentNode) S.bgEl.parentNode.removeChild(S.bgEl);
        S.fx = S.bgEl = S.canvas = S.ctx = null; S.parts = []; S.sparks = []; S.season = null;
      };
      if (instant) done(); else setTimeout(done, 1300);
    }

    /* ------------------------------------------------------------------ layout (garland + canvas) */
    function topOffset() {
      if (isSite) { var tb = doc.querySelector('.topbar'); if (tb) { var r = tb.getBoundingClientRect(); return Math.max(0, Math.round(r.bottom)); } }
      return 0;
    }

    function buildAll() {
      if (!S.fx) return;
      S.fx.innerHTML = '';
      S.W = innerWidth; S.H = innerHeight;
      S.dc = Math.min(window.devicePixelRatio || 1, 1.5);
      buildCanvas();
      buildGarland();
      loadSprites(function () { if (S.on) { populate(); kick(); } });
      applyCalm();
    }

    function buildCanvas() {
      var c = el('canvas', '', S.fx);
      c.width = Math.round(S.W * S.dc); c.height = Math.round(S.H * S.dc);
      S.canvas = c; S.ctx = c.getContext('2d');
    }

    function buildGarland() {
      var cfg = SEASONS[S.season], W = S.W, big = W >= 900;
      var top = topOffset();
      var g = el('div', 'ls-garland', S.fx);
      g.style.setProperty('--ls-top', top + 'px');
      if (isApp) g.style.top = 'env(safe-area-inset-top, 0px)';
      var swags = clamp(Math.round(W / (big ? 120 : 98)), 4, 16);
      var sw = W / swags;
      var sag = big ? 15 : 6, drop = big ? 3 : 2;
      var bw = big ? 11 : 8, bh = big ? 15 : 11, gl = big ? 38 : 26;
      var per = Math.max(3, Math.round(sw / (big ? 30 : 23)));
      var NS = 'http://www.w3.org/2000/svg';
      var svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', 40);
      svg.setAttribute('viewBox', '0 0 ' + W + ' 40');
      var path = doc.createElementNS(NS, 'path'), d = '';
      var y0 = 2, bulbs = [];
      for (var i = 0; i < swags; i++) {
        var x0 = i * sw, x1 = x0 + sw, cx = x0 + sw / 2, cy = y0 + sag * 2;
        d += (i ? ' ' : '') + 'M' + x0.toFixed(1) + ' ' + y0 + 'Q' + cx.toFixed(1) + ' ' + cy + ' ' + x1.toFixed(1) + ' ' + y0;
        for (var k = 0; k < per; k++) {
          var t = (k + 0.5) / per, u = 1 - t;
          var px = u * u * x0 + 2 * u * t * cx + t * t * x1;
          var py = u * u * y0 + 2 * u * t * cy + t * t * y0;
          bulbs.push({ x: px, y: py + drop, i: i * per + k, slope: (2 * u * (cy - y0) + 2 * t * (y0 - cy)) / sw });
        }
      }
      path.setAttribute('d', d); path.setAttribute('fill', 'none');
      path.setAttribute('stroke', cfg.wire); path.setAttribute('stroke-width', big ? 2 : 1.5); path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path); g.appendChild(svg);

      var sets = [el('div', 'ls-gset ls-ga', g), el('div', 'ls-gset ls-gb', g), el('div', 'ls-gset ls-gc', g)];
      bulbs.forEach(function (b, n) {
        var col = cfg.bulbs[n % cfg.bulbs.length];
        var glow = el('div', 'ls-gl', sets[n % 3]); glow.style.cssText = 'left:' + b.x.toFixed(1) + 'px;top:' + (b.y + bh * .55).toFixed(1) + 'px;--c:' + col + ';--g:' + gl + 'px';
        var bulb = el('div', 'ls-b', g); bulb.style.cssText = 'left:' + b.x.toFixed(1) + 'px;top:' + b.y.toFixed(1) + 'px;--c:' + col + ';--bw:' + bw + 'px;--bh:' + bh + 'px;transform:rotate(' + (b.slope * 8).toFixed(1) + 'deg)';
      });

      // charming extras: lanterns / baubles hanging between the lights (desktop: more, phone: a few small ones)
      var hang = (S.season === 'halloween') ? ['pumpkin.svg'] : ['ornament-red.svg', 'ornament-gold.svg', 'ornament-blue.svg'];
      var every = big ? 5 : 6, hw = big ? 24 : (S.season === 'halloween' ? 15 : 11);
      bulbs.forEach(function (b, n) {
        if (n % every !== every - 2) return;
        var im = el('img', 'ls-hang sw', g); im.alt = ''; im.src = AS + hang[(n / every | 0) % hang.length];
        // phone: the lantern/bauble replaces a bulb inside the garland band (never hangs over the page title)
        var ty = big ? (b.y + bh * .5) : (b.y - 1);
        im.style.cssText = 'left:' + b.x.toFixed(1) + 'px;top:' + ty.toFixed(1) + 'px;--hw:' + hw + 'px;animation-delay:' + (-(n % 5) * 0.9).toFixed(1) + 's';
      });

      // desktop only: spiders dangling from the garland on the Halloween event, at the free page edges
      if (S.season === 'halloween' && big) {
        [0.025, 0.972].forEach(function (fx, n) {
          var sp = el('div', 'ls-spider', g); sp.style.cssText = 'left:' + (W * fx).toFixed(0) + 'px;top:' + (sag * 1.2) + 'px;--th:' + (46 + n * 22) + 'px';
          el('i', '', sp); var im = el('img', '', sp); im.alt = ''; im.src = AS + 'spider.svg'; im.style.animationDelay = (-n * 1.7) + 's';
        });
      }
    }

    /* ------------------------------------------------------------------ sprites + particles */
    var SPRITE_FILES = {
      halloween: ['leaf-orange', 'leaf-red', 'leaf-gold', 'ember'],
      christmas: ['snowflake-a', 'snowflake-b', 'snowflake-c', 'sparkle']
    };
    function loadSprites(cb) {
      var names = SPRITE_FILES[S.season], left = names.length, season = S.season;
      names.forEach(function (n) {
        var key = season + n;
        if (S.sprites[key]) { if (--left === 0) cb(); return; }
        var im = new Image();
        im.onload = im.onerror = function () { S.sprites[key] = im.naturalWidth ? im : null; if (--left === 0) cb(); };
        im.src = AS + n + '.svg';
      });
    }
    // pre-render each sprite once per size class: drawImage of a small canvas is far cheaper than re-rasterising an SVG
    var sizeCache = {};
    function spriteAt(name, size) {
      var key = S.season + name, im = S.sprites[key]; if (!im) return null;
      var px = Math.max(4, Math.round(size * S.dc)), ck = key + '@' + px;
      if (sizeCache[ck]) return sizeCache[ck];
      var c = doc.createElement('canvas'); c.width = c.height = px;
      try { c.getContext('2d').drawImage(im, 0, 0, px, px); } catch (_) { return null; }
      return (sizeCache[ck] = c);
    }

    function targetCount() {
      var area = S.W * S.H, perPx = isApp ? 9500 : 15000;
      return clamp(Math.round(area / perPx), 14, 70) - S.cut;
    }
    function populate() {
      S.parts = []; S.sparks = [];
      var n = Math.max(10, targetCount()); S.target = n;
      for (var i = 0; i < n; i++) S.parts.push(makeP(true));
      if (S.season === 'christmas') for (var j = 0; j < (isApp ? 6 : 10); j++) S.sparks.push(makeSpark(true));
    }

    function makeP(initial) {
      var halloween = S.season === 'halloween', W = S.W, H = S.H, p = {};
      var layer = Math.random();                       // 0 far .. 1 near
      if (halloween) {
        var ember = Math.random() < 0.22;
        p.name = ember ? 'ember' : pick(['leaf-orange', 'leaf-red', 'leaf-gold']);
        p.sz = ember ? rnd(8, 16) : rnd(15, 15 + 17 * (0.4 + layer * 0.6));
        p.vy = ember ? -rnd(14, 34) : rnd(32, 58) * (0.7 + layer * 0.6);
        p.amp = ember ? rnd(6, 16) : rnd(26, 52); p.fr = rnd(0.8, 1.7);
        p.vr = ember ? 0 : rnd(-1.6, 1.6); p.a = ember ? rnd(.5, .95) : rnd(.72, .96);
        p.flip = !ember; p.ember = ember;
      } else {
        p.name = pick(['snowflake-a', 'snowflake-b', 'snowflake-c']);
        p.sz = rnd(8, 8 + 18 * (0.2 + layer * 0.8));
        p.vy = rnd(26, 52) * (0.6 + layer * 0.9);
        p.amp = rnd(10, 26); p.fr = rnd(0.7, 1.5);
        p.vr = rnd(-0.7, 0.7); p.a = 0.5 + layer * 0.45;
        p.flip = false;
      }
      p.x = rnd(0, W); p.y = initial ? rnd(-20, H) : (p.ember ? H + p.sz : -p.sz * 2);
      p.ph = rnd(0, 6.28); p.rot = rnd(0, 6.28); p.fl = rnd(0, 6.28);
      p.spr = spriteAt(p.name, p.sz);
      return p;
    }
    function makeSpark(initial) {
      return { x: rnd(0, S.W), y: rnd(S.H * 0.05, S.H * 0.9), t: initial ? rnd(0, 2.6) : 0, life: rnd(1.6, 3.2), sz: rnd(10, 20), spr: null };
    }

    /* ------------------------------------------------------------------ main loop */
    function loop(ts) {
      if (!S.on || S.calm || doc.hidden || !S.ctx) { S.raf = 0; return; }   // nothing scheduled while calm / hidden
      S.raf = requestAnimationFrame(loop);
      if (ts - S.last < 31) return;                    // 30 FPS cap
      var dt = Math.min((ts - S.last) / 1000, 0.1); S.last = ts;
      var t0 = performance.now(), ctx = S.ctx, dc = S.dc, W = S.W, H = S.H, wind = Math.sin(ts / 6800) * 9;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S.canvas.width, S.canvas.height);
      var ps = S.parts, i, p;
      for (i = 0; i < ps.length; i++) {
        p = ps[i];
        p.ph += p.fr * dt; p.rot += p.vr * dt; p.fl += 2.1 * dt;
        p.y += p.vy * dt; p.x += (Math.sin(p.ph) * p.amp + wind) * dt;
        if (p.ember) { p.a = 0.45 + 0.45 * Math.abs(Math.sin(p.ph * 1.7)); if (p.y < -p.sz) { ps[i] = p = makeP(false); } }
        else if (p.y > H + p.sz * 1.2) { ps[i] = p = makeP(false); }
        if (p.x < -40) p.x = W + 30; else if (p.x > W + 40) p.x = -30;
        if (!p.spr) continue;
        var c = Math.cos(p.rot) * dc, s = Math.sin(p.rot) * dc, f = p.flip ? Math.cos(p.fl) : 1;
        ctx.globalAlpha = p.a;
        ctx.setTransform(c, s, -s * f, c * f, p.x * dc, p.y * dc);
        ctx.drawImage(p.spr, -p.sz / 2, -p.sz / 2, p.sz, p.sz);
      }
      var sp = S.sparks;
      for (i = 0; i < sp.length; i++) {
        var k = sp[i]; k.t += dt;
        if (k.t > k.life) { sp[i] = k = makeSpark(false); }
        if (!k.spr) k.spr = spriteAt('sparkle', k.sz);
        if (!k.spr) continue;
        var e = Math.sin(Math.PI * (k.t / k.life)); ctx.globalAlpha = e * e * 0.95;
        var sc = 0.55 + 0.45 * e;
        ctx.setTransform(sc * dc, 0, 0, sc * dc, k.x * dc, k.y * dc);
        ctx.drawImage(k.spr, -k.sz / 2, -k.sz / 2, k.sz, k.sz);
      }
      ctx.globalAlpha = 1;
      governor(performance.now() - t0, dt);
    }

    // frame-time governor: measured on the device, reacts within a couple of seconds
    function governor(work, dt) {
      S.ema = S.ema ? S.ema * 0.9 + work * 0.1 : work;
      S.frames++;
      S.slow += (S.ema > (isApp ? 3.2 : 4.5) || dt > 0.058) ? dt : -dt * 0.5;
      if (S.slow < 0) S.slow = 0;
      if (S.slow > 2.2) {
        S.slow = 0;
        if (S.parts.length > 14) { S.cut += Math.ceil(S.parts.length * 0.3); S.parts.length = Math.max(12, Math.floor(S.parts.length * 0.7)); }
        else { setCalm(true, 'device-too-slow'); }
      }
    }

    /* ------------------------------------------------------------------ calm mode (tracking etc.) */
    function kick() { if (S.on && !S.raf && !S.calm && !doc.hidden && S.ctx) { S.last = 0; S.raf = requestAnimationFrame(loop); } }
    function setCalm(v, why) {
      v = !!v; if (S.calm === v && !why) return;
      S.calm = v; if (why) S.slowOff = true; applyCalm();
    }
    function applyCalm() {
      var calm = S.calm || mqReduce.matches;
      root.classList.toggle('ls-calm', !!calm);
      if (calm && S.ctx) S.ctx.clearRect(0, 0, S.canvas.width, S.canvas.height);
      if (!calm) kick();
    }

    function trackingRunning() {
      try { return typeof stream !== 'undefined' && !!stream && stream.active !== false; } catch (_) { return false; }
    }

    /* ------------------------------------------------------------------ bats flying across (Halloween) */
    function scheduleBat(ms) {
      clearTimeout(S.batTimer);
      S.batTimer = setTimeout(function () {
        if (S.on && S.season === 'halloween' && !S.calm && !doc.hidden && S.fx && !mqReduce.matches) {
          var b = el('div', 'ls-bat', S.fx), top = topOffset();
          var dur = rnd(9, 13);
          b.style.cssText = '--y:' + (top + rnd(2, 34)).toFixed(0) + 'px;--d:' + dur.toFixed(1) + 's;--dy:' + rnd(-24, 24).toFixed(0) + 'px;width:' + (isApp ? 30 : 38) + 'px';
          var im = el('img', '', b); im.alt = ''; im.src = AS + 'bat.svg';
          setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, dur * 1000 + 400);
        }
        if (S.on) scheduleBat(rnd(26000, 52000));
      }, ms);
    }

    /* ------------------------------------------------------------------ toast + settings switch */
    function maybeToast() {
      var cfg = SEASONS[S.season], key = 'ls_toast_' + S.season + '_' + new Date().getFullYear();
      var preview = queryOverride();
      if (!preview) { if (LS.get(key) === '1') return; LS.set(key, '1'); }
      setTimeout(function () {
        if (!S.on || !S.fx) return;
        var t = el('div', 'ls-toast', S.fx);
        if (isSite) t.style.setProperty('--ls-toast-b', '18px');
        t.innerHTML = '<span>' + cfg.emoji + ' <b>' + cfg.name + ' is live!</b> Decorations are on until ' + cfg.until + '.</span>';
        var btn = el('button', '', t); btn.type = 'button'; btn.textContent = 'Turn off';
        btn.onclick = function () { setUserOn(false); };
        requestAnimationFrame(function () { t.classList.add('in'); });
        setTimeout(function () { t.classList.remove('in'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 600); }, 7500);
      }, 1800);
    }

    function injectSettingsRow(season) {
      if (!isApp || doc.getElementById('lsSettings')) return;
      var host = doc.getElementById('tab-settings'); if (!host) return;
      var cfg = SEASONS[season];
      var panel = el('div', 'panel ls-set', host); panel.id = 'lsSettings';
      panel.innerHTML = '<div class="ls-set-row"><div><b>' + cfg.emoji + ' ' + cfg.name + '</b><span>Event background and decorations \u00B7 until ' + cfg.until +
        '. Switched off automatically while the camera is running.</span></div><button type="button" class="ls-sw" role="switch" aria-label="Seasonal event"></button></div>';
      var sw = panel.querySelector('.ls-sw');
      function paint() { sw.setAttribute('aria-checked', userOff() ? 'false' : 'true'); }
      paint();
      sw.onclick = function () { setUserOn(userOff()); paint(); };
    }

    function setUserOn(on) {
      LS.set('ls_season_off', on ? '0' : '1');
      var ev = eventToday();
      if (on && ev) start(ev); else stop(false);
      var sw = doc.querySelector('#lsSettings .ls-sw'); if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
    }

    /* ------------------------------------------------------------------ watchers */
    var poll = 0, dayT = 0, poll2 = null, clickStart = null;
    function pollOnce() { if (poll2) poll2(); }
    function onResize() {
      clearTimeout(S.resizeT);
      S.resizeT = setTimeout(function () { if (S.on && Math.abs(innerWidth - S.W) + Math.abs(innerHeight - S.H) > 2) { S.cut = 0; sizeCache = {}; buildAll(); } }, 250);
    }
    function onVis() { if (!doc.hidden) kick(); }
    function watchers(on) {
      if (on) {
        window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize);
        doc.addEventListener('visibilitychange', onVis);
        var st = doc.getElementById('start');
        if (st) { clickStart = function () { setTimeout(pollOnce, 150); setTimeout(pollOnce, 700); setTimeout(pollOnce, 1800); }; st.addEventListener('click', clickStart); }
        poll = setInterval(pollOnce, 400);
        /* (kept for readability below) */
        poll2 = function () {
          if (!S.on) return;
          if (S.slowOff || S.forcedCalm) return;
          var t = trackingRunning(); if (t !== S.calm) { S.calm = t; applyCalm(); }
        };
        if (mqReduce.addEventListener) mqReduce.addEventListener('change', applyCalm);
      } else {
        window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize);
        doc.removeEventListener('visibilitychange', onVis); clearInterval(poll); var st2 = doc.getElementById('start'); if (st2 && clickStart) st2.removeEventListener('click', clickStart);
      }
    }

    /* ------------------------------------------------------------------ boot */
    function boot() {
      var ev = eventToday();
      if (ev) injectSettingsRow(ev);
      if (ev && !userOff()) start(ev);
      // the event can start/end while the page is open (midnight on the 1st): re-check every 20 minutes
      dayT = setInterval(function () {
        var now = eventToday();
        if (now && !userOff()) { if (!S.on) start(now); else if (S.season !== now) { stop(true); start(now); } }
        else if (S.on) stop(false);
      }, 20 * 60 * 1000);
    }

    window.LegacySeasonal = {
      version: '1.6.0',
      seasonOfDate: seasonOfDate,
      get season() { return S.on ? S.season : null; },
      get calm() { return S.calm; },
      setCalm: function (v) { S.forcedCalm = !!v; S.calm = !!v; applyCalm(); },
      enable: function () { setUserOn(true); },
      disable: function () { setUserOn(false); },
      _debug: function () { return { on: S.on, season: S.season, particles: S.parts.length, target: S.target, cut: S.cut, emaMs: +S.ema.toFixed(3), calm: S.calm, W: S.W, H: S.H, dc: S.dc, raf: !!S.raf }; }
    };

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  }
})();
