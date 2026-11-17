// Draws the gear a move uses onto the stick figure: the motion clips track only the body, so the foam
// roller, the stick and the massage gun are placed from the body's points in each frame.
// A frame F is flat [x, y] pairs: spine x5 (pelvis first), head, near arm x4, far arm x4 (shoulder to
// hand), near leg x4, far leg x4 (hip to foot), in the 400 x 300 figure box with the floor at y = 280.
// Pure functions, no DOM: the page uses window.GEARDRAW, the tests use module.exports.
(function (root) {
  const FLOOR = 280, ROLLER = 13;
  const pt = (F, i) => [F[2 * i], F[2 * i + 1]];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const f = (n) => n.toFixed(1);
  const HANDS = [9, 13];
  // Body spots, each on both sides where there are two; the nearer one to the gun is used.
  const SPOT = {
    thigh: (F) => [mid(pt(F, 14), pt(F, 15)), mid(pt(F, 18), pt(F, 19))],
    calf: (F) => [mid(pt(F, 15), pt(F, 16)), mid(pt(F, 19), pt(F, 20))],
    pelvis: (F) => [pt(F, 0)],
    upperback: (F) => [mid(pt(F, 2), pt(F, 3))],
    shoulder: (F) => [pt(F, 6), pt(F, 10)],
    chest: (F) => [mid(pt(F, 3), pt(F, 4))],
    armpit: (F) => [mid(pt(F, 3), pt(F, 6))],
  };
  // Each gear move: what it uses and where it goes.
  const MOVES = {
    roll_upperback: { roller: "upperback" }, roll_tspine: { roller: "upperback" }, roll_lats: { roller: "armpit" },
    roll_quads: { roller: "thigh" }, roll_hams: { roller: "thigh" }, roll_glutes: { roller: "pelvis" }, roll_calves: { roller: "calf" },
    stick_pass: { stick: "hands" }, stick_side: { stick: "hands" }, stick_behind: { stick: "hands" }, stick_twist: { stick: "shoulders" },
    stick_hinge: { stick: "back" },
    gun_quads: { gun: "thigh" }, gun_hams: { gun: "thigh" }, gun_calves: { gun: "calf" }, gun_glutes: { gun: "pelvis" },
    gun_traps: { gun: "shoulder" }, gun_chest: { gun: "chest" },
  };

  // SVG for one frame: back goes behind the figure (the roller), front over it (stick, gun). "" when none.
  function shapes(id, F) {
    const g = MOVES[id];
    if (!g || !F) return { back: "", front: "" };
    if (g.roller) {
      // Under the body part, resting on the floor; the lowest spot when there are two.
      const at = SPOT[g.roller](F).sort((a, b) => b[1] - a[1])[0];
      return { back: `<circle class="fg-gear" cx="${f(at[0])}" cy="${FLOOR - ROLLER}" r="${ROLLER}"/>`, front: "" };
    }
    if (g.stick === "back") {
      // Along the back, from past the head to past the pelvis.
      const a = pt(F, 5), b = pt(F, 0), d = dist(a, b) || 1, ux = (a[0] - b[0]) / d, uy = (a[1] - b[1]) / d;
      return { back: "", front: `<line class="fg-gear" x1="${f(a[0] + ux * 16)}" y1="${f(a[1] + uy * 16)}" x2="${f(b[0] - ux * 10)}" y2="${f(b[1] - uy * 10)}"/>` };
    }
    if (g.stick === "shoulders") {
      // Across the upper back: level at shoulder height, as wide as the hands (narrow when turned).
      const xs = [pt(F, 9)[0], pt(F, 13)[0]], y = (pt(F, 6)[1] + pt(F, 10)[1]) / 2;
      const a = Math.min(...xs) - 18, b = Math.max(...xs) + 18;
      return { back: "", front: `<line class="fg-gear" x1="${f(a)}" y1="${f(y)}" x2="${f(b)}" y2="${f(y)}"/>` };
    }
    if (g.stick) {
      // Held in both hands, sticking out past them. Seen end-on (hands together, filmed side-on): a dot.
      const a = pt(F, 9), b = pt(F, 13), d = dist(a, b);
      if (d < 24) return { back: "", front: `<circle class="fg-gear fg-gear-end" cx="${f((a[0] + b[0]) / 2)}" cy="${f((a[1] + b[1]) / 2)}" r="5"/>` };
      const ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
      return { back: "", front: `<line class="fg-gear" x1="${f(a[0] - ux * 22)}" y1="${f(a[1] - uy * 22)}" x2="${f(b[0] + ux * 22)}" y2="${f(b[1] + uy * 22)}"/>` };
    }
    // The gun: in the hand nearer the spot, its head pointing at it.
    let best = null;
    for (const h of HANDS) for (const s of SPOT[g.gun](F)) {
      const hand = pt(F, h), d = dist(hand, s);
      if (!best || d < best.d) best = { hand, s, d };
    }
    const { hand, s, d } = best, ux = d ? (s[0] - hand[0]) / d : 1, uy = d ? (s[1] - hand[1]) / d : 0;
    const reach = Math.min(16, Math.max(8, d));
    const tip = [hand[0] + ux * reach, hand[1] + uy * reach];
    return { back: "", front: `<line class="fg-gear fg-gun" x1="${f(hand[0] - ux * 6)}" y1="${f(hand[1] - uy * 6)}" x2="${f(tip[0])}" y2="${f(tip[1])}"/>` +
      `<circle class="fg-gear fg-gun-head" cx="${f(tip[0])}" cy="${f(tip[1])}" r="5"/>` };
  }

  const api = { shapes, MOVES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GEARDRAW = api;
})(typeof window !== "undefined" ? window : globalThis);
