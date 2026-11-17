// Deep squat: feet wide and turned out, hips sinking between the heels, palms together at the chest with the elbows
// pressing inside the knees. start = standing wide, in = deep, out = a little deeper. Standing camera.
import { base, hand, foot, torso, add } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const wide = { rf: foot([0, 0.085, 0.3], [1, 0, 0.7], [0.12, -0.06, 0.06]), lf: foot([0, 0.085, -0.3], [1, 0, -0.7], [0.12, -0.06, -0.06]) };
// prayer hands: the wrists a set distance in front of and below the shoulders' midpoint, elbows out to the sides
const prayer = (Pz, fwd, down) => {
  const J = torso(Pz), c = [(J.lSh[0] + J.rSh[0]) / 2, (J.lSh[1] + J.rSh[1]) / 2, (J.lSh[2] + J.rSh[2]) / 2];
  const R = J.lSh; void R;
  const f = [Math.cos((Pz.pitch * Math.PI) / 180 * 0 ) , 0, 0]; void f;
  return { ...Pz, rh: hand(add(c, [fwd, -down, 0.035]), [0, -0.3, 1], [0.5, 1, -0.6]), lh: hand(add(c, [fwd, -down, -0.035]), [0, -0.3, -1], [0.5, 1, 0.6]) };
};
P["squat.start"] = prayer({ ...base, p: [-0.04, 0.88, 0], pitch: 4, ...wide, rh: hand([0, 1, 0.1], [0, -1, 1]), lh: hand([0, 1, -0.1], [0, -1, -1]) }, 0.24, 0.12);
P["squat.in"] = prayer({ ...base, p: [-0.1, 0.27, 0], pitch: 24, flex: -6, nflex: -8, ...wide, rh: hand([0, 1, 0.1], [0, -1, 1]), lh: hand([0, 1, -0.1], [0, -1, -1]) }, 0.2, 0.16);
P["squat.out"] = prayer({ ...base, p: [-0.11, 0.24, 0], pitch: 28, flex: -6, nflex: -8, ...wide, rh: hand([0, 1, 0.1], [0, -1, 1]), lh: hand([0, 1, -0.1], [0, -1, -1]) }, 0.2, 0.16);
