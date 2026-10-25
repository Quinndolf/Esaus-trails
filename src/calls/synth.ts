/**
 * Synthesized stand-ins for the calls, used until recordings are added under public/calls/.
 * Timings follow Atkeson, Marchinton and Miller (1988) where it gives them (grunt 0.1-0.4 s;
 * snort-wheeze: grunt, three snorts over 0.3-0.6 s, then a 0.7-3 s wheeze). They are
 * approximations. A real recording will always sound better.
 *
 * A phrase schedules one repeat of the call starting at time `t` and returns how many seconds
 * to wait before the next one starts. The player keeps scheduling phrases while the pad is held.
 */

export interface Synth {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  rnd: () => number;
}

export type Phrase = (s: Synth, t: number) => number;

interface Tone {
  type: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  gain: number;
  /** Vibrato rate (Hz) and depth (fraction of the pitch). */
  vib?: [number, number];
  /** Lowpass cutoff. */
  lp?: number;
  attack?: number;
  /** Amplitude wobble [Hz, depth 0-1], for the rough, rattly squeal. */
  am?: [number, number];
}

function tone(s: Synth, t: number, o: Tone) {
  const { ctx, out } = s;
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1 != null) osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
  const env = ctx.createGain();
  const a = o.attack ?? 0.015;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(o.gain, t + a);
  env.gain.setValueAtTime(o.gain, t + Math.max(a, o.dur - 0.05));
  env.gain.linearRampToValueAtTime(0.0001, t + o.dur);
  let node: AudioNode = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    node.connect(f);
    node = f;
  }
  node.connect(env);
  env.connect(out);
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib[0];
    const depth = ctx.createGain();
    depth.gain.value = o.vib[1] * o.f0;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.05);
  }
  if (o.am) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.am[0];
    const depth = ctx.createGain();
    depth.gain.value = o.am[1] * o.gain;
    lfo.connect(depth);
    depth.connect(env.gain);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.05);
  }
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface Burst {
  dur: number;
  gain: number;
  /** Band-pass center in Hz and Q. */
  hz: number;
  q: number;
  attack?: number;
  /** Center sweeps to this over the burst. */
  hz1?: number;
}

function burst(s: Synth, t: number, o: Burst) {
  const { ctx, out } = s;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(o.hz, t);
  if (o.hz1 != null) f.frequency.linearRampToValueAtTime(o.hz1, t + o.dur);
  f.Q.value = o.q;
  const env = ctx.createGain();
  const a = o.attack ?? 0.005;
  env.gain.setValueAtTime(0.0001, t);
  // A narrow band-pass passes little of the noise; make that up so every burst sits at its stated gain.
  const level = o.gain * (1 + 0.8 * Math.sqrt(o.q));
  env.gain.linearRampToValueAtTime(level, t + a);
  env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f);
  f.connect(env);
  env.connect(out);
  src.start(t, s.rnd() * 1.5);
  src.stop(t + o.dur + 0.02);
}

const between = (s: Synth, a: number, b: number) => a + (b - a) * s.rnd();

function grunt(s: Synth, t: number, gain = 0.9, len = 0.28) {
  const f = between(s, 95, 125);
  tone(s, t, { type: 'sawtooth', f0: f, f1: f * 0.8, dur: len, gain, lp: 520, attack: 0.03 });
  burst(s, t, { dur: len, gain: gain * 0.35, hz: 260, q: 0.8, attack: 0.03 });
}

export const PHRASES: Record<string, Phrase> = {
  // A short string of tending grunts, then a breath.
  'deer-grunt': (s, t) => {
    const n = 2 + Math.floor(s.rnd() * 3);
    let at = t;
    for (let k = 0; k < n; k++) {
      grunt(s, at, 0.85 - k * 0.05, between(s, 0.2, 0.36));
      at += between(s, 0.45, 0.75);
    }
    return at - t + between(s, 0.3, 0.9);
  },

  'deer-bleat': (s, t) => {
    const f = between(s, 420, 520);
    const dur = between(s, 0.7, 1.1);
    tone(s, t, { type: 'sawtooth', f0: f * 0.9, f1: f * 1.15, dur, gain: 0.55, vib: [7, 0.03], lp: 1800, attack: 0.06 });
    burst(s, t, { dur, gain: 0.08, hz: 900, q: 2, attack: 0.08 });
    return dur + between(s, 0.5, 1.2);
  },

  // Grunt, three snorts, a long wheeze: the shape reported by Atkeson et al. 1988.
  'deer-snort-wheeze': (s, t) => {
    grunt(s, t, 0.8, 0.22);
    let at = t + 0.3;
    for (let k = 0; k < 3; k++) {
      burst(s, at, { dur: 0.11, gain: 0.95, hz: 2400, q: 0.7, attack: 0.004, hz1: 1400 });
      at += between(s, 0.14, 0.2);
    }
    at += 0.04;
    const wheeze = between(s, 1.3, 2.2);
    burst(s, at, { dur: wheeze, gain: 0.55, hz: 3300, q: 6, attack: 0.15, hz1: 2600 });
    burst(s, at, { dur: wheeze, gain: 0.25, hz: 1100, q: 1.2, attack: 0.2 });
    tone(s, at, { type: 'sine', f0: 3100, f1: 2700, dur: wheeze, gain: 0.04, attack: 0.2 });
    return at - t + wheeze + between(s, 1.5, 2.5);
  },

  // Antlers: hard clacks, bunched, with grinding in between.
  'deer-rattle': (s, t) => {
    const span = 2.2;
    let at = t;
    while (at < t + span) {
      const hit = 0.5 + 0.5 * s.rnd();
      burst(s, at, { dur: 0.09, gain: 0.9 * hit, hz: between(s, 1400, 2600), q: 3, attack: 0.001 });
      burst(s, at, { dur: 0.05, gain: 0.5 * hit, hz: between(s, 3500, 5200), q: 5, attack: 0.001 });
      at += s.rnd() < 0.25 ? between(s, 0.2, 0.35) : between(s, 0.04, 0.12);
      if (s.rnd() < 0.18) burst(s, at, { dur: 0.22, gain: 0.3, hz: between(s, 900, 1500), q: 1.5, attack: 0.04 });
    }
    return span;
  },

  // "Kuk-kuk-kuk": a run of sharp barks.
  'squirrel-bark': (s, t) => {
    const n = 3 + Math.floor(s.rnd() * 4);
    let at = t;
    for (let k = 0; k < n; k++) {
      const hz = between(s, 1500, 2100);
      burst(s, at, { dur: 0.13, gain: 0.85, hz, q: 2.2, attack: 0.004, hz1: hz * 0.7 });
      tone(s, at, { type: 'square', f0: hz * 0.55, f1: hz * 0.4, dur: 0.1, gain: 0.07, lp: 2400, attack: 0.004 });
      at += between(s, 0.32, 0.5);
    }
    return at - t + between(s, 0.4, 1);
  },

  // A squeal: rising, rough, shaky.
  'squirrel-distress': (s, t) => {
    const dur = between(s, 0.9, 1.4);
    const f = between(s, 1000, 1300);
    tone(s, t, { type: 'sawtooth', f0: f, f1: f * 1.5, dur, gain: 0.5, am: [26, 0.7], vib: [9, 0.05], lp: 4200, attack: 0.02 });
    burst(s, t, { dur, gain: 0.25, hz: 3000, q: 1.5, attack: 0.03 });
    return dur + between(s, 0.5, 1.1);
  },

  // Rapid scolding clicks, run after run.
  'squirrel-cutter': (s, t) => {
    const runs = 6 + Math.floor(s.rnd() * 6);
    let at = t;
    for (let k = 0; k < runs; k++) {
      const hz = between(s, 1800, 2800);
      burst(s, at, { dur: 0.045, gain: 0.8, hz, q: 4, attack: 0.001 });
      at += between(s, 0.07, 0.12);
    }
    return at - t + between(s, 0.12, 0.35);
  },
};

export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
