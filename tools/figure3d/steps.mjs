// The step map: every pose-to-pose step any session can produce, from public/plan.js and public/clipplay.js.
//   node tools/figure3d/steps.mjs          writes tools/figure3d/steps.json and prints the counts
// Kinds:
//   move  gets its own clip, rendered forwards (a reverse step gets its own clip)
//   hold  form "still": same pose to itself, no clip (the last frame stays); form "sway": a hold's in and
//         out moments, one short looping clip for the pair
//   loop  one clip on repeat in real time (shake, arm circles)
//   link  the end pose of one move into the start pose of the next ("Next:" lead-in): a crossfade
// Sides: "N" or "F" = which limbs are near (F is the mirror of N, drawn by code); "both" = the same
// either way (symmetric poses). beast and sideSit can be either side, so those steps exist on both sides.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PLAN = require("../../public/plan.js");
const CP = require("../../public/clipplay.js");

export const KB_PER_SECOND = 16;
export const SPEED_MIN = 0.6, SPEED_MAX = 1.6; // playback speeds one clip can cover
export const SWAY_SECONDS = 4;
export const LINK_SECONDS = 3; // only if a link were rendered instead of crossfaded
const EITHER = new Set(["beast", "sideSit"]);

// The four cameras: which one a position uses (kneeling shares all fours, rising shares standing).
export const CAMERA_OF = { lying: "lying", seated: "seated", allfours: "floor", kneeling: "floor", rising: "standing", standing: "standing" };

// Which side a pose names: "N", "F", or null (either, or the same on both sides).
export function sideOf(name) {
  if (CP.loopOf(name)) return null;
  const p = CP.poseOf(name);
  return p && p[2] === true ? "F" : p && p[2] === false ? "N" : null;
}
const baseName = (name) => name; // poses are keyed by plan.js's names as they are

const allowed = (m, mode) => { const M = PLAN.MODES[mode]; return m.id === M.first || m.id === M.last || M.can(m); };
const paces = (mode) => { const b = PLAN.MODES[mode].breath; return [b, { in: b.in + 0.5, out: b.out + 0.5 }]; };
const round1 = (x) => Math.round(x * 10) / 10;

let cached = null;
export function buildSteps() {
  return (cached ||= buildStepsNow());
}
function buildStepsNow() {
  const { MOVES, MODES, POSITIONS } = PLAN;
  const map = new Map();
  const note = (key, rec, move, mode, d) => {
    let s = map.get(key);
    if (!s) { s = { id: key, ...rec, moves: new Set(), modes: new Set(), dMin: Infinity, dMax: 0 }; map.set(key, s); }
    s.moves.add(move); s.modes.add(mode);
    if (d > 0) { s.dMin = Math.min(s.dMin, d); s.dMax = Math.max(s.dMax, d); }
  };
  for (const m of MOVES) {
    for (const mode of Object.keys(MODES)) {
      if (!allowed(m, mode)) continue;
      for (const pace of paces(mode)) for (const n of [m.reps.min, m.reps.max]) {
        const segs = m.segs(n, pace);
        const poses = [m.start, ...segs.map((s) => s[0])];
        const sides = new Set(poses.map(sideOf).filter(Boolean));
        segs.forEach((s, i) => {
          const from = poses[i], to = s[0], d = s[1];
          let kind, form, key, stepSides;
          if (CP.loopOf(from) || CP.loopOf(to)) { kind = "loop"; stepSides = ["both"]; key = `loop:${m.id}`; }
          else {
            const sf = sideOf(from), st = sideOf(to);
            stepSides = sf || st ? [st || sf] : EITHER.has(from) || EITHER.has(to) ? [...(sides.size ? sides : ["N"])] : ["both"];
            if (from === to) { kind = "hold"; form = "still"; }
            else if (m.type === "hold" && /\.(in|out)(\.F)?$/.test(from) && /\.(in|out)(\.F)?$/.test(to)) { kind = "hold"; form = "sway"; }
            else kind = "move";
          }
          for (const side of stepSides) {
            const cross = !!(sideOf(from) && sideOf(to) && sideOf(from) !== sideOf(to));
            const k = kind === "loop" ? key : form === "sway" ? `${[from, to].sort().join("~")}@${side}` : `${from}>${to}@${side}`;
            note(k, { kind, form, from, to, side, ...(cross ? { crossSide: true } : {}) }, m.id, mode, d);
          }
        });
      }
    }
  }
  const steps = [...map.values()].map((s) => {
    const moves = [...s.moves].sort(), modes = [...s.modes];
    const pos = PLAN.MOVES.find((m) => m.id === moves[0]).position;
    const o = { id: s.id, kind: s.kind, ...(s.form ? { form: s.form } : {}), from: s.from, to: s.to, side: s.side, ...(s.crossSide ? { crossSide: true } : {}),
      moves, modes, camera: CAMERA_OF[pos], durations: s.dMax ? [round1(s.dMin), round1(s.dMax)] : [0, 0] };
    // Clip length: playback speed is clip length / step length, so it must stay inside 0.6x-1.6x for the
    // shortest and the longest step this clip will serve.
    if (s.kind === "move") {
      const lo = SPEED_MIN * s.dMax, hi = SPEED_MAX * s.dMin;
      o.clipSeconds = round1(Math.max(0.8, Math.sqrt(lo * hi)));
      o.speedOk = lo <= hi + 1e-9;
      o.speeds = [round1(o.clipSeconds / s.dMax * 100) / 100, round1(o.clipSeconds / s.dMin * 100) / 100];
    } else if (s.kind === "hold" && s.form === "sway") o.clipSeconds = SWAY_SECONDS;
    else if (s.kind === "loop") o.clipSeconds = moves.includes("armcircles") ? 5 : 3.2;
    else o.clipSeconds = 0;
    return o;
  });
  steps.sort((a, b) => a.id.localeCompare(b.id));

  // Links: the end pose of one move into the start pose of the next, as sessions really produce them
  // (every mode and focus, several days and lengths, and swaps), against every pair that could happen.
  const links = new Map();
  const seen = (a, b, modeName, from, to) => {
    if (a === b) return;
    const k = `${a}>${b}`;
    if (!links.has(k)) links.set(k, { id: k, from: a, to: b, modes: new Set(), samePosition: from === to });
    links.get(k).modes.add(modeName);
  };
  const focuses = ["all", ...Object.keys(PLAN.AREAS), ...Object.keys(PLAN.MUSCLES)];
  const byId = Object.fromEntries(MOVES.map((m) => [m.id, m]));
  const endPose = (st) => st.segs.length ? st.segs[st.segs.length - 1][0] : st.start;
  let sessions = 0;
  for (const mode of Object.keys(MODES)) for (const focus of focuses) for (const minutes of [5, 8, 10, 15, 20, 30]) for (let day = 1; day <= 6; day++) {
    let s = PLAN.build({ minutes, focus, mode, today: `2026-03-0${day}`, level: day === 6 ? -1 : 0 });
    for (let k = 0; k <= 2; k++) {
      sessions++;
      let prev = MODES[mode].from, prevPos = null;
      for (const st of s.steps) {
        seen(prev, st.start, mode, prevPos, st.position);
        prev = endPose(st); prevPos = st.position;
      }
      const i = s.steps.findIndex((x) => !x.fixed);
      const next = i >= 0 ? PLAN.swap(s, i) : null;
      if (!next) break;
      s = next;
    }
  }
  const ends = new Set(MOVES.map((m) => endPose({ segs: m.segs(m.reps.max, { in: 3, out: 4.5 }), start: m.start })));
  const starts = new Set(MOVES.map((m) => m.start));
  const linkList = [...links.values()].map((l) => ({ id: l.id, kind: "link", from: l.from, to: l.to, modes: [...l.modes], samePosition: l.samePosition, how: "crossfade" })).sort((a, b) => a.id.localeCompare(b.id));
  ends.add("table"); ends.add("stand");
  return { steps, links: linkList, linkSessions: sessions, theoreticalLinks: ends.size * starts.size - Math.min(ends.size, starts.size) };
}

export function summarise({ steps, links, linkSessions, theoreticalLinks }) {
  const count = {}, seconds = {};
  for (const s of steps) {
    const k = s.kind + (s.form ? ":" + s.form : "");
    count[k] = (count[k] || 0) + 1; seconds[k] = (seconds[k] || 0) + (s.clipSeconds || 0);
  }
  const clipSeconds = Object.values(seconds).reduce((a, b) => a + b, 0);
  const clips = steps.filter((s) => s.clipSeconds > 0).length;
  const mb = (sec) => Math.round((sec * KB_PER_SECOND) / 102.4) / 10;
  // Pairs inside moves, ignoring side: how many directed pose pairs the moves hold.
  const pairs = new Set(steps.filter((s) => s.kind === "move").map((s) => `${s.from}>${s.to}`)).size;
  return { count, clips, clipSeconds: Math.round(clipSeconds), clipMB: mb(clipSeconds), movePairsIgnoringSide: pairs,
    moveSteps: steps.filter((s) => s.kind === "move").length, moveStepsFarSideMirror: steps.filter((s) => s.kind === "move" && s.side === "F").length,
    speedRangeProblems: steps.filter((s) => s.kind === "move" && !s.speedOk).map((s) => s.id),
    links: { observed: links.length, observedInSessions: linkSessions, theoretical: theoreticalLinks, ifRenderedMB: mb(links.length * LINK_SECONDS) } };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const map = buildSteps(), sum = summarise(map);
  const out = { note: "Generated by tools/figure3d/steps.mjs from public/plan.js and public/clipplay.js. Do not edit.", summary: sum, steps: map.steps, links: map.links };
  fs.writeFileSync(path.join(HERE, "steps.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify(sum, null, 1));
}
