#!/bin/bash
# Records every line the sound guide speaks (tools/voice-lines.js) with Kokoro on this Mac, and packs
# the clips into public/sound/voice.pack with their index, public/sound/voice.json.
#   tools/build-voice.sh [WORKDIR]     # WORKDIR keeps the clips between runs; a line already recorded is skipped
#   VOICE=af_heart tools/build-voice.sh   # another Kokoro voice (default am_michael); see tools/narrate-lines.py
# Needs ffmpeg and the explainer-video skill's Kokoro setup (~/skywell/guides/local-voice-models.md).
# Takes a minute or two from scratch. Run it again after changing a caption, a move's name or its "how".
set -euo pipefail
cd "$(dirname "$0")/.."
export VOICE="${VOICE:-am_michael}"
WORK="${1:-$(mktemp -d)}"; mkdir -p "$WORK"
PY="$(bash "$HOME/Documents/2026/skills/explainer-video/scripts/pyenv.sh" kokoro)"
node tools/voice-lines.js > "$WORK/lines.json"
# The lines with no clip yet in this voice.
node -e '
  const fs = require("fs"), { clipId } = require("./tools/pack-voice.js");
  const work = process.argv[1], seen = new Set(), todo = [];
  for (const l of JSON.parse(fs.readFileSync(work + "/lines.json"))) {
    const id = clipId(l.say);
    if (!seen.has(id) && !fs.existsSync(`${work}/${id}.mp3`)) todo.push({ id, say: l.say });
    seen.add(id);
  }
  fs.writeFileSync(work + "/todo.json", JSON.stringify(todo));
  console.log(`build-voice: ${todo.length} lines to record with ${process.env.VOICE}`);' "$WORK"
"$PY" tools/narrate-lines.py "$WORK" "$VOICE" 2>"$WORK/narrate.err" || { echo "build-voice: recording failed" >&2; tail -5 "$WORK/narrate.err" >&2; exit 1; }
for wav in "$WORK"/*.wav; do
  [ -e "$wav" ] || continue
  ffmpeg -loglevel error -y -i "$wav" -ac 1 -ar 24000 -b:a 40k "${wav%.wav}.mp3" < /dev/null
  rm "$wav"
done
node tools/pack-voice.js "$WORK"
