// The sound guide: a session you can follow by ear, with the phone locked or out of sight. A phone stops a web app's
// timers when it locks, but keeps playing a track that is already playing. So the whole session becomes
// one track, built on the phone when you press Start: a voice names each move and how to do it, a wave of
// sound swells on the in-breath and ebbs on the out-breath, and a chime marks each new move.
// The voice is short clips (Kokoro, made by tools/build-voice.sh), packed into sound/voice.pack; the
// index sound/voice.json says where each clip is and how long it lasts: {key: [offset, bytes, seconds]}.
// cues() and leads() are pure (the tests use them); buildTrack() needs a browser.
(function (root) {
  const RATE = 24000;
  const COMMON = {
    "start:morning": "Good morning. Start on hands and knees. Breathe in as the tone rises, and out as it falls.",
    "start:before": "Warm-up. Start on hands and knees. Breathe in as the tone rises, and out as it falls.",
    "start:after": "Cool-down. Start standing. Breathe in as the tone rises, and out as it falls.",
    "start:qigong": "Qigong, the Eight Brocades. Start standing, feet hip-width apart. Breathe in as the tone rises, and out as it falls.",
    two: "Two more breaths.",
    done: "Done. Nice work.",
  };
  // A caption as it is read aloud.
  const spoken = (text) => text.replace(/90\/90/g, "ninety ninety").replace(/–/g, " ").replace(/:/g, ",");

  const secs = (index, key) => (index[key] ? index[key][2] : 0);

  // How long the "get ready" and each "Next: ..." lead-in must last for its clip to finish before the move starts.
  function leads(session, index) {
    return { intro: secs(index, "start:" + (session.mode || "morning")) + 0.8, steps: session.steps.map((s) => 0.9 + secs(index, "intro:" + s.id) + 0.4) };
  }

  // What plays when, for a timeline made with those leads:
  //   voice: [{t, key, d}] clips, never two at once; tones: [{t, d, dir}] one per breath (1 in, -1 out);
  //   chimes: [t] at each new move; total: the track's length in seconds.
  function cues(session, tl, index) {
    const voice = [], tones = [], chimes = [];
    let busy = 0; // when the voice is next free
    // must: wait for the voice to be free (up to 1.5 s) rather than drop the line.
    const say = (t, key, must) => {
      if (!index[key]) return false;
      if (t < busy) { if (!must || busy - t > 1.5) return false; t = busy; }
      voice.push({ t, key, d: index[key][2] });
      busy = t + index[key][2] + 0.25;
      return true;
    };
    // A breath drawn in two parts (beast to crab) is still one breath: one tone, one caption.
    const second = (g) => !!(g.breath && g.part && g.part[0] > 0);
    // "Two more breaths" goes two breaths before the end of each long run of breaths (a hold, or one side of it).
    const two = new Set();
    let run = [];
    const close = () => { if (run.length >= 8) two.add(run[run.length - 4]); run = []; };
    tl.segs.forEach((g, i) => {
      if (second(g)) return;
      if (g.breath && !g.lead && run.length && tl.segs[run[0]].step === g.step) run.push(i);
      else { close(); if (g.breath && !g.lead) run.push(i); }
    });
    close();

    let said = new Set(), first = false, prev = "";
    tl.segs.forEach((g, i) => {
      if (g.step < 0) { say(0.3, "start:" + (session.mode || "morning"), true); return; }
      if (g.lead) {
        chimes.push(g.t0);
        say(g.t0 + 0.9, "intro:" + session.steps[g.step].id, true);
        said = new Set(); first = true; prev = "";
        return;
      }
      if (second(g)) { tones[tones.length - 1].d += g.d; return; }
      if (g.breath) tones.push({ t: g.t0, d: g.d, dir: g.breath === "in" ? 1 : -1 });
      if (two.has(i)) say(g.t0 + 0.2, "two", false);
      // A breath's caption is spoken the first time only; after that the tone carries it.
      else if (g.breath) { if (!said.has(g.cap) && say(g.t0 + 0.2, g.cap, false)) said.add(g.cap); }
      // "Other side", "Come out of it": each time they come. Not the move's first caption, which the intro
      // just covered, and not a caption that only repeats the one before it (the shake, a loop).
      else if (!first && g.cap !== prev) say(g.t0, g.cap, true);
      first = false; prev = g.cap;
    });
    say(tl.total + 0.4, "done", true);
    return { voice, tones, chimes, total: Math.max(tl.total, busy) + 1 };
  }

  // ---- browser only: fetch the clips, mix the track ----
  let pack = null; // {index, bytes}, fetched once
  async function load() {
    if (pack) return pack;
    const [index, bytes] = await Promise.all([
      fetch("sound/voice.json").then((r) => { if (!r.ok) throw new Error("voice.json " + r.status); return r.json(); }),
      fetch("sound/voice.pack").then((r) => { if (!r.ok) throw new Error("voice.pack " + r.status); return r.arrayBuffer(); }),
    ]);
    return (pack = { index, bytes });
  }

  const clamp = (x) => Math.max(-32768, Math.min(32767, x));
  // The breath sound, in stereo: a wave of soft, deep noise, with a binaural beat inside it (136 Hz in the
  // left ear, 142 Hz in the right, heard in headphones as a slow 6-a-second pulse; on a speaker, a low hum).
  // The wave swells through the in-breath and ebbs through the out-breath as one continuous sound; the beat
  // swells and ebbs more, nearly to nothing at the bottom of a breath. Where one breath turns into the next,
  // a soft note marks the turn: higher into an in-breath, lower into an out-breath. Pitches never slide.
  // It fades in only where a run of breaths starts, and out only where it ends.
  const FLOOR = 0.3;                 // how much of the wave stays at the bottom of a breath
  const BEAT_FLOOR = 0.08;           // and how much of the beat
  const BEAT = [136.1, 142.1];       // left, right
  const TURN = { 1: 523.3, "-1": 392 }; // the note into an in-breath, into an out-breath
  function breaths(pcm, tones) {
    let seed = 12345, a = 0, b = 0, c = 0, pl = 0, pr = 0; // the noise, its filter and the beat carry on from one breath into the next
    const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    const near = (x, y) => Math.abs(x - y) < 0.05;
    const N = pcm.length / 2, wl = 2 * Math.PI * BEAT[0] / RATE, wr = 2 * Math.PI * BEAT[1] / RATE;
    tones.forEach((g, k) => {
      const joined = k > 0 && near(tones[k - 1].t + tones[k - 1].d, g.t);
      const joins = k < tones.length - 1 && near(g.t + g.d, tones[k + 1].t);
      const n = Math.floor(g.d * RATE), start = Math.floor(g.t * RATE);
      for (let i = 0; i < n && start + i < N; i++) {
        const x = i / n, rise = (1 - Math.cos(Math.PI * x)) / 2;
        const level = g.dir > 0 ? rise : 1 - rise;           // 0 at the bottom of the breath, 1 at the top
        let fade = 1;
        if (!joined) fade *= Math.min(1, (i / RATE) / 0.6);
        if (!joins) fade *= Math.min(1, ((n - i) / RATE) / 1.0);
        const env = fade * (FLOOR + (1 - FLOOR) * level), benv = fade * (BEAT_FLOOR + (1 - BEAT_FLOOR) * level);
        const k1 = 1 - Math.exp(-2 * Math.PI * (180 + 520 * level) / RATE); // the wave opens as the breath fills
        a += k1 * (noise() - a); b += k1 * (a - b); c += k1 * (b - c);
        pl += wl; pr += wr;
        const wave = 0.42 * env * c;
        const l = wave + 0.09 * benv * (Math.sin(pl) + 0.25 * Math.sin(2 * pl));
        const r = wave + 0.09 * benv * (Math.sin(pr) + 0.25 * Math.sin(2 * pr));
        // The turn: a soft bell-like note over the first half second of a breath that follows another.
        let turn = 0;
        if (joined && i < RATE * 0.6) { const u = i / RATE; turn = 0.07 * Math.min(1, u / 0.01) * Math.exp(-u / 0.15) * Math.sin(2 * Math.PI * TURN[g.dir] * u); }
        const j = 2 * (start + i);
        pcm[j] = clamp(pcm[j] + 32767 * (l + turn));
        pcm[j + 1] = clamp(pcm[j + 1] + 32767 * (r + turn));
      }
    });
  }
  // Add a mono sound to both channels.
  function both(pcm, start, n, f) {
    for (let i = 0; i < n && 2 * (start + i) + 1 < pcm.length; i++) { const v = f(i), j = 2 * (start + i); pcm[j] = clamp(pcm[j] + v); pcm[j + 1] = clamp(pcm[j + 1] + v); }
  }
  function chime(pcm, t0) {
    const n = Math.floor(0.8 * RATE);
    both(pcm, Math.floor(t0 * RATE), n, (i) => 6500 * Math.exp(-5 * i / n) * Math.sin(2 * Math.PI * 660 * i / RATE));
  }
  function wav(pcm) {
    const head = new DataView(new ArrayBuffer(44));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) head.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); head.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVEfmt ");
    head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 2, true); // stereo, interleaved
    head.setUint32(24, RATE, true); head.setUint32(28, RATE * 4, true); head.setUint16(32, 4, true); head.setUint16(34, 16, true);
    str(36, "data"); head.setUint32(40, pcm.length * 2, true);
    return new Blob([head, pcm], { type: "audio/wav" }); // phones are little-endian, as WAV is
  }

  // Mix a plan (what cues() returned) into stereo samples, left and right interleaved.
  // clips: {key: Float32Array at RATE}. Pure, so the tests use it.
  function mix(plan, clips) {
    const pcm = new Int16Array(2 * Math.ceil(plan.total * RATE));
    breaths(pcm, plan.tones);
    for (const t of plan.chimes) chime(pcm, t);
    for (const v of plan.voice) { const data = clips[v.key]; both(pcm, Math.floor(v.t * RATE), data.length, (i) => data[i] * 32767); }
    return pcm;
  }

  // The session's track as a WAV blob, from a plan.
  async function buildTrack(plan) {
    const { index, bytes } = await load();
    const Ctx = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    const ctx = new Ctx(1, 1, RATE); // decodes each clip at the track's own rate
    const clips = {};
    for (const key of new Set(plan.voice.map((v) => v.key))) {
      const [off, len] = index[key];
      const buf = await new Promise((ok, bad) => ctx.decodeAudioData(bytes.slice(off, off + len), ok, bad));
      clips[key] = buf.getChannelData(0);
    }
    return wav(mix(plan, clips));
  }

  // A moment of silence, to start the player inside the tap on Start: a phone only lets a page play
  // sound it started from a tap, and the real track takes a moment to build.
  const silence = () => wav(new Int16Array(RATE / 2));

  const api = { RATE, COMMON, spoken, leads, cues, mix, load, buildTrack, silence };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SOUND = api;
})(typeof window !== "undefined" ? window : globalThis);
