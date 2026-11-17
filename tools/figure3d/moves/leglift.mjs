// Lying hamstring raise: on the back, one straight leg up, the other flat on the floor, hands at the sides.
import { base, hand, foot } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const body = { ...base, p: [0, 0.1, 0], pitch: -90 };
const down = { rh: hand([0.02, 0.04, 0.27], [0, 0, 1], [1, 0, 0]), lh: hand([0.02, 0.04, -0.27], [0, 0, -1], [1, 0, 0]) };
const flatLeg = (z) => foot([0.87, 0.065, z], [0, 1, 0], [0.04, 0.12, 0]); // heel on the floor, toes up
// a: both legs flat (the right leg is the one that works).
P["leglift.a"] = { ...body, ...down, rf: flatLeg(0.09), lf: flatLeg(-0.09) };
// b: the right leg straight up toward the ceiling (angle from the floor about 78 degrees), foot flexed.
const up = (deg) => { const a = (deg * Math.PI) / 180, L = 0.78 - 0.004; return foot([0.09 + L * Math.cos(a), 0.1 + L * Math.sin(a), 0.09], [-Math.sin(a), Math.cos(a), 0], [-0.08, 0.1, 0]); }; // the kneecap faces up, then toward the head as the leg rises
P["leglift.b"] = { ...body, ...down, rf: up(78), lf: flatLeg(-0.09) };
// The straight leg swings up in an arc about the hip (a straight blend of the ankle would bend the knee half way and twist the
// foot out of its plane); the foot goes from "heel on the floor, toes up" to flexed toward the face.
const arcAt = (deg) => { const f = up(deg), k = deg / 78; return { ...body, ...down, lf: flatLeg(-0.09), rf: { ...f, toe: [0.04 - 0.12 * k, 0.12 - 0.02 * k, 0] } }; };
export const VIA = { "leglift.a>leglift.b": [12, 28, 44, 60, 72].map(arcAt) };
