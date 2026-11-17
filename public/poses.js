// Stick-figure poses and the "Floor to standing" sequence. Shared by the video (video/index.html)
// and the card (card/card.html). Side view, facing right, floor at y = 280 in a 400 x 300 box.
(function () {
  const L = { torso: 70, neck: 9, head: 14, ua: 36, fa: 34, th: 44, sh: 44 };
  const FLOOR = 280;
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const dir = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];

  // Two-bone limb: returns [upper angle, lower angle] in degrees.
  function limbAngles(root, spec, a, b, defBend) {
    if (spec.mid) {
      const u = deg(Math.atan2(spec.mid[1] - root[1], spec.mid[0] - root[0]));
      const l = deg(Math.atan2(spec.to[1] - spec.mid[1], spec.to[0] - spec.mid[0]));
      return [u, l];
    }
    const t = spec.to;
    let dx = t[0] - root[0], dy = t[1] - root[1];
    let d = Math.hypot(dx, dy);
    d = Math.min(Math.max(d, Math.abs(a - b) + 0.5), a + b - 0.01);
    const th = Math.atan2(dy, dx);
    const ph = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    const bend = spec.bend ?? defBend;
    const ua = th + bend * ph;
    const j = [root[0] + a * Math.cos(ua), root[1] + a * Math.sin(ua)];
    const la = Math.atan2(t[1] - j[1], t[0] - j[0]);
    return [deg(ua), deg(la)];
  }

  // A pose spec: hip, torso (deg, hip to shoulder; -90 is upright), arch (+ rounds the back up),
  // head (deg, relative to torso), nh/fh (near/far hand), nf/ff (near/far foot).
  // A limb is {to:[x,y], bend?, mid?:[x,y]} or {r:[dx,dy]} relative to the shoulder (hands only).
  function resolve(p) {
    const s = dir(p.torso);
    const sh = [p.hip[0] + L.torso * s[0], p.hip[1] + L.torso * s[1]];
    const hand = (h) => (h.r ? { to: [sh[0] + h.r[0], sh[1] + h.r[1]], bend: h.bend } : h);
    return {
      hip: p.hip.slice(),
      torso: p.torso,
      arch: p.arch || 0,
      head: p.head || 0,
      nh: limbAngles(sh, hand(p.nh), L.ua, L.fa, 1),
      fh: limbAngles(sh, hand(p.fh), L.ua, L.fa, 1),
      nf: limbAngles(p.hip, p.nf, L.th, L.sh, -1),
      ff: limbAngles(p.hip, p.ff, L.th, L.sh, -1),
    };
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => {
    let d = ((b - a + 540) % 360) - 180;
    return a + d * t;
  };
  function mix(A, B, t) {
    const m = (k) => [lerpAng(A[k][0], B[k][0], t), lerpAng(A[k][1], B[k][1], t)];
    return {
      hip: [lerp(A.hip[0], B.hip[0], t), lerp(A.hip[1], B.hip[1], t)],
      torso: lerp(A.torso, B.torso, t),
      arch: lerp(A.arch, B.arch, t),
      head: lerp(A.head, B.head, t),
      nh: m("nh"), fh: m("fh"), nf: m("nf"), ff: m("ff"),
    };
  }

  // Joint positions from a resolved pose.
  function joints(R) {
    const s = dir(R.torso);
    const hip = R.hip;
    const sh = [hip[0] + L.torso * s[0], hip[1] + L.torso * s[1]];
    const perp = [s[1], -s[0]];
    const ctrl = [(hip[0] + sh[0]) / 2 + perp[0] * R.arch * 2, (hip[1] + sh[1]) / 2 + perp[1] * R.arch * 2];
    const hd = dir(R.torso + R.head);
    const neck = [sh[0] + L.neck * hd[0], sh[1] + L.neck * hd[1]];
    const head = [sh[0] + (L.neck + L.head) * hd[0], sh[1] + (L.neck + L.head) * hd[1]];
    const chain = (root, ang, a, b) => {
      const u = dir(ang[0]), l = dir(ang[1]);
      const j = [root[0] + a * u[0], root[1] + a * u[1]];
      // keep joints on or above the floor during transitions
      const fl = (pt) => [pt[0], Math.min(pt[1], FLOOR + 1)];
      return [root, fl(j), fl([j[0] + b * l[0], j[1] + b * l[1]])];
    };
    return {
      hip, sh, ctrl, neck, head,
      nh: chain(sh, R.nh, L.ua, L.fa), fh: chain(sh, R.fh, L.ua, L.fa),
      nf: chain(hip, R.nf, L.th, L.sh), ff: chain(hip, R.ff, L.th, L.sh),
    };
  }

  const f = (n) => n.toFixed(1);
  const poly = (c) => `M${f(c[0][0])} ${f(c[0][1])}L${f(c[1][0])} ${f(c[1][1])}L${f(c[2][0])} ${f(c[2][1])}`;

  // Draw into an <svg> that holds the figure's <path>/<circle> elements (made by figureSVG).
  function draw(svg, R) {
    const J = joints(R);
    const q = (sel) => svg.querySelector(sel);
    q(".fg-fh").setAttribute("d", poly(J.fh));
    q(".fg-ff").setAttribute("d", poly(J.ff));
    q(".fg-spine").setAttribute(
      "d",
      `M${f(J.hip[0])} ${f(J.hip[1])}Q${f(J.ctrl[0])} ${f(J.ctrl[1])} ${f(J.sh[0])} ${f(J.sh[1])}L${f(J.neck[0])} ${f(J.neck[1])}`
    );
    q(".fg-head").setAttribute("cx", f(J.head[0]));
    q(".fg-head").setAttribute("cy", f(J.head[1]));
    q(".fg-nf").setAttribute("d", poly(J.nf));
    q(".fg-nh").setAttribute("d", poly(J.nh));
  }

  // Markup for one figure. Colours come from CSS classes so the page's theme applies.
  function figureSVG(extraClass, viewBox) {
    return (
      `<svg class="fg ${extraClass || ""}" viewBox="${viewBox || "0 0 400 300"}" xmlns="http://www.w3.org/2000/svg">` +
      `<line class="fg-floor" x1="20" y1="${FLOOR + 6}" x2="380" y2="${FLOOR + 6}"/>` +
      `<path class="fg-far fg-fh"/><path class="fg-far fg-ff"/>` +
      `<path class="fg-ink fg-spine"/><circle class="fg-headc fg-head" r="${L.head}"/>` +
      `<path class="fg-ink fg-nf"/><path class="fg-ink fg-nh"/></svg>`
    );
  }

  const P = {
    stand: { hip: [200, 192], torso: -90, nh: { r: [14, 66] }, fh: { r: [-8, 67] }, nf: { to: [204, 280] }, ff: { to: [194, 280] } },
    table: { hip: [150, 236], torso: -22, nh: { to: [216, 280] }, fh: { to: [210, 280] }, nf: { to: [106, 278] }, ff: { to: [100, 278] } },
    cow: { hip: [150, 236], torso: -22, arch: -9, head: -40, nh: { to: [216, 280] }, fh: { to: [210, 280] }, nf: { to: [106, 278] }, ff: { to: [100, 278] } },
    cat: { hip: [150, 236], torso: -22, arch: 14, head: 55, nh: { to: [216, 280] }, fh: { to: [210, 280] }, nf: { to: [106, 278] }, ff: { to: [100, 278] } },
    threadOpenN: { hip: [150, 236], torso: -24, head: -70, nh: { r: [4, -70] }, fh: { to: [210, 280] }, nf: { to: [106, 278] }, ff: { to: [100, 278] } },
    threadUnderN: { hip: [150, 236], torso: 12, head: 35, nh: { to: [150, 276], bend: 1 }, fh: { to: [222, 280], bend: 1 }, nf: { to: [106, 278] }, ff: { to: [100, 278] } },
    threadOpenF: { hip: [150, 236], torso: -24, head: -70, fh: { r: [4, -70] }, nh: { to: [214, 280] }, nf: { to: [106, 278] }, ff: { to: [100, 278] } },
    threadUnderF: { hip: [150, 236], torso: 12, head: 35, fh: { to: [150, 276], bend: 1 }, nh: { to: [222, 280], bend: 1 }, nf: { to: [106, 278] }, ff: { to: [100, 278] } },
    seatN: { hip: [190, 268], torso: -92, nh: { r: [22, 52] }, fh: { r: [18, 55] }, nf: { mid: [232, 275], to: [196, 280] }, ff: { mid: [149, 273], to: [110, 278] } },
    seatUp: { hip: [190, 268], torso: -95, nh: { r: [24, 50] }, fh: { r: [20, 53] }, nf: { to: [246, 280] }, ff: { to: [240, 280] } },
    seatF: { hip: [190, 268], torso: -92, nh: { r: [22, 52] }, fh: { r: [18, 55] }, ff: { mid: [232, 275], to: [196, 280] }, nf: { mid: [149, 273], to: [110, 278] } },
    beast: { hip: [160, 230], torso: -12, head: 10, nh: { to: [230, 280] }, fh: { to: [224, 280] }, nf: { to: [120, 280] }, ff: { to: [114, 280] } },
    sideSit: { hip: [176, 262], torso: -125, head: 30, nh: { to: [128, 280] }, fh: { to: [122, 280] }, nf: { to: [240, 280] }, ff: { to: [234, 280] } },
    crabN: { hip: [178, 222], torso: -165, head: 70, nh: { r: [-56, -40] }, fh: { to: [96, 280] }, nf: { to: [238, 280] }, ff: { to: [232, 280] } },
    crabF: { hip: [178, 222], torso: -165, head: 70, fh: { r: [-56, -40] }, nh: { to: [96, 280] }, nf: { to: [238, 280] }, ff: { to: [232, 280] } },
    lungeDropN: { hip: [190, 235], torso: 10, head: -10, nh: { mid: [236, 274], to: [270, 277] }, fh: { to: [272, 280] }, nf: { to: [240, 280] }, ff: { to: [110, 280] } },
    lungeReachN: { hip: [190, 235], torso: -20, head: -60, nh: { r: [0, -70] }, fh: { to: [262, 280] }, nf: { to: [240, 280] }, ff: { to: [110, 280] } },
    lungeDropF: { hip: [190, 235], torso: 10, head: -10, fh: { mid: [236, 274], to: [270, 277] }, nh: { to: [272, 280] }, ff: { to: [240, 280] }, nf: { to: [110, 280] } },
    lungeReachF: { hip: [190, 235], torso: -20, head: -60, fh: { r: [0, -70] }, nh: { to: [262, 280] }, ff: { to: [240, 280] }, nf: { to: [110, 280] } },
    dog: { hip: [150, 200], torso: 38.7, head: 5, nh: { to: [262, 280] }, fh: { to: [256, 280] }, nf: { to: [110, 280] }, ff: { to: [104, 280] } },
    fold: { hip: [200, 192], torso: 55, head: 15, nh: { r: [-2, 32] }, fh: { r: [-8, 32] }, nf: { to: [206, 280] }, ff: { to: [198, 280] } },
    half: { hip: [204, 192], torso: -20, head: 10, nh: { r: [8, 66] }, fh: { r: [2, 68] }, nf: { to: [206, 280] }, ff: { to: [198, 280] } },
    shakeA: { hip: [200, 196], torso: -90, nh: { r: [10, 66] }, fh: { r: [-2, 66] }, nf: { to: [208, 280] }, ff: { to: [192, 280] } },
    shakeB: { hip: [200, 204], torso: -88, nh: { r: [16, 60] }, fh: { r: [-8, 62] }, nf: { to: [208, 280] }, ff: { to: [192, 280] } },
    skyLow: { hip: [200, 192], torso: -90, nh: { r: [24, 50] }, fh: { r: [20, 52] }, nf: { to: [204, 280] }, ff: { to: [194, 280] } },
    sky: { hip: [200, 192], torso: -92, head: -20, nh: { r: [6, -70] }, fh: { r: [0, -70] }, nf: { to: [204, 280] }, ff: { to: [194, 280] } },
    bowRest: { hip: [200, 206], torso: -90, nh: { r: [26, 18] }, fh: { r: [22, 22] }, nf: { to: [238, 280] }, ff: { to: [162, 280] } },
    bowN: { hip: [200, 206], torso: -90, nh: { r: [70, -2] }, fh: { r: [-10, 10], bend: -1 }, nf: { to: [238, 280] }, ff: { to: [162, 280] } },
    bowF: { hip: [200, 206], torso: -90, fh: { r: [70, -2] }, nh: { r: [-10, 10], bend: -1 }, nf: { to: [238, 280] }, ff: { to: [162, 280] } },
    sit: { hip: [190, 268], torso: -90, nh: { to: [232, 262] }, fh: { to: [226, 266] }, nf: { mid: [232, 274], to: [198, 282] }, ff: { mid: [226, 276], to: [184, 282] } },
  };
  const R = {};
  for (const k in P) R[k] = resolve(P[k]);

  // The sequence. Breath: in 3 s, out 4.5 s. Each segment: [pose, seconds, breath, caption].
  const IN = 3, OUT = 4.5;
  const rep = (n, segs) => Array.from({ length: n }, () => segs).flat();
  const shake = [];
  for (let i = 0; i < 120; i++) shake.push(["shakeB", 0.25, "", "Loose knees. Let everything bounce."], ["shakeA", 0.25, "", "Loose knees. Let everything bounce."]);
  const STEPS = [
    { name: "Cat–cow", count: "8 breaths", how: "Hands and knees. In: chest forward, look up. Out: round the back.", key: ["cow", "cat"], start: "table",
      segs: rep(8, [["cow", IN, "in", "Breathe in: drop the belly, look up"], ["cat", OUT, "out", "Breathe out: round the back, tuck the chin"]]) },
    { name: "Thread the needle", count: "4 breaths each side", how: "Out: slide one arm under, shoulder down. In: open it to the sky.", key: ["threadUnderN", "threadOpenN"], start: "table",
      segs: [
        ...rep(4, [["threadUnderN", OUT, "out", "Breathe out: slide the arm under, shoulder down"], ["threadOpenN", IN, "in", "Breathe in: open the arm to the sky"]]),
        ["table", 2.5, "", "Other side"],
        ...rep(4, [["threadUnderF", OUT, "out", "Breathe out: slide the other arm under"], ["threadOpenF", IN, "in", "Breathe in: open it to the sky"]]),
      ] },
    { name: "90/90 hip switches", count: "8 slow switches", how: "Sit, knees bent at right angles. Swing both knees to the other side.", key: ["seatN", "seatF"], start: "seatN",
      segs: rep(4, [["seatUp", IN, "in", "Breathe in: knees up through the middle"], ["seatF", OUT, "out", "Breathe out: knees down to the other side"], ["seatUp", IN, "in", "Breathe in: knees up"], ["seatN", OUT, "out", "Breathe out: down to the first side"]]) },
    { name: "Beast to crab reach", count: "3 each side", how: "Knees hover. In: turn over, lift the hips, reach back. Out: return.", key: ["beast", "crabN"], start: "beast",
      segs: rep(3, [
        ["sideSit", 1.5, "in", "Breathe in: turn over, lift the hips, reach back", [0, 0.4]], ["crabN", 2, "in", "Breathe in: turn over, lift the hips, reach back", [0.4, 1]],
        ["sideSit", 2, "out", "Breathe out: back to beast, knees hover", [0, 0.45]], ["beast", 2.5, "out", "Breathe out: back to beast, knees hover", [0.45, 1]],
        ["sideSit", 1.5, "in", "Breathe in: turn the other way and reach", [0, 0.4]], ["crabF", 2, "in", "Breathe in: turn the other way and reach", [0.4, 1]],
        ["sideSit", 2, "out", "Breathe out: back to beast", [0, 0.45]], ["beast", 2.5, "out", "Breathe out: back to beast", [0.45, 1]],
      ]) },
    { name: "World's greatest stretch", count: "3 each side", how: "Long lunge. Out: elbow down inside the front foot. In: reach to the sky.", key: ["lungeDropN", "lungeReachN"], start: "lungeDropN",
      segs: [
        ...rep(3, [["lungeReachN", IN + 1, "in", "Breathe in: turn and reach to the sky"], ["lungeDropN", OUT, "out", "Breathe out: elbow down inside the front foot"]]),
        ["lungeDropF", 4, "", "Switch legs"],
        ...rep(3, [["lungeReachF", IN + 1, "in", "Breathe in: reach to the sky"], ["lungeDropF", OUT, "out", "Breathe out: elbow down"]]),
      ] },
    { name: "Down dog, fold, roll up", count: "5 breaths, then roll up", how: "Hips high, heels down. Walk to the hands, hang, roll up slowly.", key: ["dog", "fold"], start: "dog",
      segs: [
        ...rep(5, [["dog", IN, "in", "Breathe in: long spine, hips high"], ["dog", OUT, "out", "Breathe out: heels sink toward the floor"]]),
        ["fold", 6, "", "Walk the feet to the hands"],
        ["fold", IN, "in", "Breathe in: hang"], ["fold", OUT, "out", "Breathe out: heavy head"],
        ["half", 5, "", "Roll up slowly, one bone at a time"], ["stand", 4, "", "Head comes up last"],
      ] },
    { name: "Shake", count: "about 1 minute", how: "Loose knees, bounce, let the arms and shoulders go.", key: ["shakeA", "shakeB"], start: "stand", segs: shake },
    { name: "Hold up the sky, draw the bow", count: "4 breaths each", how: "In: palms up overhead. Out: down. Then wide stance, draw a bow each side.", key: ["sky", "bowN"], start: "skyLow",
      segs: [
        ...rep(4, [["sky", IN, "in", "Breathe in: palms up to the sky"], ["skyLow", OUT, "out", "Breathe out: hands float down"]]),
        ["bowRest", 3, "", "Step wide, sink a little"],
        ...rep(2, [["bowN", IN, "in", "Breathe in: draw the bow"], ["bowRest", OUT, "out", "Breathe out: hands back"], ["bowF", IN, "in", "Breathe in: draw the other side"], ["bowRest", OUT, "out", "Breathe out: hands back"]]),
      ] },
    { name: "Stand still", count: "5 breaths, then sit", how: "Eyes closed. Feel the body hum. Then sit down to meditate.", key: ["stand", "sit"], start: "stand",
      segs: [...rep(5, [["stand", IN, "in", "Eyes closed. Breathe in"], ["stand", OUT, "out", "Breathe out. Feel the body hum"]]), ["sit", 7, "", "Sit down to meditate"]] },
  ];

  window.FIG = { L, P, R, resolve, mix, draw, joints, figureSVG, STEPS };
})();
