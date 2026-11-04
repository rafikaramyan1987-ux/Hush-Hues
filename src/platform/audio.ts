/**
 * All sounds are synthesised with WebAudio at runtime (no audio files, no copyrighted material).
 * The AudioContext is only created after the first user gesture.
 */
class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private adMuted = false;

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
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
  }

  isMuted(): boolean {
    return this.muted;
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
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted || this.adMuted ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  private ready(): AudioContext | null {
    if (!this.ctx || !this.master || this.muted || this.adMuted || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, delay = 0, slideTo?: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBurst(dur: number, freq: number, q: number, vol: number, attack = 0.01): void {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  click(): void {
    this.tone(880, 0.05, 'triangle', 0.12);
  }
  snap(): void {
    this.tone(520, 0.06, 'square', 0.06);
    this.tone(1040, 0.05, 'triangle', 0.08, 0.02);
  }
  success(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.16, i * 0.08));
  }
  fail(): void {
    this.tone(220, 0.25, 'sawtooth', 0.08, 0, 110);
  }
  alarm(): void {
    this.tone(740, 0.18, 'square', 0.05);
    this.tone(560, 0.18, 'square', 0.05, 0.2);
  }
  breath(): void {
    this.noiseBurst(1.1, 700, 0.8, 0.07, 0.5);
  }
  hiss(): void {
    this.noiseBurst(0.6, 3000, 0.7, 0.1);
  }
  boom(): void {
    this.tone(90, 0.5, 'sine', 0.3, 0, 40);
    this.noiseBurst(0.4, 300, 0.5, 0.15);
  }
  pop(): void {
    this.tone(660, 0.08, 'sine', 0.15, 0, 1200);
  }
}

export const audio = new Audio();
