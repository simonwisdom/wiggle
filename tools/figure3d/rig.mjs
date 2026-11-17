// The 3D rig: typed poses -> joint positions (metres). No file reading, no rendering.
// World: the figure faces +X, up is +Y, its right side is +Z (toward the camera), floor at y = 0.
// A pose: p pelvis, pitch (forward lean of the pelvis, 90 = flat), yaw, roll, spine flex/twist/side
// (whole spine, degrees), nflex/ntwist for the neck and head, and for each hand and foot a target t
// (hand: the wrist; foot: the ankle), a pole (where the elbow or knee points) and a direction
// (dir for the hand, toe for the foot's ankle-to-toe offset). Code works out the elbows and knees.
export const FPS = 30;
export const JOINTS = ["pelvis", "s1", "s2", "s3", "neck", "head", "headEnd",
  "lHip", "lKnee", "lAnkle", "lToe", "rHip", "rKnee", "rAnkle", "rToe",
  "lSh", "lEl", "lWr", "lHand", "rSh", "rEl", "rWr", "rHand"];
export const BONE = { thigh: 0.378, shin: 0.402, ua: 0.268, fa: 0.269, hand: 0.09 };

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
export const lerpV = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rad = (d) => (d * Math.PI) / 180;
const rot = (axis, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  if (axis === "x") return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (axis === "y") return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
};
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
export const smooth = (t) => t * t * (3 - 2 * t);

// ---------- short-form constructors ----------
export const hand = (t, pole, dir) => ({ t, pole, dir });
export const foot = (t, pole, toe) => ({ t, pole, toe });
export const base = { yaw: 0, pitch: 0, roll: 0, flex: 0, twist: 0, side: 0, nflex: 0, ntwist: 0 };

// ---------- the solver ----------
// Two-bone chain from root to target (elbow or knee). The middle joint sits on a circle round the root-target
// line; `pole` says which way round, and if that puts it under the floor it turns round the line just enough to clear it.
export const KNEE_FLOOR = 0.02;
function ik(root, target, a, b, pole) {
  const d = sub(target, root);
  const dl = Math.max(Math.abs(a - b) + 0.02, Math.min(len(d), a + b - 0.004));
  const dir = norm(d);
  const x = (a * a + dl * dl - b * b) / (2 * dl);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const perp = norm(sub(pole, mul(dir, dot(pole, dir))));
  const c = add(root, mul(dir, x)), end = add(root, mul(dir, dl));
  const at = (deg) => { // turn perp round dir by deg (Rodrigues)
    const t = rad(deg), k = cross(dir, perp);
    const v = add(add(mul(perp, Math.cos(t)), mul(k, Math.sin(t))), mul(dir, 0));
    return add(c, mul(v, h));
  };
  let mid = at(0);
  if (mid[1] < KNEE_FLOOR) for (let deg = 4; deg <= 180; deg += 4) for (const sg of [1, -1]) { const m = at(sg * deg); if (m[1] >= KNEE_FLOOR) return [m, end]; }
  return [mid, end];
}
export function torso(P) {
  const J = {};
  const Rp = mm(mm(rot("y", 90 + (P.yaw || 0)), rot("x", P.pitch || 0)), rot("z", P.roll || 0));
  const Rs = mm(mm(rot("y", (P.twist || 0) / 3), rot("x", (P.flex || 0) / 3)), rot("z", (P.side || 0) / 3));
  J.pelvis = P.p.slice();
  J.lHip = add(P.p, mv(Rp, [0.08, -0.09, 0])); J.rHip = add(P.p, mv(Rp, [-0.08, -0.09, 0]));
  J.s1 = add(P.p, mv(Rp, [0, 0.094, 0]));
  const R1 = mm(Rp, Rs); J.s2 = add(J.s1, mv(R1, [0, 0.123, 0]));
  const R2 = mm(R1, Rs); J.s3 = add(J.s2, mv(R2, [0, 0.084, 0]));
  const R3 = mm(R2, Rs);
  J.neck = add(J.s3, mv(R3, [0, 0.197, -0.02]));
  J.lSh = add(J.s3, mv(R3, [0.166, 0.131, -0.022])); J.rSh = add(J.s3, mv(R3, [-0.166, 0.131, -0.022]));
  const Rn = mm(mm(R3, rot("y", (P.ntwist || 0) / 2)), rot("x", (P.nflex || 0) / 2));
  J.head = add(J.neck, mv(Rn, [0, 0.096, 0]));
  const Rh = mm(mm(Rn, rot("y", (P.ntwist || 0) / 2)), rot("x", (P.nflex || 0) / 2));
  J.headEnd = add(J.head, mv(Rh, [0, 0.096, 0]));
  J._R = R3; // the upper body's turn, for blending hands with the body (mixArms)
  return J;
}
// Joint positions for a pose. No floor clamp: the checks look for anything under the floor.
export function solve(P) {
  const J = torso(P);
  for (const s of ["l", "r"]) {
    const h = P[s + "h"], f = P[s + "f"];
    const [el, wr] = ik(J[s + "Sh"], h.t, BONE.ua, BONE.fa, h.pole);
    J[s + "El"] = el; J[s + "Wr"] = wr;
    J[s + "Hand"] = add(wr, mul(norm(h.dir || sub(wr, el)), BONE.hand));
    const [kn, an] = ik(J[s + "Hip"], f.t, BONE.thigh, BONE.shin, f.pole);
    J[s + "Knee"] = kn; J[s + "Ankle"] = an; J[s + "Toe"] = add(an, f.toe);
  }
  delete J._R;
  return J;
}

// A foot that sits in its knee's bend plane (no sideways twist): square to the shin and turned toward where the knee points,
// then pointed on by `point` (0 = square, 1 = in line with the shin). For a leg whose ankle target is set but whose toe is not.
export function footInPlane(P, s, point = 0.35, length = 0.143) {
  const J = solve(P), shin = norm(sub(J[s + "Ankle"], J[s + "Knee"])), bend = sub(J[s + "Knee"], mul(add(J[s + "Hip"], J[s + "Ankle"]), 0.5));
  const out = norm(sub(bend, mul(shin, dot(bend, shin))));
  return { ...P, [s + "f"]: { ...P[s + "f"], toe: mul(norm(add(out, mul(shin, point))), length) } };
}

// Set the pelvis lean so the arms are nearly straight on their targets (hands-and-knees poses).
export function straightArms(P, dist = 0.522) {
  let best = P.pitch, err = 1e9;
  for (let a = P.pitch - 35; a <= P.pitch + 35; a += 0.5) {
    const J = torso({ ...P, pitch: a });
    const e = Math.abs((len(sub(P.rh.t, J.rSh)) + len(sub(P.lh.t, J.lSh))) / 2 - dist);
    if (e < err) { err = e; best = a; }
  }
  return { ...P, pitch: best };
}

// ---------- the other side: a mirror made by code ----------
// Mirroring flips z and swaps left and right. For this rig that is: z of every point flips, yaw, roll,
// twist, side and neck twist change sign, and the left and right hands and feet trade places.
const mz = (v) => [v[0], v[1], -v[2]];
const mirrorLimb = (L) => Object.fromEntries(Object.entries(L).map(([k, v]) => [k, mz(v)]));
export function mirrorPose(P) {
  return { ...P, p: mz(P.p), yaw: -P.yaw, roll: -P.roll, twist: -P.twist, side: -P.side, ntwist: -P.ntwist,
    lh: mirrorLimb(P.rh), rh: mirrorLimb(P.lh), lf: mirrorLimb(P.rf), rf: mirrorLimb(P.lf) };
}
export function mirrorFrame(F) {
  return Object.fromEntries(JOINTS.map((j) => {
    const o = j[0] === "l" ? "r" + j.slice(1) : j[0] === "r" ? "l" + j.slice(1) : j;
    return [j, mz(F[o])];
  }));
}

// ---------- blending ----------
function mixPose(A, B, t) {
  const o = {};
  for (const k of Object.keys(A)) {
    if (typeof A[k] === "number") o[k] = lerp(A[k], B[k] ?? 0, t);
    else if (Array.isArray(A[k])) o[k] = lerpV(A[k], B[k], t);
    else o[k] = mixPose(A[k], B[k], t);
  }
  return o;
}
const T3 = (M) => [0, 1, 2].map((i) => [M[0][i], M[1][i], M[2][i]]);
function nlerp(a, b, t) { const v = lerpV(norm(a), norm(b), t); return len(v) > 0.2 ? norm(v) : norm(lerpV(norm(a), norm(b), t < 0.5 ? 0.25 : 0.75)); }
export const handPlanted = (h) => h.t[1] <= 0.06;
export const footPlanted = (f) => Math.min(f.t[1], f.t[1] + f.toe[1]) <= 0.09;
// Blend two poses. A hand that stays on the floor slides along it. Any other hand that moves is blended
// with the upper body: its target and elbow direction are mixed as seen from the shoulder, in the body's
// own frame, then turned back into the room. A straight line across the room cut a reaching arm through
// the body as it turned, and blending an "elbow up" direction into an "elbow down" one flipped the elbow.
export function mixArms(A, B, t) {
  const o = mixPose(A, B, t);
  const JA = torso(A), JB = torso(B), JO = torso(o);
  for (const s of ["l", "r"]) {
    const ha = A[s + "h"], hb = B[s + "h"];
    if (len(sub(ha.t, hb.t)) < 0.02) continue;
    if (handPlanted(ha) && handPlanted(hb)) continue; // both on the floor: the world blend already slides it
    const sh = s + "Sh";
    const la = mv(T3(JA._R), sub(ha.t, JA[sh])), lb = mv(T3(JB._R), sub(hb.t, JB[sh]));
    const reach = lerp(len(la), len(lb), t), dir = nlerp(la, lb, t);
    const pole = nlerp(mv(T3(JA._R), ha.pole), mv(T3(JB._R), hb.pole), t);
    const hdir = ha.dir && hb.dir ? mv(JO._R, nlerp(mv(T3(JA._R), ha.dir), mv(T3(JB._R), hb.dir), t)) : o[s + "h"].dir;
    o[s + "h"] = { t: add(JO[sh], mv(JO._R, mul(dir, reach))), pole: mv(JO._R, pole), dir: hdir };
  }
  return o;
}

// The limbs a step keeps on the floor: planted in both its start and its end pose, as ["h" | "f", "l" | "r"].
export function plantedBoth(...poses) {
  const out = [];
  if (!poses.length) return out;
  for (const s of ["l", "r"]) {
    if (poses.every((P) => handPlanted(P[s + "h"]))) out.push(["h", s]);
    if (poses.every((P) => footPlanted(P[s + "f"]))) out.push(["f", s]);
  }
  return out;
}
// Keep planted hands and feet on their targets: if the pelvis has moved so far that a planted limb can't
// reach (it would lift off the floor), slide the pelvis toward it, a few millimetres at a time.
export function settle(P, limbs = plantedBoth(P, P)) {
  let Q = P;
  for (let it = 0; it < 12; it++) {
    const J = torso(Q);
    let shift = [0, 0, 0], n = 0;
    for (const [k, s] of limbs) {
      const root = J[s + (k === "h" ? "Sh" : "Hip")], lim = k === "h" ? BONE.ua + BONE.fa - 0.004 : BONE.thigh + BONE.shin - 0.004;
      const d = sub(Q[s + (k === "h" ? "h" : "f")].t, root), dist = len(d);
      if (dist > lim + 1e-4) { shift = add(shift, mul(norm(d), dist - lim)); n++; }
    }
    if (!n) break;
    Q = { ...Q, p: add(Q.p, mul(shift, 1 / n)) };
  }
  return Q;
}

// Frames for a move through poses [A, B] (or A, waypoints..., B) over `dur` seconds, standing still on the first
// and last. tweak(P, t) may change the pose over time (the shake).
export function blendFrames(poses, dur, { tweak, ease = smooth } = {}) {
  const frames = [], n = Math.round(dur * FPS), segs = poses.length - 1;
  const plants = poses.slice(1).map((B, i) => plantedBoth(poses[i], B));
  for (let k = 0; k <= n; k++) {
    const u = ease(k / n) * segs, i = Math.min(segs - 1, Math.floor(u));
    let P = settle(mixArms(poses[i], poses[i + 1], u - i), plants[i]);
    if (tweak) P = tweak(P, k / FPS);
    frames.push(solve(P));
  }
  return frames;
}
