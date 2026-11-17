// One fixed camera per position, so neighbouring clips match: no drift, square picture.
// The same numbers drive the render page and the projection used by the checks and the head track.
import { add, sub, mul, dot, cross, norm, len } from "./rig.mjs";

export const FOV = 30;      // vertical field of view, degrees
export const SIZE = 540;    // the clip is SIZE x SIZE pixels
export const MARGIN = 0.05; // the figure stays this far from the edge (share of the picture)
// The mat, on the floor, centred on the origin (x along the figure, z across it).
export const MAT = { x: 1.84, z: 0.8 };

// az: degrees round the figure, 0 = straight on its right side... (the camera sits at +z, the figure's right side,
// turned az degrees toward the way it faces); el: degrees above the floor line; target: the point it looks at.
// All four sit at about the same distance (233 to 238 pixels per metre at the target), so the body is drawn at a similar size in
// every position. The standing camera sets the size: the sky pose is the tallest thing and fills the picture to the margin.
// Fitted with fit-cameras.mjs --scale 236 (floor, seated) and fit-cameras.mjs (standing); lying and seated refitted with the lying and seated moves.
export const CAMS = {
  floor: { az: 30, el: 24, dist: 4.27, target: [0.11, 0.55, -0.02] }, // all fours and kneeling
  seated: { az: 30, el: 14, dist: 4.27, target: [0.12, 0.4, -0.02] },
  lying: { az: 30, el: 14, dist: 4.27, target: [0.1, 0.4, -0.02] }, // on the back or face down
  standing: { az: 30, el: 8, dist: 4.33, target: [0.15, 0.87, -0.02] }, // standing and rising
};

export function position(cam) {
  const az = (cam.az * Math.PI) / 180, el = (cam.el * Math.PI) / 180;
  const t = cam.target;
  return [t[0] + Math.sin(az) * Math.cos(el) * cam.dist, t[1] + Math.sin(el) * cam.dist, t[2] + Math.cos(az) * Math.cos(el) * cam.dist];
}

// Where a point lands in the picture: pixels from the top left, and the pixels per metre there.
export function project(cam, p) {
  const c = position(cam), f = norm(sub(cam.target, c)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const d = sub(p, c), z = dot(d, f), k = SIZE / 2 / (z * Math.tan((FOV * Math.PI) / 360));
  return { x: SIZE / 2 + dot(d, r) * k, y: SIZE / 2 - dot(d, u) * k, perM: k, depth: z };
}

// The head and neck in the picture, for the app to draw its own head on top (the render can leave the 3D head out).
// [head centre x, y, neck x, y, head height in pixels, tilt in degrees (0 = upright, + = leaning right)], 0.1 px.
const HEAD_CENTRE = 0.075, HEAD_HEIGHT = 0.236; // metres: the head egg's centre along head->headEnd, and its height
export function headCentre(F) { return add(F.head, mul(norm(sub(F.headEnd, F.head)), HEAD_CENTRE)); }
export function headTrack(cam, F) {
  const h = project(cam, headCentre(F)), n = project(cam, F.neck);
  const tilt = (Math.atan2(h.x - n.x, n.y - h.y) * 180) / Math.PI;
  return [h.x, h.y, n.x, n.y, HEAD_HEIGHT * h.perM, tilt].map((v) => Math.round(v * 10) / 10);
}
