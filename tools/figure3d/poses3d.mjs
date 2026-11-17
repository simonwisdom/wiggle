// The pose library. Every move has its own file in moves/<move id from plan.js>.mjs (and shared pieces in moves/_common.mjs);
// this index loads them all, so adding a move means adding one file and touching nothing else.
// A move file exports:
//   POSES    required. Poses keyed by the name plan.js uses (cow, threadUnderN, move.key ...). Only the first side is typed:
//            "xF" is the mirror of "xN" (threadUnderF, crabF, seatF, bowF ...) and "name.F" of "name", made by code.
//   VIA      optional. Waypoints for steps that need a path of their own: { "from>to": [pose, ...] } by first-side names.
//   PASS     optional. Names of poses the figure passes through without stopping (the side sit).
//   LOOPS / LOOP_OF   optional. Loops played in real time, and which plan.js pose names use which loop.
// The same pose name in two files is an error (shared poses go in moves/_common.mjs).
import fs from "node:fs";
import path from "node:path";
import { mirrorPose, settle } from "./rig.mjs";
import { POSES as COMMON } from "./moves/_common.mjs";

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "moves");
export const MOVE_IDS = fs.readdirSync(DIR).filter((f) => /^[a-z0-9]+\.mjs$/.test(f)).map((f) => f.slice(0, -4)).sort();

export const POSES = { ...COMMON }, VIA = {}, LOOPS = {}, LOOP_OF = {}, PASS = new Set();
export const POSE_MOVE = Object.fromEntries(Object.keys(COMMON).map((k) => [k, "_common"]));
for (const id of MOVE_IDS) {
  const m = await import("./moves/" + id + ".mjs");
  for (const [k, v] of Object.entries(m.POSES || {})) {
    if (k in POSES) throw new Error(`pose "${k}" is in moves/${id}.mjs and in moves/${POSE_MOVE[k]}.mjs`);
    POSES[k] = v; POSE_MOVE[k] = id;
  }
  Object.assign(VIA, m.VIA); Object.assign(LOOPS, m.LOOPS); Object.assign(LOOP_OF, m.LOOP_OF);
  for (const n of m.PASS || []) PASS.add(n);
}

// ---- waypoints: poses a step passes through on the way (not named in plan.js) ----
// The reverse step uses them backwards. A key naming the other side exactly ("halfsplit.b>halfsplit.a.F": a step that changes
// sides) is used as typed, not mirrored, and wins over the first-side key.
export function viaFor(from, to, side) {
  const exact = VIA[`${from}>${to}`] || (VIA[`${to}>${from}`] && [...VIA[`${to}>${from}`]].reverse());
  if (exact && (/F$/.test(from) !== /F$/.test(to))) return exact.map((x) => settle(x));
  const n = (x) => x.replace(/\.F$/, "").replace(/F$/, "N");
  const k = `${n(from)}>${n(to)}`, r = `${n(to)}>${n(from)}`;
  const w = VIA[k] || (VIA[r] && [...VIA[r]].reverse());
  if (!w) return [];
  return side === "F" || from.endsWith("F") || to.endsWith("F") ? w.map((x) => settle(mirrorPose(x))) : w.map((x) => settle(x));
}

// ---- lookups ----
// The pose called `name` on the first side, or its mirror when the name is the other side's.
export function resolve(name) {
  const p = rawResolve(name);
  return p && settle(p);
}
function rawResolve(name) {
  if (POSES[name]) return POSES[name];
  const n = name.endsWith(".F") ? name.slice(0, -2) : name.endsWith("F") ? name.slice(0, -1) + "N" : null;
  return n && POSES[n] ? mirrorPose(POSES[n]) : null;
}
// A pose for a step on `side` ("N", "F" or "both"). A pose that doesn't name its own side (beast, sideSit,
// stand ...) is mirrored on the far side. `ownSide` is "N", "F" or null for the name.
export function poseFor(name, side, ownSide) {
  const p = resolve(name);
  return p && side === "F" && !ownSide ? mirrorPose(p) : p;
}
export const has = (name) => !!resolve(name) || !!LOOP_OF[name];
