const test = require("node:test");
const assert = require("node:assert");
const { build, swap, timeline, levelFrom, lastDone, MOVES, AREAS, POSITIONS, secondsOf } = require("../public/plan.js");

const mins = (s) => s.seconds / 60;
const ids = (s) => s.steps.map((x) => x.id);
const reps = (s, id) => (s.steps.find((x) => x.id === id) || {}).reps;
const MODES_FIXED = { morning: "catcow", before: "catcow" };
const DAYS = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"];

test("the library has about 40 moves, each tagged with known areas and a position", () => {
  assert.ok(MOVES.length >= 38, `${MOVES.length} moves`);
  assert.strictEqual(new Set(MOVES.map((m) => m.id)).size, MOVES.length, "ids repeat");
  for (const m of MOVES) {
    assert.ok(POSITIONS[m.position], `${m.id}: position ${m.position}`);
    for (const a of m.areas) assert.ok(AREAS[a], `${m.id}: area ${a}`);
    assert.ok(m.keep || m.id === "shake" || m.id === "settle" || m.areas.length, `${m.id} has no area`);
  }
  for (const a of Object.keys(AREAS)) assert.ok(MOVES.filter((m) => m.areas.includes(a)).length >= 5, `few moves for ${a}`);
});

test("each length lands near its target, for every focus and day", () => {
  for (const m of [5, 10, 15]) for (const focus of ["all", ...Object.keys(AREAS)]) for (const today of DAYS.slice(0, 3)) {
    const s = build({ minutes: m, focus, today });
    assert.ok(mins(s) <= m + 0.3 && mins(s) >= m - 1, `${m} min ${focus} ${today}: got ${mins(s).toFixed(2)}`);
  }
});

test("cat-cow opens and stand still closes, and the moves go from the floor up", () => {
  for (const today of DAYS) for (const minutes of [5, 10, 15]) {
    const s = build({ minutes, today });
    assert.strictEqual(s.steps[0].id, "catcow");
    assert.strictEqual(s.steps.at(-1).id, "still");
    const rank = s.steps.slice(1, -1).map((x) => POSITIONS[x.position]);
    assert.deepStrictEqual(rank, rank.slice().sort((a, b) => a - b), `${today}: ${ids(s)}`);
  }
});

test("a different day gives a different session; the same day gives the same one", () => {
  const a = ids(build({ today: DAYS[0] })), b = ids(build({ today: DAYS[1] }));
  assert.notDeepStrictEqual(a, b);
  assert.deepStrictEqual(ids(build({ today: DAYS[0] })), a);
});

test("over a week of daily sessions, most of the library gets used", () => {
  const history = [], seen = new Set();
  for (const today of DAYS) {
    const s = build({ minutes: 10, today, history });
    s.steps.forEach((x) => seen.add(x.id));
    history.push({ day: today, ids: ids(s) });
  }
  assert.ok(seen.size >= 30, `only ${seen.size} moves in a week`);
});

test("a move done yesterday is less likely than one not done for days", () => {
  const today = "2026-11-12";
  let again = 0;
  for (const day of DAYS) {
    const first = build({ minutes: 10, today: day });
    const yesterday = { day: "2026-11-11", ids: ids(first) };
    const next = build({ minutes: 10, today, history: [yesterday] });
    again += ids(next).filter((id) => ids(first).includes(id) && !["catcow", "still"].includes(id)).length / (ids(first).length - 2);
  }
  assert.ok(again / DAYS.length < 0.35, `${(100 * again / DAYS.length).toFixed(0)}% repeated`);
});

test("a focus fills most of the session with moves for that area", () => {
  for (const focus of Object.keys(AREAS)) {
    const s = build({ minutes: 10, focus, today: DAYS[2] });
    const mid = s.steps.slice(1, -1);
    const hits = mid.filter((x) => MOVES.find((m) => m.id === x.id).areas.includes(focus)).length;
    assert.ok(hits >= Math.min(3, mid.length / 2), `${focus}: ${hits} of ${mid.length} (${ids(s)})`);
  }
});

test("never leaves a move out; more and less change how often it comes up", () => {
  const count = (opts) => DAYS.concat(["2026-12-01", "2026-12-02", "2026-12-03"]).filter((today) => ids(build({ minutes: 10, today, ...opts })).includes("bridge")).length;
  assert.strictEqual(count({ off: ["bridge"] }), 0);
  assert.ok(count({ prefs: { bridge: "more" } }) > count({}), "more");
  assert.ok(count({ prefs: { bridge: "less" } }) <= count({}), "less");
  const s = build({ minutes: 10, off: ["catcow", "still"] });
  assert.ok(ids(s).includes("catcow") && ids(s).includes("still"), "cat-cow and stand still stay");
});

test("only moves that can be drawn are used", () => {
  const have = ["catcow", "still", "thread", "bridge", "squat"];
  const s = build({ minutes: 15, have });
  assert.ok(ids(s).every((id) => have.includes(id)), ids(s).join());
});

test("swap replaces a move with an unused one of the same position, taking about the same time", () => {
  const s = build({ minutes: 10, today: DAYS[3] });
  const i = 2, old = s.steps[i];
  const w = swap(s, i);
  const neu = w.steps[i];
  assert.notStrictEqual(neu.id, old.id);
  assert.ok(!ids(s).includes(neu.id), "already in the session");
  assert.strictEqual(neu.position, old.position);
  assert.ok(Math.abs(secondsOf(neu.segs) - secondsOf(old.segs)) < 20, `${secondsOf(old.segs)} -> ${secondsOf(neu.segs)}`);
  assert.deepStrictEqual(ids(w).filter((_, k) => k !== i), ids(s).filter((_, k) => k !== i));
  // Swapping again never brings the first move back.
  const w2 = swap(w, i);
  assert.ok(![old.id, neu.id].includes(w2.steps[i].id));
  // Cat-cow and stand still can't be swapped.
  assert.strictEqual(swap(s, 0), null);
  assert.strictEqual(swap(s, s.steps.length - 1), null);
});

test("easy sessions add reps to demanding moves; hard ones slow the breath", () => {
  const today = DAYS.find((d) => ids(build({ minutes: 15, today: d, level: 2 })).includes("wgs") && ids(build({ minutes: 15, today: d })).includes("wgs"));
  if (today) assert.ok(reps(build({ minutes: 15, today, level: 2 }), "wgs") >= reps(build({ minutes: 15, today }), "wgs"));
  const cc = (s) => s.steps.find((x) => x.id === "catcow").segs;
  assert.ok(cc(build({ level: -2 }))[0][1] > cc(build({}))[0][1]);
});

test("level comes from the last three answers", () => {
  assert.strictEqual(levelFrom([]), 0);
  assert.strictEqual(levelFrom([{ feel: "easy" }, { feel: "easy" }]), 2);
  assert.strictEqual(levelFrom([{ feel: "easy" }, { feel: "hard" }, { feel: "hard" }, { feel: "hard" }]), -2);
  assert.strictEqual(levelFrom([{ feel: "easy" }, {}, { feel: "right" }]), 1);
});

test("days since a move was done come from history", () => {
  const d = lastDone([{ day: "2026-11-10", ids: ["a", "b"] }, { day: "2026-11-12", ids: ["a"] }, { day: "2026-11-01" }], "2026-11-12");
  assert.deepStrictEqual(d, { a: 0, b: 2 });
});

test("the timeline is continuous", () => {
  const { segs, total } = timeline(build({ minutes: 15, focus: "spine" }));
  let t = 0;
  for (const g of segs) { assert.ok(Math.abs(g.t0 - t) < 1e-9); t += g.d; }
  assert.ok(Math.abs(total - t) < 1e-9);
});

// ---- before and after a workout ----
const { MODES } = require("../public/plan.js");
const move = (id) => MOVES.find((m) => m.id === id);
const PAIRS = [["hips", "hamstrings"], ["shoulders", "upperback"], ["ankles", "adductors", "hipflexors"]];

test("before and after a workout land near the target too, for one area or several", () => {
  for (const mode of ["before", "after"]) for (const m of [5, 10, 15]) for (const focus of ["all", ...Object.keys(AREAS), ...PAIRS]) for (const today of DAYS.slice(0, 3)) {
    const s = build({ minutes: m, focus, mode, today });
    assert.ok(mins(s) <= m + 0.3 && mins(s) >= m - 1, `${mode} ${m} min ${focus} ${today}: got ${mins(s).toFixed(2)}`);
  }
});

test("before a workout: only moving stretches, cat-cow first, the shake last, from the floor up", () => {
  for (const today of DAYS) for (const minutes of [5, 10, 15]) for (const focus of ["all", "hips", PAIRS[0]]) {
    const s = build({ minutes, focus, mode: "before", today });
    assert.deepStrictEqual(ids(s).filter((id) => move(id).type === "hold" || id === "still"), [], `${today}: ${ids(s)}`);
    assert.strictEqual(s.steps[0].id, "catcow");
    assert.strictEqual(s.steps.at(-1).id, "shake");
    const rank = s.steps.slice(1, -1).map((x) => POSITIONS[x.position]);
    assert.deepStrictEqual(rank, rank.slice().sort((a, b) => a - b), `${today}: ${ids(s)}`);
  }
});

test("after a workout: mostly holds, nothing demanding, from standing down to the floor, on a slower breath", () => {
  for (const today of DAYS) for (const minutes of [5, 10, 15]) for (const focus of ["all", "hips", PAIRS[0]]) {
    const s = build({ minutes, focus, mode: "after", today });
    const bad = ids(s).filter((id) => move(id).demanding || move(id).type === "loop" || id === "shake" || id === "still");
    assert.deepStrictEqual(bad, [], `${today}: ${ids(s)}`);
    const holds = ids(s).filter((id) => move(id).type === "hold").length;
    assert.ok(holds >= s.steps.length / 2, `${today} ${minutes} ${focus}: ${holds} holds in ${ids(s)}`);
    const rank = s.steps.map((x) => POSITIONS[x.position]);
    assert.deepStrictEqual(rank, rank.slice().sort((a, b) => b - a), `${today}: ${ids(s)}`);
    assert.ok(s.steps.every((x) => !x.fixed), "nothing is fixed after a workout");
  }
  assert.ok(build({ mode: "after" }).pace.out > build({}).pace.out && build({ mode: "before" }).pace.out < build({}).pace.out);
  assert.ok(build({ mode: "after", level: -2 }).pace.out > build({ mode: "after" }).pace.out, "hard sessions slow it further");
});

test("a hold lasts longer after a workout than in the morning", () => {
  const today = DAYS.find((d) => ids(build({ today: d, focus: "hips" })).includes("pigeon") && ids(build({ today: d, focus: "hips", mode: "after" })).includes("pigeon"));
  assert.ok(today, "no day has pigeon in both");
  const secs = (mode) => secondsOf(build({ today, focus: "hips", mode }).steps.find((x) => x.id === "pigeon").segs);
  assert.ok(secs("after") > secs("morning"), `${secs("after")} vs ${secs("morning")}`);
});

test("several areas: the session works each of them", () => {
  for (const mode of Object.keys(MODES).filter((k) => !MODES[k].form)) for (const focus of PAIRS) for (const today of DAYS.slice(0, 3)) {
    const s = build({ minutes: 10, focus, mode, today });
    for (const a of focus) assert.ok(s.steps.some((x) => !x.fixed && move(x.id).areas.includes(a)), `${mode} ${focus} ${today}: nothing for ${a} in ${ids(s)}`);
    const mid = s.steps.filter((x) => !x.fixed);
    const hits = mid.filter((x) => focus.some((a) => move(x.id).areas.includes(a))).length;
    assert.ok(hits >= mid.length / 2, `${mode} ${focus}: ${hits} of ${mid.length}`);
  }
  // One area in a list is the same session as the area alone; an empty or unknown list is everything.
  assert.deepStrictEqual(ids(build({ focus: ["hips"], today: DAYS[1] })), ids(build({ focus: "hips", today: DAYS[1] })));
  assert.deepStrictEqual(ids(build({ focus: [], today: DAYS[1] })), ids(build({ today: DAYS[1] })));
  assert.deepStrictEqual(ids(build({ focus: ["elbows"], today: DAYS[1] })), ids(build({ today: DAYS[1] })));
});

test("the morning, a warm-up and a cool-down on one day are three different sessions", () => {
  const [a, b, c] = ["morning", "before", "after"].map((mode) => ids(build({ mode, today: DAYS[0] })));
  assert.notDeepStrictEqual(a, b); assert.notDeepStrictEqual(a, c); assert.notDeepStrictEqual(b, c);
  assert.deepStrictEqual(ids(build({ mode: "nonsense", today: DAYS[0] })), a);
});

test("swap keeps to the kind of session", () => {
  const w = build({ minutes: 10, mode: "before", today: DAYS[3] });
  assert.strictEqual(swap(w, 0), null);
  assert.strictEqual(swap(w, w.steps.length - 1), null, "the shake closes a warm-up");
  let s = w;
  for (let k = 0; k < 6; k++) { s = swap(s, 2); assert.ok(s && move(s.steps[2].id).type !== "hold" && s.steps[2].id !== "still", ids(s).join()); }
  let c = build({ minutes: 10, mode: "after", today: DAYS[3] });
  for (let k = 0; k < 6; k++) { c = swap(c, 0); const m = move(c.steps[0].id); assert.ok(!m.demanding && m.type !== "loop" && !["shake", "still"].includes(m.id), m.id); }
});

// ---- Qigong: the Eight Brocades ----
const FORM = ["settle", "sky", "bow", "heaven", "owl", "sway", "feet", "punch", "bounce", "still"];

test("qigong is always the whole form in order, whatever the day, focus, gear or more/less", () => {
  for (const today of DAYS.slice(0, 3)) for (const minutes of [5, 10, 15]) for (const focus of ["all", "hips", ["hamstrings", "shoulders"]]) {
    const s = build({ mode: "qigong", minutes, focus, today, gear: ["roller"], off: ["sky", "still"], prefs: { owl: "less" } });
    assert.deepStrictEqual(ids(s), FORM, `${minutes} min ${focus} ${today}`);
    assert.ok(mins(s) <= minutes + 0.3 && mins(s) >= minutes - 1, `${minutes} min: got ${mins(s).toFixed(2)}`);
    assert.ok(s.steps.every((x) => x.fixed), "no piece can be swapped");
    assert.strictEqual(swap(s, 3), null);
  }
});

test("qigong: the length changes only the breaths per piece, on a slow breath, starting standing", () => {
  const [a, b, c] = [5, 10, 15].map((minutes) => build({ mode: "qigong", minutes, today: DAYS[0] }));
  for (const id of FORM) assert.ok(reps(a, id) <= reps(b, id) && reps(b, id) <= reps(c, id), id);
  assert.ok(FORM.some((id) => reps(c, id) > reps(a, id)));
  assert.ok(build({ mode: "qigong" }).pace.out > build({}).pace.out);
  assert.strictEqual(timeline(build({ mode: "qigong" })).segs[0].from, "stand");
});

test("the qigong pieces stay out of the other sessions and their swaps", () => {
  const pieces = new Set(FORM.filter((id) => id !== "still"));
  for (const mode of ["morning", "before", "after"]) for (const today of DAYS) for (const minutes of [5, 15]) {
    let s = build({ mode, minutes, today, focus: ["shoulders", "hips"] });
    assert.ok(!ids(s).some((id) => pieces.has(id)), `${mode}: ${ids(s)}`);
    const i = s.steps.length >> 1;
    for (let k = 0; k < 4; k++) { s = swap(s, i) || s; assert.ok(!pieces.has(s.steps[i].id), s.steps[i].id); }
  }
});

test("a cool-down starts standing; the others start on hands and knees", () => {
  assert.strictEqual(timeline(build({ mode: "after" })).segs[0].from, "stand");
  assert.strictEqual(timeline(build({ mode: "before" })).segs[0].from, "table");
  assert.strictEqual(timeline(build({})).segs[0].from, "table");
});

// ---- muscle groups, for warm-ups and cool-downs ----
const { MUSCLES } = require("../public/plan.js");

test("every muscle group names real areas and moves, and has enough to draw on for a warm-up and a cool-down", () => {
  assert.ok(Object.keys(MUSCLES).length >= 9);
  for (const [k, g] of Object.entries(MUSCLES)) {
    assert.ok(g.label && g.areas.length && g.moves.length, k);
    for (const a of g.areas) assert.ok(AREAS[a], `${k}: area ${a}`);
    for (const id of g.moves) assert.ok(move(id), `${k}: move ${id}`);
    const fits = (mode) => MOVES.filter((m) => MODES[mode].can(m) && (g.moves.includes(m.id) || m.areas.some((a) => g.areas.includes(a)))).length;
    assert.ok(fits("before") >= 3 && fits("after") >= 3, `${k}: ${fits("before")} warm-up moves, ${fits("after")} cool-down moves`);
  }
});

test("a muscle group fills most of a warm-up or cool-down, led by the moves that work it directly", () => {
  const SETS = [...Object.keys(MUSCLES).map((k) => [k]), ["chest", "shoulders", "arms"], ["quads", "glutes", "hamstrings"], ["back", "arms"]];
  for (const mode of ["before", "after"]) for (const focus of SETS) for (const today of DAYS.slice(0, 3)) for (const minutes of [5, 10, 15]) {
    const s = build({ mode, minutes, focus, today });
    assert.ok(mins(s) <= minutes + 0.3 && mins(s) >= minutes - 1, `${mode} ${minutes} ${focus} ${today}: ${mins(s).toFixed(2)} min`);
    const areas = new Set(focus.flatMap((k) => MUSCLES[k].areas)), direct = new Set(focus.flatMap((k) => MUSCLES[k].moves));
    const mid = s.steps.filter((x) => !x.fixed);
    const hit = mid.filter((x) => direct.has(x.id) || move(x.id).areas.some((a) => areas.has(a)));
    assert.ok(hit.length >= mid.length / 2, `${mode} ${minutes} ${focus} ${today}: ${hit.length} of ${mid.length} (${ids(s)})`);
    assert.ok(mid.some((x) => direct.has(x.id)), `${mode} ${minutes} ${focus} ${today}: no direct move in ${ids(s)}`);
    // A short session is those muscles and nothing else: no calf raises on a chest day.
    if (minutes === 5) assert.deepStrictEqual(mid.filter((x) => !hit.includes(x)).map((x) => x.id), [], `${mode} ${focus} ${today}: ${ids(s)}`);
  }
});

test("each picked muscle group gets something, and different picks give different sessions", () => {
  for (const mode of ["before", "after"]) for (const today of DAYS.slice(0, 3)) {
    const s = build({ mode, minutes: 15, focus: ["chest", "quads", "calves"], today });
    for (const k of ["chest", "quads", "calves"]) {
      const g = MUSCLES[k];
      assert.ok(s.steps.some((x) => !x.fixed && (g.moves.includes(x.id) || move(x.id).areas.some((a) => g.areas.includes(a)))), `${mode} ${today}: nothing for ${k} in ${ids(s)}`);
    }
  }
  assert.notDeepStrictEqual(ids(build({ mode: "before", focus: ["chest"], today: DAYS[0] })), ids(build({ mode: "before", focus: ["glutes"], today: DAYS[0] })));
  assert.notDeepStrictEqual(ids(build({ mode: "after", focus: ["chest"], today: DAYS[0] })), ids(build({ mode: "after", focus: ["arms"], today: DAYS[0] })));
});

test("the morning knows body areas only: a muscle group's name changes nothing there", () => {
  for (const today of DAYS.slice(0, 3)) {
    assert.deepStrictEqual(ids(build({ focus: ["chest"], today })), ids(build({ today })), "chest is not a morning focus");
    assert.strictEqual(build({ focus: ["chest"], today }).focus, "all");
  }
});

test("gear moves stay out until that gear is picked, then come up for its muscles", () => {
  const gearIds = MOVES.filter((m) => m.gear).map((m) => m.id);
  assert.ok(gearIds.length >= 18, `${gearIds.length} gear moves`);
  for (const mode of ["morning", "before", "after"]) for (const today of DAYS) {
    const s = build({ minutes: 15, mode, today, focus: mode === "morning" ? "all" : ["quads", "back"] });
    assert.ok(!ids(s).some((id) => gearIds.includes(id)), `${mode} ${today}: ${ids(s)}`);
    const sw = swap(s, 1);
    assert.ok(!sw || !gearIds.includes(sw.steps[1].id), "a swap brought in gear");
  }
  // With a roller, a cool-down for the quads uses it on most days, and never brings in the stick or the gun.
  let rolled = 0;
  for (const today of DAYS) {
    const s = build({ minutes: 10, mode: "after", today, focus: ["quads"], gear: ["roller"] });
    if (ids(s).includes("roll_quads")) rolled++;
    assert.ok(!ids(s).some((id) => /^(stick|gun)_/.test(id)), ids(s).join(" "));
  }
  assert.ok(rolled >= 5, `roll_quads in ${rolled} of ${DAYS.length} cool-downs`);
});

test("a massage gun move is timed in 10-second strokes, off the breath, on both sides", () => {
  const gun = MOVES.find((m) => m.id === "gun_quads");
  const segs = gun.segs(3);
  assert.ok(segs.every((g) => g[2] === ""), "a gun segment follows the breath");
  assert.strictEqual(gun.count(3), "30 seconds each side");
  assert.ok(segs.some((g) => g[0].endsWith(".F")), "no other side");
  assert.strictEqual(secondsOf(segs), 2 * (4 + 30) + 5);
});

test("gear tops up a session without taking it over", () => {
  const gearN = (s) => s.steps.filter((x) => /^(roll|stick|gun)_/.test(x.id)).length;
  for (const minutes of [5, 10, 15]) for (const mode of ["morning", "before", "after"]) for (const today of DAYS)
    for (const focus of ["all", ["chest"], ["quads", "hamstrings"], ["back", "shoulders"], ["calves"]]) {
      let s = build({ minutes, mode, today, focus, gear: ["roller", "stick", "gun"] });
      const cap = Math.max(2, Math.round(minutes / 3)), at = `${minutes} min ${mode} ${today} ${focus}`;
      assert.ok(gearN(s) <= cap, `${at}: ${gearN(s)} gear moves`);
      // Swapping every move in turn keeps to the cap too.
      for (let i = 0; i < s.steps.length; i++) s = swap(s, i) || s;
      assert.ok(gearN(s) <= cap, `${at}, after swaps: ${gearN(s)} gear moves`);
    }
});

test("more or fewer moves: that many more or fewer, still chosen for you, in the same length, with fewer or more breaths each", () => {
  const breaths = (s) => s.steps.reduce((n, x) => n + x.reps, 0) / s.steps.length;
  for (const mode of ["morning", "before", "after"]) for (const today of DAYS.slice(0, 3)) for (const minutes of [5, 10, 15]) {
    const base = build({ minutes, mode, today });
    for (const extra of [-2, -1, 1, 2]) {
      const s = build({ minutes, mode, today, extra });
      const want = Math.max(base.steps.filter((x) => x.fixed).length + 1, base.steps.length + extra);
      const at = `${mode} ${minutes} min ${today} ${extra}: ${base.steps.length} → ${s.steps.length}, ${mins(s).toFixed(2)} min`;
      assert.ok(extra > 0 ? s.steps.length <= want && s.steps.length >= base.steps.length : s.steps.length === want, at);
      assert.ok(mins(s) <= minutes + 0.3, at);
      if (s.steps.length !== base.steps.length) assert.ok(extra > 0 ? breaths(s) <= breaths(base) : breaths(s) >= breaths(base), `${at}: breaths per move`);
      if (MODES_FIXED[mode]) assert.strictEqual(s.steps[0].id, MODES_FIXED[mode]);
    }
  }
  // One more move fits in a 10-minute morning, taken from the breaths of the others.
  const b10 = build({ minutes: 10, today: DAYS[0] }), m10 = build({ minutes: 10, today: DAYS[0], extra: 1 });
  assert.strictEqual(m10.steps.length, b10.steps.length + 1);
  assert.ok(mins(m10) >= 9 && mins(m10) <= 10.3, mins(m10).toFixed(2));
});

test("fewer moves never drops below one move besides the opener and closer", () => {
  const s = build({ minutes: 5, today: DAYS[0], extra: -20 });
  assert.ok(s.steps.filter((x) => !x.fixed).length >= 1, ids(s).join());
});

test("qigong ignores more or fewer: it is always the whole form", () => {
  assert.deepStrictEqual(ids(build({ minutes: 10, mode: "qigong", today: DAYS[0], extra: 2 })), ids(build({ minutes: 10, mode: "qigong", today: DAYS[0] })));
});

test("upper and lower body cover every area and muscle group between them, with no unknown names", () => {
  const { HALVES, MUSCLES } = require("../public/plan.js");
  const areas = [...HALVES.upper.areas, ...HALVES.lower.areas], muscles = [...HALVES.upper.muscles, ...HALVES.lower.muscles];
  assert.deepStrictEqual(areas.slice().sort(), Object.keys(AREAS).sort());
  assert.deepStrictEqual(muscles.slice().sort(), Object.keys(MUSCLES).sort());
  const s = build({ minutes: 10, today: DAYS[0], focus: HALVES.lower.areas });
  const lowerMoves = s.steps.filter((x) => !x.fixed && MOVES.find((m) => m.id === x.id).areas.some((a) => HALVES.lower.areas.includes(a)));
  assert.ok(lowerMoves.length >= s.steps.filter((x) => !x.fixed).length * 0.6, ids(s).join());
});

test("swap choices are the other moves for the same muscle, and the one picked goes in", () => {
  const { swapChoices, MUSCLES } = require("../public/plan.js");
  // Around a workout: the muscle group that lists the move.
  const s = build({ minutes: 10, mode: "before", focus: ["glutes"], today: DAYS[2] });
  const group = MUSCLES.shoulders.moves;
  const i = ids(s).indexOf("beastcrab");
  assert.ok(i >= 0, ids(s).join());
  const c = swapChoices(s, i);
  assert.strictEqual(c.label, "shoulders");
  assert.ok(c.same && c.steps.length > 1, c.steps.map((x) => x.id).join());
  for (const x of c.steps) {
    assert.ok(group.includes(x.id), `${x.id} is not a shoulders move`);
    assert.ok(!ids(s).includes(x.id), `${x.id} is already in the session`);
    assert.ok(move(x.id).type !== "hold", `${x.id} is a hold, in a warm-up`);
  }
  const pick = c.steps[c.steps.length - 1];
  const w = swap(s, i, pick.id);
  assert.strictEqual(w.steps[i].id, pick.id);
  assert.deepStrictEqual(w.steps[i].segs, pick.segs, "the step shown is the step that goes in");
  assert.deepStrictEqual(ids(w).filter((_, k) => k !== i), ids(s).filter((_, k) => k !== i));
  // The move swapped away is a choice again, so a pick can be undone.
  assert.ok(swapChoices(w, i).steps.some((x) => x.id === s.steps[i].id));
  // Only a move on the list can go in; a move that opens or closes the session has no list.
  assert.strictEqual(swap(s, i, s.steps[i].id), null);
  assert.strictEqual(swap(s, i, "still"), null);
  assert.strictEqual(swapChoices(s, 0), null);

  // In the morning: the move's body areas.
  const m = build({ minutes: 10, today: DAYS[3] });
  const old = move(m.steps[2].id), cm = swapChoices(m, 2);
  assert.strictEqual(cm.label, old.areas.map((a) => AREAS[a].toLowerCase()).join(old.areas.length > 2 ? ", " : " and "));
  assert.ok(cm.same && cm.steps.every((x) => move(x.id).areas.some((a) => old.areas.includes(a))));

  // Nothing else for the muscle (a glutes warm-up already holds every glutes move that fits): the closest
  // other moves, said as such. A move picked for several muscles is named for the ones you chose.
  const j = ids(s).indexOf("bridge"), none = swapChoices(s, j);
  assert.strictEqual(none.label, "glutes");
  assert.ok(!none.same && none.steps.length > 0 && none.steps.every((x) => !MUSCLES.glutes.moves.includes(x.id)));
});
