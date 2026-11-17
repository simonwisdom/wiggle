// Open and hug: a = arms swung wide open (chest open, arms a little behind), b = arms wrapped across the chest,
// each hand on the opposite shoulder. The arms swing out through the front, not through the body.
import { base, hand, torso, add } from "../rig.mjs";
import { POSES as C, armTo } from "./_common.mjs";

export const POSES = {};
const P = POSES;
// hands continue the line of the forearm (a loose wrist), palms down
const along = (Q, d) => ({ ...Q, rh: { ...Q.rh, dir: [d[0], d[1] - 0.2, d[2]] }, lh: { ...Q.lh, dir: [d[0], d[1] - 0.2, -d[2]] } });
P["hug.a"] = along(armTo(armTo({ ...C.stand, p: [0, 0.94, 0], flex: -6, nflex: -6 }, "r", [-0.35, 0.05, 1]), "l", [-0.35, 0.05, -1]), [-0.35, 0.05, 1]);
const wrap = { ...C.stand, flex: 8, nflex: 10 };
const J = torso(wrap);
P["hug.b"] = { ...wrap,
  rh: hand(add(J.lSh, [0.06, -0.08, 0.0]), [0.4, -1, 0.2], [0, 0.3, -1]),
  lh: hand(add(J.rSh, [0.2, 0.03, 0.0]), [0.4, -1, -0.2], [0, 0.3, 1]) };
// on the way the arms pass through the front, level with the shoulders
export const VIA = { "hug.a>hug.b": [along(armTo(armTo({ ...C.stand, flex: 0 }, "r", [1, -0.15, 0.1]), "l", [1, 0.15, -0.1]), [1, 0, 0.1])] };
