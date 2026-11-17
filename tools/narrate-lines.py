"""Records many short lines with Kokoro 82M on this Mac, loading the model once.

Usage: "$(bash pyenv.sh kokoro)" tools/narrate-lines.py WORKDIR VOICE
Reads WORKDIR/todo.json, a list of {"id", "say"}, and writes WORKDIR/<id>.wav for each (24 kHz mono).
Voices: af_heart, af_bella, af_nicole (women), am_michael, am_fenrir, am_puck (men). Only a cached
model is used; the text never leaves the machine. Same setup as the explainer-video skill's narrate.py.
"""
import json
import os
import sys
from pathlib import Path

work, voice = Path(sys.argv[1]), sys.argv[2]
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
# The espeak-ng data baked into espeakng-loader points at a path that doesn't exist; Homebrew's copy works.
lib, data = Path("/opt/homebrew/lib/libespeak-ng.dylib"), Path("/opt/homebrew/share/espeak-ng-data")
if not lib.exists():
    sys.exit("narrate-lines: espeak-ng not found. Install it once with: brew install espeak-ng")
os.environ.setdefault("PHONEMIZER_ESPEAK_LIBRARY", str(lib))
os.environ.setdefault("ESPEAK_DATA_PATH", str(data))

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

todo = json.loads((work / "todo.json").read_text())
model = load_model("mlx-community/Kokoro-82M-bf16")
for line in todo:
    parts = [np.array(r.audio) for r in model.generate(line["say"], voice=voice, lang_code=voice[0], speed=1.0)]
    if not parts:
        sys.exit(f"narrate-lines: Kokoro returned no audio for: {line['say']}")
    sf.write(work / f"{line['id']}.wav", np.concatenate(parts), 24000)
    print(f"recorded: {line['say']}", flush=True)
