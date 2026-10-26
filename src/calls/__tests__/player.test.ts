import { describe, expect, it } from 'vitest';
import { CALLS } from '../catalog';
import { CallPlayer, type PlayerEnv } from '../player';

/** Minimal Web Audio stand-in that counts what gets started and stopped. */
function fakeAudio() {
  const log = { oscStarts: 0, srcStarts: 0, srcStops: 0, loops: [] as boolean[], ended: [] as (() => void)[], disconnected: 0 };
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
      const s: any = node({
        loop: false,
        onended: null,
        start: () => {
          log.srcStarts++;
          log.loops.push(s.loop);
          log.ended.push(() => s.onended?.());
        },
        stop: () => log.srcStops++,
      });
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

const rec = (o: object = {}) => ({ file: 'x.mp3', author: 'A. Recordist', license: 'CC BY 4.0', source: 'https://example.org', ...o });

describe('call catalog', () => {
  it('has deer, squirrel and turkey pads, each with an id, name and blurb', () => {
    const species = new Set(CALLS.map((c) => c.species));
    expect([...species].sort()).toEqual(['deer', 'squirrel', 'turkey']);
    expect(new Set(CALLS.map((c) => c.id)).size).toBe(CALLS.length);
    for (const c of CALLS) expect(c.name && c.blurb).toBeTruthy();
  });
});

describe('press and hold', () => {
  it('plays nothing for a call with no recording', async () => {
    const { e, audio, timers } = env({ recordings: {} });
    const p = new CallPlayer(e);
    expect(await p.press('deer-grunt')).toBe('missing');
    expect(p.isHeld('deer-grunt')).toBe(false);
    expect(audio.log.oscStarts + audio.log.srcStarts).toBe(0);
    expect(timers.length).toBe(0);
    expect(Object.values(await p.sources()).every((v) => v === 'missing')).toBe(true);
  });

  it('does not start if the finger lifts before the call loads', async () => {
    const { e, audio } = env({ recordings: { 'deer-bleat': rec() } });
    const p = new CallPlayer(e);
    const pending = p.press('deer-bleat');
    p.release('deer-bleat');
    await pending;
    expect(audio.log.srcStarts).toBe(0);
  });

  it('loops a listed recording while held, stops on release, and credits it', async () => {
    const { e, audio, timers } = env({ recordings: { 'deer-grunt': rec({ loopStart: 0.2, loopEnd: 2 }) } });
    const p = new CallPlayer(e);
    expect(await p.press('deer-grunt')).toBe('playing');
    expect(audio.log.srcStarts).toBe(1);
    expect(audio.log.loops).toEqual([true]);
    expect((await p.sources())['deer-grunt']).toBe('recording');
    expect((await p.sources())['deer-bleat']).toBe('missing');
    expect((await p.credits())[0]).toMatchObject({ id: 'deer-grunt', author: 'A. Recordist', license: 'CC BY 4.0' });
    p.release('deer-grunt');
    timers.splice(0).forEach((t) => t.fn());
    expect(audio.log.srcStops).toBe(1);
  });

  it('repeats a clip with a gap until released', async () => {
    const { e, audio, timers } = env({ recordings: { 'turkey-yelp': rec({ gap: 0.6 }) } });
    const p = new CallPlayer(e);
    await p.press('turkey-yelp');
    expect(audio.log.loops).toEqual([false]);
    audio.log.ended[0](); // clip finished: wait the gap, then play again
    expect(timers.at(-1)?.ms).toBe(600);
    timers.at(-1)!.fn();
    expect(audio.log.srcStarts).toBe(2);
    p.release('turkey-yelp');
    timers.splice(0).forEach((t) => t.fn());
    audio.log.ended[1]();
    expect(timers.length).toBe(0); // nothing rescheduled after release
  });

  it('reports a clip that will not decode as failed, and plays nothing', async () => {
    const a = fakeAudio();
    a.ctx.decodeAudioData = async () => {
      throw new Error('bad clip');
    };
    const { e } = env({ recordings: { 'squirrel-bark': rec() } }, a);
    const p = new CallPlayer(e);
    expect(await p.press('squirrel-bark')).toBe('failed');
    expect(a.log.srcStarts).toBe(0);
    const broken = new CallPlayer({ ...e, fetchJson: async () => Promise.reject(new Error('404')) });
    expect(await broken.sources()).toMatchObject({ 'deer-grunt': 'missing' });
  });

  it('releaseAll silences everything and ignores unknown ids', async () => {
    const { e, audio, timers } = env({ recordings: { 'deer-grunt': rec(), 'turkey-gobble': rec() } });
    const p = new CallPlayer(e);
    await p.press('deer-grunt');
    await p.press('turkey-gobble');
    await p.press('not-a-call');
    p.releaseAll();
    expect(p.isHeld('deer-grunt') || p.isHeld('turkey-gobble') || p.isHeld('not-a-call')).toBe(false);
    timers.splice(0).forEach((t) => t.fn());
    expect(audio.log.srcStops).toBe(2);
  });
});
