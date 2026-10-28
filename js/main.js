/* =========================================================
   PARADISE — interaction engine
   Created by TST Project · no dependencies, no external services
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceMQ.matches;
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', (e) => { reduced = e.matches; });

  // sessionStorage can throw (private mode, blocked storage) — never let it break the page.
  const store = {
    get(k) { try { return sessionStorage.getItem('paradise.' + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem('paradise.' + k, v); } catch (e) { /* ignore */ } },
  };

  const announcer = $('[data-announcer]');
  function announce(msg) {
    if (!announcer) return;
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = msg; }, 40);
  }

  /* =======================================================
     SOUND — small original synth palette (Web Audio API)
     Starts OFF. Context is created only after a user gesture.
     ======================================================= */
  const Sound = (() => {
    const btn = $('[data-sound-toggle]');
    const label = btn && $('.sound-toggle__label', btn);
    let ctx = null, out = null, noiseBuf = null;
    let enabled = store.get('sound') === 'on';
    let voices = 0;
    const lastPlayed = {};
    const MIN_GAP = { ui: 70, nav: 90, latch: 250, creak: 600, paper: 220, close: 200, secret: 1500, error: 260, pluck: 300, whoosh: 600, thud: 300, ding: 300, seal: 300, toll: 900 };

    function ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -22; comp.ratio.value = 8; comp.attack.value = .003; comp.release.value = .2;
      out = ctx.createGain(); out.gain.value = .55;
      out.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }

    function env(g, t, attack, peak, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function tone(type, f0, t, dur, peak, f1, dest) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, Math.min(.01, dur / 4), peak, dur);
      o.connect(g); g.connect(dest || out);
      o.start(t); o.stop(t + dur + .05);
      return o;
    }
    function noise(t, dur, peak, filterType, f0, q, f1, attack) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = filterType; f.frequency.setValueAtTime(f0, t); f.Q.value = q || 1;
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, attack || .004, peak, dur);
      s.connect(f); f.connect(g); g.connect(out);
      s.start(t, Math.random()); s.stop(t + dur + (attack || 0) + .05);
    }

    const recipes = {
      // quiet refined click
      ui(t) { noise(t, .03, .22, 'highpass', 3200, .7); tone('sine', 1900, t, .05, .05, 1400); return .08; },
      // soft metallic tap
      nav(t) { tone('sine', 1320, t, .2, .06); tone('sine', 3640, t, .1, .02); tone('triangle', 660, t, .08, .03); return .22; },
      // heavy latch / handle
      latch(t) { tone('sine', 130, t, .18, .32, 58); noise(t, .05, .28, 'bandpass', 900, 2); noise(t + .075, .035, .18, 'bandpass', 2400, 3); return .25; },
      // slow concealed mechanism / hinge creak
      creak(t) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createOscillator(), amg = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(64, t); o.frequency.linearRampToValueAtTime(96, t + .35); o.frequency.linearRampToValueAtTime(78, t + .75);
        f.type = 'bandpass'; f.frequency.setValueAtTime(620, t); f.frequency.linearRampToValueAtTime(900, t + .75); f.Q.value = 7;
        am.frequency.value = 27; amg.gain.value = .03; am.connect(amg); amg.connect(g.gain);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.06, t + .12); g.gain.linearRampToValueAtTime(.045, t + .55); g.gain.exponentialRampToValueAtTime(0.0001, t + .85);
        o.connect(f); f.connect(g); g.connect(out);
        o.start(t); am.start(t); o.stop(t + .9); am.stop(t + .9);
        tone('sine', 52, t + .7, .3, .12, 40);
        return .95;
      },
      // paper / file opening
      paper(t) { for (let i = 0; i < 4; i++) noise(t + i * .055 + Math.random() * .02, .06, .1 - i * .015, 'bandpass', 3400 + i * 300, .8); return .3; },
      // restrained reverse mechanism
      close(t) { noise(t, .03, .18, 'bandpass', 1900, 3); noise(t + .08, .03, .16, 'bandpass', 1150, 3); tone('sine', 320, t + .02, .12, .06, 170); return .2; },
      // rare atmospheric cue
      secret(t) { [440, 523.25, 659.25, 987.77].forEach((f, i) => tone('sine', f, t + i * .07, 2.2 - i * .3, .045)); noise(t, 1.2, .02, 'bandpass', 5200, 6, 7200, .4); return 2.3; },
      // muted unavailable feedback
      error(t) {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.connect(out);
        tone('square', 98, t, .08, .07, null, f); tone('square', 92, t + .12, .1, .06, null, f); return .25;
      },
      // apple stem snapping
      pluck(t) { noise(t, .025, .3, 'highpass', 2200, .8); tone('triangle', 880, t, .07, .08, 300); return .1; },
      // falling air (duration follows the animation)
      whoosh(t, opts) { const d = (opts && opts.dur) || 1.2; noise(t, d, .16, 'bandpass', 300, 1.4, 1500, d * .8); return d; },
      // impact as the apple leaves the scene
      thud(t) { tone('sine', 90, t, .4, .45, 42); noise(t, .14, .22, 'lowpass', 420, .7); return .45; },
      ding(t) { tone('sine', 1046.5, t, 1.1, .05); tone('sine', 1318.5, t + .09, 1.1, .045); return 1.2; },
      seal(t) { noise(t, .025, .3, 'bandpass', 1400, 3); noise(t + .04, .02, .22, 'bandpass', 900, 3); noise(t + .09, .05, .14, 'bandpass', 600, 2); return .15; },
      toll(t) { tone('sine', 110, t, 2.4, .2); tone('sine', 220.8, t, 1.6, .06); tone('sine', 331, t, 1.1, .035); return 2.4; },
    };

    function play(name, opts) {
      if (!enabled || !ctx || ctx.state !== 'running' || !recipes[name]) return;
      const now = performance.now();
      if (now - (lastPlayed[name] || 0) < (MIN_GAP[name] || 80)) return; // per-sound debounce
      if (voices >= 4 && name !== 'thud') return; // global polyphony cap
      lastPlayed[name] = now;
      try {
        const dur = recipes[name](ctx.currentTime + .005, opts) || .3;
        voices++;
        setTimeout(() => { voices = Math.max(0, voices - 1); }, Math.min(dur, 1.2) * 1000);
      } catch (e) { /* audio must never break interaction */ }
    }

    function render() {
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(enabled));
      label.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
    }

    if (btn) {
      btn.addEventListener('click', () => {
        enabled = !enabled;
        store.set('sound', enabled ? 'on' : 'off');
        if (enabled) {
          if (!ensure()) { enabled = false; announce('Sound is not supported in this browser'); }
          else setTimeout(() => play('ui'), 30);
        } else if (ctx) { ctx.suspend().catch(() => {}); }
        render();
        announce(enabled ? 'Sound on' : 'Sound off');
      });
      render();
    }

    // A preference remembered from earlier in this session still waits for a real gesture.
    if (enabled) {
      const resume = () => {
        ensure();
        removeEventListener('pointerdown', resume, true);
        removeEventListener('keydown', resume, true);
      };
      addEventListener('pointerdown', resume, true);
      addEventListener('keydown', resume, true);
    }

    return { play };
  })();

  /* =======================================================
     CURSOR — fine pointers only; native cursor until it works
     ======================================================= */
  (() => {
    const el = $('.cursor');
    if (!el || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const ring = $('.cursor__ring', el), mark = $('.cursor__mark', el);
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, started = false;

    const DOORISH = '[data-door], [data-apple], [data-break-seal], [data-contract-seal], .elevator__btn, [data-inscription], .seat, .wax-seal';
    function stateFor(t) {
      if (!t || !t.closest) return 'default';
      if (t.closest('[disabled], [aria-disabled="true"], .door--locked:not(.is-unlocked), .redacted')) return 'disabled';
      if (t.closest('[data-lightbox-stage]')) return 'drag';
      if (t.closest(DOORISH)) return 'door';
      if (t.closest('a[href], button, [role="tab"], input, label[for], summary')) return 'link';
      return 'default';
    }
    function loop() {
      const k = reduced ? 1 : .3;
      rx += (x - rx) * k; ry += (y - ry) * k;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      mark.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = (Math.abs(x - rx) > .15 || Math.abs(y - ry) > .15) ? requestAnimationFrame(loop) : 0;
    }
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (!started) { started = true; rx = x; ry = y; root.classList.add('has-cursor'); }
      el.classList.add('is-visible');
      const s = stateFor(e.target);
      if (el.dataset.state !== s) el.dataset.state = s;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) el.classList.remove('is-visible'); });
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') el.classList.add('is-down'); }, { passive: true });
    addEventListener('pointerup', () => el.classList.remove('is-down'), { passive: true });
    addEventListener('blur', () => el.classList.remove('is-visible'));
  })();

  /* =======================================================
     SECRETS
     ======================================================= */
  const SECRET_IDS = ['inscription', 'contract', 'key', 'office'];
  const found = new Set((store.get('secrets') || '').split(',').filter((s) => SECRET_IDS.includes(s)));
  const secretCount = $('[data-secret-count]');
  function renderSecrets() { if (secretCount) secretCount.textContent = `SECRETS FOUND ${found.size} / ${SECRET_IDS.length}`; }
  function discover(id) {
    if (found.has(id)) return false;
    found.add(id);
    store.set('secrets', Array.from(found).join(','));
    renderSecrets();
    Sound.play('secret');
    announce(`Secret found. ${found.size} of ${SECRET_IDS.length}.`);
    return true;
  }
  renderSecrets();

  /* =======================================================
     LAYOUT STATE — inert + scroll lock
     ======================================================= */
  const invitation = $('#invitation');
  const header = $('[data-site-header]');
  const main = $('#lobby-main');
  const footer = $('.site-footer');
  const lightbox = $('[data-lightbox]');
  const rooms = new Map($$('[data-room]').map((r) => [r.id, r]));
  let currentRoom = null;
  let invitationOpen = !!invitation;

  function setInert(el, on) {
    if (!el) return;
    if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  }
  function syncLayers() {
    const lb = lightbox && !lightbox.hidden;
    [header, main, footer].forEach((el) => setInert(el, invitationOpen || lb || !!currentRoom));
    rooms.forEach((r) => setInert(r, r !== currentRoom || invitationOpen || lb));
    setInert(invitation, !invitationOpen);
    root.classList.toggle('is-locked', invitationOpen || !!currentRoom || lb);
  }
  const lockStyle = document.createElement('style');
  lockStyle.textContent = 'html.is-locked body{overflow:hidden}';
  document.head.appendChild(lockStyle);

  /* =======================================================
     THE INVITATION — the apple
     ======================================================= */
  const frame = $('[data-invite-frame]');
  const apple = $('[data-apple]');
  const hint = $('[data-apple-hint]');
  const verdict = $('[data-apple-verdict]');
  const enterBtn = $('[data-enter]');
  const skipBtn = $('[data-skip-fall]');
  let appleFallen = store.get('apple') === 'fallen';
  let fallAnims = [];

  function showBereft() {
    apple.classList.add('is-gone');
    frame.classList.add('is-bereft');
    hint.hidden = true;
    verdict.hidden = false;
    enterBtn.hidden = false;
    skipBtn.hidden = true;
  }

  function showInvitation() {
    invitationOpen = true;
    invitation.classList.remove('is-gone', 'is-leaving');
    syncLayers();
    if (appleFallen) { showBereft(); enterBtn.focus({ preventScroll: true }); }
    else apple.focus({ preventScroll: true });
  }

  function enterParadise() {
    store.set('entered', '1');
    Sound.play('latch');
    invitationOpen = false;
    const finish = () => { invitation.classList.add('is-gone'); };
    if (reduced) finish();
    else { invitation.classList.add('is-leaving'); setTimeout(finish, 800); }
    syncLayers();
    main.focus({ preventScroll: true });
    const id = location.hash.slice(1);
    if (rooms.has(id)) { history.replaceState({ room: id, depth: 0 }, '', '#' + id); openRoom(id); }
  }

  // Hover: the apple leans toward the pointer; the frame tilts a little.
  if (frame && apple) {
    frame.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduced || appleFallen) return;
      const fr = frame.getBoundingClientRect();
      const px = (e.clientX - fr.left) / fr.width - .5, py = (e.clientY - fr.top) / fr.height - .5;
      frame.style.setProperty('--ty', (px * 3).toFixed(2) + 'deg');
      frame.style.setProperty('--tx', (-py * 3).toFixed(2) + 'deg');
      const ar = apple.getBoundingClientRect();
      const dx = e.clientX - (ar.left + ar.width / 2), dy = e.clientY - (ar.top + ar.height / 2);
      const dist = Math.hypot(dx, dy), pull = clamp(1 - dist / 260);
      apple.style.setProperty('--ax', (dx / (dist || 1) * 5 * pull).toFixed(2) + 'px');
      apple.style.setProperty('--ay', (dy / (dist || 1) * 4 * pull).toFixed(2) + 'px');
      apple.style.setProperty('--ar', (dx / (dist || 1) * 7 * pull).toFixed(2) + 'deg');
    });
    frame.addEventListener('pointerleave', () => {
      ['--tx', '--ty'].forEach((p) => frame.style.setProperty(p, '0deg'));
      apple.style.setProperty('--ax', '0px'); apple.style.setProperty('--ay', '0px'); apple.style.setProperty('--ar', '0deg');
    });

    apple.addEventListener('click', dropApple);
    enterBtn.addEventListener('click', enterParadise);
    skipBtn.addEventListener('click', () => { fallAnims.forEach((a) => a.finish()); });
  }

  function dropApple() {
    if (appleFallen) return;
    appleFallen = true;
    store.set('apple', 'fallen');
    Sound.play('pluck');
    hint.hidden = true;
    frame.style.setProperty('--tx', '0deg'); frame.style.setProperty('--ty', '0deg');

    if (reduced || !apple.animate) { afterFall(false); return; }

    const ar = apple.getBoundingClientRect();
    const fallY = innerHeight - ar.top + 40; // fully below the visible scene
    const drift = 24 + Math.random() * 40;
    const spin = 200 + Math.random() * 90;
    apple.classList.add('is-falling');
    apple.style.transform = 'none';
    skipBtn.hidden = false;

    // 1 — the apple tears from its corner
    const detach = apple.animate([
      { transform: 'translate(0, 0) rotate(0deg)' },
      { transform: 'translate(-3px, -9px) rotate(-10deg)', offset: .45 },
      { transform: 'translate(2px, 3px) rotate(7deg)' },
    ], { duration: 420, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' });
    fallAnims = [detach];

    detach.finished.then(() => {
      // 2 — the frame loses its weight; gravity takes the apple
      frame.classList.add('is-shaken', 'is-bereft');
      verdict.hidden = false;
      const DUR = 1250;
      Sound.play('whoosh', { dur: DUR / 1000 });
      const fall = apple.animate([
        { transform: 'translate(2px, 3px) rotate(7deg)' },
        { transform: `translate(${drift * .35}px, ${fallY * .22}px) rotate(${spin * .3}deg)`, offset: .45 },
        { transform: `translate(${drift}px, ${fallY}px) rotate(${spin}deg)` },
      ], { duration: DUR, easing: 'cubic-bezier(.45, 0, .9, .55)', fill: 'forwards' });
      fallAnims = [fall];
      return fall.finished.then(() => afterFall(true));
    }).catch(() => afterFall(false));
  }

  function afterFall(played) {
    if (played) Sound.play('thud');
    showBereft();
    enterBtn.focus({ preventScroll: true });
    announce('The apple has fallen. Enter Paradise.');
  }

  // Initial state for this session
  if (invitation) {
    if (appleFallen) showBereft();
    if (store.get('entered') === '1') {
      invitationOpen = false;
      invitation.classList.add('is-gone');
    }
  }
  syncLayers();

  /* =======================================================
     ROOMS — history-aware router + door transitions
     ======================================================= */
  const veil = $('[data-veil]');
  const baseTitle = document.title;
  const navLinks = $$('.site-nav a');
  let returnFocus = null;
  let keyFound = store.get('key') === 'found';

  function roomLabel(room) {
    const t = $('.section-title', room);
    return t ? t.textContent.trim() : '';
  }

  function openRoom(id) {
    const room = rooms.get(id);
    if (!room || room === currentRoom) return;
    if (id === 'office' && !keyFound) return;
    if (!currentRoom) returnFocus = document.activeElement;
    if (currentRoom) currentRoom.classList.remove('is-open');
    currentRoom = room;
    room.classList.add('is-open');
    room.scrollTop = 0;
    syncLayers();
    const title = $('.section-title', room);
    if (title) title.focus({ preventScroll: true });
    document.title = `${roomLabel(room)} — PARADISE`;
    navLinks.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + id));
    navLinks.forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
    if (['character', 'biography', 'rubicon', 'credits'].includes(id)) Sound.play('paper');
    if (id === 'office') discover('office');
    Serpents.refresh();
  }

  function closeRoom(silent) {
    if (!currentRoom) return;
    if (!silent) Sound.play('close');
    currentRoom.classList.remove('is-open');
    currentRoom = null;
    syncLayers();
    document.title = baseTitle;
    navLinks.forEach((a) => a.removeAttribute('aria-current'));
    if (returnFocus && document.contains(returnFocus) && !returnFocus.closest('[data-room]')) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    Serpents.refresh();
  }

  function navigate(id) {
    if (!rooms.has(id)) return;
    const depth = (history.state && history.state.depth) || 0;
    history.pushState({ room: id, depth: currentRoom ? depth + 1 : 1 }, '', '#' + id);
    openRoom(id);
  }

  function requestClose() {
    const depth = (history.state && history.state.depth) || 0;
    if (depth > 0) history.go(-depth);
    else { history.replaceState({ depth: 0 }, '', location.pathname + location.search); closeRoom(); }
  }

  addEventListener('popstate', () => {
    const id = location.hash.slice(1);
    if (rooms.has(id) && (id !== 'office' || keyFound)) openRoom(id);
    else closeRoom();
  });

  $$('[data-close-room]').forEach((b) => b.addEventListener('click', requestClose));

  // Veil: darkness spreading from the door, then lifting off the room.
  function throughVeil(originEl, done) {
    if (reduced || !veil) { done(); return; }
    const r = originEl.getBoundingClientRect();
    veil.style.setProperty('--vx', ((r.left + r.width / 2) / innerWidth * 100).toFixed(1) + '%');
    veil.style.setProperty('--vy', ((r.top + r.height / 2) / innerHeight * 100).toFixed(1) + '%');
    veil.classList.remove('is-lifting');
    void veil.offsetWidth;
    veil.classList.add('is-active');
    let called = false;
    const go = () => {
      if (called) return; called = true;
      done();
      veil.classList.remove('is-active');
      veil.classList.add('is-lifting');
      setTimeout(() => veil.classList.remove('is-lifting'), 520);
    };
    veil.addEventListener('transitionend', go, { once: true });
    setTimeout(go, 700); // fallback if transitionend never fires
  }

  // Doors
  const lockedNote = $('[data-locked-note]');
  function renderLock() {
    const d = $('[data-locked]');
    if (!d) return;
    d.classList.toggle('is-unlocked', keyFound);
    if (keyFound && lockedNote) {
      lockedNote.textContent = 'UNLOCKED · ROOM 000 IS OPEN';
      lockedNote.classList.add('is-unlocked');
    }
  }
  renderLock();

  $$('[data-door]').forEach((door) => {
    const frameEl = $('.door__frame', door);
    const id = door.getAttribute('href').slice(1);
    door.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduced) return;
      const r = frameEl.getBoundingClientRect();
      const px = clamp((e.clientX - r.left) / r.width), py = clamp((e.clientY - r.top) / r.height);
      frameEl.style.setProperty('--ry', ((px - .5) * 14).toFixed(2) + 'deg');
      frameEl.style.setProperty('--rx', ((.5 - py) * 8).toFixed(2) + 'deg');
      door.style.setProperty('--lx', (px * 100).toFixed(0) + '%');
    });
    door.addEventListener('pointerleave', () => {
      frameEl.style.setProperty('--ry', '0deg');
      frameEl.style.setProperty('--rx', '0deg');
    });
    door.addEventListener('click', (e) => {
      e.preventDefault();
      if (door.hasAttribute('data-locked') && !keyFound) {
        Sound.play('error');
        door.classList.remove('is-rattling'); void door.offsetWidth; door.classList.add('is-rattling');
        announce('Locked. The key is somewhere inside the club.');
        return;
      }
      if (door.classList.contains('is-opening')) return;
      Sound.play('latch');
      Sound.play('creak'); // the creak's slow attack lands just after the latch, as the leaf swings
      door.classList.add('is-opening');
      setTimeout(() => {
        throughVeil(door, () => { navigate(id); door.classList.remove('is-opening'); });
      }, reduced ? 0 : 260);
    });
  });

  // All other in-page links
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-door') || e.defaultPrevented) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    if (id === 'invitation') { e.preventDefault(); closeMenu(); if (currentRoom) closeRoom(true); showInvitation(); return; }
    if (rooms.has(id)) {
      e.preventDefault();
      closeMenu();
      if (id === 'office' && !keyFound) { Sound.play('error'); return; }
      Sound.play('nav');
      navigate(id);
      return;
    }
    // Anchors inside the open room scroll that room instead of the page.
    const target = document.getElementById(id);
    if (currentRoom && target && currentRoom.contains(target)) {
      e.preventDefault();
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (currentRoom) { e.preventDefault(); requestClose(); setTimeout(() => target && target.scrollIntoView({ behavior: 'auto' }), 60); }
    closeMenu();
  });

  // Menu (small screens)
  const menuBtn = $('[data-menu-toggle]');
  const nav = $('#site-nav');
  function closeMenu() {
    if (!menuBtn || menuBtn.getAttribute('aria-expanded') !== 'true') return;
    menuBtn.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const open = menuBtn.getAttribute('aria-expanded') !== 'true';
      menuBtn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      Sound.play('nav');
    });
  }

  /* =======================================================
     KEYBOARD — Escape + focus trapping
     ======================================================= */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trap(container, e) {
    const soundBtn = $('[data-sound-toggle]');
    const items = $$(FOCUSABLE, container).filter((el) => !el.closest('[hidden]') && el.getClientRects().length);
    if (soundBtn) items.push(soundBtn);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const inside = items.includes(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (lightbox && !lightbox.hidden) { closeLightbox(); return; }
      if (menuBtn && menuBtn.getAttribute('aria-expanded') === 'true') { closeMenu(); menuBtn.focus(); return; }
      const insc = $('[data-inscription][aria-expanded="true"]');
      if (insc) { insc.setAttribute('aria-expanded', 'false'); return; }
      if (currentRoom && !invitationOpen) { requestClose(); return; }
    }
    if (e.key === 'Tab') {
      if (lightbox && !lightbox.hidden) trap(lightbox, e);
      else if (invitationOpen) trap(invitation, e);
      else if (currentRoom) trap(currentRoom, e);
    }
  });

  /* =======================================================
     SERPENTS — scroll-coordinated SVG snakes
     ======================================================= */
  const Serpents = (() => {
    const NS = 'http://www.w3.org/2000/svg';
    const hosts = $$('[data-serpent-host]');
    const list = [];
    // [from, to, width]: segments measured backwards from the head as fractions of body length
    const LAYERS = [[1, 0, 3.2], [.9, .02, 6.5], [.74, .03, 10], [.56, .05, 13], [.36, .06, 14.5]];
    let ticking = false;
    let px = -9999, py = -9999;

    const KINDS = {
      wander: {
        body: (w) => Math.min(560, w * .55),
        build(w, h) {
          const pts = [], y0 = h - 58, amp = Math.min(22, h * .03), lambda = 250;
          for (let x = -140; x <= w + 160; x += 8) {
            const k = (x + 140) / (w + 300);
            pts.push([x, y0 - k * 26 + amp * Math.sin((x / lambda) * Math.PI * 2) + 8 * Math.sin(x / 97)]);
          }
          return pts;
        },
        progress: (r, vh, s) => lerp(s.L * .3, s.total + s.L, clamp((64 - r.top) / (r.height * .8))),
        rest: (s) => s.total * .62,
      },
      divider: {
        body: (w) => Math.min(340, w * .45),
        build(w, h) {
          const pts = [], y0 = h - 2;
          for (let x = w + 120; x >= -140; x -= 8) pts.push([x, y0 - 9 * Math.abs(Math.sin(x / 70))]);
          return pts;
        },
        progress: (r, vh, s) => lerp(0, s.total + s.L, clamp((vh * .92 - r.bottom) / (vh * .55))),
        rest: (s) => s.total * .55,
      },
      spine: {
        body: () => 440,
        build(w, h, host) {
          const sx = parseFloat(getComputedStyle(host).getPropertyValue('--spine')) || 34;
          const pts = [];
          for (let y = -60; y <= h + 40; y += 8) pts.push([sx + 11 * Math.sin(y / 46) + 4 * Math.sin(y / 17), y]);
          return pts;
        },
        progress: (r, vh, s) => lerp(s.L * .55, s.total, clamp((vh * .58 - r.top) / r.height)),
        rest: (s) => s.L * 1.2,
      },
    };

    hosts.forEach((host, i) => {
      const kind = KINDS[host.dataset.serpentHost];
      if (!kind) return;
      const id = 'serpent' + i;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'serpent');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const layerPaths = (cls) => LAYERS.map(([, , wdt]) => `<path class="${cls}" stroke-width="${wdt}"/>`).join('');
      const rimPaths = LAYERS.map(([, , wdt]) => `<path stroke-width="${wdt + 2.4}"/>`).join('');
      svg.innerHTML = `
        <defs>
          <pattern id="${id}-sc" width="7" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
            <path d="M0 3 Q1.75 .4 3.5 3 Q5.25 .4 7 3" fill="none" stroke="#33443a" stroke-width=".6"/>
          </pattern>
          <mask id="${id}-m" maskUnits="userSpaceOnUse" x="-200" y="-200" width="6000" height="20000"><g fill="none" stroke="#fff" stroke-linecap="round">${layerPaths('m')}</g></mask>
        </defs>
        <path class="t" fill="none" stroke="none"/>
        <g class="rim" fill="none" stroke="#2a3a30" stroke-linecap="round" opacity=".9">${rimPaths}</g>
        <g class="b" fill="none" stroke="#060807" stroke-linecap="round">${layerPaths('l')}</g>
        <rect x="-200" y="-200" width="6000" height="20000" fill="url(#${id}-sc)" mask="url(#${id}-m)" opacity=".7"/>
        <path class="ridge" fill="none" stroke="#1d2822" stroke-width="2" stroke-linecap="round"/>
        <g class="h">
          <path class="serpent__tongue" d="M21 0 H31 L35 -3 M31 0 L35 3" fill="none" stroke="#8C2934" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M-7 -7.6 C3 -10.2 15 -8.4 21.5 -3.2 C24.5 -1 24.5 1 21.5 3.2 C15 8.4 3 10.2 -7 7.6 Z" fill="#060807" stroke="#2a3a30" stroke-width="1.2"/>
          <path d="M1 -5.4 C8 -6.6 14 -5.6 18.5 -2.4 M1 5.4 C8 6.6 14 5.6 18.5 2.4" fill="none" stroke="#1d2822" stroke-width=".9"/>
          <circle cx="12.5" cy="-3.7" r="1.75" fill="#A38A5B"/><circle cx="12.9" cy="-4" r=".55" fill="#efe6d2"/>
        </g>`;
      host.insertBefore(svg, host.firstChild);
      const s = {
        host, kind, svg,
        track: $('.t', svg),
        rim: $$('.rim path', svg), body: $$('.l', svg), mask: $$('.m', svg),
        ridge: $('.ridge', svg), head: $('.h', svg),
        total: 0, L: 0, cur: null, built: false, active: false, lastFlick: 0,
      };
      list.push(s);
    });

    function build(s) {
      const w = s.host.clientWidth, h = s.host.clientHeight;
      if (!w || !h) { s.built = false; return; }
      const pts = s.kind.build(w, h, s.host);
      const d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
      s.track.setAttribute('d', d);
      [...s.rim, ...s.body, ...s.mask, s.ridge].forEach((p) => p.setAttribute('d', d));
      s.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      s.total = s.track.getTotalLength();
      s.L = s.kind.body(w);
      s.built = true;
      if (s.cur === null) s.cur = reduced ? s.kind.rest(s) : target(s);
      render(s);
    }

    function target(s) {
      if (reduced) return s.kind.rest(s);
      return s.kind.progress(s.host.getBoundingClientRect(), innerHeight, s);
    }

    function dash(p, head, a, b, s) {
      const start = head - a * s.L, len = (a - b) * s.L;
      p.style.strokeDasharray = `${len.toFixed(1)} ${(s.total * 3).toFixed(0)}`;
      p.style.strokeDashoffset = (-start).toFixed(1);
    }

    function render(s) {
      const head = s.cur;
      LAYERS.forEach(([a, b], i) => { dash(s.rim[i], head, a, b, s); dash(s.body[i], head, a, b, s); dash(s.mask[i], head, a, b, s); });
      dash(s.ridge, head, .62, .07, s);
      if (head < 2 || head > s.total) { s.head.style.display = 'none'; return; }
      s.head.style.display = '';
      const p = s.track.getPointAtLength(head), q = s.track.getPointAtLength(Math.max(0, head - 6));
      let ang = Math.atan2(p.y - q.y, p.x - q.x) * 180 / Math.PI;
      // Curiosity: the head turns toward a nearby pointer and tastes the air.
      if (!reduced && px > -9000) {
        const box = s.svg.getBoundingClientRect();
        const hx = box.left + p.x, hy = box.top + p.y;
        const dx = px - hx, dy = py - hy, dist = Math.hypot(dx, dy);
        if (dist < 170) {
          const want = Math.atan2(dy, dx) * 180 / Math.PI;
          let delta = ((want - ang + 540) % 360) - 180;
          ang += clamp(delta, -30, 30) * (1 - dist / 170);
          const now = performance.now();
          if (now - s.lastFlick > 1400) {
            s.lastFlick = now;
            s.svg.classList.remove('is-flick'); void s.svg.getBoundingClientRect(); s.svg.classList.add('is-flick');
          }
        }
      }
      s.head.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
    }

    function tick() {
      ticking = false;
      let again = false;
      for (const s of list) {
        if (!s.active) continue;
        if (!s.built) build(s);
        if (!s.built) continue;
        const t = target(s);
        if (s.cur === null) s.cur = t;
        s.cur += (t - s.cur) * (reduced ? 1 : .14);
        if (Math.abs(t - s.cur) > .4) again = true; else s.cur = t;
        render(s);
      }
      if (again) request();
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const s = list.find((x) => x.host === en.target);
        if (s) s.active = en.isIntersecting;
      });
      request();
    }, { rootMargin: '120px 0px' });
    list.forEach((s) => io.observe(s.host));

    const ro = new ResizeObserver((entries) => {
      entries.forEach((en) => { const s = list.find((x) => x.host === en.target); if (s) s.built = false; });
      request();
    });
    list.forEach((s) => ro.observe(s.host));

    // One passive capture listener covers the page and every room's own scroller.
    document.addEventListener('scroll', () => { if (list.some((s) => s.active)) request(); }, { passive: true, capture: true });
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX; py = e.clientY;
      if (list.some((s) => s.active)) request();
    }, { passive: true });

    return { refresh() { list.forEach((s) => { s.built = false; }); request(); } };
  })();

  /* =======================================================
     REVEAL ON SCROLL
     ======================================================= */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-revealed'); revealIO.unobserve(en.target); } });
  }, { threshold: .12 });
  $$('[data-reveal]').forEach((el) => revealIO.observe(el));

  /* =======================================================
     LOBBY — the inscription
     ======================================================= */
  const insc = $('[data-inscription]');
  if (insc) {
    insc.setAttribute('aria-expanded', 'false');
    const reveal = () => discover('inscription');
    insc.addEventListener('pointerenter', reveal);
    insc.addEventListener('focus', reveal);
    insc.addEventListener('click', () => {
      const open = insc.getAttribute('aria-expanded') !== 'true';
      insc.setAttribute('aria-expanded', String(open));
      Sound.play('ui');
      reveal();
    });
  }

  /* =======================================================
     01 — mask toggle
     ======================================================= */
  const maskBtn = $('[data-mask-toggle]');
  if (maskBtn) {
    const fig = $('[data-mask-figure]');
    maskBtn.addEventListener('click', () => {
      const on = !fig.classList.contains('is-masked');
      fig.classList.toggle('is-masked', on);
      maskBtn.setAttribute('aria-pressed', String(on));
      maskBtn.textContent = on ? 'REMOVE THE MASK' : 'SHOW THE MASK';
      Sound.play('ui');
    });
  }

  /* =======================================================
     02 — biography chapter links stay inside the room
     (handled by the global link handler)
     ======================================================= */

  /* =======================================================
     03 — relationship tabs
     ======================================================= */
  const tabs = $$('[data-rel-tab]');
  const relmap = $('.relmap');
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (relmap) relmap.dataset.active = tab.id.replace('tab-', '');
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { selectTab(t); Sound.play('paper'); });
    t.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (dir) { e.preventDefault(); selectTab(tabs[(i + dir + tabs.length) % tabs.length], true); Sound.play('nav'); }
      if (e.key === 'Home') { e.preventDefault(); selectTab(tabs[0], true); }
      if (e.key === 'End') { e.preventDefault(); selectTab(tabs[tabs.length - 1], true); }
    });
  });
  if (tabs.length) selectTab(tabs[0]);

  /* =======================================================
     04 — the rebirth cycle model + contract seal
     ======================================================= */
  (() => {
    const live = $('[data-cycle-live]'), die = $('[data-cycle-die]'), reset = $('[data-cycle-reset]');
    if (!live) return;
    const ageEl = $('[data-cycle-age]'), ageSvg = $('[data-cycle-age-svg]'), memEl = $('[data-cycle-memory]');
    const rebEl = $('[data-cycle-rebirths]'), locEl = $('[data-cycle-location]'), log = $('[data-cycle-log]');
    const arc = $('.cycle__arc'), dial = $('.cycle__dial');
    const C = 2 * Math.PI * 86;
    const st = { age: 25, mem: 0, reb: 0 };

    function paint() {
      ageEl.textContent = st.age; ageSvg.textContent = st.age;
      memEl.textContent = st.mem; rebEl.textContent = st.reb;
      arc.style.strokeDashoffset = (C * (1 - (st.age - 25) / 5)).toFixed(1);
      const capped = st.age >= 30;
      live.setAttribute('aria-disabled', String(capped));
    }
    live.addEventListener('click', () => {
      if (st.age >= 30) {
        Sound.play('error');
        log.textContent = 'ตลอดชีวิตของเธอ ยังไม่เคยมีช่วงใดที่มีชีวิตอยู่ต่อเนื่องเกินอายุ 30 ปี';
        return;
      }
      st.age++; st.mem++;
      Sound.play('ui');
      log.textContent = `อายุร่างกาย ${st.age} ปี — เธอแก่ตัวลงตามปกติเหมือนมนุษย์ทั่วไป และไม่มีการฟื้นฟูร่างกายใด ๆ ขณะยังมีชีวิต`;
      paint();
    });
    die.addEventListener('click', () => {
      st.reb++;
      const kept = st.mem;
      st.age = 25;
      locEl.textContent = 'สุสานนอกเมืองนิวยอร์ก';
      log.textContent = `ความตายคือเงื่อนไขเดียว — เธอฟื้นคืนชีพที่หลุมศพของตนเองในสุสานนอกเมืองนิวยอร์ก ร่างกายกลับสู่สภาพเมื่ออายุ 25 ปี ตอนทำสัญญา แต่ความทรงจำ ${kept} ปียังคงอยู่ครบ`;
      dial.classList.add('is-dead');
      setTimeout(() => dial.classList.remove('is-dead'), 900);
      Sound.play('toll');
      paint();
    });
    reset.addEventListener('click', () => {
      Object.assign(st, { age: 25, mem: 0, reb: 0 });
      locEl.textContent = '—';
      log.textContent = 'เริ่มต้นที่อายุ 25 ปี — วันที่สัญญาถูกลงนาม';
      Sound.play('close');
      paint();
    });
    paint();
  })();

  const seal = $('[data-contract-seal]');
  if (seal) {
    seal.addEventListener('click', () => {
      const terms = $('#' + seal.getAttribute('aria-controls'));
      const open = seal.getAttribute('aria-expanded') !== 'true';
      seal.setAttribute('aria-expanded', String(open));
      terms.hidden = !open;
      $('.wax-seal__label', seal).textContent = open ? 'FOLD THE ADDENDUM' : 'BREAK THE CONTRACT SEAL';
      Sound.play(open ? 'seal' : 'close');
      if (open) discover('contract');
    });
  }

  /* =======================================================
     05 — Paradise Club: elevator, corridor, atmospheric map
     ======================================================= */
  (() => {
    const panel = $('.elevator__panel');
    if (!panel) return;
    const FLOORS = {
      P: { code: 'P', label: 'FLOOR P · HOTEL', seed: 7,
        title: 'โรงแรม',
        text: 'ห้องพักหรูที่ไม่มีหน้าต่างสักบาน แขกรู้ได้ว่าเป็นกลางวันหรือกลางคืน ก็จากแสงไฟที่ฝ่ายบริหารเป็นผู้ตั้งเท่านั้น',
        rooms: 'SUITES P-01 — P-48', clear: 'CLEARANCE · GUESTS WITH A KEYCARD', prefix: 'P' },
      V: { code: 'V', label: 'FLOOR V · PRIVATE ROOMS', seed: 13,
        title: 'พื้นที่บันเทิงส่วนตัว',
        text: 'ห้องรับรองส่วนตัวที่เข้าได้ด้วยคำเชิญเท่านั้น ประตูทุกบานหน้าตาเหมือนกัน และไม่มีห้องใดปรากฏอยู่ในผังอาคารฉบับทางการ',
        rooms: 'ROOMS V-1 — V-?', clear: 'CLEARANCE · BY INVITATION', prefix: 'V' },
      C: { code: 'C', label: 'FLOOR C · CASINO', seed: 21,
        title: 'คาสิโน',
        text: 'คาสิโนที่ไม่มีนาฬิกาบนผนังแม้แต่เรือนเดียว โต๊ะเปิดตลอดเวลา และทางเดินทุกเส้นพาวนกลับมาที่โต๊ะเดิม',
        rooms: 'TABLES C-01 — C-36', clear: 'CLEARANCE · MEMBERS', prefix: 'C' },
      B: { code: 'B', label: 'FLOOR B · BARS', seed: 34,
        title: 'บาร์',
        text: 'บาร์หลายแห่งเชื่อมถึงกันด้วยทางเดินที่ดูเหมือนกันทุกเส้น ลูกค้าบางคนเข้ามาเพื่อลืม และบางคนก็ลืมจริง ๆ',
        rooms: 'BARS B-I — B-VII', clear: 'CLEARANCE · OPEN TO GUESTS', prefix: 'B' },
      G: { code: 'G', label: 'FLOOR G · THE CLUB', seed: 3,
        title: 'คลับระดับสูง',
        text: 'คลับหรูชั้นล่างสุดที่คนภายนอกรู้จัก ทางเข้าเดียวที่ทุกคนจำได้ และเป็นทางเดียวที่ไม่มีใครจำได้ว่าเคยเดินออกไป',
        rooms: 'HALL · LOUNGES G-1 — G-9', clear: 'CLEARANCE · ON THE LIST', prefix: 'G' },
      S: { code: 'S1', label: 'FLOOR S1 · STAFF QUARTERS', seed: 55,
        title: 'ที่พักพนักงาน',
        text: 'ที่พัก อาหาร รายได้ และสวัสดิการสำหรับพนักงาน ซึ่งส่วนใหญ่เป็นมิวแทนต์หรือผู้มีความสามารถพิเศษที่ไม่มีที่อื่นให้ไป ที่นี่ปลอดภัยกว่าโลกภายนอก — ตราบใดที่ยังทำตามกฎของเจ้าของอาคาร',
        rooms: 'QUARTERS S1-001 — S1-140', clear: 'CLEARANCE · STAFF ONLY · CURFEW ENFORCED', prefix: 'S1' },
      X: { code: '—', label: 'FLOOR — · NOT IN THE DIRECTORY', seed: 66, hidden: true,
        title: 'ชั้นที่ไม่มีอยู่',
        text: 'ชั้นที่ไม่มีหมายเลขบนแผงลิฟต์ ที่ตั้งของเครือข่ายธุรกิจผิดกฎหมายและข้อตกลงที่ไม่ควรถูกบันทึกไว้ ไม่มีใครยอมรับว่าเคยลงมาถึงชั้นนี้',
        rooms: 'ROOMS ███ — ███', clear: 'CLEARANCE · NONE ISSUED', prefix: '—' },
    };
    const ORDER = ['P', 'V', 'C', 'B', 'G', 'S', 'X'];
    const disp = $('[data-elev-floor]'), arrow = $('[data-elev-arrow]');
    const floorBox = $('.floor');
    const codeEl = $('[data-floor-code]'), titleEl = $('[data-floor-title]'), textEl = $('[data-floor-text]');
    const roomsEl = $('[data-floor-rooms]'), clearEl = $('[data-floor-clear]');
    const mapSvg = $('[data-floor-map]'), corridorSvg = $('[data-corridor-art]');
    const keyBox = $('[data-keyfind]');
    let cur = 'G', stepTimer = 0;

    function rng(seed) {
      let a = seed * 2654435761 >>> 0;
      return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }

    function drawMap(f) {
      const R = rng(f.seed), cols = 12, rows = 8, cs = 28, ox = 12, oy = 8;
      const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
      const walls = []; // [x, y, right, bottom]
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) walls.push({ x, y, r: true, b: true });
      const W = (x, y) => walls[y * cols + x];
      const stack = [[0, rows - 1]]; seen[rows - 1][0] = true;
      while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, dx, dy])
          .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny][nx]);
        if (!n.length) { stack.pop(); continue; }
        const [nx, ny, dx, dy] = n[Math.floor(R() * n.length)];
        if (dx === 1) W(x, y).r = false; if (dx === -1) W(nx, ny).r = false;
        if (dy === 1) W(x, y).b = false; if (dy === -1) W(nx, ny).b = false;
        seen[ny][nx] = true; stack.push([nx, ny]);
      }
      const stroke = f.hidden ? '#8C2934' : '#A38A5B';
      let d = `M${ox} ${oy} H${ox + cols * cs} M${ox} ${oy} V${oy + rows * cs}`;
      walls.forEach((c) => {
        const X = ox + c.x * cs, Y = oy + c.y * cs;
        if (c.r) d += ` M${X + cs} ${Y} V${Y + cs}`;
        if (c.b) d += ` M${X} ${Y + cs} H${X + cs}`;
      });
      let rooms = '';
      for (let i = 0; i < 5; i++) {
        const x = 1 + Math.floor(R() * (cols - 2)), y = Math.floor(R() * (rows - 1));
        const num = f.hidden ? '???' : `${f.prefix}-${String(Math.floor(R() * 90) + 10)}`;
        rooms += `<rect x="${ox + x * cs + 4}" y="${oy + y * cs + 4}" width="${cs - 8}" height="${cs - 8}" fill="${f.hidden ? '#3a0d14' : '#25382D'}" opacity=".8"/>`
          + `<text x="${ox + x * cs + cs / 2}" y="${oy + y * cs + cs / 2 + 2}" text-anchor="middle" font-size="5.5" fill="#D8D0BF" opacity=".75" font-family="Cinzel, serif">${num}</text>`;
      }
      mapSvg.innerHTML = `${rooms}<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.1" opacity=".55" stroke-linecap="square"/>`
        + `<circle cx="${ox + cs / 2}" cy="${oy + (rows - .5) * cs}" r="4" fill="#8C2934"/><circle cx="${ox + cs / 2}" cy="${oy + (rows - .5) * cs}" r="8" fill="none" stroke="#8C2934" opacity=".5"/>`
        + `<text x="${ox + cs + 2}" y="${oy + (rows - .5) * cs + 3}" font-size="7" fill="#D8D0BF" font-family="Cinzel, serif" letter-spacing="1">YOU ARE HERE</text>`;
    }

    function drawCorridor(f) {
      const R = rng(f.seed + 101), vx = 300, vy = 122, W = 600, H = 260;
      const wallTop = (x, left) => left ? lerp(0, vy - 26, x / (vx - 40)) : lerp(0, vy - 26, (W - x) / (vx - 40));
      const wallBot = (x, left) => left ? lerp(H, vy + 30, x / (vx - 40)) : lerp(H, vy + 30, (W - x) / (vx - 40));
      const depth = (i) => 1 - 1 / (1 + i * .55);
      let doors = '';
      for (let side = 0; side < 2; side++) {
        const left = side === 0;
        for (let i = 0; i < 6; i++) {
          const t1 = depth(i + .25), t2 = depth(i + .75);
          const x1 = left ? t1 * (vx - 40) : W - t1 * (vx - 40);
          const x2 = left ? t2 * (vx - 40) : W - t2 * (vx - 40);
          const b1 = wallBot(x1, left), b2 = wallBot(x2, left);
          const top1 = b1 - (b1 - wallTop(x1, left)) * .72, top2 = b2 - (b2 - wallTop(x2, left)) * .72;
          const lit = R() > .72;
          doors += `<path d="M${x1} ${b1} L${x1} ${top1} L${x2} ${top2} L${x2} ${b2} Z" fill="${lit ? '#1f3027' : '#101a15'}" stroke="#A38A5B" stroke-opacity=".35" stroke-width=".8"/>`;
          const fs = Math.max(3, 9 * (1 - t1));
          const num = f.hidden ? '░░' : `${f.prefix}${String(i * 2 + side + 1).padStart(2, '0')}`;
          doors += `<text x="${(x1 + x2) / 2}" y="${top1 + (b1 - top1) * .18}" text-anchor="middle" font-size="${fs.toFixed(1)}" fill="#A38A5B" opacity=".75" font-family="Cinzel, serif">${num}</text>`;
          if (lit) doors += `<path d="M${x1} ${b1} L${x2} ${b2}" stroke="#bcd3b4" stroke-opacity=".35" stroke-width="1.2"/>`;
        }
      }
      let lights = '';
      for (let i = 0; i < 6; i++) {
        const t = depth(i + .5), y = lerp(0, vy - 26, t) + 4;
        lights += `<ellipse cx="${vx}" cy="${y}" rx="${(24 * (1 - t)).toFixed(1)}" ry="${(3 * (1 - t) + .6).toFixed(1)}" fill="${f.hidden ? '#8C2934' : '#d8d0bf'}" opacity="${(.5 * (1 - t) + .1).toFixed(2)}"/>`;
      }
      const end = f.hidden ? '#2a0a10' : '#0f1c16';
      corridorSvg.innerHTML = `
        <defs><linearGradient id="cf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#17241d"/><stop offset="1" stop-color="#050706"/></linearGradient></defs>
        <rect width="${W}" height="${H}" fill="#050706"/>
        <path d="M0 ${H} L${vx - 40} ${vy + 30} L${vx + 40} ${vy + 30} L${W} ${H} Z" fill="url(#cf)"/>
        <path d="M0 0 L${vx - 40} ${vy - 26} L${vx + 40} ${vy - 26} L${W} 0 Z" fill="#070a08"/>
        <path d="M0 0 L${vx - 40} ${vy - 26} L${vx - 40} ${vy + 30} L0 ${H} Z" fill="#0b120e"/>
        <path d="M${W} 0 L${vx + 40} ${vy - 26} L${vx + 40} ${vy + 30} L${W} ${H} Z" fill="#0b120e"/>
        <rect x="${vx - 40}" y="${vy - 26}" width="80" height="56" fill="${end}" stroke="#A38A5B" stroke-opacity=".3"/>
        <rect x="${vx - 9}" y="${vy - 8}" width="18" height="38" fill="#020302" stroke="#A38A5B" stroke-opacity=".25"/>
        ${lights}${doors}
        <g stroke="#A38A5B" stroke-opacity=".18" fill="none"><path d="M0 ${H} L${vx - 40} ${vy + 30} M${W} ${H} L${vx + 40} ${vy + 30} M0 0 L${vx - 40} ${vy - 26} M${W} 0 L${vx + 40} ${vy - 26}"/></g>
        <text x="${vx}" y="${vy - 32}" text-anchor="middle" font-size="7" letter-spacing="2" fill="#A38A5B" opacity=".6" font-family="Cinzel, serif">${f.hidden ? 'NO EXIT' : 'EXIT ?'}</text>`;
    }

    function show(key) {
      const f = FLOORS[key];
      codeEl.textContent = f.label;
      titleEl.textContent = f.title;
      textEl.textContent = f.text;
      roomsEl.textContent = f.rooms;
      clearEl.textContent = f.clear;
      drawMap(f); drawCorridor(f);
      if (f.hidden) {
        keyBox.hidden = false;
        if (!keyFound) {
          keyFound = true;
          store.set('key', 'found');
          renderLock();
          discover('key');
        }
      } else keyBox.hidden = true;
    }

    function go(key) {
      if (key === cur) return;
      $$('.elevator__btn', panel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.floor === key)));
      clearInterval(stepTimer);
      const from = ORDER.indexOf(cur), to = ORDER.indexOf(key), dir = to > from ? 1 : -1;
      arrow.classList.toggle('is-down', dir > 0);
      cur = key;
      floorBox.classList.add('is-switching');
      Sound.play('ui');
      if (reduced) { disp.textContent = FLOORS[key].code; show(key); floorBox.classList.remove('is-switching'); Sound.play('ding'); return; }
      let i = from;
      stepTimer = setInterval(() => {
        i += dir;
        disp.textContent = FLOORS[ORDER[i]].code;
        if (i === to) {
          clearInterval(stepTimer);
          show(key);
          floorBox.classList.remove('is-switching');
          Sound.play('ding');
        }
      }, 140);
    }

    panel.addEventListener('click', (e) => {
      const b = e.target.closest('.elevator__btn');
      if (b) go(b.dataset.floor);
    });
    show('G');
    if (keyFound) keyBox.hidden = true;
  })();

  /* =======================================================
     06 — Rubicon: seal, redactions, the 72-hour slider
     ======================================================= */
  (() => {
    const cover = $('[data-break-seal]');
    if (!cover) return;
    const sealed = $('[data-sealed]'), file = $('#rubicon-file');
    cover.addEventListener('click', () => {
      sealed.classList.add('is-open');
      cover.setAttribute('aria-expanded', 'true');
      file.hidden = false;
      Sound.play('seal');
      setTimeout(() => Sound.play('paper'), 120);
      const first = $('.rubifile__facts dt', file);
      file.setAttribute('tabindex', '-1');
      file.focus({ preventScroll: true });
      if (first) first.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    });
    $$('[data-redacted]').forEach((r) => r.addEventListener('click', () => {
      Sound.play('error');
      r.classList.remove('is-denied'); void r.offsetWidth; r.classList.add('is-denied');
      announce('Access denied');
    }));
    const range = $('[data-hours]'), out = $('[data-hours-out]'), state = $('[data-hours-state]'), text = $('[data-hours-text]');
    let returned = false;
    const update = () => {
      const v = +range.value;
      out.textContent = v;
      const now = v >= 72;
      state.classList.toggle('is-returned', now);
      text.textContent = now
        ? 'ฤทธิ์หมดลงแล้ว ความทรงจำที่เจ็บปวดย้อนกลับมาพร้อมกันทั้งหมด และอาจยากเกินกว่าจะรับมือได้'
        : v >= 60
          ? 'ใกล้ครบ 72 ชั่วโมง สิ่งที่ถูกกดทับไว้ยังเงียบอยู่ — แต่อีกไม่นาน'
          : 'ความทรงจำที่เจ็บปวดถูกกดทับไว้ ทุกอย่างดูเบาลง — แม้แต่ชื่อของตัวเอง';
      if (now && !returned) Sound.play('toll');
      returned = now;
    };
    range.addEventListener('input', update);
    update();
  })();

  /* =======================================================
     07 — the seven seats
     ======================================================= */
  (() => {
    const seats = $$('[data-seat]');
    if (!seats.length) return;
    const known = $('[data-seat-file="known"]'), unknown = $('[data-seat-file="unknown"]'), tag = $('[data-seat-tag]');
    const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    seats.forEach((s) => s.addEventListener('click', () => {
      const i = +s.dataset.seat;
      seats.forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
      known.hidden = i !== 0;
      unknown.hidden = i === 0;
      if (i !== 0) { tag.textContent = `SEAT ${ROMAN[i]} · SEALED`; Sound.play('error'); }
      else Sound.play('paper');
    }));
  })();

  /* =======================================================
     000 — the office
     ======================================================= */
  const officeBtn = $('[data-office-toggle]');
  if (officeBtn) {
    const fig = $('[data-office-figure]');
    officeBtn.addEventListener('click', () => {
      const on = !fig.classList.contains('is-masked');
      fig.classList.toggle('is-masked', on);
      officeBtn.setAttribute('aria-pressed', String(on));
      Sound.play('ui');
    });
  }

  /* =======================================================
     LIGHTBOX — natural proportions, keyboard + swipe
     ======================================================= */
  const ART = [
    { src: 'assets/images/lust/theater-of-serpents.webp', w: 2000, h: 2000, cap: 'THE THEATER OF SERPENTS', alt: 'Lust lounging across red theater seats, holding a gold skull mask, black serpents coiling over the rows while a faceless man in a dark suit sits behind her.' },
    { src: 'assets/images/lust/red-room-telephone.webp', w: 2000, h: 1514, cap: 'THE RED ROOM', alt: 'Lust lying upside down on a deep red floor, a telephone receiver at her ear, a heart-shaped box and a handwritten letter beside her.' },
    { src: 'assets/images/lust/lust-cutout.webp', w: 2000, h: 1390, cap: 'CHARACTER STUDY', alt: 'Full-body illustration of Lust seated on the floor in a dark green jacket and black trousers, smiling.' },
    { src: 'assets/images/lust/lust-cutout-skull-mask.webp', w: 2000, h: 1390, cap: 'CHARACTER STUDY, MASKED', alt: 'Full-body illustration of Lust in warm tones, her face hidden behind a fanged skull mask.' },
    { src: 'assets/images/lust/grave-embrace.webp', w: 1200, h: 1801, cap: 'THE GRAVE EMBRACE', alt: 'Painted night scene: a man in red armor holds Lust, draped in green, beside a gravestone among autumn shrubs.' },
    { src: 'assets/images/lust/office-at-dusk.webp', w: 1414, h: 2000, cap: 'THE OFFICE AT DUSK', alt: 'Lust seated at a desk in a book-lined office, sunset light through a tall window, stacks of paper at her feet.' },
    { src: 'assets/images/lust/office-at-dusk-skull-mask.webp', w: 1414, h: 2000, cap: 'THE OFFICE, MASKED', alt: 'The same office scene, Lust wearing a skull mask.' },
    { src: 'assets/images/lust/bride-of-thorns.webp', w: 1441, h: 2000, cap: 'BRIDE OF THORNS', alt: 'A smiling woman in a blood-stained white bridal gown with red roses and a crown of thorns, raising a revolver to her head before a gilded frame.' },
  ];
  const lbImg = $('[data-lightbox-img]'), lbCap = $('[data-lightbox-caption]'), lbCount = $('[data-lightbox-count]');
  const lbMissing = $('[data-lightbox-missing]'), lbStage = $('[data-lightbox-stage]');
  let lbIndex = 0, lbReturn = null;

  function showArt(i) {
    lbIndex = (i + ART.length) % ART.length;
    const a = ART[lbIndex];
    lbMissing.hidden = true;
    lbImg.hidden = false;
    lbImg.removeAttribute('src');
    lbImg.width = a.w; lbImg.height = a.h;
    lbImg.alt = a.alt;
    lbImg.src = a.src;
    lbCap.textContent = a.cap;
    lbCount.textContent = `${String(lbIndex + 1).padStart(2, '0')} / ${String(ART.length).padStart(2, '0')}`;
  }
  lbImg.addEventListener('error', () => { lbImg.hidden = true; lbMissing.hidden = false; });

  function openLightbox(i, opener) {
    lbReturn = opener || document.activeElement;
    showArt(i);
    lightbox.hidden = false;
    syncLayers();
    Sound.play('paper');
    $('[data-lightbox-close]').focus({ preventScroll: true });
  }
  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    syncLayers();
    Sound.play('close');
    if (lbReturn && document.contains(lbReturn)) lbReturn.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lightbox-open]');
    if (b) openLightbox(+b.dataset.lightboxOpen, b);
  });
  $('[data-lightbox-close]').addEventListener('click', closeLightbox);
  $('[data-lightbox-prev]').addEventListener('click', () => { showArt(lbIndex - 1); Sound.play('nav'); });
  $('[data-lightbox-next]').addEventListener('click', () => { showArt(lbIndex + 1); Sound.play('nav'); });
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { showArt(lbIndex - 1); Sound.play('nav'); }
    if (e.key === 'ArrowRight') { showArt(lbIndex + 1); Sound.play('nav'); }
  });
  // Click on the empty stage (not the image) closes; horizontal swipe navigates.
  let swipeX = null, swipeY = null;
  lbStage.addEventListener('pointerdown', (e) => { swipeX = e.clientX; swipeY = e.clientY; });
  lbStage.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX, dy = e.clientY - swipeY;
    swipeX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { showArt(lbIndex + (dx < 0 ? 1 : -1)); Sound.play('nav'); return; }
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && e.target === lbStage) closeLightbox();
  });

  /* =======================================================
     IMAGE FALLBACKS
     ======================================================= */
  function markMissing(img) {
    const host = img.closest('figure') || img.parentElement;
    if (host) host.classList.add('is-missing');
  }
  $$('img').forEach((img) => {
    if (img === lbImg) return;
    img.addEventListener('error', () => markMissing(img));
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) markMissing(img);
  });

  /* =======================================================
     BOOT — honour a deep link once inside
     ======================================================= */
  const startId = location.hash.slice(1);
  if (!invitationOpen && rooms.has(startId) && (startId !== 'office' || keyFound)) {
    history.replaceState({ room: startId, depth: 0 }, '', '#' + startId);
    openRoom(startId);
  } else if (!invitationOpen && startId === 'invitation') {
    showInvitation();
  }
})();
