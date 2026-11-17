// Roll down: a = standing tall (rolled up, head last), b = rolled down, chin to chest, arms hanging, knees soft.
// On the way the arms hang straight down from the shoulders (waypoints), they don't swing with the body.
import { hand, torso, add } from "../rig.mjs";
import { POSES as C } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P["rolldown.a"] = { ...C.stand };
const hang = (Pz, drop = 0.5) => {
  const J = torso(Pz), y = (sh) => Math.max(0.13, sh[1] - drop);
  const t = (sh, z) => { const q = add(sh, [0.06, 0, z]); return [q[0], y(sh), q[2]]; };
  return { ...Pz, rh: hand(t(J.rSh, 0.03), [0.3, 0, 1], [0.1, -1, 0]), lh: hand(t(J.lSh, -0.03), [0.3, 0, -1], [0.1, -1, 0]) };
};
const at = (u) => hang({ ...C.stand, p: [-0.16 * u, 0.94 - 0.02 * u, 0], pitch: 128 * u, flex: 40 * u, nflex: 40 * u,
  rf: { ...C.stand.rf, pole: [1, 0, 0.1] }, lf: { ...C.stand.lf, pole: [1, 0, -0.1] } });
P["rolldown.b"] = at(1);
export const VIA = { "rolldown.a>rolldown.b": [0.2, 0.4, 0.6, 0.8].map(at) };
