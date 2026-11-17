// Prints every line the sound guide can speak, in any kind of session, as JSON: [{key, say}].
// key is how the app asks for the clip (a caption's own text, "intro:<move id>", or a common line);
// say is the text read aloud. tools/build-voice.sh turns these into public/sound/voice.pack.
const { MOVES, MODES } = require("../public/plan.js");
const { COMMON, spoken } = require("../public/sound.js");

const lines = new Map();
const add = (key, say) => lines.set(key, spoken(say));
for (const [key, say] of Object.entries(COMMON)) add(key, say);
for (const m of MOVES) {
  add("intro:" + m.id, `${m.name}. ${m.how}`);
  for (const g of m.segs(m.reps.max, MODES.morning.breath)) if (g[3]) add(g[3], g[3]);
}
console.log(JSON.stringify([...lines].map(([key, say]) => ({ key, say })), null, 1));
