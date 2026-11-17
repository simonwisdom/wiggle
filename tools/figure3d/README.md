# figure3d: the 3D figure's pose builder, checks and renderer

Part of the plan in `~/skywell/projects/morning-movement/WIGGLE-3D-PLAN.md` (Stage 1). The app still draws its flat figure; this folder makes the pre-rendered clips that can replace it.

| File | What it does |
| --- | --- |
| `steps.mjs` -> `steps.json` | The step map: every pose-to-pose step any session can produce (from `public/plan.js` and `clipplay.js`), its side, kind (`move`, `hold`, `loop`, links), clip length and size. `node tools/figure3d/steps.mjs` |
| `rig.mjs` | The solver: a pose (hips, lean, spine, hand and foot targets) -> joint positions. Elbows and knees by IK. `blendFrames` makes a clip's frames; `mirrorPose` makes the other side. |
| `moves/<move id>.mjs` | One file per move, named by its id in `plan.js`: its poses (`cow`, `threadUnderN` ...), and if it needs them waypoints (`VIA`), pass-through poses (`PASS`) and loops (`LOOPS`). `moves/_common.mjs` holds the foot and hand shapes and the poses more than one move uses (`table`, `stand`). |
| `poses3d.mjs` | The index: loads every file in `moves/`, merges them (the same pose name in two files is an error), and looks poses up by plan.js's name. The other side (`...F`) is a mirror made by code. You do not edit it. |
| `motion.mjs` | Frames for a step of the map. |
| `cameras.mjs` | One fixed camera per position (`floor` = all fours and kneeling, `seated`, `lying`, `standing` = standing and rising), the real projection, the mat size, and `headTrack`. `fit-cameras.mjs` suggests the numbers. |
| `checks.mjs` | Per-frame checks, used by `tests/figure3d.test.js` (run by `npm test`). |
| `preview.mjs` | `node tools/figure3d/preview.mjs [move ids]` writes `previews/<move>.png`: key poses and the middle of each moving step, on that move's camera. Headless Chrome. |
| `export.mjs` | `node tools/figure3d/export.mjs [--steps id,id] [--no-head]` writes the render data, `render/_main.html` and `out/cuts.json` (where each clip sits in the render, and its head track). |
| `render/` | The three.js scene (`scene.js`, colours in one place at the top) and the HyperFrames page. |

## Adding a move
Each move is one file, so several people can add moves at the same time without touching the same file.
1. Make `moves/<move id>.mjs`, with the id from `public/plan.js` (`cobra`, `child` ...). Copy the shape of `moves/skybow.mjs`: `export const POSES = {}`, then each pose under the name `plan.js` uses (`P.cobraA = {...}`) in the short form. Type only the first side; `...F` poses are mirrors made by code. Import shared shapes and `table` / `stand` from `./_common.mjs`; do not edit `_common.mjs` or `poses3d.mjs`. A pose another move already defines can't be defined again (the index says which file has it).
2. Optional exports: `VIA` (waypoints, `{ "from>to": [pose] }`, when a straight blend goes through the body or the floor), `PASS` (names of poses the figure passes through without stopping), `LOOPS` and `LOOP_OF` (a loop played in real time).
3. `npm test` covers every move that has a file, automatically: planted hands and feet on the mat, nothing under the floor, in frame, limbs apart, bone lengths, clip ends on its poses. Fix what it names. `node tools/figure3d/preview.mjs <id>` writes `previews/<id>.png` to look at (`CELL=540 COLS=3` for a closer look).
4. `node tools/figure3d/fit-cameras.mjs` if a pose reaches outside its position's camera (then change `cameras.mjs`, and tell the others: it moves every clip on that camera). Keep the cameras at about the same body size.
5. Render and cut, see below. `npm test` then checks the manifest against the steps.

## Rendering
`node tools/figure3d/export.mjs --no-head` writes the data and `out/cuts.json` for every posed step. Then, from `tools/figure3d/render/`, `bash ~/skywell/projects/skills/explainer-video/scripts/hf.sh render --composition=_main.html --output=renders/all.mp4 --fps=30` (about 4 minutes for 4000 frames; check `memory_pressure | tail -1` first). Then `node tools/figure3d/clips.mjs` cuts `out/clips/*.mp4` (540 square, H.264, key frame every 30) and writes `out/clips3d.json` (the manifest) and `out/clips3d-heads.json` (the head track for every clip, in the order of the manifest's ids). Re-rendering renders every posed move, so run it after the others' moves have merged.

## The head
The app will draw a flat, pickable head over the video. `export.mjs --no-head` leaves the 3D head out (the neck stays, with a rounded end). Either way `out/cuts.json` carries, per frame of every clip, `[head x, head y, neck x, neck y, head height, tilt]` in the 540 px square's pixels (tilt in degrees, 0 = upright, + = leaning right), from the same camera numbers the render uses (checked against three.js: 0.000 px apart).

## Colours
Wiggle's cobalt body and out-breath orange joints: `FIG3D_COLORS` at the top of `render/scene.js`.
