// Web Audio Synthesizer for Echoes of Exploration
// Pure procedural audio engine — zero external audio dependencies, includes live transcripts.

export type AudioChannel = 'sfx' | 'music';

type TranscriptListener = (caption: string) => void;

class TelemetryAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientOscA: OscillatorNode | null = null;
  private ambientOscB: OscillatorNode | null = null;
  private ambientTimer: number | null = null;

  private masterMute = false;
  private sfxVolume = 0.7;
  private musicVolume = 0.45;
  private ambientEnabled = false;
  private showTranscripts = true;
  private listeners = new Set<TranscriptListener>();

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      this.ctx = new AudioCtor();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.syncGains();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  private syncGains(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.masterMute ? 0 : 1, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.musicVolume, now, 0.02);
  }

  public configure(options: {
    masterMute: boolean;
    sfxVolume: number;
    musicVolume: number;
    showAudioTranscripts: boolean;
  }): void {
    this.masterMute = options.masterMute;
    this.sfxVolume = Math.max(0, Math.min(1, options.sfxVolume));
    this.musicVolume = Math.max(0, Math.min(1, options.musicVolume));
    this.showTranscripts = options.showAudioTranscripts;
    this.syncGains();
  }

  public subscribeTranscript(listener: TranscriptListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitTranscript(caption: string): void {
    if (!this.showTranscripts) return;
    const formatted = `[AUDIO: ${caption}]`;
    for (const listener of this.listeners) {
      listener(formatted);
    }
  }

  public isMuted(): boolean {
    return this.masterMute;
  }

  public toggleMute(): boolean {
    this.masterMute = !this.masterMute;
    this.syncGains();
    this.emitTranscript(this.masterMute ? 'Telemetry audio muted' : 'Telemetry audio active');
    return this.masterMute;
  }

  public setAmbientEnabled(enabled: boolean): void {
    this.ambientEnabled = enabled;
    if (!enabled) {
      this.stopAmbient();
      return;
    }
    this.startAmbient();
  }

  private startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain || this.ambientOscA) return;

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const droneGain = ctx.createGain();

    oscA.type = 'sine';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(55, ctx.currentTime);
    oscB.frequency.setValueAtTime(82.41, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(190, ctx.currentTime);

    droneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 1.5);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.musicGain);

    oscA.start();
    oscB.start();
    this.ambientOscA = oscA;
    this.ambientOscB = oscB;

    this.ambientTimer = window.setInterval(() => {
      if (!this.ctx || !this.ambientOscB || !this.ambientEnabled) return;
      const notes = [82.41, 73.42, 65.41, 82.41, 98.0];
      const next = notes[Math.floor(Math.random() * notes.length)];
      this.ambientOscB.frequency.setTargetAtTime(next, this.ctx.currentTime, 0.8);
    }, 5200);
  }

  private stopAmbient(): void {
    if (this.ambientTimer !== null) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    if (this.ambientOscA) {
      try {
        this.ambientOscA.stop();
        this.ambientOscA.disconnect();
      } catch {
        // Ignore already-stopped oscillator
      }
      this.ambientOscA = null;
    }
    if (this.ambientOscB) {
      try {
        this.ambientOscB.stop();
        this.ambientOscB.disconnect();
      } catch {
        // Ignore already-stopped oscillator
      }
      this.ambientOscB = null;
    }
  }

  public playChirp(freq = 640, duration = 0.06, caption?: string): void {
    this.emitTranscript(caption ?? 'Console telemetry chirp');
    if (this.masterMute || this.sfxVolume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.18, now + duration);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  public playSignalLock(): void {
    this.emitTranscript('Verified signal lock acquired (rising harmonic tone)');
    if (this.masterMute || this.sfxVolume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.075;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.21);
    });
  }

  public playSuccessFanfare(): void {
    this.emitTranscript('Mission patch unlocked! Harmonic completion chord');
    if (this.masterMute || this.sfxVolume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.09;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  public playSoftFail(): void {
    this.emitTranscript('Telemetry warning chime — recalibrating');
    if (this.masterMute || this.sfxVolume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.24);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playThruster(duration = 0.14): void {
    this.emitTranscript('Vernier thruster pulse');
    if (this.masterMute || this.sfxVolume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }
}

export const telemetryAudio = new TelemetryAudioEngine();
