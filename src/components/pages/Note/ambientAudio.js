/* Procedural ambient soundscapes for the pomodoro focus overlay.
   Pure WebAudio — no audio assets, degrades silently (same approach as the
   chime/tick in TuiView). One soundscape plays at a time; an AnalyserNode
   sits on the master bus so the overlay can draw a live equalizer. */

export const AMBIENT_KINDS = ['rain', 'lofi', 'waves'];

let ctx = null;
let master = null;
let analyser = null;
let current = null; // { kind, bus, nodes, timers }

const ensureCtx = () => {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') {
    ctx.resume();
    // Autoplay policy (e.g. reload with a running timer): retry on the
    // next user gesture.
    const kick = () => ctx.resume();
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
  }
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0.9;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    master.connect(analyser).connect(ctx.destination);
  }
};

const noiseBuffer = (type) => {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i += 1) {
    const white = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
    else data[i] = white;
  }
  return buf;
};

/* Rain — a lowpassed noise "shhh" bed plus random short high plinks
   panned across the stereo field: the "tí tách" droplets. */
const buildRain = (out, nodes, timers) => {
  const bed = ctx.createBufferSource();
  bed.buffer = noiseBuffer('white');
  bed.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.4;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.16;
  bed.connect(bp).connect(bedGain).connect(out);
  bed.start();
  nodes.push(bed);

  const drop = () => {
    const t = ctx.currentTime + 0.02 + Math.random() * 0.1;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 1800 + Math.random() * 2600;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.045);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.06);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g).connect(pan).connect(out);
    } else o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.18);
  };
  timers.push(setInterval(() => {
    if (Math.random() < 0.9) drop();
    if (Math.random() < 0.35) drop();
  }, 130));
};

/* Waves — brown noise with a slow gain swell, like surf washing in. */
const buildWaves = (out, nodes) => {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer('brown');
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 480;
  const g = ctx.createGain();
  g.gain.value = 0.16;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = 0.11;
  lfo.connect(depth).connect(g.gain);
  src.connect(lp).connect(g).connect(out);
  src.start();
  lfo.start();
  nodes.push(src, lfo);
};

/* Lofi — a mellow 7th-chord pad (detuned triangles through a lowpass,
   soft attack/release, chord change every 4s) over a sine sub root,
   with sparse vinyl crackle on top. */
const LOFI_CHORDS = [
  [220.00, 261.63, 329.63, 392.00], // Am7
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [130.81, 164.81, 196.00, 246.94], // Cmaj7
  [196.00, 246.94, 293.66, 349.23], // G7
];
const buildLofi = (out, nodes, timers) => {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 850;
  lp.connect(out);
  let step = 0;
  const playChord = () => {
    const t = ctx.currentTime + 0.05;
    const dur = 4.4;
    const chord = LOFI_CHORDS[step % LOFI_CHORDS.length];
    step += 1;
    chord.forEach((f, i) => {
      [-5, 5].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.024, t + 1.3);
        g.gain.setValueAtTime(0.024, t + dur - 1.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
      if (i === 0) { // sub root, one octave down
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f / 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.9);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    });
  };
  playChord();
  timers.push(setInterval(playChord, 4000));

  const crackleBuf = noiseBuffer('white');
  timers.push(setInterval(() => {
    if (Math.random() < 0.45) return;
    const t = ctx.currentTime + Math.random() * 0.15;
    const s = ctx.createBufferSource();
    s.buffer = crackleBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.01 + Math.random() * 0.018, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    s.connect(hp).connect(g).connect(out);
    s.start(t, Math.random() * 1.5, 0.03);
  }, 180));
};

export const startAmbient = (kind) => {
  try {
    if (!AMBIENT_KINDS.includes(kind)) { stopAmbient(); return; }
    if (current?.kind === kind) return;
    stopAmbient();
    ensureCtx();
    const nodes = [];
    const timers = [];
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    if (kind === 'rain') buildRain(bus, nodes, timers);
    else if (kind === 'waves') buildWaves(bus, nodes);
    else buildLofi(bus, nodes, timers);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    current = { kind, bus, nodes, timers };
  } catch { /* no audio — fine */ }
};

export const stopAmbient = () => {
  if (!current) return;
  const { bus, nodes, timers } = current;
  current = null;
  try {
    timers.forEach(clearInterval);
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    setTimeout(() => {
      try {
        nodes.forEach((n) => n.stop?.());
        bus.disconnect();
      } catch { /* already gone */ }
    }, 500);
  } catch { /* no audio — fine */ }
};

export const getAmbientAnalyser = () => analyser;
