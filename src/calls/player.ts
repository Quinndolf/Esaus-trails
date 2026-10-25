import { callById, type CallManifest, type CallRecording } from './catalog';
import { makeNoise, PHRASES, type Synth } from './synth';

/**
 * Press-and-hold call player. `press` starts a call and keeps it going; `release` fades it out.
 * A listed recording (public/calls/manifest.json) loops while held; otherwise the synthesized
 * stand-in repeats phrase after phrase. Nothing plays after the finger lifts.
 */

export interface PlayerEnv {
  createContext(): AudioContext;
  fetchJson(url: string): Promise<unknown>;
  fetchBytes(url: string): Promise<ArrayBuffer>;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(id: unknown): void;
  rnd(): number;
}

export const browserEnv: PlayerEnv = {
  createContext: () => {
    const C: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return new C();
  },
  fetchJson: async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  },
  fetchBytes: async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.arrayBuffer();
  },
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  rnd: Math.random,
};

const LOOKAHEAD_S = 0.6;
const TICK_MS = 150;
const FADE_IN_S = 0.03;
const FADE_OUT_S = 0.12;

interface Clip {
  buf: AudioBuffer;
  rec: CallRecording;
}

interface Voice {
  gain: GainNode;
  stop(): void;
}

export class CallPlayer {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private manifest: Promise<CallManifest> | null = null;
  private buffers = new Map<string, Promise<Clip | null>>();
  private held = new Set<string>();
  private voices = new Map<string, Voice>();

  constructor(private env: PlayerEnv = browserEnv) {}

  /** Where each call's sound comes from right now. */
  async sources(): Promise<Record<string, 'recording' | 'synth'>> {
    const m = await this.loadManifest();
    const out: Record<string, 'recording' | 'synth'> = {};
    for (const id of Object.keys(PHRASES)) out[id] = m.recordings[id] ? 'recording' : 'synth';
    return out;
  }

  async credits(): Promise<(CallRecording & { id: string })[]> {
    const m = await this.loadManifest();
    return Object.entries(m.recordings).map(([id, r]) => ({ id, ...r }));
  }

  isHeld(id: string) {
    return this.held.has(id);
  }

  /** Fetch recordings ahead of the first press. Needs no audio permission. */
  async warm(): Promise<void> {
    const m = await this.loadManifest();
    // decodeAudioData needs a context, which iOS will only start from a tap: wait for the first press.
    if (!this.ctx) return;
    await Promise.all(Object.keys(m.recordings).map((id) => this.buffer(id)));
  }

  /** Call from a pointerdown handler: the audio context must start inside a user gesture. */
  async press(id: string): Promise<void> {
    if (!callById(id) || this.held.has(id)) return;
    this.held.add(id);
    const ctx = this.ensureContext();
    void ctx.resume?.();
    const clip = await this.buffer(id);
    if (!this.held.has(id) || this.voices.has(id)) return; // let go while it loaded
    this.voices.set(id, clip ? this.startRecording(ctx, clip) : this.startSynth(ctx, id));
  }

  release(id: string): void {
    this.held.delete(id);
    const v = this.voices.get(id);
    if (!v) return;
    this.voices.delete(id);
    const t = this.ctx?.currentTime ?? 0;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0.0001, t + FADE_OUT_S);
    this.env.setTimer(() => v.stop(), FADE_OUT_S * 1000 + 40);
  }

  releaseAll(): void {
    for (const id of [...this.held]) this.release(id);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = this.env.createContext();
      this.noise = makeNoise(this.ctx);
    }
    return this.ctx;
  }

  private loadManifest(): Promise<CallManifest> {
    this.manifest ??= this.env
      .fetchJson('/calls/manifest.json')
      .then((m) => ({ recordings: (m as CallManifest)?.recordings ?? {} }))
      .catch(() => ({ recordings: {} }));
    return this.manifest;
  }

  private buffer(id: string): Promise<Clip | null> {
    let p = this.buffers.get(id);
    if (!p) {
      p = (async () => {
        const rec = (await this.loadManifest()).recordings[id];
        if (!rec) return null;
        try {
          const bytes = await this.env.fetchBytes(`/calls/${rec.file}`);
          return { buf: await this.ensureContext().decodeAudioData(bytes), rec };
        } catch {
          return null; // a missing or undecodable clip falls back to the synth
        }
      })();
      this.buffers.set(id, p);
    }
    return p;
  }

  private startRecording(ctx: AudioContext, { buf, rec }: Clip): Voice {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN_S);
    gain.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    if (rec.loopStart != null) src.loopStart = rec.loopStart;
    if (rec.loopEnd != null) src.loopEnd = rec.loopEnd;
    src.connect(gain);
    src.start();
    return { gain, stop: () => src.stop() };
  }

  private startSynth(ctx: AudioContext, id: string): Voice {
    const phrase = PHRASES[id];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + FADE_IN_S);
    gain.connect(ctx.destination);
    const s: Synth = { ctx, out: gain, noise: this.noise!, rnd: this.env.rnd };
    let next = ctx.currentTime + 0.02;
    let timer: unknown;
    let live = true;
    const tick = () => {
      if (!live) return;
      while (next < ctx.currentTime + LOOKAHEAD_S) next += Math.max(0.1, phrase(s, next));
      timer = this.env.setTimer(tick, TICK_MS);
    };
    tick();
    return {
      gain,
      stop: () => {
        live = false;
        this.env.clearTimer(timer);
        gain.disconnect();
      },
    };
  }
}

export const callPlayer = new CallPlayer();
