// Packs the recorded clips in WORKDIR into public/sound/voice.pack, and writes public/sound/voice.json:
// {key: [offset, bytes, seconds]}. Fails if any line has no clip, so a pack is never half-made.
// A clip is named for its voice and its words, so a new voice records everything again.
const fs = require("fs"), crypto = require("crypto"), { execFileSync } = require("child_process");
const clipId = (say) => crypto.createHash("sha1").update((process.env.VOICE || "am_michael") + "|" + say).digest("hex").slice(0, 12);
module.exports = { clipId };
if (require.main !== module) return;
const work = process.argv[2];
const lines = JSON.parse(fs.readFileSync(`${work}/lines.json`));
const index = {}, parts = [], at = {};
let offset = 0;
for (const l of lines) {
  const id = clipId(l.say), file = `${work}/${id}.mp3`;
  if (!fs.existsSync(file)) { console.error(`pack-voice: no clip for "${l.say}"`); process.exit(1); }
  if (!at[id]) { // two keys that read the same share one clip
    const bytes = fs.readFileSync(file);
    const seconds = +execFileSync("ffprobe", ["-loglevel", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString();
    if (!(seconds > 0.2)) { console.error(`pack-voice: empty clip for "${l.say}"`); process.exit(1); }
    at[id] = [offset, bytes.length, +seconds.toFixed(2)];
    parts.push(bytes); offset += bytes.length;
  }
  index[l.key] = at[id];
}
fs.mkdirSync("public/sound", { recursive: true });
fs.writeFileSync("public/sound/voice.pack", Buffer.concat(parts));
fs.writeFileSync("public/sound/voice.json", JSON.stringify(index));
console.log(`pack-voice: ${lines.length} lines, ${parts.length} clips, ${(offset / 1e6).toFixed(2)} MB`);
