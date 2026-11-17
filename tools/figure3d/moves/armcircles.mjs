// Arm circles: both arms straight, circling together forward-up-back-down beside the head. A loop in real time, 5 s,
// two full circles, so the end of the clip is its start. Standing camera.
import { torso, add } from "../rig.mjs";

export const POSES = {};
export const LOOPS = {
  armcircles: {
    seconds: 5, pose: "stand",
    tweak(Pz, t) {
      const th = 2 * Math.PI * (2 / 5) * t; // two turns in the clip
      const q = JSON.parse(JSON.stringify(Pz)), R = 0.47;
      q.p[1] -= 0.05; q.rf.pole = [1, 0, 0.2]; q.lf.pole = [1, 0, -0.2]; // soft knees keep the top of the circle in the picture
      const J = torso(q);
      for (const [h, s, z] of [["rh", "rSh", 0.06], ["lh", "lSh", -0.06]]) {
        // 0 = straight down; the hand goes forward and up, over the top and back down behind
        const d = [Math.sin(th) * R, -Math.cos(th) * R, z];
        q[h].t = add(J[s], d); q[h].pole = [-Math.sin(th) * 0.3, 0, z > 0 ? 1 : -1];
        q[h].dir = [0.3 * Math.sin(th) + Math.cos(th), -0.3 * Math.cos(th) + Math.sin(th), z * 0.5]; // the wrist bends about 70 degrees toward the way the hand is moving
      }
      return q;
    },
  },
};
export const LOOP_OF = { "armcircles.loop": "armcircles" };
