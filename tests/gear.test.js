const test = require("node:test");
const assert = require("node:assert");
const { shapes, MOVES: DRAWN } = require("../public/gear.js");
const { MOVES } = require("../public/plan.js");

// A standing figure, side-on: spine up from the pelvis, arms down, legs down.
const stand = [200, 190, 200, 170, 200, 150, 200, 130, 200, 115, 200, 95,
  200, 125, 205, 155, 208, 185, 209, 192,   200, 125, 195, 155, 192, 185, 191, 192,
  202, 190, 204, 235, 205, 278, 215, 280,   198, 190, 196, 235, 195, 278, 205, 280];

test("every gear move in the plan has gear drawn for it", () => {
  for (const m of MOVES.filter((m) => m.gear)) assert.ok(DRAWN[m.id], `${m.id} has no gear drawing`);
  for (const id of Object.keys(DRAWN)) assert.ok(MOVES.find((m) => m.id === id && m.gear), `${id} isn't a gear move`);
});

test("moves without gear, or with no frame, draw nothing", () => {
  assert.deepStrictEqual(shapes("bridge", stand), { back: "", front: "" });
  assert.deepStrictEqual(shapes("roll_quads", null), { back: "", front: "" });
});

test("the roller sits on the floor behind the figure, the stick and gun in front", () => {
  const r = shapes("roll_calves", stand);
  assert.match(r.back, /cy="267"/);
  assert.strictEqual(r.front, "");
  const end = shapes("stick_pass", stand); // hands close together: seen end-on
  assert.match(end.front, /fg-gear-end/);
  const wide = stand.slice(); wide[18] = 150; wide[26] = 250; // hands apart, as filmed from the front
  assert.match(shapes("stick_pass", wide).front, /<line/);
  assert.match(shapes("gun_quads", stand).front, /fg-gun-head/);
  assert.ok(!/NaN/.test(Object.values(shapes("gun_glutes", stand)).join("")));
});

test("the twist's stick stays level across the shoulders", () => {
  const turned = stand.slice(); turned[18] = 205; turned[19] = 120; turned[26] = 195; turned[27] = 60;
  const m = /y1="([\d.]+)".*y2="([\d.]+)"/.exec(shapes("stick_twist", turned).front);
  assert.ok(m && m[1] === m[2], shapes("stick_twist", turned).front);
});
