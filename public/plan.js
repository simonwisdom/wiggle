// Builds a session from the move library: picks varied moves for the minutes you have, favours the
// areas you picked, moves you haven't done lately and the ones you asked for more of, orders them from
// the floor up, and shifts reps by how the last few sessions felt. swap() replaces one move.
// A session is for the morning, before a workout (moving stretches only, quicker) or after one (long
// holds, slow breath, from standing down to the floor).
// Pure functions, no DOM: the page uses window.PLAN, the tests use module.exports.
(function (root) {
  const TRANSITION = 5; // seconds to get into each move ("Next: ...")
  const INTRO = 6;

  // What a session is for. Each: the moves that open and close it, which way it runs (1 floor up,
  // -1 standing down), the pose it starts from, its breath in seconds, and which moves it can use.
  const DYNAMIC = (m) => m.type !== "hold" && m.id !== "still";
  const GENTLE = (m) => !m.demanding && m.type !== "loop" && m.id !== "still" && m.id !== "shake";
  const MODES = {
    morning: { label: "Morning", first: "catcow", last: "still", dir: 1, from: "table", breath: { in: 3, out: 4.5 }, can: () => true },
    before: { label: "Warm-up", first: "catcow", last: "shake", dir: 1, from: "table", breath: { in: 2.5, out: 3.5 }, can: DYNAMIC },
    after: { label: "Cool-down", first: null, last: null, dir: -1, from: "stand", breath: { in: 4, out: 6 }, can: GENTLE },
    // The Eight Brocades (Ba Duan Jin): always the whole form, in its fixed order; the length changes only
    // the breaths per piece, and body-area picks don't change it.
    qigong: { label: "Qigong", first: "settle", last: "still", dir: 1, from: "stand", breath: { in: 4, out: 5 }, can: () => false,
      form: ["settle", "sky", "bow", "heaven", "owl", "sway", "feet", "punch", "bounce", "still"] },
  };
  const modeOf = (mode) => MODES[mode] || MODES.morning;
  // "first" or "last" when this move opens or closes a session of that kind.
  const keepOf = (m, mode) => (m.id === modeOf(mode).first ? "first" : m.id === modeOf(mode).last ? "last" : undefined);

  // Breath lengths in seconds. Slower when recent sessions felt hard.
  const pace = (level, mode) => {
    const b = modeOf(mode).breath;
    return level < 0 ? { in: b.in + 0.5, out: b.out + 0.5 } : b;
  };

  const rep = (n, segs) => Array.from({ length: n }, () => segs).flat();

  const AREAS = {
    hips: "Hips", hamstrings: "Hamstrings", adductors: "Inner thighs", hipflexors: "Hip flexors",
    ankles: "Ankles", upperback: "Upper back", shoulders: "Shoulders", spine: "Spine",
  };
  const FOCUS = { all: "Everything", ...AREAS };
  // What you train, named as a gym app names it, for warm-ups and cool-downs. Each: the body areas whose
  // moves prepare or release it, and the moves that work it most directly (they come up first).
  const MUSCLES = {
    chest: { label: "Chest", areas: ["shoulders", "upperback"], moves: ["hug", "tabletop", "puppy", "cobra", "skybow", "stick_behind", "stick_pass", "gun_chest"] },
    back: { label: "Back", areas: ["upperback", "spine"], moves: ["child", "puppy", "thread", "squatrot", "catcow", "supinetwist", "rolldown", "roll_upperback", "roll_tspine", "roll_lats", "stick_twist", "stick_side"] },
    shoulders: { label: "Shoulders", areas: ["shoulders"], moves: ["armcircles", "thread", "skybow", "beastcrab", "hug", "stick_pass", "stick_behind", "roll_lats", "gun_traps"] },
    arms: { label: "Arms", areas: ["shoulders"], moves: ["tabletop", "puppy", "armcircles", "skybow"] },
    core: { label: "Core", areas: ["spine"], moves: ["cobra", "bridge", "sidebend", "supinetwist", "catcow", "stick_twist", "stick_side"] },
    glutes: { label: "Glutes", areas: ["hips"], moves: ["figure4", "pigeon", "hips9090", "bridge", "squat", "squatrot", "roll_glutes", "gun_glutes"] },
    quads: { label: "Quads", areas: ["hipflexors", "ankles"], moves: ["lowlunge", "lungerock", "lizard", "squat", "cossack", "wgs", "roll_quads", "gun_quads"] },
    hamstrings: { label: "Hamstrings", areas: ["hamstrings"], moves: ["leglift", "halfsplit", "seatedfold", "ragdoll", "dogfold", "roll_hams", "gun_hams", "stick_hinge"] },
    adductors: { label: "Inner thighs", areas: ["adductors", "hips"], moves: ["butterfly", "straddle", "frog", "cossack", "happybaby"] },
    calves: { label: "Calves", areas: ["ankles"], moves: ["calfraise", "dogpedal", "ankle", "dogfold", "roll_calves", "gun_calves"] },
  };
  // Upper and lower body, each picked with one tap: the areas (morning) or muscle groups (around a workout) in each half.
  const HALVES = {
    upper: { label: "Upper body", areas: ["shoulders", "upperback", "spine"], muscles: ["chest", "back", "shoulders", "arms", "core"] },
    lower: { label: "Lower body", areas: ["hips", "hipflexors", "adductors", "hamstrings", "ankles"], muscles: ["glutes", "quads", "adductors", "hamstrings", "calves"] },
  };
  // Floor first, then up to standing. Cat–cow opens and Stand still closes every session.
  const POSITIONS = { lying: 1, seated: 2, allfours: 3, kneeling: 4, rising: 5, standing: 6 };

  // ---- moves played from a clip by type (segments made from the type, poses named move.key[.F]) ----
  // flow: two positions on the breath (a on the in-breath, b on the out-breath).
  // hold: ease in from start, then sway between two moments of the hold (in and out) on the breath.
  // alt: a middle and two sides (mid, n, f); noMid: straight from side to side.
  // loop: a repeating motion played in real time, 15 s a rep.
  const P = (id, key, far) => `${id}.${key}${far ? ".F" : ""}`;
  const REPS = {
    flow: { min: 3, base: 6, max: 10 }, flowSides: { min: 2, base: 4, max: 7 },
    hold: { min: 3, base: 6, max: 10 }, holdSides: { min: 2, base: 5, max: 8 },
    alt: { min: 2, base: 3, max: 6 }, loop: { min: 1, base: 2, max: 4 },
    spot: { min: 2, base: 3, max: 6 }, spotSides: { min: 2, base: 3, max: 6 },
  };
  // What gear a move needs. A move with gear comes up only when you have said you have it.
  const GEAR = { roller: "Foam roller", stick: "Stick", gun: "Massage gun" };

  function typed(m) {
    const { id, type, sides, cap } = m;
    const reps = REPS[type + (sides && type !== "alt" && type !== "loop" ? "Sides" : "")];
    let segs, start, count;
    if (type === "flow") {
      start = P(id, "a");
      const side = (n, b, far) => rep(n, [[P(id, "a", far), b.in, "in", cap.a], [P(id, "b", far), b.out, "out", cap.b]]);
      segs = (n, b) => (sides ? [...side(n, b, false), [P(id, "a", true), 3, "", "Other side"], ...side(n, b, true)] : side(n, b, false));
      count = (n) => (sides ? `${n} breaths each side` : `${n} breaths`);
    } else if (type === "hold") {
      start = P(id, "start");
      const side = (n, b, far) => [[P(id, "in", far), 4, "", cap.enter],
        ...rep(n, [[P(id, "out", far), b.out, "out", cap.out], [P(id, "in", far), b.in, "in", cap.in]])];
      segs = (n, b) => (sides ? [...side(n, b, false), [P(id, "start"), 3, "", "Come out of it"], [P(id, "start", true), 2, "", "Other side"], ...side(n, b, true)] : side(n, b, false));
      count = (n) => (sides ? `Hold ${n} breaths each side` : `Hold ${n} breaths`);
    } else if (type === "alt") {
      start = P(id, m.noMid ? "n" : "mid");
      segs = (n, b) => (m.noMid ? rep(n * 2, [[P(id, "n"), b.in, "in", cap.n], [P(id, "f"), b.out, "out", cap.f]])
        : rep(n, [[P(id, "mid"), b.in, "in", cap.mid], [P(id, "n"), b.out, "out", cap.n], [P(id, "mid"), b.in, "in", cap.mid], [P(id, "f"), b.out, "out", cap.f]]));
      count = (n) => `${n * 2} each way`;
    } else if (type === "spot") {
      // A massage gun on one spot: timed, not on the breath. Each rep is 10 seconds of slow strokes.
      start = P(id, "start");
      const side = (n, far) => [[P(id, "in", far), 4, "", cap.enter],
        ...rep(n, [[P(id, "out", far), 5, "", cap.on], [P(id, "in", far), 5, "", cap.on]])];
      segs = (n) => (sides ? [...side(n, false), [P(id, "start"), 3, "", "Lift the gun off"], [P(id, "start", true), 2, "", "Other side"], ...side(n, true)] : side(n, false));
      count = (n) => (sides ? `${n * 10} seconds each side` : `${n * 10} seconds`);
    } else {
      start = P(id, "loop");
      segs = (n) => rep(n * 3, [[P(id, "loop"), 5, "", cap.loop]]);
      count = (n) => `${n * 15} seconds`;
    }
    return { reps, ...m, start, segs, count };
  }

  // Each move: areas it works, position, whether it's demanding (gets more reps when sessions feel
  // easy), reps {min, base, max}, how the count reads, and segs(reps, breath) -> [pose, seconds, breath, caption, part?].
  const FIRST = [
    {
      id: "catcow", name: "Cat–cow", areas: ["spine", "upperback"], position: "allfours", keep: "first", reps: { min: 4, base: 6, max: 14 },
      how: "Hands and knees. In: chest forward, look up. Out: round the back.", start: "table",
      count: (n) => `${n} breaths`,
      segs: (n, b) => rep(n, [["cow", b.in, "in", "Breathe in: drop the belly, look up"], ["cat", b.out, "out", "Breathe out: round the back, tuck the chin"]]),
    },
    {
      id: "thread", name: "Thread the needle", areas: ["upperback", "shoulders"], position: "allfours", reps: { min: 3, base: 4, max: 8 },
      how: "Out: slide one arm under, shoulder down. In: open it to the sky.", start: "table",
      count: (n) => `${n} breaths each side`,
      segs: (n, b) => [
        ...rep(n, [["threadUnderN", b.out, "out", "Breathe out: slide the arm under, shoulder down"], ["threadOpenN", b.in, "in", "Breathe in: open the arm to the sky"]]),
        ["table", 2.5, "", "Other side"],
        ...rep(n, [["threadUnderF", b.out, "out", "Breathe out: slide the other arm under"], ["threadOpenF", b.in, "in", "Breathe in: open it to the sky"]]),
      ],
    },
    {
      id: "hips9090", name: "90/90 hip switches", areas: ["hips"], position: "seated", reps: { min: 3, base: 4, max: 8 },
      how: "Sit, knees bent at right angles. Swing both knees to the other side.", start: "seatN",
      count: (n) => `${n * 2} slow switches`,
      segs: (n, b) => rep(n, [["seatUp", b.in, "in", "Breathe in: knees up through the middle"], ["seatF", b.out, "out", "Breathe out: knees down to the other side"], ["seatUp", b.in, "in", "Breathe in: knees up"], ["seatN", b.out, "out", "Breathe out: down to the first side"]]),
    },
    {
      id: "beastcrab", name: "Beast to crab reach", areas: ["shoulders", "hips"], position: "allfours", demanding: true, reps: { min: 2, base: 3, max: 6 },
      how: "Knees hover. In: turn over, lift the hips, reach back. Out: return.", start: "beast",
      count: (n) => `${n} each side`,
      segs: (n, b) => {
        const i = b.in + 0.5, o = b.out + 2; // a full turn takes a little longer than a breath
        return rep(n, [
          ["sideSit", i * 0.4, "in", "Breathe in: turn over, lift the hips, reach back", [0, 0.4]], ["crabN", i * 0.6, "in", "Breathe in: turn over, lift the hips, reach back", [0.4, 1]],
          ["sideSit", o * 0.45, "out", "Breathe out: back to beast, knees hover", [0, 0.45]], ["beast", o * 0.55, "out", "Breathe out: back to beast, knees hover", [0.45, 1]],
          ["sideSit", i * 0.4, "in", "Breathe in: turn the other way and reach", [0, 0.4]], ["crabF", i * 0.6, "in", "Breathe in: turn the other way and reach", [0.4, 1]],
          ["sideSit", o * 0.45, "out", "Breathe out: back to beast", [0, 0.45]], ["beast", o * 0.55, "out", "Breathe out: back to beast", [0.45, 1]],
        ]);
      },
    },
    {
      id: "wgs", name: "World's greatest stretch", areas: ["hips", "hipflexors", "upperback"], position: "kneeling", demanding: true, reps: { min: 2, base: 3, max: 6 },
      how: "Long lunge. Out: elbow down inside the front foot. In: reach to the sky.", start: "lungeDropN",
      count: (n) => `${n} each side`,
      segs: (n, b) => [
        ...rep(n, [["lungeReachN", b.in + 1, "in", "Breathe in: turn and reach to the sky"], ["lungeDropN", b.out, "out", "Breathe out: elbow down inside the front foot"]]),
        ["lungeDropF", 4, "", "Switch legs"],
        ...rep(n, [["lungeReachF", b.in + 1, "in", "Breathe in: reach to the sky"], ["lungeDropF", b.out, "out", "Breathe out: elbow down"]]),
      ],
    },
    {
      id: "dogfold", name: "Down dog, fold, roll up", areas: ["hamstrings", "ankles", "spine"], position: "rising", reps: { min: 3, base: 4, max: 10 },
      how: "Hips high, heels down. Walk to the hands, hang, roll up slowly.", start: "dog",
      count: (n) => `${n} breaths, then roll up`,
      segs: (n, b) => [
        ...rep(n, [["dog", b.in, "in", "Breathe in: long spine, hips high"], ["dog", b.out, "out", "Breathe out: heels sink toward the floor"]]),
        ["fold", 6, "", "Walk the feet to the hands"],
        ["fold", b.in, "in", "Breathe in: hang"], ["fold", b.out, "out", "Breathe out: heavy head"],
        ["half", 5, "", "Roll up slowly, one bone at a time"], ["stand", 4, "", "Head comes up last"],
      ],
    },
    {
      id: "shake", name: "Shake", areas: [], position: "standing", reps: { min: 2, base: 2, max: 6 }, // reps of 15 s
      how: "Loose knees, bounce, let the arms and shoulders go.", start: "shakeA",
      count: (n) => `${n * 15} seconds`,
      segs: (n) => {
        const out = [];
        for (let i = 0; i < n * 30; i++) out.push(["shakeB", 0.25, "", "Loose knees. Let everything bounce."], ["shakeA", 0.25, "", "Loose knees. Let everything bounce."]);
        return out;
      },
    },
    {
      id: "skybow", name: "Hold up the sky, draw the bow", areas: ["shoulders"], position: "standing", reps: { min: 2, base: 4, max: 8 },
      how: "In: palms up overhead. Out: down. Then wide stance, draw a bow each side.", start: "skyLow",
      count: (n) => `${n} breaths each`,
      segs: (n, b) => [
        ...rep(n, [["sky", b.in, "in", "Breathe in: palms up to the sky"], ["skyLow", b.out, "out", "Breathe out: hands float down"]]),
        ["bowRest", 3, "", "Step wide, sink a little"],
        ...rep(Math.ceil(n / 2), [["bowN", b.in, "in", "Breathe in: draw the bow"], ["bowRest", b.out, "out", "Breathe out: hands back"], ["bowF", b.in, "in", "Breathe in: draw the other side"], ["bowRest", b.out, "out", "Breathe out: hands back"]]),
      ],
    },
    // ---- the Eight Brocades, only in a Qigong session (form: true), in this order ----
    {
      id: "settle", name: "Stand still", form: true, areas: [], position: "standing", reps: { min: 2, base: 3, max: 6 },
      how: "Feet hip-width apart, knees soft, hands on the belly.", start: "stand",
      count: (n) => `${n} breaths`,
      segs: (n, b) => rep(n, [["stand", b.in, "in", "Breathe in, low into the belly"], ["stand", b.out, "out", "Breathe out. Let the shoulders drop"]]),
    },
    {
      id: "sky", name: "Hold up the sky", form: true, areas: ["shoulders", "spine"], position: "standing", reps: { min: 3, base: 6, max: 12 },
      how: "Fingers laced. Press the palms up to the sky, then let the hands float down.", start: "skyLow",
      count: (n) => `${n} breaths`,
      segs: (n, b) => rep(n, [["sky", b.in, "in", "Breathe in: palms up to the sky"], ["skyLow", b.out, "out", "Breathe out: hands float down"]]),
    },
    {
      id: "bow", name: "Draw the bow", form: true, areas: ["shoulders", "upperback"], position: "standing", reps: { min: 1, base: 3, max: 6 },
      how: "Wide stance, knees bent. Draw a bow to one side, then the other.", start: "bowRest",
      count: (n) => `${n} each side`,
      segs: (n, b) => [["bowRest", 3, "", "Step wide, sink a little"],
        ...rep(n, [["bowN", b.in, "in", "Breathe in: draw the bow"], ["bowRest", b.out, "out", "Breathe out: hands back"], ["bowF", b.in, "in", "Breathe in: draw the other side"], ["bowRest", b.out, "out", "Breathe out: hands back"]])],
    },
    {
      id: "heaven", name: "Separate heaven and earth", form: true, areas: ["shoulders", "spine"], position: "standing", reps: { min: 1, base: 3, max: 6 },
      how: "Hands at the belly. One palm presses up to the sky, the other down to the earth, then swap.", start: "heaven.mid",
      count: (n) => `${n} each side`,
      segs: (n, b) => rep(n, [["heaven.n", b.in, "in", "Breathe in: one hand presses up, the other down"], ["heaven.mid", b.out, "out", "Breathe out: hands come back to the belly"],
        ["heaven.f", b.in, "in", "Breathe in: the other hand presses up"], ["heaven.mid", b.out, "out", "Breathe out: hands come back to the belly"]]),
    },
    {
      id: "owl", name: "Wise owl looks back", form: true, areas: ["upperback", "spine"], position: "standing", reps: { min: 1, base: 3, max: 6 },
      how: "Arms by the sides. Turn the palms out and look back over one shoulder, then the other.", start: "owl.mid",
      count: (n) => `${n} each side`,
      segs: (n, b) => rep(n, [["owl.n", b.in, "in", "Breathe in: palms turn out, look back over one shoulder"], ["owl.mid", b.out, "out", "Breathe out: face forward, arms soft"],
        ["owl.f", b.in, "in", "Breathe in: look back over the other shoulder"], ["owl.mid", b.out, "out", "Breathe out: face forward, arms soft"]]),
    },
    {
      id: "sway", name: "Sway the head, shake the tail", form: true, areas: ["hips", "spine"], position: "standing", reps: { min: 1, base: 3, max: 6 },
      how: "Wide stance, hands on the thighs. Lean over one knee, circle the hips, then over the other.", start: "sway.mid",
      count: (n) => `${n} each side`,
      segs: (n, b) => rep(n, [["sway.n", b.out, "out", "Breathe out: lean over one knee, head low"], ["sway.mid", b.in, "in", "Breathe in: circle back up to the middle"],
        ["sway.f", b.out, "out", "Breathe out: lean over the other knee"], ["sway.mid", b.in, "in", "Breathe in: circle back up to the middle"]]),
    },
    {
      id: "feet", name: "Hands down the legs to the feet", form: true, areas: ["hamstrings", "spine"], position: "standing", reps: { min: 2, base: 5, max: 10 },
      how: "Reach up, then fold and slide the hands down the backs of the legs to the feet.", start: "feet.a",
      count: (n) => `${n} times`,
      // A long piece: a little longer than one breath each way.
      segs: (n, b) => rep(n, [["feet.a", b.in + 1, "in", "Breathe in: reach up to the sky"], ["feet.b", b.out + 2, "out", "Breathe out: fold, hands slide down to the feet"]]),
    },
    {
      id: "punch", name: "Punch with angry eyes", form: true, areas: ["hips", "adductors"], position: "standing", reps: { min: 1, base: 3, max: 6 },
      how: "Horse stance, fists at the waist. Punch slowly with one fist, eyes wide, then the other.", start: "punch.mid",
      count: (n) => `${n} each side`,
      // The other fist is the same punch with the sides swapped; the swap happens while the fist comes back.
      segs: (n, b) => rep(n, [["punch.n", b.out, "out", "Breathe out: punch slowly, eyes wide"], ["punch.mid.F", b.in, "in", "Breathe in: fist back to the waist"],
        ["punch.n.F", b.out, "out", "Breathe out: punch with the other fist"], ["punch.mid", b.in, "in", "Breathe in: fist back to the waist"]]),
    },
    {
      id: "bounce", name: "Bounce on the heels", form: true, areas: ["ankles"], position: "standing", reps: { min: 3, base: 6, max: 12 },
      how: "Feet together. Rise onto the toes, then drop gently onto the heels.", start: "bounce.b",
      count: (n) => `${n} times`,
      segs: (n, b) => rep(n, [["bounce.a", b.in, "in", "Breathe in: rise onto the toes"], ["bounce.b", b.out, "out", "Breathe out: drop onto the heels"]]),
    },
    {
      id: "still", name: "Stand still", areas: [], position: "standing", keep: "last", reps: { min: 3, base: 4, max: 8 },
      how: "Eyes closed. Feel the body hum.", start: "stand",
      count: (n) => `${n} breaths`,
      segs: (n, b) => rep(n, [["stand", b.in, "in", "Eyes closed. Breathe in"], ["stand", b.out, "out", "Breathe out. Feel the body hum"]]),
    },
  ];

  const LIBRARY = [
    // lying
    { id: "bridge", name: "Bridge", type: "flow", areas: ["hipflexors", "spine"], position: "lying",
      how: "On your back, knees bent. Lift the hips, lower them slowly.",
      cap: { a: "Breathe in: lift the hips", b: "Breathe out: lower one bone at a time" } },
    { id: "happybaby", name: "Happy baby", type: "hold", areas: ["hips", "adductors"], position: "lying",
      how: "On your back. Hold the outsides of the feet, knees wide toward the armpits.",
      cap: { enter: "Hold the feet, knees wide", in: "Breathe in: back long on the floor", out: "Breathe out: let the knees sink wider" } },
    { id: "figure4", name: "Lying figure four", type: "hold", sides: true, areas: ["hips"], position: "lying",
      how: "On your back, ankle across the other knee. Pull that thigh in.",
      cap: { enter: "Ankle over the knee, pull the thigh in", in: "Breathe in: head and shoulders soft", out: "Breathe out: draw the thigh closer" } },
    { id: "leglift", name: "Lying hamstring raise", type: "flow", sides: true, areas: ["hamstrings"], position: "lying",
      how: "On your back. Raise one straight leg as high as it goes, lower it slowly.",
      cap: { a: "Breathe in: lower the leg slowly", b: "Breathe out: raise the straight leg" } },
    { id: "supinetwist", name: "Lying twist", type: "hold", sides: true, areas: ["spine"], position: "lying",
      how: "On your back, drop both knees to one side, arms wide.",
      cap: { enter: "Knees drop to one side", in: "Breathe in: shoulders heavy", out: "Breathe out: knees sink lower" } },
    { id: "cobra", name: "Cobra", type: "flow", areas: ["spine", "hipflexors"], position: "lying",
      how: "Face down, hands under the shoulders. Lift the chest, lower it.",
      cap: { a: "Breathe in: lift the chest", b: "Breathe out: lower down" } },
    // seated
    { id: "seatedfold", name: "Seated forward fold", type: "hold", areas: ["hamstrings", "spine"], position: "seated",
      how: "Sit with long legs. Fold forward from the hips.",
      cap: { enter: "Fold forward over the legs", in: "Breathe in: lengthen the spine", out: "Breathe out: fold a little further" } },
    { id: "butterfly", name: "Butterfly", type: "hold", areas: ["adductors", "hips"], position: "seated",
      how: "Soles together, knees wide. Lean forward over the feet.",
      cap: { enter: "Soles together, lean forward", in: "Breathe in: sit tall", out: "Breathe out: let the knees drop" } },
    { id: "straddle", name: "Wide-leg fold", type: "hold", areas: ["adductors", "hamstrings"], position: "seated",
      how: "Legs wide. Walk the hands forward.",
      cap: { enter: "Legs wide, fold forward", in: "Breathe in: long spine", out: "Breathe out: walk the hands further" } },
    { id: "wipers", name: "Windshield wipers", type: "alt", areas: ["hips"], position: "seated",
      how: "Sit, feet wide, hands behind. Drop both knees to one side, then the other.",
      cap: { mid: "Breathe in: knees up", n: "Breathe out: knees down to one side", f: "Breathe out: knees down to the other side" } },
    { id: "tabletop", name: "Reverse tabletop", type: "flow", areas: ["shoulders", "hipflexors"], position: "seated",
      how: "Sit, hands behind, fingers forward. Lift the hips to a table.",
      cap: { a: "Breathe in: lift the hips", b: "Breathe out: sit back down" } },
    // all fours
    { id: "frog", name: "Frog rock-back", type: "flow", areas: ["hips", "adductors"], position: "allfours",
      how: "Knees wide, on the forearms. Rock the hips back and forward.",
      cap: { a: "Breathe in: rock forward", b: "Breathe out: rock the hips back" } },
    { id: "dogpedal", name: "Down dog pedal", type: "alt", noMid: true, areas: ["ankles", "hamstrings"], position: "allfours",
      how: "Down dog. Bend one knee, press the other heel down, switch.",
      cap: { n: "Breathe in: press one heel down", f: "Breathe out: switch to the other heel" } },
    // kneeling
    { id: "child", name: "Child's pose", type: "hold", areas: ["upperback", "shoulders", "hips"], position: "kneeling",
      how: "Sit back on the heels, arms long, forehead down.",
      cap: { enter: "Sit back, arms long", in: "Breathe in into the back", out: "Breathe out: sink the hips" } },
    { id: "puppy", name: "Puppy stretch", type: "hold", areas: ["shoulders", "upperback"], position: "kneeling",
      how: "Hips over the knees, walk the hands forward, let the chest sink.",
      cap: { enter: "Hips up, walk the hands forward", in: "Breathe in: long arms", out: "Breathe out: chest sinks" } },
    { id: "pigeon", name: "Pigeon", type: "hold", sides: true, areas: ["hips"], position: "kneeling",
      how: "Front shin across, back leg long. Fold over the front shin.",
      cap: { enter: "Shin across, back leg long", in: "Breathe in: lift the chest", out: "Breathe out: fold over the shin" } },
    { id: "lizard", name: "Lizard lunge", type: "hold", sides: true, areas: ["hips", "hipflexors"], position: "kneeling",
      how: "Long lunge, both hands inside the front foot. Sink the hips.",
      cap: { enter: "Hands inside the front foot", in: "Breathe in: long back", out: "Breathe out: sink the hips" } },
    { id: "halfsplit", name: "Lunge to half split", type: "flow", sides: true, areas: ["hamstrings", "hipflexors"], position: "kneeling",
      how: "Low lunge. Shift the hips back and straighten the front leg.",
      cap: { a: "Breathe in: lunge forward", b: "Breathe out: hips back, front leg straight" } },
    { id: "lowlunge", name: "Low lunge, arms up", type: "hold", sides: true, areas: ["hipflexors"], position: "kneeling",
      how: "Back knee down. Arms up, sink the hips forward.",
      cap: { enter: "Back knee down, arms up", in: "Breathe in: reach up", out: "Breathe out: hips sink forward" } },
    { id: "lungerock", name: "Kneeling hip flexor rock", type: "flow", sides: true, areas: ["hipflexors"], position: "kneeling",
      how: "Kneel on one knee, tall. Shift the hips forward and back.",
      cap: { a: "Breathe in: tall, hips back", b: "Breathe out: hips forward" } },
    { id: "ankle", name: "Kneeling ankle rock", type: "flow", sides: true, areas: ["ankles"], position: "kneeling",
      how: "Kneel on one knee. Push the front knee forward over the toes, heel down.",
      cap: { a: "Breathe in: back to upright", b: "Breathe out: knee forward, heel down" } },
    // standing
    { id: "squat", name: "Deep squat", type: "hold", areas: ["hips", "ankles"], position: "standing",
      how: "Feet wide, sit deep between the heels, elbows inside the knees.",
      cap: { enter: "Sit deep, heels down", in: "Breathe in: chest up", out: "Breathe out: sink a little lower" } },
    { id: "cossack", name: "Cossack shift", type: "alt", demanding: true, areas: ["adductors", "hips", "ankles"], position: "standing",
      how: "Wide stance. Sit into one leg, the other straight, then shift across.",
      cap: { mid: "Breathe in: back through the middle", n: "Breathe out: sit into one side", f: "Breathe out: sit into the other side" } },
    { id: "squatrot", name: "Squat with rotation", type: "alt", areas: ["upperback", "hips", "ankles"], position: "standing",
      how: "Sit in a deep squat, hands down. Keep one hand by the foot, turn and reach the other arm to the sky.",
      cap: { mid: "Breathe in: both hands down", n: "Breathe out: turn and reach one arm up", f: "Breathe out: turn and reach the other arm up" } },
    { id: "ragdoll", name: "Ragdoll fold", type: "flow", areas: ["hamstrings"], position: "standing",
      how: "Fold forward, hold the elbows. Bend and straighten the knees.",
      cap: { a: "Breathe in: bend the knees", b: "Breathe out: straighten the legs" } },
    { id: "rolldown", name: "Roll down", type: "flow", areas: ["spine", "hamstrings"], position: "standing",
      how: "Chin to chest, roll down one bone at a time, then roll up.",
      cap: { a: "Breathe in: roll up, head last", b: "Breathe out: roll down slowly" } },
    { id: "calfraise", name: "Calf raises", type: "flow", areas: ["ankles"], position: "standing",
      how: "Rise onto the toes, lower slowly.",
      cap: { a: "Breathe in: rise onto the toes", b: "Breathe out: heels down slowly" } },
    { id: "sidebend", name: "Standing side bend", type: "alt", areas: ["spine"], position: "standing",
      how: "Arms up. Bend to one side, back up, then the other.",
      cap: { mid: "Breathe in: up through the middle", n: "Breathe out: bend to one side", f: "Breathe out: bend to the other side" } },
    { id: "hug", name: "Open and hug", type: "flow", areas: ["shoulders", "upperback"], position: "standing",
      how: "Swing the arms wide open, then wrap them across the chest.",
      cap: { a: "Breathe in: arms wide open", b: "Breathe out: hug the shoulders" } },
    { id: "armcircles", name: "Arm circles", type: "loop", areas: ["shoulders"], position: "standing",
      how: "Big slow circles with both arms.",
      cap: { loop: "Big circles. Let the shoulders roll." } },
    // foam roller
    { id: "roll_upperback", gear: "roller", name: "Foam roll: upper back", type: "flow", areas: ["upperback"], position: "lying",
      how: "Roller under the shoulder blades, hands behind the head, hips up. Roll down to mid-back and back.",
      cap: { a: "Breathe in: roll up to the shoulder blades", b: "Breathe out: roll down to mid-back" } },
    { id: "roll_tspine", gear: "roller", name: "Upper back bend over the roller", type: "flow", areas: ["upperback", "spine"], position: "lying",
      how: "Roller under the shoulder blades, hands behind the head. Arch back over it, then curl up a little.",
      cap: { a: "Breathe in: curl up a little", b: "Breathe out: arch back over the roller" } },
    { id: "roll_lats", gear: "roller", name: "Foam roll: lats", type: "flow", sides: true, areas: ["upperback", "shoulders"], position: "lying",
      how: "On your side, roller under the armpit, arm overhead. Roll a hand's width down and back.",
      cap: { a: "Breathe in: roll up to the armpit", b: "Breathe out: roll down the side" } },
    { id: "roll_quads", gear: "roller", name: "Foam roll: quads", type: "flow", areas: ["hipflexors"], position: "lying",
      how: "Face down on the forearms, roller under the thighs. Roll from the hips to just above the knees.",
      cap: { a: "Breathe in: roll up to the hips", b: "Breathe out: roll down to the knees" } },
    { id: "roll_hams", gear: "roller", name: "Foam roll: hamstrings", type: "flow", areas: ["hamstrings"], position: "seated",
      how: "Hands behind you, roller under the backs of the thighs, hips up. Roll from the bottom to the knees.",
      cap: { a: "Breathe in: roll up to the bottom", b: "Breathe out: roll down to the knees" } },
    { id: "roll_glutes", gear: "roller", name: "Foam roll: glutes", type: "flow", sides: true, areas: ["hips"], position: "seated",
      how: "Sit on the roller, ankle over the other knee, lean toward the crossed leg. Roll a little back and forth.",
      cap: { a: "Breathe in: roll forward a little", b: "Breathe out: roll back, lean in" } },
    { id: "roll_calves", gear: "roller", name: "Foam roll: calves", type: "flow", areas: ["ankles"], position: "seated",
      how: "Hands behind you, roller under the calves, hips up. Roll from the ankles to the knees.",
      cap: { a: "Breathe in: roll down to the ankles", b: "Breathe out: roll up to the knees" } },
    // stick
    { id: "stick_hinge", gear: "stick", name: "Hip hinge with the stick", type: "flow", areas: ["hamstrings"], position: "standing",
      how: "Stick along the back, touching head, upper back and tailbone. Hinge forward with a flat back.",
      cap: { a: "Breathe in: stand tall", b: "Breathe out: hinge forward, back flat" } },
    { id: "stick_pass", gear: "stick", name: "Shoulder pass-throughs", type: "flow", areas: ["shoulders"], position: "standing",
      how: "Wide grip, arms straight. Lift the stick over the head and behind you, then back.",
      cap: { a: "Breathe in: stick over and behind", b: "Breathe out: back to the front" } },
    { id: "stick_behind", gear: "stick", name: "Stick behind the back", type: "flow", areas: ["shoulders", "upperback"], position: "standing",
      how: "Hold the stick behind you, arms straight. Lift it away from the back, chest open.",
      cap: { a: "Breathe in: stick to the back", b: "Breathe out: lift it away, chest open" } },
    { id: "stick_side", gear: "stick", name: "Overhead side bend with a stick", type: "alt", areas: ["spine", "shoulders"], position: "standing",
      how: "Stick overhead, arms straight. Lean to one side, back up, then the other.",
      cap: { mid: "Breathe in: up through the middle", n: "Breathe out: lean to one side", f: "Breathe out: lean to the other side" } },
    { id: "stick_twist", gear: "stick", name: "Stick on the shoulders, twist", type: "alt", areas: ["spine", "upperback"], position: "standing",
      how: "Stick across the upper back, hands wide. Turn to one side, back, then the other.",
      cap: { mid: "Breathe in: face forward", n: "Breathe out: turn to one side", f: "Breathe out: turn to the other side" } },
    // massage gun
    { id: "gun_quads", gear: "gun", name: "Massage gun: quads", type: "spot", sides: true, areas: ["hipflexors"], position: "seated",
      how: "Sitting. Glide the gun slowly over the front of the thigh, hip to knee.",
      cap: { enter: "Gun on the front of the thigh", on: "Slow strokes, hip to knee" } },
    { id: "gun_hams", gear: "gun", name: "Massage gun: hamstrings", type: "spot", sides: true, areas: ["hamstrings"], position: "seated",
      how: "Sitting on the edge of a chair or step. Glide the gun over the back of the thigh.",
      cap: { enter: "Gun on the back of the thigh", on: "Slow strokes, avoid the back of the knee" } },
    { id: "gun_calves", gear: "gun", name: "Massage gun: calves", type: "spot", sides: true, areas: ["ankles"], position: "seated",
      how: "Sitting, foot up. Glide the gun over the calf, ankle to knee.",
      cap: { enter: "Gun on the calf", on: "Slow strokes, ankle to knee" } },
    { id: "gun_glutes", gear: "gun", name: "Massage gun: glutes", type: "spot", sides: true, areas: ["hips"], position: "standing",
      how: "Standing, weight on the other leg. Glide the gun over the side of the bottom.",
      cap: { enter: "Gun on the side of the bottom", on: "Slow circles over the muscle" } },
    { id: "gun_traps", gear: "gun", name: "Massage gun: upper traps", type: "spot", sides: true, areas: ["shoulders"], position: "standing",
      how: "Reach across with the other hand. Gun on top of the shoulder, away from the neck.",
      cap: { enter: "Gun on top of the shoulder", on: "Small strokes, away from the neck" } },
    { id: "gun_chest", gear: "gun", name: "Massage gun: chest", type: "spot", sides: true, areas: ["shoulders"], position: "standing",
      how: "Gun just below the collarbone. Glide out toward the shoulder.",
      cap: { enter: "Gun below the collarbone", on: "Slow strokes out to the shoulder" } },
  ].map(typed);

  const MOVES = [...FIRST, ...LIBRARY];
  const byId = Object.fromEntries(MOVES.map((m) => [m.id, m]));

  const secondsOf = (segs) => segs.reduce((s, g) => s + g[1], 0);

  // level: -2..2 from recent "how did it feel" answers (hard -1, right 0, easy +1).
  function levelFrom(history) {
    const recent = (history || []).filter((h) => h.feel).slice(-3);
    const score = recent.reduce((s, h) => s + (h.feel === "easy" ? 1 : h.feel === "hard" ? -1 : 0), 0);
    return Math.max(-2, Math.min(2, score));
  }

  // A repeatable random number source, so a day's session stays the same each time the page draws it.
  function rng(seed) {
    let h = 2166136261;
    for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const dayNum = (day) => Math.round(Date.parse(day + "T12:00:00Z") / 864e5);
  // Days since each move was last done, from history entries {day, ids}.
  function lastDone(history, today) {
    const out = {};
    for (const h of history || []) {
      if (!h.day || !h.ids) continue;
      const d = dayNum(today) - dayNum(h.day);
      for (const id of h.ids) if (out[id] === undefined || d < out[id]) out[id] = d;
    }
    return out;
  }

  // What was picked: focus is "all", or one or a list of body areas and (before or after a workout) muscle
  // groups. Unknown ones are dropped. The morning knows body areas only, so its sessions stay as they were;
  // in a workout session a name that is both (hamstrings) is the muscle group: the same area, plus its direct moves.
  //   keys: the picks; areas: every body area they cover; direct: moves that work a picked muscle group directly.
  function targetsOf(focus, mode) {
    const gym = mode === "before" || mode === "after";
    const keys = (Array.isArray(focus) ? focus : [focus]).filter((k) => AREAS[k] || (gym && MUSCLES[k]));
    const areas = new Set(), direct = new Set();
    for (const k of keys) {
      if (gym && MUSCLES[k]) { MUSCLES[k].areas.forEach((a) => areas.add(a)); MUSCLES[k].moves.forEach((id) => direct.add(id)); }
      if (AREAS[k]) areas.add(k);
    }
    return { keys, areas: [...areas], direct };
  }
  const works = (m, tg) => tg.direct.has(m.id) || tg.areas.some((a) => m.areas.includes(a));

  // How much a move wants reps, relative to its base: focus, level and the kind of session move it up or down.
  function weight(m, tg, level, mode) {
    let w = 1;
    if (tg.keys.length) w *= works(m, tg) ? 1.5 : keepOf(m, mode) || !m.areas.length ? 1 : 0.8;
    if (m.demanding) w *= 1 + 0.2 * level;
    if (mode === "after" && m.type === "hold") w *= 1.4; // after a workout, stay in each hold longer
    return w;
  }

  // How much a move wants to be in today's session: focus, the kind of session, more/less, and how long since it was done.
  function appeal(m, { tg, mode, prefs, since }) {
    let s = m.areas.length ? 1 : 0.6; // the shake: a nice extra, not a regular
    if (tg.keys.length) s *= tg.direct.has(m.id) ? 6 : works(m, tg) ? 4 : 0.5;
    if (mode === "after") s *= m.type === "hold" ? 4 : m.type === "alt" ? 0.6 : 1;
    if (m.gear) s *= 4; // you said you have it with you today, so use it
    if (prefs[m.id] === "more") s *= 2;
    if (prefs[m.id] === "less") s *= 0.35;
    const d = since[m.id];
    s *= d === undefined ? 1.15 : Math.min(1, 0.25 + 0.25 * d); // today 0.25, yesterday 0.5, 3+ days 1
    return s;
  }

  // At most about one gear move for every three minutes, so gear tops up a session rather than taking it over.
  const gearCapOf = (minutes) => Math.max(2, Math.round(minutes / 3));
  const startSecs = (m, b) => TRANSITION + secondsOf(m.segs(m.reps.min, b));
  const order = (m, mode) => (keepOf(m, mode) === "first" ? 0 : keepOf(m, mode) === "last" ? 99 : 50 + modeOf(mode).dir * POSITIONS[m.position]);

  // fixed: this move opens or closes the session, so it can't be swapped.
  function stepOf(m, n, b, mode) {
    return { id: m.id, name: m.name, how: m.how, start: m.start, position: m.position, reps: n, count: m.count(n), segs: m.segs(n, b), fixed: !!keepOf(m, mode) || !!modeOf(mode).form };
  }

  // Build a session of about `minutes`.
  //   mode: "morning", "before" (a workout) or "after"; focus: "all", or one or a list of body areas
  //   (and, before or after a workout, muscle groups);
  //   off: ids never to use; prefs: {id: "more" | "less"}; history: past sessions {day, ids, feel};
  //   today: "YYYY-MM-DD" (also seeds the variety); have: ids that can be drawn (all when left out).
  //   extra: how many more moves (or, below 0, fewer) than that length would have. The moves are still
  //   chosen for you: the session is built for a longer or shorter time until it has that many, so it
  //   grows or shrinks by about a move's time each.
  function build(opts = {}) {
    const extra = Math.round(+opts.extra || 0);
    const first = fitTo(opts);
    if (!extra || modeOf(first.mode).form) return first;
    const fixed = first.steps.filter((s) => s.fixed).length;
    const want = Math.max(fixed + 1, first.steps.length + extra);
    let best = first;
    for (let k = 1; k <= 90; k++) {
      const seconds = first.minutes * 60 + Math.sign(extra) * k * 15;
      if (seconds < 60) break;
      const s = fitTo(opts, seconds);
      if (extra > 0 ? s.steps.length > best.steps.length : s.steps.length < best.steps.length && s.steps.length > fixed) best = s;
      if (extra > 0 ? s.steps.length >= want : s.steps.length <= want) break;
    }
    return { ...best, extra };
  }
  function fitTo({ minutes = 10, focus = "all", mode = "morning", level = 0, off = [], prefs = {}, history = [], today = "2026-01-01", have = null, gear = [] } = {}, seconds) {
    if (!MODES[mode]) mode = "morning";
    const b = pace(level, mode);
    const target = seconds || minutes * 60;
    const tg = targetsOf(focus, mode);
    if (!tg.keys.length) focus = "all";
    const usable = (m) => (!have || have.includes(m.id)) && (!m.gear || gear.includes(m.gear));
    if (MODES[mode].form) return buildForm({ minutes, mode, level, b, target, have });
    const fixed = MOVES.filter((m) => keepOf(m, mode) && usable(m));
    const pool = MOVES.filter((m) => !m.form && !keepOf(m, mode) && MODES[mode].can(m) && usable(m) && !off.includes(m.id));
    const since = lastDone(history, today);
    const rand = rng(`${today}|${tg.keys.join("+") || "all"}|${minutes}${mode === "morning" ? "" : "|" + mode}`);
    const score = Object.fromEntries(pool.map((m) => [m.id, appeal(m, { tg, mode, prefs, since }) * (0.7 + 0.6 * rand())]));

    // Pick moves until the time is used, each pick making moves that work the same areas less likely.
    let moves = [...fixed];
    // After a workout, leave room for the longer holds: count each move at the reps it wants, not its base.
    const want = (m) => Math.max(m.reps.min, Math.min(m.reps.max, Math.round(m.reps.base * weight(m, tg, level, mode))));
    const plan = (m) => (mode === "after" ? want(m) : m.reps.base);
    const used = () => INTRO + moves.reduce((s, m) => s + TRANSITION + secondsOf(m.segs(plan(m), b)), 0);
    // Gear tops up a session, it doesn't take it over: about one gear move for every three minutes.
    const gearCap = gearCapOf(minutes);
    const gearFull = (m) => m.gear && moves.filter((c) => c.gear).length >= gearCap;
    const eff = (m) => score[m.id] * moves.reduce((s, c) => s * (c.areas.some((a) => m.areas.includes(a)) ? 0.6 : 1) * (c.type && c.type === m.type ? 0.85 : 1), 1);
    const pick = (left, room) => {
      left = left.filter((m) => !moves.includes(m));
      while (left.length && room()) {
        left = left.filter((m) => !gearFull(m));
        left.sort((x, y) => eff(y) - eff(x));
        const i = left.findIndex((m) => used() + startSecs(m, b) <= target - 20);
        if (i < 0) break;
        moves.push(left.splice(i, 1)[0]);
      }
    };
    // Around a workout, with muscle groups picked, the session is the moves for those muscles: more reps of
    // each rather than moves for something else. Other moves come in only when those can't fill the time.
    const gym = mode !== "morning" && tg.keys.length;
    const full = () => INTRO + moves.reduce((s, m) => s + TRANSITION + secondsOf(m.segs(m.reps.max, b)), 0) >= target - 15;
    if (gym) {
      // First one move for each thing picked, so none is left out when time is short; then the best of the rest.
      for (const k of tg.keys) {
        const one = targetsOf([k], mode), n = moves.length;
        if (!moves.some((m) => !keepOf(m, mode) && works(m, one))) pick(pool.filter((m) => works(m, one)), () => moves.length === n);
      }
      pick(pool.filter((m) => works(m, tg)), () => true);
      pick(pool.filter((m) => !works(m, tg)), () => !full());
    } else pick(pool.slice(), () => true);
    moves.sort((x, y) => order(x, mode) - order(y, mode));

    const reps = {};
    for (const m of moves) reps[m.id] = want(m);
    const total = () => INTRO + moves.reduce((s, m) => s + TRANSITION + secondsOf(m.segs(reps[m.id], b)), 0);
    const ratio = (m) => reps[m.id] / (m.reps.base * weight(m, tg, level, mode));
    for (let guard = 0; guard < 300 && total() > target + 15; guard++) {
      const can = moves.filter((m) => reps[m.id] > m.reps.min).sort((x, y) => ratio(y) - ratio(x));
      if (!can.length) break;
      reps[can[0].id]--;
    }
    for (let guard = 0; guard < 300; guard++) {
      const can = moves.filter((m) => reps[m.id] < m.reps.max).sort((x, y) => ratio(x) - ratio(y));
      if (!can.length) break;
      const m = can[0];
      reps[m.id]++;
      if (total() > target + 15) { reps[m.id]--; break; }
    }

    const steps = moves.map((m) => stepOf(m, reps[m.id], b, mode));
    return { minutes, focus, mode, level, pace: b, steps, seconds: total(), off, prefs, have, gear, skipped: [], extra: 0 };
  }

  // A session that is a fixed form (Qigong): every piece in its order, whatever was picked; the minutes
  // only change the breaths per piece, added one at a time to the piece furthest below its usual count.
  function buildForm({ minutes, mode, level, b, target, have }) {
    const moves = MODES[mode].form.map((id) => byId[id]).filter((m) => !have || have.includes(m.id));
    const reps = moves.map((m) => m.reps.min);
    const total = () => INTRO + moves.reduce((s, m, i) => s + TRANSITION + secondsOf(m.segs(reps[i], b)), 0);
    const fits = (i) => { reps[i]++; const ok = total() <= target + 15; reps[i]--; return ok; };
    for (let guard = 0; guard < 300; guard++) {
      const i = moves.map((m, k) => k).filter((k) => reps[k] < moves[k].reps.max)
        .sort((x, y) => reps[x] / moves[x].reps.base - reps[y] / moves[y].reps.base).find(fits);
      if (i === undefined) break;
      reps[i]++;
    }
    const steps = moves.map((m, i) => stepOf(m, reps[i], b, mode));
    return { minutes, focus: "all", mode, level, pace: b, steps, seconds: total(), off: [], prefs: {}, have, gear: [], skipped: [] };
  }

  // Replace step i with another move: same position if one is free (so the body needn't get up or down),
  // sharing an area with the old one where possible, reps set to take about the same time.
  function swap(session, i) {
    const old = session.steps[i];
    const m0 = old && byId[old.id];
    const mode = session.mode, tg = targetsOf(session.focus, mode);
    if (!m0 || keepOf(m0, mode) || modeOf(mode).form) return null;
    const inUse = new Set(session.steps.map((s) => s.id));
    const skipped = [...(session.skipped || []), old.id];
    const prefs = session.prefs || {};
    const gearLeft = gearCapOf(session.minutes) - session.steps.filter((s, k) => k !== i && byId[s.id] && byId[s.id].gear).length;
    const cands = MOVES.filter((m) => !m.form && (!m.gear || gearLeft > 0) && !keepOf(m, mode) && modeOf(mode).can(m) && !inUse.has(m.id) && !skipped.includes(m.id) &&
      !(session.off || []).includes(m.id) && (!session.have || session.have.includes(m.id)) &&
      (!m.gear || (session.gear || []).includes(m.gear)));
    if (!cands.length) return null;
    const near = (m) => Math.abs(POSITIONS[m.position] - POSITIONS[m0.position]);
    const fit = (m) => (near(m) === 0 ? 4 : near(m) === 1 ? 1.5 : 1) *
      (m.areas.some((a) => m0.areas.includes(a)) ? 2 : 1) *
      (tg.direct.has(m.id) ? 3 : works(m, tg) ? 2 : 1) *
      (mode === "after" && m.type === "hold" ? 1.5 : 1) *
      (prefs[m.id] === "more" ? 1.5 : prefs[m.id] === "less" ? 0.4 : 1);
    cands.sort((x, y) => fit(y) - fit(x));
    const m = cands[0];
    const want = secondsOf(old.segs);
    let n = m.reps.min;
    for (let k = m.reps.min; k <= m.reps.max; k++) if (Math.abs(secondsOf(m.segs(k, session.pace)) - want) < Math.abs(secondsOf(m.segs(n, session.pace)) - want)) n = k;
    const steps = session.steps.slice();
    steps[i] = stepOf(m, n, session.pace, mode);
    const seconds = INTRO + steps.reduce((s, x) => s + TRANSITION + secondsOf(x.segs), 0);
    return { ...session, steps, seconds, skipped };
  }

  // Flatten a session into timed segments the player walks through.
  //   lead: {intro, steps: [seconds]} makes the "get ready" and each "Next: ..." lead-in at least that long,
  //   so the sound guide's voice can finish before the move starts. Each lead-in segment is marked lead.
  function timeline(session, lead) {
    const segs = [];
    let t = 0, prev = modeOf(session.mode).from;
    const intro = Math.max(INTRO, (lead && lead.intro) || 0);
    segs.push({ t0: 0, d: intro, from: prev, to: prev, breath: "", cap: "Breathe with the bar: in as it fills, out as it empties", step: -1 });
    t = intro;
    session.steps.forEach((s, i) => {
      s.t0 = t;
      const d = Math.max(TRANSITION, (lead && lead.steps && lead.steps[i]) || 0);
      segs.push({ t0: t, d, from: prev, to: s.start, breath: "", cap: "Next: " + s.name, step: i, lead: true });
      t += d; prev = s.start;
      for (const [pose, d, breath, cap, part] of s.segs) {
        segs.push({ t0: t, d, from: prev, to: pose, breath, cap, part, step: i });
        t += d; prev = pose;
      }
      s.t1 = t;
    });
    return { segs, total: t };
  }

  const api = { MOVES, GEAR, AREAS, FOCUS, MUSCLES, HALVES, POSITIONS, MODES, build, swap, timeline, levelFrom, secondsOf, lastDone };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PLAN = api;
})(typeof window !== "undefined" ? window : globalThis);
