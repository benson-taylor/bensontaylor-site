// BT-OS — bensontaylor.com
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mobile = matchMedia('(max-width: 820px)');

  function store(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---------- Windows ---------- */

  var wins = Array.prototype.slice.call(document.querySelectorAll('.win'));
  var z = 100;

  function place(win) {
    if (win._placed || mobile.matches) return;
    var pos = (win.dataset.pos || '20,15').split(',').map(Number);
    var w = Math.min(+win.dataset.w || 600, innerWidth - 40);
    win.style.width = w + 'px';
    var x = Math.round((innerWidth - w) * pos[0] / 60);
    var barH = document.querySelector('.menubar').offsetHeight;
    var y = Math.round(barH + 14 + (innerHeight - barH - 260) * pos[1] / 100);
    win.style.left = Math.max(10, Math.min(x, innerWidth - w - 10)) + 'px';
    win.style.top = Math.max(barH + 10, y) + 'px';
    win._placed = true;
  }

  function focus(win) {
    wins.forEach(function (w) { w.classList.toggle('active', w === win); });
    win.style.zIndex = ++z;
  }

  function syncIcons() {
    document.querySelectorAll('.mb-menu a').forEach(function (a) {
      var w = document.getElementById(a.dataset.open);
      a.classList.toggle('here', !!(w && w.classList.contains('open') && w.classList.contains('active')));
    });
    document.querySelectorAll('.icon').forEach(function (b) {
      var w = document.getElementById(b.dataset.open), on = !!(w && w.classList.contains('open'));
      b.classList.toggle('is-open', on);
      // Open windows show their icon darkened, the way the Finder did.
      var img = b.querySelector('img');
      if (!img.dataset.src) img.dataset.src = img.getAttribute('src');
      img.src = on ? img.dataset.sel : img.dataset.src;
    });
  }

  // Classic Mac "zoom rects": outlines stepping from where you clicked to the window.
  function zoomRects(from, to) {
    if (reduced || !from) return;
    var a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    for (var i = 1; i <= 5; i++) {
      (function (i) {
        setTimeout(function () {
          var t = i / 6, r = document.createElement('div');
          r.style.cssText = 'position:fixed;z-index:950;pointer-events:none;border:2px dashed #000;' +
            'left:' + (a.left + (b.left - a.left) * t) + 'px;top:' + (a.top + (b.top - a.top) * t) + 'px;' +
            'width:' + (a.width + (b.width - a.width) * t) + 'px;height:' + (a.height + (b.height - a.height) * t) + 'px';
          document.body.appendChild(r);
          setTimeout(function () { r.remove(); }, 90);
        }, i * 28);
      })(i);
    }
  }

  function open(id, from, quiet) {
    var win = document.getElementById(id);
    if (!win || !win.classList.contains('win')) return;
    if (mobile.matches) wins.forEach(function (w) { if (w !== win) w.classList.remove('open'); });
    var wasOpen = win.classList.contains('open');
    place(win);
    win.classList.add('open');
    focus(win);
    if (!wasOpen) {
      zoomRects(from, win);
      win.classList.remove('win-in'); void win.offsetWidth; win.classList.add('win-in');
      if (id === 'about') revealPortrait(win);
      if (id === 'work') requestAnimationFrame(initPosters);
      if (id === 'music') requestAnimationFrame(function () { drawWave(); fetchWave(); });
      pulse();
    }
    if (!quiet && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    syncIcons();
    if (typeof updateMini === 'function') updateMini();
  }

  function close(win) {
    win.classList.remove('open', 'active');
    var top = wins.filter(function (w) { return w.classList.contains('open'); })
      .sort(function (a, b) { return b.style.zIndex - a.style.zIndex; })[0];
    if (top) focus(top);
    history.replaceState(null, '', top ? '#' + top.id : location.pathname);
    syncIcons();
    if (typeof updateMini === 'function') updateMini();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open]');
    if (t) { e.preventDefault(); open(t.dataset.open, t); return; }
    var c = e.target.closest('.win-close');
    if (c && c.closest('.win')) close(c.closest('.win'));
  });
  wins.forEach(function (win) { win.addEventListener('pointerdown', function () { focus(win); }); });

  // Click anywhere outside a window to close what's open (menu, icons, players keep their own jobs).
  document.addEventListener('click', function (e) {
    if (root.classList.contains('booting')) return;
    if (e.target.closest('.win, [data-open], .menubar, .np, .mini, .icons, a, button')) return;
    var openWins = wins.filter(function (w) { return w.classList.contains('open'); });
    if (!openWins.length) return;
    openWins.forEach(function (w) { w.classList.remove('open', 'active'); });
    history.replaceState(null, '', location.pathname);
    syncIcons();
    if (typeof updateMini === 'function') updateMini();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var top = wins.filter(function (w) { return w.classList.contains('active') && w.classList.contains('open'); })[0];
    if (top) close(top);
  });

  // Drag by the title bar (desktop only).
  wins.forEach(function (win) {
    var bar = win.querySelector('.win-bar');
    bar.addEventListener('pointerdown', function (e) {
      if (mobile.matches || e.target.closest('.win-close')) return;
      var r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
      function move(ev) {
        win.style.left = Math.max(-r.width + 80, Math.min(ev.clientX - dx, innerWidth - 80)) + 'px';
        win.style.top = Math.max(document.querySelector('.menubar').offsetHeight, Math.min(ev.clientY - dy, innerHeight - 60)) + 'px';
      }
      function up() { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); }
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
  });

  /* ---------- Music: our own player, driven through the SoundCloud widget ---------- */

  var player = document.getElementById('player');
  var engine = document.getElementById('sc-player');
  var trackRows = Array.prototype.slice.call(document.querySelectorAll('.track'));
  var el = function (id) { return document.getElementById(id); };
  var widget = null, ready = false, current = 0, duration = 0, playing = false, pendingPlay = false;

  /* The track's real waveform (SoundCloud's samples), drawn as pixel bars. */
  var waveCache = {}, waveSamples = null, waveProgress = 0, waveHover = -1;
  function drawWave() {
    var cv = el('pl-wave'), box = cv.parentNode, dpr = Math.min(devicePixelRatio || 1, 2);
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    cv.width = w * dpr; cv.height = h * dpr;
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var step = 4, bars = Math.floor(w / step), unit = 2, mid = Math.round(h * 0.62);
    for (var i = 0; i < bars; i++) {
      var v = 0.08;
      if (waveSamples) {
        var a = Math.floor(i / bars * waveSamples.length), b2 = Math.max(a + 1, Math.floor((i + 1) / bars * waveSamples.length)), m = 0;
        for (var k = a; k < b2; k++) m = Math.max(m, waveSamples[k]);
        v = m;
      }
      var up = Math.max(unit, Math.round(v * (mid - 2) / unit) * unit);
      var down = Math.max(unit, Math.round(up * 0.45 / unit) * unit);
      var f = i / bars, played = f <= waveProgress, hovered = waveHover >= 0 && f <= waveHover && !played;
      c.fillStyle = played ? '#ff56cc' : hovered ? '#777' : '#b8b8b8';
      c.fillRect(i * step, mid - up, step - 1, up);
      c.globalAlpha = 0.45;
      c.fillRect(i * step, mid + 1, step - 1, down);
      c.globalAlpha = 1;
    }
  }
  function fetchWave() {
    if (!widget) return;
    widget.getCurrentSound(function (s) {
      if (!s || !s.waveform_url) return;
      var id = s.id;
      if (waveCache[id]) { waveSamples = waveCache[id]; drawWave(); return; }
      fetch(s.waveform_url.replace(/\.png$/, '.json')).then(function (r) { return r.json(); }).then(function (j) {
        var hmax = j.height || Math.max.apply(null, j.samples);
        waveCache[id] = j.samples.map(function (x) { return x / hmax; });
        if (String(id) === trackRows[current].dataset.id) { waveSamples = waveCache[id]; drawWave(); }
      }).catch(function () {});
    });
  }
  el('pl-bar').addEventListener('pointermove', function (e) { var r = this.getBoundingClientRect(); waveHover = (e.clientX - r.left) / r.width; drawWave(); });
  el('pl-bar').addEventListener('pointerleave', function () { waveHover = -1; drawWave(); });
  addEventListener('resize', drawWave);

  function fmtTime(ms) {
    var t = Math.max(0, Math.round(ms / 1000));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }

  function show(i) {
    var r = trackRows[i];
    current = i;
    trackRows.forEach(function (x, k) { x.classList.toggle('current', k === i); x.classList.remove('is-playing'); });
    el('pl-num').textContent = String(i + 1).padStart(2, '0');
    el('pl-title').textContent = r.querySelector('.t').firstChild.textContent.trim();
    el('pl-sub').textContent = r.dataset.group;
    el('pl-art').src = r.dataset.art;
    el('pl-art').parentNode.classList.toggle('logo-art', /\.svg$/.test(r.dataset.art));
    el('mini-art').src = r.dataset.art;
    el('mini-art').parentNode.classList.toggle('logo-art', /\.svg$/.test(r.dataset.art));
    el('mini-title').textContent = el('pl-title').textContent;
    el('mini-fill').style.width = '0%';
    el('pl-fill').style.width = '0%';
    el('pl-time').textContent = '0:00';
    el('pl-dur').textContent = '0:00';
    duration = 0;
    var cached = waveCache[r.dataset.id];
    waveSamples = cached || null; waveProgress = 0; drawWave();
  }

  function setPlaying(on) {
    playing = on;
    player.classList.toggle('playing', on);
    el('mini').classList.toggle('playing', on);
    el('mini-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
    updateMini();
    el('pl-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
    trackRows.forEach(function (x, k) {
      var here = k === current && on;
      x.classList.toggle('is-playing', here);
      x.setAttribute('aria-label', (here ? 'Pause ' : 'Play ') + x.querySelector('.t').firstChild.textContent.trim());
    });
  }

  function load(i, autoplay) {
    show(i);
    if (!ready) { pendingPlay = autoplay; return; }
    widget.load('https://api.soundcloud.com/tracks/' + trackRows[i].dataset.id, {
      auto_play: autoplay, hide_related: true, show_comments: false, visual: false,
      callback: function () { widget.getDuration(function (d) { duration = d; el('pl-dur').textContent = fmtTime(d); }); fetchWave(); }
    });
  }

  function hookWidget() {
    if (widget || !window.SC || !SC.Widget) return;
    widget = SC.Widget(engine);
    var E = SC.Widget.Events;
    widget.bind(E.READY, function () {
      ready = true;
      widget.getDuration(function (d) { duration = d; el('pl-dur').textContent = fmtTime(d); });
      if (pendingPlay) { pendingPlay = false; load(current, true); } else fetchWave();
    });
    widget.bind(E.PLAY, function () {
      setPlaying(true);
      widget.getDuration(function (d) { duration = d; el('pl-dur').textContent = fmtTime(d); });
      if (ytReady) { yt.pauseVideo(); soundBtn.setAttribute('aria-pressed', 'false'); }
      userMuted = true;
      removeEventListener('pointerdown', firstGesture, true);
      removeEventListener('keydown', firstGesture, true);
    });
    widget.bind(E.PAUSE, function () { setPlaying(false); });
    widget.bind(E.FINISH, function () { load((current + 1) % trackRows.length, true); });
    widget.bind(E.PLAY_PROGRESS, function (e) {
      el('mini-fill').style.width = (e.relativePosition * 100).toFixed(2) + '%';
      waveProgress = e.relativePosition; drawWave();
      el('pl-time').textContent = fmtTime(e.currentPosition);
      el('pl-bar').setAttribute('aria-valuenow', Math.round(e.relativePosition * 100));
    });
  }
  engine.addEventListener('load', hookWidget);
  addEventListener('load', hookWidget);

  el('pl-play').addEventListener('click', function () {
    hookWidget();
    if (!ready) { pendingPlay = true; return; }
    widget.toggle();
  });
  el('pl-prev').addEventListener('click', function () { load((current - 1 + trackRows.length) % trackRows.length, true); });
  el('pl-next').addEventListener('click', function () { load((current + 1) % trackRows.length, true); });

  function seek(clientX, bar) {
    if (!ready || !duration) return;
    var r = (bar || el('pl-bar')).getBoundingClientRect();
    var f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    widget.seekTo(f * duration);
    if (!bar) { waveProgress = f; drawWave(); }
  }
  el('pl-bar').addEventListener('pointerdown', function (e) { seek(e.clientX); });
  el('mini-bar').addEventListener('pointerdown', function (e) { seek(e.clientX, el('mini-bar')); });

  // The mini player: visible only while something plays and the Music window is shut.
  var musicWin = document.getElementById('music'), miniOpen = false;
  function updateMini() {
    // Appears when music plays with the window shut; stays (even paused) until its ✕ or the window reopens.
    var show = musicWin.classList.contains('open') ? false : (playing || miniOpen);
    if (show === miniOpen) return;
    miniOpen = show;
    el('mini').hidden = !show;
  }
  el('mini-play').addEventListener('click', function () { if (ready) widget.toggle(); });
  el('mini-prev').addEventListener('click', function () { el('pl-prev').click(); });
  el('mini-next').addEventListener('click', function () { el('pl-next').click(); });
  el('mini-open').addEventListener('click', function () { open('music', el('mini')); });
  el('mini-close').addEventListener('click', function () {
    if (ready) widget.pause();
    miniOpen = false;
    el('mini').hidden = true;
  });
  el('pl-bar').addEventListener('keydown', function (e) {
    if (!ready || !duration) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    widget.getPosition(function (pos) { widget.seekTo(Math.max(0, pos + (e.key === 'ArrowRight' ? 10000 : -10000))); });
  });

  trackRows.forEach(function (r, k) {
    r.addEventListener('click', function (e) {
      hookWidget();
      if (!widget) return; // without the widget the row opens the track on SoundCloud
      e.preventDefault();
      // The playing track's row is its pause button; any other row plays that track.
      if (k === current && ready) { widget.toggle(); return; }
      load(k, true);
      player.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    });
  });
  show(0);

  /* ---------- Desktop icons: drag them anywhere (a click still opens them) ---------- */

  var ICON_KEY = 'bt-icons';
  function loadIconSpots() { try { return JSON.parse(localStorage.getItem(ICON_KEY)) || {}; } catch (e) { return {}; } }
  function saveIconSpots(spots) { try { localStorage.setItem(ICON_KEY, JSON.stringify(spots)); } catch (e) {} }

  function currentShift(li) {
    var m = getComputedStyle(li).transform;
    if (!m || m === 'none') return { x: 0, y: 0 };
    var v = m.match(/matrix\(([^)]+)\)/);
    if (!v) return { x: 0, y: 0 };
    var n = v[1].split(',').map(parseFloat);
    return { x: n[4], y: n[5] };
  }

  function initIcons() {
    if (!finePointer) return; // on phones the icons stay in their grid
    var spots = loadIconSpots();
    document.querySelectorAll('.icons li').forEach(function (li) {
      var btn = li.querySelector('.icon'), id = btn.dataset.open;
      if (spots[id] && !mobile.matches) li.style.transform = 'translate(' + spots[id].x + 'px,' + spots[id].y + 'px)';
      var start = null, moved = false;
      btn.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || mobile.matches) return;
        var shift = currentShift(li), r = li.getBoundingClientRect();
        start = { px: e.clientX, py: e.clientY, x: shift.x, y: shift.y, left: r.left, top: r.top, w: r.width, h: r.height };
        moved = false;
        btn.setPointerCapture(e.pointerId);
      });
      btn.addEventListener('pointermove', function (e) {
        if (!start) return;
        var dx = e.clientX - start.px, dy = e.clientY - start.py;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
        li.classList.add('dragging');
        // Keep the icon on screen and below the menu bar.
        var bar = document.querySelector('.menubar').offsetHeight;
        dx = Math.max(-start.left + 4, Math.min(dx, innerWidth - start.left - start.w - 4));
        dy = Math.max(-start.top + bar + 4, Math.min(dy, innerHeight - start.top - start.h - 4));
        li.style.transform = 'translate(' + (start.x + dx) + 'px,' + (start.y + dy) + 'px)';
      });
      function end() {
        if (!start) return;
        if (moved) {
          var shift = currentShift(li);
          spots[id] = { x: Math.round(shift.x), y: Math.round(shift.y) };
          saveIconSpots(spots);
          li.classList.remove('dragging');
        }
        start = null;
      }
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', end);
      // A drag isn't a click: don't open the window when you let go.
      btn.addEventListener('click', function (e) {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);
    });
  }
  initIcons();

  /* ---------- Posters: pixelated, and they sharpen when you roll over them ---------- */

  var POSTER_BLOCKS = [14, 9, 6, 4, 2];

  function pixelate(canvas, img, block) {
    var w = canvas.width = canvas.clientWidth, h = canvas.height = canvas.clientHeight;
    if (!w || !h || !img.naturalWidth) return;
    var tmp = document.createElement('canvas'), tx = tmp.getContext('2d');
    tmp.width = Math.max(1, Math.ceil(w / block)); tmp.height = Math.max(1, Math.ceil(h / block));
    // Cover-fit, like the <img> underneath.
    var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var sw = w / s, sh = h / s, sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
    tx.drawImage(img, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
    var c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(tmp, 0, 0, tmp.width * block, tmp.height * block);
  }

  function animatePoster(fig, sharpen) {
    var img = fig.querySelector('img'), cv = fig.querySelector('canvas');
    clearTimeout(fig._t);
    if (reduced) { fig.classList.toggle('sharp', sharpen); if (!sharpen) pixelate(cv, img, POSTER_BLOCKS[0]); return; }
    var steps = sharpen ? POSTER_BLOCKS.slice(1) : POSTER_BLOCKS.slice().reverse();
    if (!sharpen) fig.classList.remove('sharp');
    (function step(k) {
      if (k >= steps.length) { if (sharpen) fig.classList.add('sharp'); return; }
      pixelate(cv, img, steps[k]);
      fig._t = setTimeout(function () { step(k + 1); }, 45);
    })(0);
  }

  function initPosters() {
    document.querySelectorAll('.posters .poster').forEach(function (fig) {
      if (fig._px) return;
      var box = fig.querySelector('.poster-img'), img = box.querySelector('img');
      if (fig.classList.contains('is-card')) return; // title cards stay crisp
      var cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      box.appendChild(cv);
      fig._px = true;
      function draw() { pixelate(cv, img, POSTER_BLOCKS[0]); }
      if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, { once: true });
      fig.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') animatePoster(fig, true); });
      fig.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') animatePoster(fig, false); });
      fig.addEventListener('click', function () { animatePoster(fig, !fig.classList.contains('sharp')); });
    });
  }

  /* ---------- About: the photo is pixelated; the cursor reveals the real picture underneath ---------- */

  var PORTRAIT_BLOCK = 14, REVEAL_R = 120;

  function revealPortrait(win) {
    var fig = win.querySelector('.portrait'), img = fig.querySelector('img'), cv = fig.querySelector('canvas');
    var c2 = cv.getContext('2d'), base = document.createElement('canvas'), bx = base.getContext('2d');
    var W2 = 0, H2 = 0, dpr = 1, at = null;

    function pixels(block, ctx) {
      var tmp = document.createElement('canvas'), tx = tmp.getContext('2d');
      tmp.width = Math.ceil(W2 / block); tmp.height = Math.ceil(H2 / block);
      tx.drawImage(img, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, tmp.width * block, tmp.height * block);
    }

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W2 = fig.clientWidth; H2 = fig.clientHeight;
      cv.width = base.width = W2 * dpr; cv.height = base.height = H2 * dpr;
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pixels(PORTRAIT_BLOCK, bx);
    }

    function paint() {
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.drawImage(base, 0, 0);
      if (!at) return;
      // A circle built from whole pixel blocks, so its edge stays pixelated.
      var b = PORTRAIT_BLOCK, r = Math.min(REVEAL_R, W2 * 0.3);
      c2.save();
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2.beginPath();
      var x0 = Math.floor((at.x - r) / b), x1 = Math.ceil((at.x + r) / b);
      var y0 = Math.floor((at.y - r) / b), y1 = Math.ceil((at.y + r) / b);
      for (var gx = x0; gx < x1; gx++) {
        for (var gy = y0; gy < y1; gy++) {
          var cx = gx * b + b / 2, cy = gy * b + b / 2;
          if ((cx - at.x) * (cx - at.x) + (cy - at.y) * (cy - at.y) <= r * r) c2.rect(gx * b, gy * b, b, b);
        }
      }
      c2.clip();
      c2.imageSmoothingEnabled = true;
      c2.drawImage(img, 0, 0, W2, H2);
      c2.restore();
    }

    function run() {
      size();
      if (reduced) { paint(); return; }
      // Arrive chunky, settle at the resting pixel size.
      var steps = [56, 40, 28, 20, PORTRAIT_BLOCK], k = 0;
      (function step() {
        c2.setTransform(dpr, 0, 0, dpr, 0, 0);
        pixels(steps[k], c2);
        if (++k < steps.length) fig._t = setTimeout(step, 80); else paint();
      })();
    }

    if (!fig._hooked) {
      fig._hooked = true;
      function move(e) { var r = cv.getBoundingClientRect(); at = { x: e.clientX - r.left, y: e.clientY - r.top }; paint(); }
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerdown', move);
      cv.addEventListener('pointerleave', function () { at = null; paint(); });
      cv.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') { at = null; paint(); } });
      addEventListener('resize', function () { if (win.classList.contains('open')) { size(); paint(); } });
    }
    if (img.complete && img.naturalWidth) run(); else img.addEventListener('load', run, { once: true });
  }

  /* ---------- Background: the photo as a stirring grid of pixels ----------
     The same idea as alvvays.com: 100 square cells across the photo, each one a
     flat block of the photo's colour. The grid is slowly stirred by overlapping
     waves and pushed around by the mouse, and it springs back like jelly.
     Settings match theirs: grid 100, stir disorder 10, strength 3, frequency 35,
     elasticity 35, mouse sensitivity 6. */

  var GRID = 100, STIR_FREQ = 35, STIR_DISORDER = 10, STIR_STRENGTH = 3, ELASTICITY = 35, MOUSE_SENS = 6;
  var bg = document.getElementById('bg'), ctx = bg.getContext('2d');
  var photo = new Image();
  photo.src = 'assets/img/benson-taylor-1536.jpeg';
  var srcC = document.createElement('canvas'), srcX = srcC.getContext('2d', { willReadFrequently: true });
  var outC = document.createElement('canvas'), outX = outC.getContext('2d');
  var W = 0, H = 0, DPR = 1, cols = 0, rows = 0, cell = 10, src = null, out = null;
  var spX, spY, mvX, mvY, counter = 0;
  var mouse = { x: -1, y: -1, px: -1, py: -1, sx: 0, sy: 0, in: false };

  function strip() { return parseInt(getComputedStyle(root).getPropertyValue('--strip'), 10) || 0; }

  function layout() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    bg.width = W * DPR; bg.height = H * DPR;
    if (!photo.naturalWidth) return;

    // Cover the space above the bottom rows, keeping the face in view.
    var h0 = H - strip();
    var s = Math.max(W / photo.naturalWidth, h0 / photo.naturalHeight);
    var cw = photo.naturalWidth * s, ch = photo.naturalHeight * s;
    var x0 = (W - cw) * (mobile.matches ? 0.66 : 0.6), y0 = (h0 - ch) * 0.4;
    cell = cw / GRID;
    cols = Math.ceil(W / cell) + 1;
    rows = Math.ceil(H / cell) + 1;

    // Average the photo down to one colour per cell (halving steps keep it clean).
    var step = document.createElement('canvas'), sx = step.getContext('2d');
    var w = photo.naturalWidth, h = photo.naturalHeight;
    step.width = w; step.height = h; sx.drawImage(photo, 0, 0);
    while (w / 2 > GRID * 1.5) {
      var n = document.createElement('canvas'), nx = n.getContext('2d');
      n.width = Math.round(w / 2); n.height = Math.round(h / 2);
      nx.drawImage(step, 0, 0, n.width, n.height);
      step = n; w = n.width; h = n.height;
    }
    srcC.width = cols; srcC.height = rows;
    srcX.fillStyle = '#000';
    srcX.fillRect(0, 0, cols, rows);
    srcX.imageSmoothingQuality = 'high';
    srcX.drawImage(step, x0 / cell, y0 / cell, cw / cell, ch / cell);
    src = srcX.getImageData(0, 0, cols, rows).data;

    outC.width = cols; outC.height = rows;
    out = outX.createImageData(cols, rows);
    var len = cols * rows;
    spX = new Float32Array(len); spY = new Float32Array(len);
    mvX = new Float32Array(len); mvY = new Float32Array(len);
  }

  function stir() {
    var speed = STIR_FREQ * 0.05, period = STIR_DISORDER * 0.1 + 1, strength = STIR_STRENGTH * 0.001 * 0.25;
    var direction = Math.sin(0.005 * speed * counter), cosd = Math.cos(0.005 * speed * counter);
    for (var x = 0, i = 0; x < cols; x++) {
      for (var y = 0; y < rows; y++, i++) {
        cosd = Math.sin(cosd + (period - 1) * i * 10);
        spX[i] += (Math.sin(counter * 0.003 * speed + (x + cosd * y * 0.5 * period) * 0.1) * cosd +
                   Math.cos(counter * -0.0031 * speed + (x - cosd * y * 0.5 * period) * -0.1 + 0.7) * direction) * strength;
        spY[i] += (Math.sin(counter * 0.0031 * speed + (y - cosd * x * 0.5 * period) * 0.1) * cosd +
                   Math.cos(counter * -0.003 * speed + (y - cosd * x * 0.5 * period) * -0.1 + 0.7) * direction) * strength;
      }
    }
  }

  function push() {
    // Mouse movement pushes the cells under it, strongest in the middle.
    mouse.sx = mouse.sx * 0.6 + (mouse.x - mouse.px) / cell * 0.4;
    mouse.sy = mouse.sy * 0.6 + (mouse.y - mouse.py) / cell * 0.4;
    mouse.px = mouse.x; mouse.py = mouse.y;
    if (!mouse.in || (Math.abs(mouse.sx) < 0.01 && Math.abs(mouse.sy) < 0.01)) return;
    var tol = 4, cx = mouse.x / cell, cy = mouse.y / cell, maxH = Math.SQRT2 * tol;
    for (var x = Math.max(0, Math.floor(cx - tol)); x <= Math.min(cols - 1, Math.ceil(cx + tol)); x++) {
      for (var y = Math.max(0, Math.floor(cy - tol)); y <= Math.min(rows - 1, Math.ceil(cy + tol)); y++) {
        var d = Math.hypot(cx - 0.5 - x, cy - 0.5 - y), k = Math.max(tol - d, 0) / (maxH * 0.5), i = x * rows + y;
        spX[i] += Math.max(-1, Math.min(1, mouse.sx * k * MOUSE_SENS * 0.01));
        spY[i] += Math.max(-1, Math.min(1, mouse.sy * k * MOUSE_SENS * 0.01));
      }
    }
  }

  function kick() {
    // A little shove across the whole grid (used when a window opens).
    if (reduced || !spX) return;
    for (var i = 0; i < spX.length; i++) { spX[i] += (Math.random() - 0.5) * 0.06; spY[i] += (Math.random() - 0.5) * 0.06; }
  }

  function frame() {
    if (!src) return;
    counter++;
    if (!reduced) { stir(); push(); }
    var el = 1 - (ELASTICITY * 0.15) / 100, visc = (1 - ELASTICITY / 100) * 0.5 + 0.49, reach = GRID * 0.5;
    var d = out.data;
    for (var x = 0, i = 0; x < cols; x++) {
      for (var y = 0; y < rows; y++, i++) {
        spX[i] = Math.max(-1, Math.min(1, spX[i] * el));
        spY[i] = Math.max(-1, Math.min(1, spY[i] * el));
        var ax = 0, ay = 0, n = 0;
        if (y + 1 < rows) { ax += mvX[i + 1]; ay += mvY[i + 1]; n++; }
        if (y > 0) { ax += mvX[i - 1]; ay += mvY[i - 1]; n++; }
        if (x + 1 < cols) { ax += mvX[i + rows]; ay += mvY[i + rows]; n++; }
        if (x > 0) { ax += mvX[i - rows]; ay += mvY[i - rows]; n++; }
        mvX[i] = (ax / n) * visc + spX[i] * (1 - visc);
        mvY[i] = (ay / n) * visc + spY[i] * (1 - visc);

        var sx = Math.max(0, Math.min(cols - 1, Math.round(x - mvX[i] * reach)));
        var sy = Math.max(0, Math.min(rows - 1, Math.round(y - mvY[i] * reach)));
        var si = (sy * cols + sx) * 4, oi = (y * cols + x) * 4;
        d[oi] = src[si]; d[oi + 1] = src[si + 1]; d[oi + 2] = src[si + 2]; d[oi + 3] = 255;
      }
    }
    outX.putImageData(out, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(outC, 0, 0, cols * cell, rows * cell);
  }

  addEventListener('pointermove', function (e) {
    if (mouse.x < 0) { mouse.px = e.clientX; mouse.py = e.clientY; }
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true;
  });
  document.addEventListener('pointerleave', function () { mouse.in = false; });

  function loop() {
    requestAnimationFrame(loop);
    if (!document.hidden) frame();
  }
  addEventListener('resize', function () { layout(); frame(); });
  photo.addEventListener('load', function () { layout(); frame(); if (!reduced) requestAnimationFrame(loop); });
  layout();

  function pulse() { kick(); }

  /* ---------- Now playing: the video plays straight away; sound comes on at the first click ---------- */

  var np = document.querySelector('.np'), soundBtn = document.getElementById('np-sound');
  var yt = null, ytReady = false, wantSound = false, userMuted = false;

  function setSound(on) {
    soundBtn.setAttribute('aria-pressed', String(on));
    if (!ytReady) { wantSound = on; return; }
    if (on) { yt.unMute(); yt.setVolume(90); yt.playVideo(); if (widget && playing) widget.pause(); }
    else yt.mute();
  }

  function makePlayer() {
    if (yt || !window.YT || !YT.Player) return;
    yt = new YT.Player('np-player', {
      videoId: 'rpQ9LRvMG9g',
      playerVars: { autoplay: 1, mute: 1, loop: 1, playlist: 'rpQ9LRvMG9g', controls: 0, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: function (e) { ytReady = true; e.target.mute(); e.target.playVideo(); if (wantSound) setSound(true); },
        onStateChange: function (e) { np.classList.toggle('playing', e.data === YT.PlayerState.PLAYING); }
      }
    });
  }
  window.onYouTubeIframeAPIReady = makePlayer;
  makePlayer();

  soundBtn.addEventListener('click', function () {
    var on = soundBtn.getAttribute('aria-pressed') !== 'true';
    userMuted = !on;
    setSound(on);
  });

  // The first click or key press anywhere turns the sound on (browsers allow sound only after one).
  function firstGesture(e) {
    if (e.target.closest && e.target.closest('#np-sound, #player, .track, #mini')) return;
    removeEventListener('pointerdown', firstGesture, true);
    removeEventListener('keydown', firstGesture, true);
    if (!userMuted) setSound(true);
  }
  addEventListener('pointerdown', firstGesture, true);
  addEventListener('keydown', firstGesture, true);

  /* ---------- Boot ---------- */

  function start() {
    var hash = location.hash.slice(1);
    if (hash) open(hash, null, true);
  }

  if (!reduced && !/[?&]skipboot/.test(location.search)) {
    root.classList.add('booting');
    var log = document.getElementById('boot-log'), bootEl = document.getElementById('boot'), li = 0, done = false;
    var finish = function () {
      if (done) return;
      done = true;
      store('bt-booted', '1');
      bootEl.classList.add('out');
      setTimeout(function () { root.classList.remove('booting'); }, 360);
      start();
      setSound(true);
    };
    // A memory dump scrolling up the screen, like a machine printing its contents:
    // hex address, then bytes in binary. The name passes through in pink; one stretch,
    // unmarked, spells out a message in ASCII.
    function ascii(text) { return text.split('').map(function (ch) { return ('0000000' + ch.charCodeAt(0).toString(2)).slice(-8); }); }
    var NAME = ascii('BENSON TAYLOR');
    var HIDDEN = ascii('LEADER OF THE RESISTANCE AGAINST THE MACHINES');
    function startStream() {
      var probe = document.createElement('span');
      probe.textContent = new Array(101).join('0');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      log.appendChild(probe);
      var cw = probe.getBoundingClientRect().width / 100 || 10, lh = probe.getBoundingClientRect().height || 22;
      log.removeChild(probe);
      dumpMetrics = { cw: cw, lh: lh };
      var ADDR = 10; // "0001A3F0  "
      var perRow = Math.max(2, Math.floor(((bootEl.clientWidth - 64) / cw - ADDR + 1) / 9));
      var rowsN = Math.max(8, Math.floor((bootEl.clientHeight - 64) / lh) - 3);

      function chunks(bytes) { var out = []; for (var b = 0; b < bytes.length; b += perRow) out.push(bytes.slice(b, b + perRow)); return out; }
      function randomByte() { return ('0000000' + Math.floor(Math.random() * 256).toString(2)).slice(-8); }
      function randomBytes(n) { var out = []; for (var b = 0; b < n; b++) out.push(randomByte()); return out; }
      var nameRows = chunks(NAME), hiddenRows = chunks(HIDDEN);

      // What comes next in the stream: mostly noise, the name every so often, the message now and then.
      var queue = [], sinceName = 6, sinceHidden = 18;
      function refill() {
        while (queue.length < 4) {
          if (sinceName > 22 + Math.random() * 10) {
            nameRows.forEach(function (bytes) {
              var pad = Math.floor((perRow - bytes.length) / 2);
              queue.push(randomBytes(pad).join(' ') + (pad ? ' ' : '') + '<span class="name">' + bytes.join(' ') + '</span>' +
                         (perRow - pad - bytes.length ? ' ' + randomBytes(perRow - pad - bytes.length).join(' ') : ''));
            });
            sinceName = 0;
          } else if (sinceHidden > 40 + Math.random() * 20) {
            hiddenRows.forEach(function (bytes) { queue.push(bytes.join(' ') + (perRow - bytes.length ? ' ' + randomBytes(perRow - bytes.length).join(' ') : '')); });
            sinceHidden = 0;
          } else {
            queue.push(randomBytes(perRow).join(' '));
          }
          sinceName++; sinceHidden++;
        }
      }

      var addr = Math.floor(Math.random() * 0x8000) * 16, rows = [];
      function line() {
        refill();
        var d = document.createElement('div'), body = queue.shift(), a = ('0000000' + addr.toString(16).toUpperCase()).slice(-8);
        d.innerHTML = '<span class="addr">' + a + '</span>  ' + body;
        addr += perRow;
        // Plain rows stream sideways; the name and the message stay put so they still decode.
        d._addr = a;
        d._bits = body.indexOf('<') < 0 ? body.replace(/ /g, '') : null;
        d._speed = 1 + Math.floor(Math.random() * 3);
        log.appendChild(d);
        rows.push(d);
        if (rows.length > rowsN) log.removeChild(rows.shift());
      }
      function slide() {
        rows.forEach(function (d) {
          if (!d._bits) return;
          var b = d._bits;
          for (var k = 0; k < d._speed; k++) b = (Math.random() < 0.5 ? '0' : '1') + b.slice(0, -1);
          d._bits = b;
          d.textContent = d._addr + '  ' + b.replace(/(.{8})(?=.)/g, '$1 ');
        });
      }

      var prompt = document.createElement('div');
      prompt.className = 'boot-prompt boot-prompt-fixed';
      prompt.textContent = 'CLICK OR PRESS ANY KEY TO START_';
      bootEl.appendChild(prompt);

      (function tick() {
        if (done) return;
        line();
        if (Math.random() < 0.5) line();
        // Bursts and pauses, like real output.
        setTimeout(tick, Math.random() < 0.05 ? 120 + Math.random() * 160 : 14 + Math.random() * 12);
      })();
      (function drift() { if (done) return; slide(); setTimeout(drift, 40); })();
    }
    var streamStarted = false, dumpMetrics = { cw: 10, lh: 22 };
    function go() { if (!streamStarted) { streamStarted = true; startStream(); } }
    if (document.fonts && document.fonts.load) document.fonts.load('20px VT323').then(go, go);
    setTimeout(go, 800);
    // Space bar: the leader's entrance. Anything else: the normal way in.
    function onBootKey(e) {
      removeEventListener('keydown', onBootKey);
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); leaderEntrance(); } else finish();
    }
    addEventListener('keydown', onBootKey);
    bootEl.addEventListener('pointerdown', function () { if (!leaderMode) finish(); }, { once: true });

    var leaderMode = false;
    // Space bar: the code on screen turns into the portrait behind it, then gives way to the desktop.
    function leaderEntrance() {
      if (done) return;
      done = true;            // freeze the dump
      leaderMode = true;
      setSound(true);         // the key press counts as the go-ahead for sound

      var W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      // Snapshot the dump as it is right now.
      var cv = document.createElement('canvas');
      cv.className = 'leader-canvas';
      cv.width = W * dpr; cv.height = H * dpr;
      var c2 = cv.getContext('2d');
      var face = document.createElement('canvas');
      face.width = cv.width; face.height = cv.height;
      var fx = face.getContext('2d');
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.fillStyle = '#000'; fx.fillRect(0, 0, W, H);
      var fs = parseFloat(getComputedStyle(log).fontSize) || 20;
      fx.font = fs + 'px VT323, monospace'; fx.textBaseline = 'top';
      var cwid = dumpMetrics.cw;
      Array.prototype.forEach.call(log.querySelectorAll(':scope > div'), function (row) {
        var r = row.getBoundingClientRect(), x = r.left;
        (function walk(node, color) {
          Array.prototype.forEach.call(node.childNodes, function (n) {
            if (n.nodeType === 3) {
              fx.fillStyle = color;
              for (var k = 0; k < n.textContent.length; k++) { fx.fillText(n.textContent[k], x, r.top + 2); x += cwid; }
            } else walk(n, n.classList.contains('name') ? '#ff56cc' : n.classList.contains('addr') ? '#6a6a6a' : color);
          });
        })(row, '#3a3a3a');
      });
      bootEl.appendChild(cv);
      bootEl.classList.add('leader');
      var CUT = 0, GLITCH = 420;
      function drawFace() {}
      var t0 = performance.now(), cut = false;
      (function frame() {
        var t = performance.now() - t0;
        if (!cut) {
          cut = true;
          bootEl.classList.add('dissolving');
          root.classList.remove('booting');
          bootEl.style.display = 'block';
          start_();
        }
        var g = t - CUT;
        if (g >= GLITCH) { bootEl.style.display = ''; bootEl.classList.remove('dissolving', 'leader'); cv.remove(); return; }
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.clearRect(0, 0, cv.width, cv.height);
        // Some frames show the page straight through; the rest tear the face into shifted slices.
        if (Math.random() < 0.35 + g / GLITCH * 0.5) { requestAnimationFrame(frame); return; }
        var y = 0, PW = cv.width, PH = cv.height;
        while (y < PH) {
          var h = (6 + Math.random() * 60) * dpr, off = (Math.random() - 0.5) * (40 + g * 0.6) * dpr;
          if (Math.random() < 0.8) {
            c2.globalCompositeOperation = 'source-over';
            c2.drawImage(face, 0, y, PW, h, off, y, PW, h);
            c2.globalCompositeOperation = 'lighter';
            c2.globalAlpha = 0.55;
            c2.fillStyle = '#ff56cc';
            if (Math.random() < 0.4) c2.fillRect(off + (Math.random() - 0.5) * 30 * dpr, y, PW, Math.min(h, 3 * dpr));
            c2.globalAlpha = 1;
          }
          y += h;
        }
        c2.globalCompositeOperation = 'source-over';
        requestAnimationFrame(frame);
      })();
      function start_() { store('bt-booted', '1'); start(); pulse(); }
    }
  } else {
    start();
  }

  addEventListener('hashchange', function () {
    var id = location.hash.slice(1);
    if (id) open(id, null, true);
  });
})();
