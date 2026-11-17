// Shake: a loop played in real time. The poses are the shared `stand` with a bounce on top. plan.js names: shakeA, shakeB.
// 10 beats in 3.2 s (3.1 a second) and 5 sways, so the end of the clip is its start.
export const POSES = {};
export const LOOPS = {
  shake: {
    seconds: 3.2, pose: "stand",
    tweak(Pz, t) {
      const w = 2 * Math.PI * (10 / 3.2) * t, s = Math.sin; // 10 beats in the clip, 5 of the half-speed sway
      const q = JSON.parse(JSON.stringify(Pz));
      q.p[1] -= 0.035 + 0.03 * s(w);
      q.roll = 2 * s(w / 2); q.twist = 5 * s(w / 2 + 1); q.nflex = 4 * s(w + 2);
      for (const [h, sg, ph] of [["rh", 1, 0.9], ["lh", -1, 2.3]]) {
        q[h].t[0] += 0.07 + 0.07 * s(w + ph); q[h].t[1] += 0.05 + 0.05 * s(w + ph + 1.2); q[h].t[2] += sg * 0.04 * s(w / 2 + ph);
        q[h].dir = [0.3 + 0.5 * s(w + ph + 2), -1, 0];
      }
      q.rf.pole = [1, 0, 0.25]; q.lf.pole = [1, 0, -0.25];
      return q;
    },
  },
};
export const LOOP_OF = { shakeA: "shake", shakeB: "shake" };
