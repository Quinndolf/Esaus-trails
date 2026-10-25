import { describe, expect, it } from 'vitest';
import { CALLS } from '../catalog';
import { CallPlayer, type PlayerEnv } from '../player';
import { PHRASES } from '../synth';

/** Minimal Web Audio stand-in that counts what gets started and stopped. */
function fakeAudio() {
  const log = { oscStarts: 0, srcStarts: 0, srcStops: 0, loops: [] as boolean[], disconnected: 0 };
  const param = () => ({
    value: 1,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = (extra: object = {}) => ({ connect() {}, disconnect: () => void log.disconnected++, ...extra });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    resume: async () => {},
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ frequency: param(), Q: param(), type: '' }),
    createOscillator: () => node({ frequency: param(), type: '', start: () => void log.oscStarts++, stop() {} }),
    createBuffer: (_c: number, len: number) => ({ length: len, getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => {
      const s: any = node({ loop: false, start: () => log.srcStarts++, stop: () => log.srcStops++ });
      s.loopStart = 0;
      s.loopEnd = 0;
      return s;
    },
    decodeAudioData: async () => ({ duration: 3 }),
  };
  return { ctx: ctx as unknown as AudioContext, log };
}

function env(manifest: unknown, audio = fakeAudio()) {
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let n = 0;
  const e: PlayerEnv = {
    createContext: () => audio.ctx,
    fetchJson: async () => manifest,
    fetchBytes: async () => new ArrayBuffer(8),
    setTimer: (fn, ms) => {
      const id = ++n;
      timers.push({ fn, ms, id });
      return id;
    },
    clearTimer: (id) => {
      const k = timers.findIndex((t) => t.id === id);
      if (k >= 0) timers.splice(k, 1);
    },
    rnd: () => 0.5,
  };
  return { e, audio, timers };
}

describe('call catalog', () => {
  it('has the seven calls and a synth phrase for each', () => {
    expect(CALLS.map((c) => c.id)).toEqual([
      'deer-grunt',
      'deer-bleat',
      'deer-snort-wheeze',
      'deer-rattle',
      'squirrel-bark',
      'squirrel-distress',
      'squirrel-cutter',
    ]);
    for (const c of CALLS) expect(PHRASES[c.id]).toBeTypeOf('function');
  });
  it('every phrase schedules sound and returns a positive wait', () => {
    for (const id of Object.keys(PHRASES)) {
      const { ctx, log } = fakeAudio();
      const wait = PHRASES[id]({ ctx, out: ctx.destination, noise: ctx.createBuffer(1, 10, 8000), rnd: () => 0.5 }, 0);
      expect(wait, id).toBeGreaterThan(0.3);
      expect(log.oscStarts + log.srcStarts, id).toBeGreaterThan(0);
    }
  });
});

describe('press and hold', () => {
  it('plays a synth while held, keeps scheduling, and stops on release', async () => {
    const { e, audio, timers } = env({ recordings: {} });
    const p = new CallPlayer(e);
    await p.press('deer-grunt');
    expect(p.isHeld('deer-grunt')).toBe(true);
    const started = audio.log.oscStarts + audio.log.srcStarts;
    expect(started).toBeGreaterThan(0);
    expect(timers.length).toBe(1); // the scheduler is ticking
    p.release('deer-grunt');
    expect(p.isHeld('deer-grunt')).toBe(false);
    timers.splice(0).forEach((t) => t.fn()); // fade-out timer fires: voice stops
    expect(timers.length).toBe(0); // no scheduler left running
    expect(audio.log.disconnected).toBeGreaterThan(0);
  });

  it('does not start if the finger lifts before the call loads', async () => {
    const { e, audio } = env({ recordings: { 'deer-bleat': { file: 'deer-bleat.mp3', author: 'a', license: 'CC0', source: 's' } } });
    const p = new CallPlayer(e);
    const pending = p.press('deer-bleat');
    p.release('deer-bleat');
    await pending;
    expect(audio.log.srcStarts).toBe(0);
  });

  it('loops a listed recording while held and credits it', async () => {
    const rec = { file: 'deer-grunt.mp3', author: 'A. Recordist', license: 'CC BY 4.0', source: 'https://example.org', loopStart: 0.2, loopEnd: 2 };
    const { e, audio } = env({ recordings: { 'deer-grunt': rec } });
    const p = new CallPlayer(e);
    await p.press('deer-grunt');
    expect(audio.log.srcStarts).toBe(1);
    expect((await p.sources())['deer-grunt']).toBe('recording');
    expect((await p.sources())['deer-bleat']).toBe('synth');
    expect((await p.credits())[0]).toMatchObject({ id: 'deer-grunt', author: 'A. Recordist', license: 'CC BY 4.0' });
    p.release('deer-grunt');
  });

  it('falls back to the synth when the manifest is missing or the clip will not decode', async () => {
    const a = fakeAudio();
    a.ctx.decodeAudioData = async () => {
      throw new Error('bad clip');
    };
    const { e } = env({ recordings: { 'squirrel-bark': { file: 'x.mp3', author: 'a', license: 'CC0', source: 's' } } }, a);
    const p = new CallPlayer(e);
    await p.press('squirrel-bark');
    expect(a.log.oscStarts + a.log.srcStarts).toBeGreaterThan(0);
    const broken = new CallPlayer({ ...e, fetchJson: async () => Promise.reject(new Error('404')) });
    expect(await broken.sources()).toMatchObject({ 'deer-grunt': 'synth' });
  });

  it('releaseAll silences everything and ignores unknown ids', async () => {
    const { e, timers } = env({ recordings: {} });
    const p = new CallPlayer(e);
    await p.press('deer-rattle');
    await p.press('squirrel-cutter');
    await p.press('not-a-call');
    p.releaseAll();
    expect(p.isHeld('deer-rattle') || p.isHeld('squirrel-cutter') || p.isHeld('not-a-call')).toBe(false);
    timers.splice(0).forEach((t) => t.fn());
    expect(timers.length).toBe(0);
  });
});
