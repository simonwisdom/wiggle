// Checks on frames of joint positions (see rig.mjs). Each returns a list of problems (empty = fine).
import { JOINTS, BONE, add, sub, mul, dot, len, cross, norm } from "./rig.mjs";
import { project, MAT, SIZE, MARGIN } from "./cameras.mjs";

const GAP = 0.03;           // a planted hand or foot is within 3 cm of the floor
const FLOOR_JOINT = 0.01;   // no joint centre lower than 1 cm above the floor (the balls are 3-5 cm across: a knee on a mat sinks a little)
const ELBOW_JUMP = 0.12;    // metres between neighbouring frames
const BONE_TOL = 0.005;
// Limbs are capsules with their average radius. They may press into each other 5 cm (soft flesh; stacked legs in
// the side sit) and into the torso 5 cm (a belly against the thighs in a fold), no more.
const PENETRATION = 0.05, PENETRATION_TORSO = 0.05;
const R = { thigh: 0.065, shin: 0.042, ua: 0.045, fa: 0.034, torso: 0.1 };

// Ankle and wrist ranges, from clinical joint-motion norms (AAOS / Kapandji), plus 10 degrees of slack for the soft rig.
// Ankle: neutral is the foot at 90 degrees to the shin; dorsiflexion up to 20, plantarflexion up to 50. So the angle between
// the shin's line (knee to ankle) and the foot (ankle to toe) is 40..110 degrees. Twist: the foot may turn out of the leg's
// bend plane (inversion 35 / eversion 15, and the hip turns the plane with it) by at most 35 degrees.
const ANKLE_MIN = 30, ANKLE_MAX = 120, FOOT_TWIST = 35;
// Wrist: flexion about 80, extension about 70, radial 20, ulnar 30: the hand is at most 80 degrees off its forearm's line (70 + slack).
// A palm pressed to the mat (all fours, a plank) is loaded into extension: weight-bearing range is about 90 degrees (yoga and
// gymnastics norms), so planted hands may reach 95.
const WRIST_MAX = 80, WRIST_LOADED = 95;
const FLAT_FOOT = 30;       // a planted foot's slope to the floor, unless it stands on the ball (toe low, heel up)
const FLAT_HAND = 25;       // a planted hand's slope to the floor
const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 180) / Math.PI;
const slope = (v) => (Math.asin(Math.abs(v[1]) / (len(v) || 1)) * 180) / Math.PI;

// Hands and feet that point the wrong way, on one frame. plants: as for checkFrames.
export function limbEnds(F, plants = []) {
  const out = [];
  for (const s of ["l", "r"]) {
    const shin = sub(F[s + "Ankle"], F[s + "Knee"]), toe = sub(F[s + "Toe"], F[s + "Ankle"]), thigh = sub(F[s + "Knee"], F[s + "Hip"]);
    const a = ang(shin, toe);
    // A foot with its shin lying on the mat (kneeling, shins back) is pressed into extension by the floor and the toe joints
    // (up to about 50 more degrees than the ankle alone), so the minimum does not apply to it.
    const instepDown = F[s + "Ankle"][1] <= 0.1 && slope(shin) <= 35;
    if ((a < ANKLE_MIN && !instepDown) || a > ANKLE_MAX) out.push(`${s}Foot is ${a.toFixed(0)} deg off its shin (the ankle allows ${ANKLE_MIN}-${ANKLE_MAX})`);
    const bend = ang(thigh, shin);
    if (bend > 20) { // the knee's bend plane is known: the foot should lie near it
      const n = norm(cross(thigh, shin)), tw = (Math.asin(Math.min(1, Math.abs(dot(n, norm(toe))))) * 180) / Math.PI;
      if (tw > FOOT_TWIST) out.push(`${s}Foot twists ${tw.toFixed(0)} deg out of its leg's plane (max ${FOOT_TWIST})`);
    }
    const fa = sub(F[s + "Wr"], F[s + "El"]), h = sub(F[s + "Hand"], F[s + "Wr"]);
    const w = ang(fa, h);
    const loaded = plants.some(([k, q]) => k === "h" && q === s);
    if (w > (loaded ? WRIST_LOADED : WRIST_MAX)) out.push(`${s}Hand is ${w.toFixed(0)} deg off its forearm (the wrist allows ${WRIST_MAX})`);
  }
  for (const [kind, s] of plants) {
    if (kind === "h") {
      const v = sub(F[s + "Hand"], F[s + "Wr"]);
      if (slope(v) > FLAT_HAND) out.push(`${s}Hand is planted but tilted ${slope(v).toFixed(0)} deg off the mat`);
    } else {
      const v = sub(F[s + "Toe"], F[s + "Ankle"]), ball = F[s + "Toe"][1] - 0.03 <= GAP && F[s + "Ankle"][1] > F[s + "Toe"][1] + 0.03;
      const heel = F[s + "Ankle"][1] - 0.04 <= GAP && F[s + "Toe"][1] > F[s + "Ankle"][1]; // heel on the mat, toes up
      if (slope(v) > FLAT_FOOT && !ball && !heel) out.push(`${s}Foot is planted but tilted ${slope(v).toFixed(0)} deg off the mat`);
    }
  }
  return out;
}

export function segDist(a0, a1, b0, b1) {
  // Closest distance between segments a0-a1 and b0-b1 (clamped).
  const d1 = sub(a1, a0), d2 = sub(b1, b0), r = sub(a0, b0);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  const c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b;
  s = den > 1e-9 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
  t = (b * s + f) / (e || 1);
  if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / (a || 1))); }
  else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / (a || 1))); }
  return len(sub(add(a0, mul(d1, s)), add(b0, mul(d2, t))));
}

// The contact points of a hand or foot: the joints that touch the floor, and how far each is from it.
const handGap = (F, s) => Math.min(F[s + "Wr"][1] - 0.03, F[s + "Hand"][1] - 0.03);
const footGap = (F, s) => Math.min(F[s + "Ankle"][1] - 0.04, F[s + "Toe"][1] - 0.03);
const contactPoints = (F, kind, s) => kind === "h" ? [F[s + "Wr"], F[s + "Hand"]] : [F[s + "Ankle"], F[s + "Toe"]];
const onMat = (p) => Math.abs(p[0]) <= MAT.x / 2 && Math.abs(p[2]) <= MAT.z / 2;

export { plantedBoth as planted } from "./rig.mjs";

// Points that must stay in the picture: every joint with some body around it, and the top of the head.
export const figurePoints = (F) => [...JOINTS.map((j) => [F[j], 0.05]), [add(F.head, mul(sub(F.headEnd, F.head), 1.9)), 0.1], [F.head, 0.1]];

// pass: how deep limbs may press into each other, if a step needs more (see PASS_ALLOWED in the test).
export function checkFrames(name, frames, { plants = [], cam, pass = PENETRATION } = {}) {
  const bad = [], seen = new Set();
  const say = (kind, i, msg) => { if (!seen.has(kind + msg.split(" ")[0])) { seen.add(kind + msg.split(" ")[0]); bad.push(`${name} frame ${i}: ${msg}`); } };
  frames.forEach((F, i) => {
    for (const j of JOINTS) if (F[j][1] < FLOOR_JOINT) say("floor", i, `${j} is under the floor (${(F[j][1] * 100).toFixed(1)} cm up)`);
    for (const [kind, s] of plants) {
      const gap = kind === "h" ? handGap(F, s) : footGap(F, s);
      if (gap > GAP) say("plant", i, `${s}${kind === "h" ? "Hand" : "Foot"} lifts ${(gap * 100).toFixed(1)} cm off the mat`);
      if (!contactPoints(F, kind, s).every(onMat)) say("mat", i, `${s}${kind === "h" ? "Hand" : "Foot"} is off the mat's edge`);
    }
    if (cam) {
      const m = MARGIN * SIZE;
      for (const [p, r] of figurePoints(F)) {
        const q = project(cam, p), pad = r * q.perM;
        if (q.x - pad < m || q.x + pad > SIZE - m || q.y - pad < m || q.y + pad > SIZE - m) { say("frame", i, `${JOINTS.find((j) => F[j] === p) || "head"} leaves the picture (x ${q.x.toFixed(0)}, y ${q.y.toFixed(0)})`); break; }
      }
    }
    for (const m of limbEnds(F, plants)) say("end", i, m);
    // bone lengths
    const L = (a, b) => len(sub(F[a], F[b]));
    for (const s of ["l", "r"]) for (const [a, b, want] of [[s + "Hip", s + "Knee", BONE.thigh], [s + "Knee", s + "Ankle", BONE.shin], [s + "Sh", s + "El", BONE.ua], [s + "El", s + "Wr", BONE.fa]]) {
      if (Math.abs(L(a, b) - want) > BONE_TOL) say("bone", i, `${a}-${b} is ${(L(a, b) * 100).toFixed(1)} cm, should be ${(want * 100).toFixed(1)}`);
    }
    for (const [a, b] of [["pelvis", "s1"], ["s1", "s2"], ["s2", "s3"], ["s3", "neck"], ["neck", "head"]]) {
      const l0 = frames[0] && len(sub(frames[0][a], frames[0][b]));
      if (Math.abs(L(a, b) - l0) > BONE_TOL) say("bone", i, `${a}-${b} changes length (${(L(a, b) * 100).toFixed(1)} vs ${(l0 * 100).toFixed(1)} cm)`);
    }
    // elbows and knees must not jump (a flipped joint)
    if (i > 0) for (const j of ["lEl", "rEl", "lKnee", "rKnee"]) { const d = len(sub(F[j], frames[i - 1][j])); if (d > ELBOW_JUMP) say("jump", i, `${j} jumps ${(d * 100).toFixed(0)} cm`); }
    // limbs through each other and through the torso
    const caps = [];
    for (const s of ["l", "r"]) {
      caps.push([s + "thigh", F[s + "Hip"], F[s + "Knee"], R.thigh, s + "leg", 0], [s + "shin", F[s + "Knee"], F[s + "Ankle"], R.shin, s + "leg", 1],
        [s + "ua", F[s + "Sh"], F[s + "El"], R.ua, s + "arm", 0], [s + "fa", F[s + "El"], F[s + "Wr"], R.fa, s + "arm", 1]);
    }
    const spine = [F.pelvis, F.s1, F.s2, F.s3, F.neck];
    for (let a = 0; a < caps.length; a++) {
      const [na, a0, a1, ra, ca, ia] = caps[a];
      for (let b = a + 1; b < caps.length; b++) {
        const [nb, b0, b1, rb, cb] = caps[b];
        if (ca === cb) continue; // the same limb
        const d = segDist(a0, a1, b0, b1), pen = ra + rb - d;
        if (pen > pass) say("pass", i, `${na} passes through ${nb} (${(pen * 100).toFixed(0)} cm deep)`);
      }
      if (ia === 1) { // forearms and shins against the torso (the upper limbs start at it)
        let d = 9; for (let k = 0; k < 4; k++) d = Math.min(d, segDist(a0, a1, spine[k], spine[k + 1]));
        if (ra + R.torso - d > PENETRATION_TORSO) say("torso", i, `${na} passes through the torso (${((ra + R.torso - d) * 100).toFixed(0)} cm deep)`);
      }
    }
  });
  return bad;
}
