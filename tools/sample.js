// Writes the start of a real sound-guide track as a WAV, to listen to on the Mac:
//   node tools/sample.js OUT.wav [SECONDS] [morning|before|after]
// The same plan and mix the phone uses; only the clips are decoded by ffmpeg here, not by the browser.
const fs = require("fs"), { execFileSync } = require("child_process");
const { build, timeline } = require("../public/plan.js");
const { leads, cues, mix, RATE } = require("../public/sound.js");
const index = JSON.parse(fs.readFileSync("public/sound/voice.json")), pack = fs.readFileSync("public/sound/voice.pack");
const [out, seconds = 45, mode = "after"] = process.argv.slice(2);
const s = build({ mode, minutes: 10, focus: ["hips", "hamstrings"], today: "2026-11-14" });
const plan = cues(s, timeline(s, leads(s, index)), index);
const clips = {};
for (const { key } of plan.voice) {
  if (clips[key]) continue;
  const [off, len] = index[key];
  const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-f", "mp3", "-i", "-", "-f", "f32le", "-ar", String(RATE), "-ac", "1", "-"], { input: pack.subarray(off, off + len), maxBuffer: 1 << 26 });
  clips[key] = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
const pcm = mix(plan, clips).subarray(0, 2 * seconds * RATE); // stereo, interleaved
const head = Buffer.alloc(44);
head.write("RIFF"); head.writeUInt32LE(36 + pcm.length * 2, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(pcm.length * 2, 40);
fs.writeFileSync(out, Buffer.concat([head, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.length * 2)]));
