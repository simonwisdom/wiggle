const test = require("node:test");
const left = (pcm) => pcm.filter((_, i) => i % 2 === 0); // the left ear of a stereo mix
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { build, timeline, MOVES, MODES } = require("../public/plan.js");
const { leads, cues, spoken, COMMON } = require("../public/sound.js");

const index = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/sound/voice.json"), "utf8"));
const packSize = fs.statSync(path.join(__dirname, "../public/sound/voice.pack")).size;
const DAYS = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"];
const SESSIONS = [];
for (const mode of Object.keys(MODES)) for (const today of DAYS) for (const minutes of [5, 10, 15]) for (const focus of ["all", "hips", ["hamstrings", "shoulders"]]) for (const level of [0, -2])
  SESSIONS.push(build({ mode, minutes, focus, today, level }));
const planOf = (s) => { const tl = timeline(s, leads(s, index)); return { tl, plan: cues(s, tl, index) }; };

test("every line any session can speak has a clip inside the pack", () => {
  const keys = [...Object.keys(COMMON)];
  for (const m of MOVES) {
    keys.push("intro:" + m.id);
    for (const mode of Object.values(MODES)) for (const g of m.segs(m.reps.max, mode.breath)) keys.push(g[3]);
  }
  for (const k of keys) {
    assert.ok(index[k], `no clip for "${k}"`);
    const [off, len, secs] = index[k];
    assert.ok(off >= 0 && len > 500 && off + len <= packSize, `"${k}" is outside the pack`);
    assert.ok(secs > 0.3 && secs < 12, `"${k}" lasts ${secs}s`);
  }
});

test("the voice never talks over itself, and every line it plans has a clip", () => {
  for (const s of SESSIONS) {
    const { plan } = planOf(s);
    plan.voice.forEach((v, i) => {
      assert.ok(index[v.key], v.key);
      if (i) assert.ok(v.t >= plan.voice[i - 1].t + plan.voice[i - 1].d, `"${v.key}" starts over "${plan.voice[i - 1].key}"`);
    });
  }
});

test("each move is named, with how to do it, before it starts; a chime marks it", () => {
  for (const s of SESSIONS) {
    const { tl, plan } = planOf(s);
    assert.strictEqual(plan.chimes.length, s.steps.length);
    s.steps.forEach((step, i) => {
      const lead = tl.segs.find((g) => g.lead && g.step === i);
      const v = plan.voice.find((x) => x.key === "intro:" + step.id && x.t >= lead.t0);
      assert.ok(v, `${step.id} is never named`);
      assert.ok(v.t + v.d <= lead.t0 + lead.d + 1e-9, `${step.id}: its intro runs ${(v.t + v.d - lead.t0 - lead.d).toFixed(2)}s into the move`);
      assert.ok(plan.chimes.includes(lead.t0));
    });
  }
});

test("it opens with how to breathe, closes with Done, and the track outlasts the session", () => {
  for (const s of SESSIONS) {
    const { tl, plan } = planOf(s);
    assert.strictEqual(plan.voice[0].key, "start:" + s.mode);
    assert.ok(plan.voice[0].t + plan.voice[0].d <= tl.segs[0].d, "the opening line runs into the first move");
    const last = plan.voice.at(-1);
    assert.strictEqual(last.key, "done");
    assert.ok(last.t >= tl.total && plan.total >= last.t + last.d, "Done is cut off");
  }
});

test("every breath has its sound: swelling on the in-breath, ebbing on the out-breath", () => {
  const s = build({ mode: "after", minutes: 10, focus: "hips", today: DAYS[0] }), { tl, plan } = planOf(s);
  const breaths = tl.segs.filter((g) => g.breath);
  assert.strictEqual(plan.tones.length, breaths.length);
  breaths.forEach((g, i) => assert.deepStrictEqual(plan.tones[i], { t: g.t0, d: g.d, dir: g.breath === "in" ? 1 : -1 }));
  // Tones never overlap, in any session: each starts when the one before has ended.
  for (const x of SESSIONS) {
    const p = planOf(x).plan;
    p.tones.forEach((t, i) => { if (i) assert.ok(t.t >= p.tones[i - 1].t + p.tones[i - 1].d - 1e-9, `${x.mode}: tones overlap at ${t.t.toFixed(1)}s`); });
  }
});

test("a breath drawn in two parts is one tone and one caption (beast to crab)", () => {
  const today = DAYS.find((d) => build({ mode: "before", focus: "shoulders", today: d }).steps.some((x) => x.id === "beastcrab"));
  assert.ok(today, "no day has beast to crab");
  const s = build({ mode: "before", focus: "shoulders", today }), { tl, plan } = planOf(s);
  const step = s.steps.find((x) => x.id === "beastcrab");
  const tones = plan.tones.filter((t) => t.t >= step.t0 && t.t < step.t1);
  assert.strictEqual(tones.length, step.reps * 4, "one tone per in-breath and out-breath");
  const b = s.pace;
  assert.ok(Math.abs(tones[0].d - (b.in + 0.5)) < 1e-9 && Math.abs(tones[1].d - (b.out + 2)) < 1e-9, `${tones[0].d} ${tones[1].d}`);
});

test("a caption that only repeats is spoken once: the shake is not read out sixty times", () => {
  const s = build({ mode: "before", today: DAYS[0] }), { plan } = planOf(s);
  const step = s.steps.at(-1);
  assert.strictEqual(step.id, "shake");
  const mine = plan.voice.filter((v) => v.t >= step.t0 && v.t < step.t1).map((v) => v.key);
  assert.deepStrictEqual(mine, ["intro:shake"]);
  const today = DAYS.find((d) => build({ mode: "before", focus: "shoulders", today: d }).steps.some((x) => x.id === "armcircles"));
  if (today) {
    const w = build({ mode: "before", focus: "shoulders", today }), p = planOf(w).plan, c = w.steps.find((x) => x.id === "armcircles");
    assert.deepStrictEqual(p.voice.filter((v) => v.t >= c.t0 && v.t < c.t1).map((v) => v.key), ["intro:armcircles"]);
  }
});

test("a breath's caption is spoken once per move, and a long hold gets Two more breaths on each side", () => {
  const today = DAYS.find((d) => build({ mode: "after", focus: "hips", today: d }).steps.some((x) => x.id === "pigeon"));
  assert.ok(today, "no day has pigeon");
  const s = build({ mode: "after", focus: "hips", today }), { tl, plan } = planOf(s);
  const i = s.steps.findIndex((x) => x.id === "pigeon"), step = s.steps[i];
  const mine = plan.voice.filter((v) => v.t >= step.t0 && v.t < step.t1).map((v) => v.key);
  const count = (k) => mine.filter((x) => x === k).length;
  assert.strictEqual(count("Breathe out: fold over the shin"), 1, mine.join(" | "));
  assert.strictEqual(count("two"), 2, mine.join(" | "));
  assert.strictEqual(count("Other side"), 1);
  // Two more breaths comes two breaths before the side ends.
  const twos = plan.voice.filter((v) => v.key === "two" && v.t >= step.t0 && v.t < step.t1);
  const out = tl.segs.find((g) => g.step === i && g.cap === "Come out of it");
  const breath = s.pace.in + s.pace.out;
  assert.ok(Math.abs(out.t0 - twos[0].t - 2 * breath) < 0.5, `${(out.t0 - twos[0].t).toFixed(1)}s before the side ends`);
});

test("lead-ins stretch to fit the voice, and stay as they were without it", () => {
  const s = build({ mode: "after", today: DAYS[0] });
  const plain = timeline(s), long = timeline(s, leads(s, index));
  assert.ok(plain.segs.filter((g) => g.lead).every((g) => g.d === 5));
  assert.ok(long.total > plain.total);
  let t = 0;
  for (const g of long.segs) { assert.ok(Math.abs(g.t0 - t) < 1e-9); t += g.d; }
  assert.ok(Math.abs(long.total - t) < 1e-9);
  // A line with no clip adds nothing: the timeline falls back to its usual lead-ins.
  assert.strictEqual(timeline(s, leads(s, {})).total, plain.total);
  assert.deepStrictEqual(cues(s, timeline(s, leads(s, {})), {}).voice, []);
});

test("captions are read aloud without symbols", () => {
  assert.strictEqual(spoken("90/90 hip switches"), "ninety ninety hip switches");
  assert.strictEqual(spoken("Cat–cow"), "Cat cow");
  assert.strictEqual(spoken("Breathe in: lift the chest"), "Breathe in, lift the chest");
});

test("the mix puts each sound where the plan says, and silence elsewhere", () => {
  const { mix, RATE } = require("../public/sound.js");
  const voice = new Float32Array(RATE).fill(0.5);
  const pcm = left(mix({ total: 10, tones: [{ t: 2, d: 2, dir: 1 }], chimes: [5], voice: [{ t: 7, key: "a", d: 1 }] }, { a: voice }));
  const loud = (t) => Math.max(...pcm.subarray(Math.floor(t * RATE), Math.floor((t + 0.5) * RATE)).map(Math.abs));
  assert.strictEqual(pcm.length, 10 * RATE);
  assert.strictEqual(loud(0.5), 0); assert.strictEqual(loud(6), 0); assert.strictEqual(loud(9), 0);
  assert.ok(loud(3.2) > 800 && loud(5) > 4000 && loud(7.2) > 16000, `${loud(3.2)} ${loud(5)} ${loud(7.2)}`);
});

test("the breath sound is one continuous sound: no silence between an in-breath and the out-breath, or the next breath", () => {
  const { mix, RATE } = require("../public/sound.js");
  // Two breaths in a row (4 s in, 6 s out, twice), then nothing.
  const tones = [{ t: 1, d: 4, dir: 1 }, { t: 5, d: 6, dir: -1 }, { t: 11, d: 4, dir: 1 }, { t: 15, d: 6, dir: -1 }];
  const pcm = left(mix({ total: 24, tones, chimes: [], voice: [] }, {}));
  const rms = (t, w) => { let s = 0; const a = Math.floor(t * RATE), n = Math.floor(w * RATE); for (let i = 0; i < n; i++) s += pcm[a + i] * pcm[a + i]; return Math.sqrt(s / n); };
  assert.strictEqual(rms(0.2, 0.5), 0, "silent before the first breath");
  assert.strictEqual(rms(22, 1), 0, "silent after the last");
  // From just after the fade-in to just before the fade-out, every half second has sound.
  let quietest = Infinity;
  for (let t = 2; t <= 19.5; t += 0.25) quietest = Math.min(quietest, rms(t, 0.5));
  assert.ok(quietest > 150, `a gap: the quietest half second is ${quietest.toFixed(0)}`);
  // And it still breathes: fuller at the top of the breath than at the bottom.
  assert.ok(rms(4.5, 1) > 1.8 * rms(10.5, 1), `top ${rms(4.5, 1).toFixed(0)}, bottom ${rms(10.5, 1).toFixed(0)}`);
  // A breath on its own fades in and out rather than starting or stopping dead.
  const one = left(mix({ total: 8, tones: [{ t: 1, d: 4, dir: -1 }], chimes: [], voice: [] }, {}));
  assert.ok(Math.abs(one[Math.floor(1.01 * RATE)]) < 300 && Math.abs(one[Math.floor(4.99 * RATE)]) < 300);
});

test("the breath has a binaural beat: the two ears differ in the breath, never in the voice or chime, and the beat swells with the breath", () => {
  const { mix, RATE } = require("../public/sound.js");
  const voice = new Float32Array(RATE).fill(0.3);
  const pcm = mix({ total: 20, tones: [{ t: 1, d: 4, dir: 1 }, { t: 5, d: 6, dir: -1 }], chimes: [14], voice: [{ t: 16, key: "a", d: 1 }] }, { a: voice });
  const diff = (t, w) => { let s = 0; const a = Math.floor(t * RATE), n = Math.floor(w * RATE); for (let i = a; i < a + n; i++) s += (pcm[2 * i] - pcm[2 * i + 1]) ** 2; return Math.sqrt(s / n); };
  assert.ok(diff(4.5, 0.5) > 300, `top of the breath: ${diff(4.5, 0.5).toFixed(0)}`);
  assert.ok(diff(4.5, 0.5) > 4 * diff(10.3, 0.4), `swells: top ${diff(4.5, 0.5).toFixed(0)}, bottom ${diff(10.3, 0.4).toFixed(0)}`);
  assert.strictEqual(diff(14, 0.5), 0, "the chime is the same in both ears");
  assert.strictEqual(diff(16, 0.5), 0, "the voice is the same in both ears");
});

test("a soft note marks each turn between breaths, and none where a run of breaths starts", () => {
  const { mix, RATE } = require("../public/sound.js");
  const tones = [{ t: 1, d: 4, dir: 1 }, { t: 5, d: 6, dir: -1 }, { t: 11, d: 4, dir: 1 }];
  const withTurns = left(mix({ total: 16, tones, chimes: [], voice: [] }, {}));
  const peak = (p, t) => { let m = 0; for (let i = Math.floor(t * RATE); i < Math.floor((t + 0.15) * RATE); i++) m = Math.max(m, Math.abs(p[i])); return m; };
  assert.ok(peak(withTurns, 5.02) > 1500, `turn into the out-breath: ${peak(withTurns, 5.02)}`);
  assert.ok(peak(withTurns, 11.02) > 1500, `turn into the in-breath: ${peak(withTurns, 11.02)}`);
  assert.ok(Math.abs(withTurns[Math.floor(1.01 * RATE)]) < 300, "no note at the start of a run");
});
