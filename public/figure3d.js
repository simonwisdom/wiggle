// The 3D figure: pre-rendered clips (public/clips3d/, made by tools/figure3d) played in step with the session's timeline.
// Two parts. The pure part works out, for every timeline segment, which clip, still or crossfade to show, and where the
// flat head goes on a frame (tested in tests/figure3d-player.test.js). The player part (browser only) runs two stacked
// <video>s and swaps them at the shared pose, as the Stage 0 phone test did (spike/video3d/index.html).
(function (root) {
  const CP = typeof module !== "undefined" && module.exports ? require("./clipplay.js") : root.CLIPPLAY;
  const EITHER = new Set(["beast", "sideSit"]);
  const SWAY = /\.(in|out)(\.F)?$/;
  const FADE = 0.3; // seconds: a crossfade between two poses that no clip joins
  const RATE_MIN = 0.5, RATE_MAX = 2; // keep the playback speed inside what the phone does smoothly

  // ---------- pure: which clip for which segment ----------
  // Which limbs a pose names: "N", "F", or null (either, or the same on both sides). Same rule as tools/figure3d/steps.mjs.
  function sideOf(name) {
    if (CP.loopOf(name)) return null;
    const p = CP.poseOf(name);
    return p && p[2] === true ? "F" : p && p[2] === false ? "N" : null;
  }
  // The side of step j of a move whose poses are `poses` (poses[j] -> poses[j+1]): a pose that names none (beast, sideSit)
  // is on the side of the next named pose going into the turn, or the last one coming out of it.
  function sideAt(poses, j, from, to) {
    const sf = sideOf(from), st = sideOf(to);
    if (sf || st) return st || sf;
    if (!EITHER.has(from) && !EITHER.has(to)) return "both";
    const order = to === "beast" ? [[j, -1], [j, 1]] : [[j, 1], [j, -1]];
    for (const [a, dir] of order) for (let k = a; k >= 0 && k < poses.length; k += dir) if (sideOf(poses[k])) return sideOf(poses[k]);
    return "N";
  }
  const isSway = (from, to) => SWAY.test(from) && SWAY.test(to);
  const key = (from, to, side) => `${from}>${to}@${side}`;
  const swayKey = (from, to, side) => `${[from, to].sort().join("~")}@${side}`;
  const rateOf = (len, d) => Math.max(RATE_MIN, Math.min(RATE_MAX, len / Math.max(d, 0.05)));

  // What to show for one pose-to-pose segment of a move. M is the manifest's `clips`.
  //   { kind: "clip", id, a, b, rate }   play clip id from clip time a to b
  //   { kind: "loop", id, len }          a loop, in real time
  //   { kind: "still", id, frame }       the pose held (id/frame null: whatever the figure already shows)
  //   { kind: "flat" }                   no 3D for this: draw the flat figure
  function resolveStep(M, from, to, d, poses, j, moveId) {
    if (CP.loopOf(from) || CP.loopOf(to)) {
      const c = M[`loop:${moveId}`];
      return c && c.file ? { kind: "loop", id: `loop:${moveId}`, len: c.seconds } : { kind: "flat" };
    }
    const side = sideAt(poses, j, from, to);
    if (from === to) {
      const c = M[key(from, to, side)];
      return c && c.still ? { kind: "still", id: c.still.clip, frame: c.still.frame } : c ? { kind: "still", id: null, frame: 0 } : { kind: "flat" };
    }
    if (isSway(from, to)) {
      const id = swayKey(from, to, side), c = M[id];
      if (!c || !c.file) return { kind: "flat" };
      const half = c.seconds / 2, first = from === c.from;
      const a = first ? 0 : half, b = first ? half : c.seconds;
      return { kind: "clip", id, a, b, rate: rateOf(half, d) };
    }
    const id = key(from, to, side), c = M[id];
    if (c && c.file) return { kind: "clip", id, a: 0, b: c.seconds, rate: rateOf(c.seconds, d) };
    if (c && c.still) return { kind: "still", id: c.still.clip, frame: c.still.frame };
    return { kind: "flat" };
  }

  // The 3D plan for a session's timeline segments: one item per segment (a run of loop segments is one item), each
  // { t0, t1, kind, ... }. A lead-in or "get ready" segment with no clip of its own is a "fade": the pose you are in
  // gives way to the next move's first pose over FADE seconds. If either side of it has no 3D, it is flat instead.
  function plan(segs, session, M) {
    const items = [];
    const done = new Map(); // step -> index of its next non-lead segment
    for (const g of segs) {
      let r;
      const st = g.step >= 0 ? session.steps[g.step] : null;
      if (g.step < 0 || g.lead || !st) {
        const tryKey = g.from !== g.to && st && g.lead ? key(g.from, g.to, sideOf(g.to) || sideOf(g.from) || "both") : null;
        const c = tryKey && M[tryKey];
        r = c && c.file ? { kind: "clip", id: tryKey, a: 0, b: c.seconds, rate: rateOf(c.seconds, g.d) } : c && c.still ? { kind: "still", id: c.still.clip, frame: c.still.frame } : { kind: "fade" };
      } else {
        const j = done.get(g.step) || 0;
        done.set(g.step, j + 1);
        const poses = [st.start, ...st.segs.map((s) => s[0])];
        r = resolveStep(M, g.from, g.to, g.d, poses, j, st.id);
      }
      const last = items[items.length - 1];
      if (r.kind === "fade" && last && last.kind === "fade") { last.t1 = g.t0 + g.d; last.n++; continue; } // "get ready" then the first lead-in: one crossfade
      if (r.kind === "loop" && last && last.kind === "loop" && last.id === r.id) { last.t1 = g.t0 + g.d; last.n++; continue; }
      items.push({ ...r, t0: g.t0, t1: g.t0 + g.d, seg: g, n: 1 });
    }
    const has = (it) => it && (it.kind === "clip" || it.kind === "loop" || (it.kind === "still"));
    items.forEach((it, i) => {
      if (it.kind !== "fade") return;
      const prev = items[i - 1], next = items[i + 1];
      if ((i > 0 && !has(prev)) || !has(next)) it.kind = "flat";
    });
    // a still with nothing to show (no clip names it) keeps what is on screen, which only works after a video item
    items.forEach((it, i) => { if (it.kind === "still" && !it.id && !(i > 0 && items[i - 1].kind !== "flat")) it.kind = "flat"; });
    return items;
  }

  const itemIndexAt = (items, t) => {
    let lo = 0, hi = items.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (items[mid].t0 <= t) lo = mid; else hi = mid - 1; }
    return lo;
  };
  // The clip time wanted at session time t, for a clip, loop or still item.
  function clipTime(it, t, fps) {
    const e = Math.max(0, t - it.t0);
    if (it.kind === "clip") return Math.min(it.b, it.a + it.rate * e);
    if (it.kind === "loop") return it.len > 0 ? e % it.len : 0;
    if (it.kind === "still") return (it.frame + 0.5) / (fps || 30);
    return 0;
  }

  // ---------- pure: the flat head on a frame ----------
  // rows are [headX, headY, neckX, neckY, headHeight, tiltDeg] per frame, in the 540 px square. Returns the same 6 numbers
  // between frames f and f+1 (the tilt takes the short way round).
  function headAt(rows, f) {
    if (!rows || !rows.length) return null;
    const n = rows.length, x = Math.max(0, Math.min(n - 1, f)), i = Math.min(n - 2, Math.floor(x)), k = x - i;
    if (n === 1) return rows[0].slice();
    const A = rows[i], B = rows[i + 1];
    const out = A.map((v, j) => v + (B[j] - v) * k);
    let dt = B[5] - A[5];
    dt = ((dt + 540) % 360) - 180;
    out[5] = A[5] + dt * k;
    return out;
  }
  // Where the head goes: centre, turn (degrees) and size (radius in px, half the 3D head's height).
  const HEAD_FILL = 0.88;
  function headPlace(row) {
    return { x: row[0], y: row[1], rot: row[5], r: (row[4] / 2) * HEAD_FILL };
  }

  // ---------- pure: the zoom ----------
  // The figure should fill the panel, not sit small on the mat. moveBoxes: one box per move and camera, the union of the boxes
  // of that move's clips, for the items that have no box of their own.
  const ZOOM_PAD = 0.05, ZOOM_MAX = 2.6;
  function moveBoxes(clips) {
    const out = {};
    for (const c of Object.values(clips || {})) {
      if (!c.box) continue;
      for (const m of c.moves || []) {
        const k = m + "|" + c.camera, b = out[k];
        out[k] = b ? [Math.min(b[0], c.box[0]), Math.min(b[1], c.box[1]), Math.max(b[2], c.box[2]), Math.max(b[3], c.box[3])] : c.box.slice();
      }
    }
    return out;
  }
  // The box to show for a clip: its own box (the view glides as one clip hands over to the next). A still, or a clip with no
  // box: the union of its moves' boxes on its camera. null: show the whole picture.
  function boxFor(clip, boxes) {
    if (!clip) return null;
    if (clip.box) return clip.box.slice();
    let b = null;
    for (const m of clip.moves || []) {
      const x = boxes[m + "|" + clip.camera];
      if (x) b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : x.slice();
    }
    return b;
  }
  // Scale and offset that fit box (in the size x size picture) into a W x H panel, centred, with a margin.
  // The picture's edge never comes inside the panel where the picture is bigger than it, and stays inside it where it is smaller.
  function fitBox(box, W, H, size) {
    size = size || 540;
    const b = box || [0, 0, size, size];
    const bw = Math.max(1, b[2] - b[0]), bh = Math.max(1, b[3] - b[1]);
    const k = Math.min((W * (1 - 2 * ZOOM_PAD)) / bw, (H * (1 - 2 * ZOOM_PAD)) / bh, ZOOM_MAX);
    let x = W / 2 - k * (b[0] + b[2]) / 2, y = H / 2 - k * (b[1] + b[3]) / 2;
    const S = k * size;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    x = clamp(x, Math.min(0, W - S), Math.max(0, W - S));
    y = clamp(y, Math.min(0, H - S), Math.max(0, H - S));
    return { k, x, y };
  }

  const api = { moveBoxes, boxFor, fitBox, sideOf, sideAt, resolveStep, plan, itemIndexAt, clipTime, headAt, headPlace, rateOf, FADE, RATE_MIN, RATE_MAX };

  // ---------- the player (browser) ----------
  if (typeof document !== "undefined") {
    api.player = function (stage, LOOK, base) {
      const url = (file) => base + file;
      const mk = () => {
        const v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.preload = "auto"; v.disablePictureInPicture = true;
        v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
        v.className = "f3-v";
        return v;
      };
      const V = [mk(), mk()];
      stage.innerHTML = "";
      // .f3-zoom holds the picture at its own size (540 px square) and is scaled and moved to put the figure in the panel.
      const zoom = document.createElement("div");
      zoom.className = "f3-zoom";
      stage.append(zoom);
      zoom.append(V[0], V[1]);
      zoom.insertAdjacentHTML("beforeend",
        `<svg class="f3-head" viewBox="0 0 540 540" xmlns="http://www.w3.org/2000/svg"><defs>` +
        `<radialGradient id="f3h" cx=".35" cy=".3"><stop offset="0" style="stop-color:var(--fig-hi)"/><stop offset=".5" style="stop-color:var(--fig-body)"/><stop offset="1" style="stop-color:var(--fig-edge)"/></radialGradient></defs><g class="f3-hg"></g></svg>`);
      const hg = stage.querySelector(".f3-hg");
      let zoomBox = null, zoomKey = "";
      // Glide the view to the box for item k (smoothly, unless the panel is just coming on).
      function zoomTo(k, glide) {
        let it = P.items[k];
        if (it && it.kind === "fade") { const n = nextVideo(k); it = n >= 0 ? P.items[n] : null; }
        if (!it || !it.id) return;
        zoomBox = boxFor(P.M[it.id], P.boxes);
        applyZoom(glide);
      }
      function applyZoom(glide) {
        const W = stage.clientWidth, H = stage.clientHeight;
        if (!W || !H) return;
        const f = fitBox(zoomBox, W, H, P.size), key = `${f.k.toFixed(3)} ${f.x.toFixed(1)} ${f.y.toFixed(1)}`;
        if (key === zoomKey) return;
        zoomKey = key;
        zoom.style.transition = glide ? "transform 0.9s cubic-bezier(.4,0,.2,1)" : "none";
        zoom.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) scale(${f.k.toFixed(4)})`;
      }
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => applyZoom(false)).observe(stage);

      const P = { stat: { swaps: 0, jumps: 0, drift: 0, fixes: 0, errors: 0 }, M: null, H: null, fps: 30, ready: false, broken: false, items: null, on: false };
      let front = 0, bound = [-1, -1], shown = -1, z = 1, fadeTimer = 0, fadedAt = -1;
      let ct = 0, lastNow = 0, flatUntil = 0, stageOn = false;

      // Download the manifest and the head track. Resolves true when 3D can be used.
      P.load = async () => {
        if (P.ready) return true;
        P.tried = true;
        try {
          const m = await (await fetch(base + "clips3d.json")).json();
          const h = await (await fetch(base + (m.headsFile || "clips3d-heads.json"))).json();
          P.M = m.clips; P.H = h; P.fps = m.fps || 30; P.size = m.size || 540; P.boxes = moveBoxes(m.clips); P.ready = true;
        } catch { P.ready = false; }
        return P.ready;
      };
      V.forEach((v) => v.addEventListener("error", () => { if (v.getAttribute("src")) { P.broken = true; P.stat.errors++; } }));

      const setStage = (on) => { if (on !== stageOn) { stageOn = on; stage.classList.toggle("on", on); if (stage.parentElement) stage.parentElement.classList.toggle("is3d", on); } };
      const idOf = (it) => it.id;
      const file = (it) => url(P.M[idOf(it)].file);
      function startTime(it) {
        if (it.kind === "clip") return it.a;
        if (it.kind === "still") return (it.frame + 0.5) / P.fps;
        return 0;
      }
      function load(v, it) {
        const f = file(it);
        if (v.dataset.file !== f) { v.dataset.file = f; v.src = f; v.load(); }
        v.dataset.id = idOf(it);
        v.loop = it.kind === "loop";
      }
      function prime(vi, k) {
        const it = P.items[k], v = V[vi];
        load(v, it); v.pause();
        const t0 = startTime(it);
        if (Math.abs(v.currentTime - t0) > 0.001) v.currentTime = t0;
        bound[vi] = k;
      }
      function reveal(v, other, fade) {
        v.style.zIndex = ++z;
        clearTimeout(fadeTimer);
        if (!fade) { v.style.transition = "none"; v.style.opacity = "1"; other.style.transition = "none"; other.style.opacity = "0"; return; }
        v.style.transition = "none"; v.style.opacity = "0"; void v.offsetWidth;
        v.style.transition = `opacity ${FADE}s linear`; v.style.opacity = "1";
        fadeTimer = setTimeout(() => { other.style.transition = "none"; other.style.opacity = "0"; other.pause(); }, FADE * 1000 + 40);
      }
      const nextVideo = (k) => { for (let i = k + 1; i < P.items.length; i++) { const it = P.items[i]; if (it.kind === "clip" || it.kind === "loop" || (it.kind === "still" && it.id)) return i; if (it.kind === "flat") return -1; } return -1; };
      const playing = (it) => it.kind === "clip" || it.kind === "loop";

      function primeNext(k) {
        const n = nextVideo(k);
        if (n >= 0 && bound[1 - front] !== n) prime(1 - front, n);
      }
      // Bring item k to the screen. jumped: we did not get here by playing on from the item before.
      function enter(k, jumped, want, run) {
        const it = P.items[k];
        shown = k;
        const noShow = it.kind === "still" && !it.id && (jumped || !stageOn || bound[front] !== k - 1);
        if (it.kind === "flat" || noShow) { setStage(false); V.forEach((v) => v.pause()); flatUntil = performance.now() + FADE * 1000 + 60; bound = [-1, -1]; fadedAt = -1; return; }
        const wasOff = !stageOn;
        zoomTo(k, !wasOff && !jumped);
        if (it.kind === "fade") {
          fadedAt = -1;
          const n = nextVideo(k);
          if (n < 0) return;
          if (jumped || wasOff || bound[front] < 0) { // nothing sensible to hold: show the next pose straight away
            const v = V[front]; prime(front, n); reveal(v, V[1 - front], false); setStage(true); V[1 - front].pause(); bound[1 - front] = -1;
          } else primeNext(k);
          return;
        }
        if (it.kind === "still" && !jumped && !wasOff && bound[front] === k - 1) { bound[front] = k; return; } // hold: the pose on screen stays
        if (!jumped && !wasOff && bound[front] === k) { // came in through a fade: already up
          if (playing(it) && run) { V[front].playbackRate = it.rate || 1; V[front].play().catch(() => {}); }
          primeNext(k); return;
        }
        if (!jumped && !wasOff && bound[1 - front] === k) { // primed: swap at the shared pose
          const v = V[1 - front];
          v.playbackRate = it.rate || 1;
          if (playing(it) && run) v.play().catch(() => {}); else v.pause();
          reveal(v, V[front], false); V[front].pause(); P.stat.swaps++;
          front = 1 - front; bound[1 - front] = -1;
        } else { P.stat.jumps++; // a jump (start, back, skip, unlock, or back from a flat move): load straight into the front video
          const v = V[front]; load(v, it);
          v.currentTime = jumped ? Math.min(clipTime(it, want, P.fps), (v.duration || 99) - 0.01) : startTime(it);
          v.playbackRate = it.rate || 1;
          if (playing(it) && run) v.play().catch(() => {}); else v.pause();
          reveal(v, V[1 - front], wasOff ? false : false); bound[front] = k; bound[1 - front] = -1; V[1 - front].pause();
          setStage(true);
        }
        primeNext(k);
      }

      P.available = () => P.ready && !P.broken && !!P.items;
      // True when move `step` has no 3D at all, so it plays flat even with 3D on (the gear moves, the Qigong pieces).
      P.flatStep = (step) => { const its = (P.items || []).filter((it) => it.seg.step === step && !it.seg.lead); return its.length > 0 && its.every((it) => it.kind === "flat"); };
      // Set the timeline to play (after a session starts, or the track is rebuilt, or a move is swapped).
      P.set = (segs, session) => {
        P.items = P.ready ? plan(segs, session, P.M) : null;
        P.broken = false;
        shown = -1; bound = [-1, -1]; fadedAt = -1; ct = 0; lastNow = 0;
        V.forEach((v) => v.pause());
      };
      // Clip files this session needs.
      P.files = () => (P.items ? [...new Set(P.items.filter((it) => it.id && P.M[it.id] && P.M[it.id].file).map((it) => P.M[it.id].file))] : []);
      P.jump = () => { shown = -1; lastNow = 0; };
      P.stop = () => { V.forEach((v) => v.pause()); setStage(false); shown = -1; bound = [-1, -1]; hg.innerHTML = ""; };
      // iOS lets a muted inline video play without a tap, but touching both inside the tap costs nothing.
      P.unlock = () => V.forEach((v) => { try { v.play().then(() => v.pause()).catch(() => {}); } catch {} });

      // Called every screen frame with the session time t. Returns true when the flat figure must be drawn too
      // (a move with no 3D, or the moment it fades out).
      P.frame = (t, run, look) => {
        if (!P.available()) { if (stageOn) { V.forEach((v) => v.pause()); setStage(false); } return true; }
        const items = P.items, now = performance.now();
        // A smooth clock steered toward t: on the iPhone the sound track's time can stand still for half a second.
        let forced = false;
        if (!lastNow || !run) { ct = t; if (!lastNow) forced = true; }
        else {
          ct += (now - lastNow) / 1000;
          const d = t - ct;
          if (Math.abs(d) > 1) { ct = t; forced = true; } else ct += d * 0.02;
        }
        lastNow = now;
        const k = itemIndexAt(items, ct), it = items[k];
        if (k !== shown || forced) enter(k, forced || k !== shown + 1, ct, run);
        if (it.kind === "fade") {
          const startAt = it.t0 + Math.max(0, (it.t1 - it.t0 - FADE) * 0.4);
          if (fadedAt < 0 && ct >= startAt && bound[1 - front] >= 0 && stageOn && V[front].dataset.id !== V[1 - front].dataset.id) {
            const nv = V[1 - front];
            reveal(nv, V[front], true); fadedAt = ct;
            front = 1 - front; bound[1 - front] = -1;
          }
        }
        const v = V[front];
        if (stageOn && playing(it) && bound[front] === k) {
          const want = clipTime(it, ct, P.fps);
          if (!run) { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - want) > 0.05 && v.readyState >= 1) v.currentTime = want; }
          else if (v.readyState >= 2 && !v.seeking) {
            let drift = v.currentTime - want;
            if (it.kind === "loop") { const L = it.len; drift = ((drift + L * 1.5) % L) - L / 2; }
            const ended = it.kind === "clip" && want >= it.b - 0.001;
            if (v.paused && !ended) v.play().catch(() => {});
            // Catch up by playing a little faster or slower, not by jumping: a seek shows as a stutter on the iPhone.
            if (!ended) P.stat.drift = Math.max(P.stat.drift, Math.abs(drift));
            if (Math.abs(drift) > 0.6 && !ended) { v.currentTime = want; P.stat.fixes++; }
            else if (!ended) {
              const base = it.rate || 1;
              const r = +(base * (1 + Math.max(-0.25, Math.min(0.25, -drift * 1.5)))).toFixed(3);
              if (Math.abs(v.playbackRate - r) > 0.02) v.playbackRate = r;
            }
          }
        } else if (stageOn && it.kind === "still" && !run && bound[front] === k && v.paused === true) {
          // paused on a still: nothing to do
        }
        P.drawHead(look);
        return !stageOn || performance.now() < flatUntil;
      };

      // The flat head on top of whichever video is showing, placed from the head track for that frame.
      P.drawHead = (look) => {
        if (!stageOn) { if (hg.innerHTML) hg.innerHTML = ""; return; }
        const v = V[front], id = v.dataset.id;
        const rows = id && P.H[id];
        if (!rows) { hg.innerHTML = ""; return; }
        const row = headAt(rows, v.currentTime * P.fps);
        if (!row) { hg.innerHTML = ""; return; }
        const p = headPlace(row), kind = (look && look.head) || "ball", nominal = kind === "ball" ? 15 : 16.5;
        const s = p.r / nominal;
        const flip = look && look.flip ? " scale(-1 1)" : "";
        hg.innerHTML = `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${s.toFixed(3)})${flip}">` +
          LOOK.headSVG(kind, nominal, { breath: look && look.breath, t: look && look.t, grad: kind === "ball" ? "f3h" : "" }) + `</g>`;
      };
      return P;
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FIG3D = api;
})(typeof window !== "undefined" ? window : globalThis);
