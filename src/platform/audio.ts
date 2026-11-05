/**
 * Soft sounds synthesised with WebAudio at runtime (no audio files).
 * The AudioContext is only created after the first user gesture.
 * Each colour has its own note of a major pentatonic scale, so sorting sounds gently musical.
 */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
const BASE = 392; // G4
const noteFreq = (i: number): number => BASE * Math.pow(2, (PENTA[i % PENTA.length] ?? 0) / 12);

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private adMuted = false;
  /** global mute of the platform (CrazyGames setting), on top of the game's own mute button */
  private platformMuted = false;
  private static readonly VOLUME = 0.5;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.adMuted) void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted || this.platformMuted ? 0 : Audio.VOLUME;
      // a gentle low-pass keeps every sound round and soft
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      this.master.connect(lp).connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
  }

  setPlatformMuted(m: boolean): void {
    this.platformMuted = m;
    this.applyGain();
  }

  /** Mute everything while an ad plays (CrazyGames requirement). */
  setAdMuted(m: boolean): void {
    this.adMuted = m;
    this.applyGain();
    if (this.ctx) {
      if (m) void this.ctx.suspend().catch(() => {});
      else void this.ctx.resume().catch(() => {});
    }
  }

  private applyGain(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted || this.adMuted || this.platformMuted ? 0 : Audio.VOLUME, this.ctx.currentTime, 0.02);
  }

  private ready(): AudioContext | null {
    if (!this.ctx || !this.master || this.muted || this.adMuted || this.platformMuted || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private tone(freq: number, dur: number, vol = 0.15, delay = 0, type: OscillatorType = 'sine', slideTo?: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** ball lifted out of a tube */
  lift(color: number): void {
    const f = noteFreq(color);
    this.tone(f * 0.5, 0.18, 0.08, 0, 'sine', f * 0.75);
  }
  /** ball lands in a tube */
  drop(color: number): void {
    const f = noteFreq(color);
    this.tone(f, 0.35, 0.13, 0, 'sine');
    this.tone(f * 2, 0.2, 0.03, 0.005, 'triangle');
  }
  /** move not allowed: a soft, low "boop", never harsh */
  nope(): void {
    this.tone(196, 0.16, 0.07, 0, 'sine', 170);
  }
  /** a tube just got sorted */
  tubeDone(color: number): void {
    const f = noteFreq(color);
    [1, 1.25, 1.5].forEach((m, i) => this.tone(f * m, 0.6, 0.07, i * 0.06));
  }
  win(): void {
    [0, 2, 4, 7, 9, 12].forEach((p, i) => this.tone(523 * Math.pow(2, p / 12), 0.9, 0.08, i * 0.09));
  }
  /** a "?" ball shows its colour */
  reveal(): void {
    this.tone(880, 0.25, 0.05, 0, 'sine', 1320);
  }
  /** ice cracks */
  thaw(): void {
    this.tone(1568, 0.12, 0.04, 0, 'triangle');
    this.tone(1175, 0.18, 0.04, 0.05, 'triangle');
  }
  /** a locked tube opens */
  opened(): void {
    this.tone(659, 0.3, 0.07, 0, 'sine');
    this.tone(988, 0.45, 0.07, 0.1, 'sine');
  }
  tap(): void {
    this.tone(660, 0.07, 0.05, 0, 'triangle');
  }
}

export const audio = new Audio();

/** Optional, very short vibrations (ignored where unsupported). */
export function vibrate(enabled: boolean, pattern: number | number[]): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
