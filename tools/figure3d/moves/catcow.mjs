// Cat-cow, all fours. Poses named as in plan.js; only the first side is typed.
import { straightArms } from "../rig.mjs";
import { POSES as C } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P.cow = straightArms({ ...C.table, flex: -42, nflex: -50, p: [0.01, 0.5, 0] });
P.cat = straightArms({ ...C.table, flex: 62, nflex: 55, p: [-0.02, 0.5, 0] });
