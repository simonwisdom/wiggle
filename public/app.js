// Wiggle (morning stretch): home, player and done screens. Everything stays in this browser (localStorage).
(function () {
  const { R, mix, joints } = window.FIG;
  const LOOK = window.LOOK;
  const CLIPS = window.CLIPS || {};
  const { annotate, segmentFrame, playable, poseOf, loopOf, frameAt } = window.CLIPPLAY;
  const { build, swap, timeline, levelFrom, MOVES, MODES, AREAS, MUSCLES, GEAR, HALVES } = window.PLAN;
  const SOUND = window.SOUND;
  const GEARDRAW = window.GEARDRAW;
  const $ = (id) => document.getElementById(id);

  // ---- saved state ----
  const KEY = "morning-stretch.v1";
  // mode: what the session is for; areas: the body areas picked for each kind of session (none = everything).
  const DEFAULTS = () => ({ minutes: 10, mode: "morning", areas: {}, off: [], prefs: {}, history: [], sound: true, voiceOn: true, music: false, gear: [], head: "ball", figure: "flat" });
  function load() {
    try { return Object.assign(DEFAULTS(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch { return DEFAULTS(); }
  }
  const state = load();
  if (!MODES[state.mode]) state.mode = "morning";
  if (!Array.isArray(state.gear)) state.gear = [];
  if (!LOOK.HEAD_KEYS.includes(state.head)) state.head = "ball";
  if (state.figure !== "3d") state.figure = "flat"; // Flat until you pick 3D in your figure sheet
  if (!state.areas || typeof state.areas !== "object" || Array.isArray(state.areas)) state.areas = {};
  if (state.focus) { // from before sessions had kinds: one focus, for the morning ("back" was the old Back chip)
    const old = state.focus === "back" ? "spine" : state.focus;
    if (AREAS[old] && !state.areas.morning) state.areas.morning = [old];
    delete state.focus;
  }
  // What you pick from: body areas in the morning ("anything tight?"), muscle groups around a workout,
  // named as a gym app names them, because that is how you think of what you are training.
  const choices = () => (state.mode === "morning" ? Object.entries(AREAS) : Object.entries(MUSCLES).map(([k, m]) => [k, m.label]));
  const picked = () => {
    const ok = new Set(choices().map(([k]) => k));
    return (Array.isArray(state.areas[state.mode]) ? state.areas[state.mode] : []).filter((a) => ok.has(a));
  };
  // After a warm-up, the next thing you will want is the cool-down for the same muscles: set that up once,
  // if the warm-up was in the last three hours.
  function carry() {
    const last = state.history.at(-1);
    if (!last || last.mode !== "before" || state.carried === last.at) return;
    if (Date.now() - Date.parse(last.at) > 3 * 3600e3) return;
    state.carried = last.at;
    state.mode = "after";
    state.areas.after = (Array.isArray(last.focus) ? last.focus : []).filter((k) => MUSCLES[k]);
    save();
  }
  // What each kind of session says about itself on the home screen.
  const COPY = {
    morning: { ask: "Anything tight today?", title: "Today", note: "From the floor up to standing. Cat–cow opens, Stand still closes." },
    before: { ask: "What are you training?", title: "Warm-up", note: "Moving stretches only, on a quicker breath. Ends with a shake, ready to go." },
    after: { ask: "What did you train?", title: "Cool-down", note: "Long holds on a slow breath, from standing down to the floor." },
    qigong: { ask: "", title: "Qigong", note: "The Eight Brocades, in their order, on a slow breath. Stand still opens and closes. The length sets the breaths per piece." },
  };
  // A fixed form (Qigong) is the same whatever you pick: no areas, gear, swaps or more/less.
  const isForm = () => !!MODES[state.mode].form;

  // Moves whose every pose can be drawn: from a clip in clips.js, or hand-made.
  const HAVE = playable(MOVES, CLIPS, (name) => !!R[name]);
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function show(id) {
    for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
    if (id === "home") requestAnimationFrame(drawLeads); // the body map's lines need the screen laid out
    window.scrollTo(0, 0);
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 3000);
  }

  // ---- home ----
  let session = null;

  function renderWeek() {
    const days = new Set(state.history.filter((h) => h.seconds >= 60).map((h) => h.day));
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const names = ["M", "T", "W", "T", "F", "S", "S"];
    let n = 0;
    $("week").innerHTML = names.map((name, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const did = days.has(dayKey(d)); if (did) n++;
      const today = dayKey(d) === dayKey(now);
      return `<li class="${did ? "did" : ""} ${today ? "is-today" : ""}">${name}</li>`;
    }).join("");
    const last = state.history.at(-1);
    const lastText = !last ? "Your first session." :
      last.day === dayKey(now) ? "Done today." :
      `Last: ${new Date(last.at).toLocaleDateString(undefined, { weekday: "long" })}.`;
    $("streak").textContent = `${lastText} ${n ? `${n} this week.` : ""}`.trim();
  }

  function renderPick() {
    for (const b of $("lengths").children) b.setAttribute("aria-checked", String(+b.dataset.min === state.minutes));
    $("modes").innerHTML = Object.entries(MODES).map(([k, m]) =>
      `<button role="radio" data-mode="${k}" aria-checked="${k === state.mode}"><svg class="ic"><use href="#i-${k}"/></svg>${m.label}</button>`).join("");
    $("mode-note").textContent = COPY[state.mode].note;
    $("focus-title").textContent = COPY[state.mode].ask;
    $("focuses").closest("section").hidden = isForm();
    $("open-moves").hidden = isForm();
    renderBody();
  }

  // Pick on the body (after GOWOD): each area or muscle group is a label at the side, joined by a line to
  // its spot on a front-on figure. Each: [side, label height, spots], in the figure's 160 × 236 units.
  // Muscles at the back (back, glutes, hamstrings) sit where they would show through.
  const SPOTS = {
    morning: {
      shoulders: ["l", 30, [[54, 46], [106, 46]]], upperback: ["l", 64, [[80, 58]]], spine: ["l", 98, [[80, 92]]], hips: ["l", 132, [[66, 120], [94, 120]]],
      hipflexors: ["r", 112, [[74, 132]]], adductors: ["r", 148, [[88, 156], [72, 156]]], hamstrings: ["r", 184, [[96, 182], [64, 182]]], ankles: ["r", 216, [[98, 220], [62, 220]]],
    },
    muscles: {
      shoulders: ["l", 26, [[54, 46], [106, 46]]], chest: ["l", 58, [[70, 60], [90, 60]]], arms: ["l", 90, [[42, 96], [118, 96]]], back: ["l", 122, [[80, 80]]], core: ["l", 154, [[80, 104]]],
      glutes: ["r", 100, [[94, 118], [66, 118]]], quads: ["r", 132, [[97, 144], [63, 144]]], adductors: ["r", 162, [[86, 162], [74, 162]]], hamstrings: ["r", 192, [[96, 186], [64, 186]]], calves: ["r", 220, [[98, 206], [62, 206]]],
    },
  };
  const BODY_H = 214, BODY_S = BODY_H / 236; // the figure is drawn 214 px tall (app.css .bm-body)
  function renderBody() {
    const map = $("focuses"), on = picked(), at = SPOTS[state.mode === "morning" ? "morning" : "muscles"];
    map.querySelectorAll("button").forEach((b) => b.remove());
    // Whole body, Upper body or Lower body: one tap picks that whole half (or clears the picks).
    const half = (k) => (k === "all" ? [] : HALVES[k][state.mode === "morning" ? "areas" : "muscles"]);
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    for (const b of $("halves").children) b.setAttribute("aria-checked", String(same(on, half(b.dataset.half))));
    map.insertAdjacentHTML("beforeend", choices().filter(([k]) => at[k]).map(([k, label]) => {
      const [side, y] = at[k];
      return `<button class="bm-tag bm-${side}" role="checkbox" data-focus="${k}" aria-checked="${on.includes(k)}" style="top:${Math.round(4 + y * BODY_S) - 15}px">${label}</button>`;
    }).join(""));
    $("bm-spots").innerHTML = Object.entries(at).filter(([k]) => choices().some(([c]) => c === k)).map(([k, [, , pts]]) =>
      pts.map(([x, y]) => `<circle class="bm-spot${on.includes(k) ? " on" : ""}" cx="${x}" cy="${y}" r="6"/>`).join("")).join("");
    drawLeads();
  }
  // The lines run from each label's inner edge to its first spot, so they follow the labels' real widths.
  function drawLeads() {
    const map = $("focuses"), body = map.querySelector(".bm-body"), at = SPOTS[state.mode === "morning" ? "morning" : "muscles"];
    if (!map.offsetWidth) return;
    const mr = map.getBoundingClientRect(), br = body.getBoundingClientRect(); // an svg has no offsetLeft
    const bx = br.left - mr.left, by = br.top - mr.top, s = br.width / 160;
    $("bm-lead").innerHTML = [...map.querySelectorAll(".bm-tag")].map((b) => {
      const [side, , [[x, y]]] = at[b.dataset.focus];
      const x1 = side === "l" ? b.offsetLeft + b.offsetWidth : b.offsetLeft, y1 = b.offsetTop + b.offsetHeight / 2;
      return `<line class="${b.getAttribute("aria-checked") === "true" ? "on" : ""}" x1="${x1}" y1="${y1}" x2="${(bx + x * s).toFixed(1)}" y2="${(by + y * s).toFixed(1)}"/>`;
    }).join("");
  }
  addEventListener("resize", drawLeads);
  if (document.fonts) document.fonts.ready.then(drawLeads);

  // Your gear: off until picked, remembered until unticked, and only gear that has moves this app can draw.
  const gearHave = () => Object.keys(GEAR).filter((g) => MOVES.some((m) => m.gear === g && HAVE.includes(m.id)));
  const gearOn = () => state.gear.filter((g) => gearHave().includes(g));
  function renderGear() {
    const have = gearHave();
    $("gear").closest("section").hidden = !have.length || isForm();
    $("gear").innerHTML = have.map((g) => `<button role="checkbox" data-gear="${g}" aria-checked="${state.gear.includes(g)}"><svg class="ic"><use href="#i-${g}"/></svg>${GEAR[g]}</button>`).join("");
  }
  $("gear").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const g = b.dataset.gear;
    state.gear = state.gear.includes(g) ? state.gear.filter((x) => x !== g) : [...state.gear, g];
    save(); renderGear(); renderToday();
  });

  function renderTodayTitle() {
    $("today-title").textContent = `${COPY[session.mode].title}: ${session.steps.length} moves, about ${Math.round(session.seconds / 60)} min`;
  }
  // More or fewer moves than the length gives: Wiggle still picks which, and the length stays, so each move
  // gets fewer breaths (or more). Fewer stops where the moves left can't fill the length. Held only until
  // the length or the kind of session changes, or the app is closed.
  let extra = 0;
  function renderToday() {
    const level = levelFrom(state.history);
    session = build({ minutes: state.minutes, focus: picked(), mode: state.mode, level, off: state.off, prefs: state.prefs,
      history: state.history, today: dayKey(new Date()), have: HAVE, gear: gearOn(), extra });
    $("morefew").hidden = isForm();
    renderList();
  }
  function moreOrFewer(by) {
    const n = session.steps.length;
    extra += by; renderToday();
    const short = by < 0 && session.seconds < state.minutes * 60 - 45;
    if (session.steps.length !== n && !short) return;
    extra -= by; renderToday();
    toast(by > 0 ? `That's every move that fits in ${state.minutes} min.` : `Fewer moves won't fill ${state.minutes} min.`);
  }
  $("more").addEventListener("click", () => moreOrFewer(1));
  $("fewer").addEventListener("click", () => moreOrFewer(-1));
  function renderList() {
    renderTodayTitle();
    const level = session.level;
    $("adjust").textContent = level > 0 ? "Recent sessions felt easy, so the harder moves get more reps." :
      level < 0 ? "Recent sessions felt hard, so the breaths are slower and the harder moves shorter." : "";
    $("today-list").innerHTML = session.steps.map((s, i) => `<li>${thumb(s)}<span class="mv"><span>${s.name}</span><span class="muted small">${s.count}</span></span>
      ${s.fixed ? "" : `<button class="swap" data-i="${i}" aria-label="Swap ${s.name} for another move">Swap</button>`}</li>`).join("");
  }
  $("today-list").addEventListener("click", (e) => {
    const b = e.target.closest(".swap"); if (!b) return;
    const next = swap(session, +b.dataset.i);
    if (!next) { toast("No other move fits here."); return; }
    session = next; renderList();
  });

  // A small stick figure of the move's first pose, from its clip (or the hand-made pose), fitted to its box.
  function thumb(step) {
    const pose = step.segs[0][0];
    let F, front = false;
    try {
      const loop = loopOf(pose), p = poseOf(pose);
      if (loop && CLIPS[loop]) { F = frameAt(CLIPS[loop], 0, false); front = CLIPS[loop].view === "front"; }
      else if (p && CLIPS[p[0]] && (CLIPS[p[0]].keys[p[1]] || []).length) { F = frameAt(CLIPS[p[0]], CLIPS[p[0]].keys[p[1]][0], p[2]); front = CLIPS[p[0]].view === "front"; }
      else F = handFrame(pose);
    } catch { return `<svg class="thumb" aria-hidden="true"></svg>`; }
    const xs = F.filter((_, j) => j % 2 === 0), ys = F.filter((_, j) => j % 2 === 1);
    const x0 = Math.min(...xs) - 16, x1 = Math.max(...xs) + 16, y0 = Math.min(...ys) - 16, y1 = Math.max(...ys) + 16;
    const w = Math.max(x1 - x0, (y1 - y0) * 1.3), h = w / 1.3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const pt = (k) => `${F[2 * k].toFixed(0)} ${F[2 * k + 1].toFixed(0)}`;
    const gear = GEARDRAW ? GEARDRAW.shapes(step.id, F) : { back: "", front: "" };
    const path = (a, b, cls) => `<path ${cls ? `class="${cls}" ` : ""}d="M${Array.from({ length: b - a + 1 }, (_, k) => pt(a + k)).join("L")}"/>`;
    return `<svg class="thumb" aria-hidden="true" viewBox="${(cx - w / 2).toFixed(0)} ${(cy - h / 2).toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}">
      ${gear.back}${path(10, 13, front ? "" : "far")}${path(18, 21, front ? "" : "far")}${path(0, 4)}${path(6, 9)}${path(14, 17)}<circle cx="${F[10]}" cy="${F[11]}" r="15"/>${gear.front}</svg>`;
  }

  // Keep my music playing: Wiggle's sound mixes with music from another app instead of pausing it.
  // Safari's "ambient" sound does that, but the phone mutes it when it locks (and on silent), so with
  // music on the session pauses when the screen goes off, and the screen stays on while it plays.
  const canMix = "audioSession" in navigator;
  const mixing = () => canMix && !!state.music;
  function setMix() { try { if (canMix) navigator.audioSession.type = mixing() ? "ambient" : "auto"; } catch {} }
  function renderMusic() {
    $("music").hidden = !canMix;
    $("music").setAttribute("aria-checked", String(!!state.music));
    $("music-note").textContent = state.music
      ? "Plays under the voice. Locking the phone pauses Wiggle."
      : "Wiggle pauses your music. The voice carries on locked.";
  }
  $("music").addEventListener("click", () => { state.music = !state.music; save(); renderMusic(); });
  // The settings row says what the figure is now, so you needn't open the sheet to check.
  function renderFigureRow() {
    const head = (LOOK.HEADS.find(([k]) => k === state.head) || LOOK.HEADS[0])[1];
    $("figure-sub").textContent = `${state.figure === "3d" ? "3D" : "Flat"}, ${head.toLowerCase()} head`;
  }

  function renderHome() { carry(); renderWeek(); renderPick(); renderGear(); renderMusic(); renderFigureRow(); renderToday(); }

  $("lengths").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.minutes = +b.dataset.min; extra = 0; save(); renderPick(); renderToday();
  });
  $("modes").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.mode = b.dataset.mode; extra = 0; save(); renderPick(); renderGear(); renderToday(); // Qigong hides the gear
  });
  $("halves").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const k = b.dataset.half, all = k === "all" || b.getAttribute("aria-checked") === "true"; // tap a picked half again for the whole body
    state.areas[state.mode] = all ? [] : HALVES[k][state.mode === "morning" ? "areas" : "muscles"].slice();
    save(); renderPick(); renderToday();
  });
  // Tap an area to add it, tap again to take it off.
  $("focuses").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const k = b.dataset.focus, on = picked();
    state.areas[state.mode] = k === "all" ? [] : on.includes(k) ? on.filter((a) => a !== k) : [...on, k];
    save(); renderPick(); renderToday();
  });

  // moves on/off
  // moves: more often, less often or never (Fitbod's three), grouped by where the body is
  const GROUPS = [["lying", "Lying down"], ["seated", "Sitting"], ["allfours", "Hands and knees"], ["kneeling", "Kneeling"], ["rising", "Getting up"], ["standing", "Standing"]];
  const prefOf = (id) => (state.off.includes(id) ? "never" : state.prefs[id] || "normal");
  $("open-moves").addEventListener("click", () => {
    const usable = MOVES.filter((m) => !m.form && HAVE.includes(m.id) && (!m.gear || gearOn().includes(m.gear)));
    $("move-list").innerHTML = GROUPS.map(([pos, label]) => {
      const ms = usable.filter((m) => m.position === pos);
      if (!ms.length) return "";
      return `<li class="grp">${label}</li>` + ms.map((m) => `<li><label><span><span>${m.name}</span>
        <span class="muted small">${m.areas.map((a) => AREAS[a]).join(", ") || "Whole body"}</span></span>
        ${m.keep ? `<span class="muted small">Always in</span>` : `<select data-id="${m.id}" aria-label="How often: ${m.name}">
          ${[["normal", "Normal"], ["more", "More"], ["less", "Less"], ["never", "Never"]].map(([v, t]) => `<option value="${v}" ${prefOf(m.id) === v ? "selected" : ""}>${t}</option>`).join("")}
        </select>`}</label></li>`).join("");
    }).join("");
    $("moves").showModal();
  });
  $("move-list").addEventListener("change", (e) => {
    const id = e.target.dataset.id, v = e.target.value;
    state.off = v === "never" ? [...new Set([...state.off, id])] : state.off.filter((x) => x !== id);
    if (v === "more" || v === "less") state.prefs[id] = v; else delete state.prefs[id];
    save(); renderToday();
  });

  // ---- your figure: pick a head ----
  // The preview draws the bow, a standing move, so the head shows clearly; it runs only while the sheet is open.
  const paintPrev = LOOK.mount($("figprev"), "60 70 280 222");
  const PREV = [["bowN", 3, "in"], ["bowRest", 4.5, "out"], ["bowF", 3, "in"], ["bowRest", 4.5, "out"]];
  let prevRaf = 0;
  function preview(now) {
    const t = now / 1000, total = PREV.reduce((a, s) => a + s[1], 0);
    let u = t % total, i = 0;
    while (u > PREV[i][1]) { u -= PREV[i][1]; i++; }
    const from = PREV[(i + PREV.length - 1) % PREV.length][0], [to, d, breath] = PREV[i];
    paintPrev(handFrame(mix(R[from], R[to], ease(u / d))), { head: state.head, breath, t });
    prevRaf = requestAnimationFrame(preview);
  }
  function renderMode() {
    $("figmode").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.fig === state.figure)));
    const note = $("fignote");
    note.hidden = !(state.figure === "3d" && !p3.ready && p3.tried);
    note.textContent = "3D isn't ready yet, so sessions play flat for now.";
  }
  $("figmode").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.figure = b.dataset.fig; save(); renderMode();
    if (state.figure === "3d") { await prepare3d(); renderMode(); }
    else p3.stop();
  });
  function renderHeads() {
    $("heads").innerHTML = LOOK.HEADS.map(([k, label]) =>
      `<button type="button" role="radio" data-head="${k}" aria-checked="${k === state.head}">${LOOK.headIcon(k)}<span>${label}</span></button>`).join("");
  }
  $("open-figure").addEventListener("click", () => {
    renderHeads(); renderMode();
    $("figure").showModal();
    $("heads").querySelector('[aria-checked="true"]').focus(); // not the first head, which would look picked
    cancelAnimationFrame(prevRaf); prevRaf = requestAnimationFrame(preview);
  });
  $("figure").addEventListener("close", () => { cancelAnimationFrame(prevRaf); renderFigureRow(); });
  $("heads").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.head = b.dataset.head; save(); renderHeads();
  });

  // ---- player ----
  const paint = LOOK.mount($("figwrap"), "30 40 340 255");
  // The 3D figure (figure3d.js): clips in clips3d/, loaded only once you pick 3D. If they can't load, the session stays flat.
  const p3 = window.FIG3D.player($("fig3d"), LOOK, "clips3d/");
  const sw = (msg) => { try { navigator.serviceWorker && navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage(msg)); } catch {} };
  // Get 3D ready: the manifest and head track now, the clips stored by the service worker for offline, and the browser asked
  // to keep them. Returns true when 3D can play.
  async function prepare3d() {
    const ok = await p3.load();
    if (ok) { sw({ type: "clips" }); try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {} }
    return ok;
  }
  // Offline with a clip this session needs not stored: play this session flat rather than stall.
  async function clipsHere() {
    if (navigator.onLine !== false || !window.caches) return true;
    for (const f of p3.files()) if (!(await caches.match("clips3d/" + f, { ignoreSearch: true }))) return false;
    return true;
  }
  if (state.figure === "3d") prepare3d();
  const svg = $("figwrap").querySelector("svg");
  // The gear (gear.js): the roller goes behind the figure, the stick and the gun in front of it.
  svg.querySelector(".fg-floor").insertAdjacentHTML("afterend", `<g class="fg-gear-back"></g>`);
  svg.insertAdjacentHTML("beforeend", `<g class="fg-gear-front"></g>`);
  let gearDrawn = "";
  function drawGear(id, F) {
    const g = GEARDRAW && F ? GEARDRAW.shapes(id, F) : { back: "", front: "" };
    if (g.back + "|" + g.front === gearDrawn) return;
    gearDrawn = g.back + "|" + g.front;
    svg.querySelector(".fg-gear-back").innerHTML = g.back;
    svg.querySelector(".fg-gear-front").innerHTML = g.front;
  }
  const ease = (x) => (1 - Math.cos(Math.PI * x)) / 2;

  let tl = null, t = 0, playing = false, last = 0, si = 0, lastStep = -9, raf = 0, wake = null, audio = null;
  // The sound guide: when on, the session's one track (sound.js) is the clock, and the screen follows it.
  const track = $("track");
  let soundOn = false, trackUrl = null;
  function setTrack(blob) {
    if (trackUrl) URL.revokeObjectURL(trackUrl);
    trackUrl = URL.createObjectURL(blob);
    track.src = trackUrl;
  }
  const seek = (to) => { t = to; if (soundOn) track.currentTime = to; };

  function beep() {
    if (!state.sound || !audio || soundOn) return; // the track has its own chime
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 660; o.type = "sine";
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.6);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.65);
  }

  async function keepAwake() {
    try { if ("wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => (wake = null)); } } catch {}
  }
  function letSleep() { try { wake && wake.release(); } catch {} wake = null; }

  // ---- real-motion figure (clips.js) ----
  // A hand-made pose (its name, or a resolved pose) as the same 44 numbers a clip frame uses (see clips.js),
  // so the two can blend.
  function handFrame(pose) {
    const J = joints(typeof pose === "string" ? R[pose] : pose);
    const q = (u) => [(1 - u) * (1 - u) * J.hip[0] + 2 * u * (1 - u) * J.ctrl[0] + u * u * J.sh[0], (1 - u) * (1 - u) * J.hip[1] + 2 * u * (1 - u) * J.ctrl[1] + u * u * J.sh[1]];
    const limb = (root, c) => [root, ...c];
    return [J.hip, q(1 / 3), q(2 / 3), J.sh, J.neck, J.head,
      ...limb(J.sh, J.nh), ...limb(J.sh, J.fh), ...limb(J.hip, J.nf), ...limb(J.hip, J.ff)].flat();
  }

  let in3d = false;
  function render() {
    const segs = tl.segs;
    while (si < segs.length - 1 && t >= segs[si].t0 + segs[si].d) si++;
    while (si > 0 && t < segs[si].t0) si--;
    const g = segs[si];
    const x = Math.min(1, Math.max(0, (t - g.t0) / g.d));
    const bx = g.part ? ease(g.part[0] + (g.part[1] - g.part[0]) * x) : ease(x);
    const gearId = g.step >= 0 ? session.steps[g.step].id : null;
    // Seen from the front, both sides are equally near, so all four limbs are drawn near.
    const look = { head: state.head, breath: g.breath, t };
    // 3D: the pre-rendered clips cover the flat figure. A move with no 3D clip (or a failed one) shows the flat figure.
    const want3 = state.figure === "3d" && p3.available();
    if (want3 !== in3d) { in3d = want3; if (want3) p3.jump(); else p3.stop(); }
    const flat = want3 ? p3.frame(t, playing, look) : true;
    if (!flat) drawGear(gearId, null);
    else if (!g.motion || g.motion.mode === "hand") { paint(handFrame(mix(R[g.from], R[g.to], ease(x))), look); drawGear(gearId, null); }
    else { const { F, front } = segmentFrame(CLIPS, g.motion, x, t - g.t0, handFrame); paint(F, { ...look, front }); drawGear(gearId, F); }

    if (g.step !== lastStep) {
      if (g.step >= 0 && lastStep !== -9) beep();
      lastStep = g.step;
      if (g.step < 0) {
        $("kicker").textContent = "Get ready";
        $("name").textContent = MODES[session.mode].from === "stand" ? "Start standing" : "Start on hands and knees";
        $("count").textContent = `${session.steps.length} moves`;
      } else {
        const s = session.steps[g.step];
        $("kicker").textContent = `${g.step + 1} of ${session.steps.length}`;
        $("name").textContent = s.name;
        $("count").textContent = s.count;
      }
      $("swap").disabled = g.step < 0 || session.steps[g.step].fixed;
    }
    const s = g.step >= 0 ? session.steps[g.step] : null;
    $("stepfill").style.width = s ? `${(100 * Math.min(1, (t - s.t0) / (s.t1 - s.t0))).toFixed(2)}%` : "0";
    if ($("cap").textContent !== g.cap) $("cap").textContent = g.cap;
    const b = $("breath"), fill = $("bfill");
    const word = g.breath === "in" ? "Breathe in" : g.breath === "out" ? "Breathe out" : "";
    if (b.textContent !== word) b.textContent = word;
    b.style.color = g.breath === "in" ? "var(--in-ink)" : "var(--out-ink)";
    fill.style.background = g.breath === "in" ? "var(--in)" : "var(--out)";
    fill.style.transform = `scaleX(${g.breath === "in" ? bx.toFixed(4) : g.breath === "out" ? (1 - bx).toFixed(4) : 0})`;
    $("progfill").style.width = `${(100 * Math.min(1, t / tl.total)).toFixed(2)}%`;
    $("left").textContent = fmt(Math.max(0, tl.total - t));
  }

  function frame(now) {
    if (soundOn) {
      if (track.ended) { t = tl.total; render(); finish(true); return; }
      t = Math.min(track.currentTime, tl.total - 0.001); // the track runs a little past the last move, to say "Done"
      render();
    } else if (playing) {
      t += Math.min(0.25, (now - last) / 1000); // cap a stalled frame so the figure never jumps a whole breath
      last = now;
      if (t >= tl.total) { t = tl.total; render(); finish(true); return; }
      render();
    }
    raf = requestAnimationFrame(frame);
  }

  function setPlaying(p) {
    playing = p; last = performance.now();
    $("pause").setAttribute("aria-label", p ? "Pause" : "Play");
    p ? keepAwake() : letSleep();
    if (soundOn) { if (p) track.play().catch(() => {}); else track.pause(); }
  }
  // Pause and play from the headphones or the lock screen reach the track first; the screen follows.
  track.addEventListener("pause", () => { if (soundOn && playing && !track.ended) setPlaying(false); });
  track.addEventListener("play", () => { if (soundOn && !playing) setPlaying(true); });
  track.addEventListener("ended", () => { if (soundOn) { t = tl.total; finish(true); } });

  // The voice is on unless you turn it off; the player's one sound button turns it off and on as it plays.
  function renderSound() {
    $("sound").setAttribute("aria-pressed", String(!!state.voiceOn));
    $("sound").setAttribute("aria-label", state.voiceOn ? "Voice on" : "Voice off");
  }

  // Flat or 3D, switchable as it plays: the next frame draws the other one, on the same moment.
  function renderLook() {
    $("look").dataset.on = state.figure === "3d" ? "3d" : "flat";
    $("look").setAttribute("aria-label", `Figure style: ${state.figure === "3d" ? "3D" : "Flat"}. Tap to switch.`);
  }
  $("look").addEventListener("click", async () => {
    const to = state.figure === "3d" ? "flat" : "3d";
    if (to === "3d") {
      p3.unlock();
      if (!(await prepare3d())) { toast("3D isn't ready yet."); return; }
      if (tl) { p3.set(tl.segs, session); if (!(await clipsHere())) p3.broken = true; }
    }
    state.figure = to; save(); renderLook();
    if (to === "flat") p3.stop();
    if (!playing) render();
  });

  // Build the session's track and start it. A phone only plays sound a tap started, and the track takes
  // a moment to build, so a moment of silence starts the player inside the tap; the track then takes over.
  // Returns the timeline the track was built for, or null if it couldn't start (the session then runs silent).
  async function startTrack() {
    try {
      setMix();
      setTrack(SOUND.silence());
      const tapped = track.play();
      const { index } = await SOUND.load();
      const line = timeline(session, SOUND.leads(session, index));
      const blob = await SOUND.buildTrack(SOUND.cues(session, line, index));
      await tapped.catch(() => {});
      setTrack(blob);
      await track.play();
      return line;
    } catch (e) {
      try { track.pause(); } catch {}
      toast("The sound guide couldn't start, so this one is on screen only.");
      return null;
    }
  }
  function lockScreen() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: `${MODES[session.mode].label}, ${session.minutes} min`, artist: "Wiggle",
        artwork: [{ src: "icon-512.png", sizes: "512x512", type: "image/png" }] });
      navigator.mediaSession.setActionHandler("play", () => setPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setPlaying(false));
      navigator.mediaSession.setActionHandler("nexttrack", () => $("skip").click());
      navigator.mediaSession.setActionHandler("previoustrack", () => $("back").click());
    } catch {}
  }

  let starting = false;
  async function start() {
    if (starting) return;
    soundOn = false;
    if (state.figure === "3d") p3.unlock(); // inside the tap, before anything is awaited
    let line = null;
    if (state.voiceOn) {
      starting = true; $("start").disabled = true; $("start").textContent = "Getting the voice ready…";
      line = await startTrack();
      starting = false; $("start").disabled = false; $("start").textContent = "Start";
    }
    soundOn = !!line;
    track.muted = false;
    tl = line || timeline(session);
    if (state.figure === "3d" && !p3.ready) await Promise.race([prepare3d(), new Promise((r) => setTimeout(r, 2500))]);
    annotate(tl.segs, CLIPS); p3.set(tl.segs, session);
    if (state.figure === "3d" && p3.available() && !(await clipsHere())) p3.broken = true;
    t = 0; si = 0; lastStep = -9;
    if (soundOn) lockScreen();
    else { setMix(); try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {} }
    show("play"); renderSound(); renderLook(); render(); setPlaying(true);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }

  const stepIndex = () => tl.segs[si].step;
  function seekStep(i) {
    seek(i >= session.steps.length ? tl.total - 0.01 : i < 0 ? 0 : session.steps[i].t0);
    last = performance.now(); render();
  }
  $("skip").addEventListener("click", () => seekStep(stepIndex() + 1));
  $("back").addEventListener("click", () => {
    const i = stepIndex();
    const into = i >= 0 ? t - session.steps[i].t0 : t;
    seekStep(into < 3 ? i - 1 : i);
  });
  $("pause").addEventListener("click", () => setPlaying(!playing));
  // Put a freshly built track in charge, from the start of move i (or the very start), playing or paused as before.
  function takeTrack(line, i, was) {
    tl = line; annotate(tl.segs, CLIPS); p3.set(tl.segs, session);
    soundOn = true; lockScreen();
    si = 0; lastStep = -9;
    seek(i < 0 ? 0 : session.steps[i].t0);
    setPlaying(was); render();
  }
  // Swap the move playing now for another, from the start of its "Next:" lead-in. With the voice on,
  // the track is built again for the new session; it keeps its place and whether the voice was muted.
  $("swap").addEventListener("click", async () => {
    if (starting) return;
    const i = stepIndex();
    const next = i >= 0 && swap(session, i);
    if (!next) { toast("No other move fits here."); return; }
    session = next;
    const was = playing;
    if (soundOn) {
      const muted = track.muted;
      setPlaying(false); soundOn = false; starting = true;
      const line = await startTrack();
      starting = false;
      if (line) { takeTrack(line, i, was); track.muted = muted; return; }
    }
    tl = timeline(session);
    annotate(tl.segs, CLIPS); p3.set(tl.segs, session);
    si = 0; lastStep = -9;
    t = session.steps[i].t0;
    setPlaying(was); render();
  });
  // Voice off mutes the track, which stays the clock. Voice on in a session that started without it
  // builds the track now and carries on from the start of the move you are in.
  $("sound").addEventListener("click", async () => {
    if (starting) return;
    state.voiceOn = !state.voiceOn; save(); renderSound();
    if (soundOn) { track.muted = !state.voiceOn; return; }
    if (!state.voiceOn) return;
    const i = stepIndex(), was = playing;
    starting = true;
    const line = await startTrack();
    starting = false;
    if (!line) { state.voiceOn = false; save(); renderSound(); return; }
    takeTrack(line, i, was); track.muted = false;
  });
  $("stop").addEventListener("click", () => finish(false));
  $("start").addEventListener("click", start);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing && (!soundOn || track.muted || mixing())) setPlaying(false); // the clock waits while the phone is locked; with the voice on, it plays on, unless it is mixed with your music, which the phone mutes when locked
    if (!document.hidden && p3.available()) p3.jump(); // unlocked: the videos may have been stopped; land on the right moment
    if (!document.hidden && playing) keepAwake(); // the phone drops the wake lock when the page hides; take it again on the way back
  });

  // ---- done ----
  let pending = null;
  function finish(complete) {
    setPlaying(false); cancelAnimationFrame(raf);
    soundOn = false;
    const seconds = Math.round(Math.min(t, tl.total));
    const doneSteps = tl.segs[si].step + (complete ? 1 : 0);
    if (seconds < 60) { show("home"); renderHome(); return; }
    const now = new Date();
    pending = { at: now.toISOString(), day: dayKey(now), minutes: session.minutes, mode: session.mode, focus: session.focus, seconds, moves: Math.max(0, doneSteps), complete,
      ids: session.steps.slice(0, Math.max(0, doneSteps)).map((s) => s.id) };
    state.history.push(pending); state.history = state.history.slice(-200); save();
    $("done-title").textContent = complete ? "Done." : "Stopped.";
    $("done-sub").textContent = `${Math.max(1, Math.round(seconds / 60))} minutes, ${Math.max(0, doneSteps)} moves.`;
    show("done");
  }
  document.querySelector(".feel").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !pending) return;
    pending.feel = b.dataset.feel; save(); pending = null;
    show("home"); renderHome(); toast("Saved. The next session takes it into account.");
  });
  $("no-feel").addEventListener("click", () => { pending = null; show("home"); renderHome(); });

  // For screenshots and checks: jump the player to a time in seconds.
  window.__seek = (sec) => { playing && setPlaying(false); seek(sec); render(); };

  renderHome();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  window.__p3 = p3; // for the checks in a browser
})();
