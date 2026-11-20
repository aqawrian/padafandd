/**
 * Ultra-Stable Procedural Web Audio API Sound & Dynamic Epic Cinematic Soundtrack Engine
 * for Air Shield (پدافند هوایی)
 *
 * Crash-Proof Guarantees:
 * - Hard active voice cap (MAX_ACTIVE_VOICES) prevents audio-thread saturation in swarm waves
 * - Every finished Oscillator/BufferSource explicitly disconnects its entire node chain on 'ended'
 * - Max 1 scheduled music step per tick (never loop-bursts after tab switch or GC pause)
 * - Auto-pauses music scheduling when document.hidden is true
 * - All AudioParam timestamps strictly clamped to >= ctx.currentTime + 0.005
 * - Pre-allocated shared white & dark-rumble noise buffers (zero runtime AudioBuffer allocations)
 */

export type MusicMode = 'prep' | 'combat' | 'boss';

const NOTE_FREQ: Record<string, number> = {
  D1: 36.71,
  F1: 43.65,
  G1: 49.0,
  A1: 55.0,
  Bb1: 58.27,
  C2: 65.41,
  D2: 73.42,
  Eb2: 77.78,
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  Bb2: 116.54,
  C3: 130.81,
  D3: 146.83,
  Eb3: 155.56,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  D5: 587.33,
};

const COMBAT_BASS_PATTERN = [
  'D2', 'D2', 'D2', 'F2',
  'D2', 'D2', 'C2', 'D2',
  'Bb1', 'Bb1', 'C2', 'D2',
  'A1', 'A1', 'C2', 'E3',
];

const BOSS_BASS_PATTERN = [
  'D2', 'Eb2', 'D2', 'D2',
  'F2', 'D2', 'Eb2', 'C2',
  'Bb1', 'D2', 'Eb2', 'F2',
  'A1', 'A1', 'Eb2', 'A1',
];

const CHORD_PROGRESSION: string[][] = [
  ['D3', 'F3', 'A3'],
  ['Bb2', 'D3', 'F3'],
  ['G2', 'Bb2', 'D3'],
  ['A2', 'E3', 'A3'],
];

const MAX_ACTIVE_VOICES = 24;

class SoundManager {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private darkNoiseBuffer: AudioBuffer | null = null;
  private lastPlayed: Record<string, number> = {};
  private activeVoices = 0;

  private _sfxEnabled = true;
  private _musicEnabled = true;
  private musicMode: MusicMode = 'prep';
  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private barIndex = 0;

  get enabled(): boolean {
    return this._sfxEnabled;
  }

  set enabled(val: boolean) {
    this._sfxEnabled = val;
    if (this.sfxBus && this.ctx) {
      try {
        this.sfxBus.gain.setTargetAtTime(val ? 0.72 : 0.0001, this.ctx.currentTime, 0.04);
      } catch {
        // ignore
      }
    }
  }

  get musicEnabled(): boolean {
    return this._musicEnabled;
  }

  setMusicEnabled(val: boolean) {
    this._musicEnabled = val;
    if (val) {
      this.unlock();
    }
    if (this.musicBus && this.ctx) {
      try {
        this.musicBus.gain.setTargetAtTime(val ? 0.24 : 0.0001, this.ctx.currentTime, 0.12);
      } catch {
        // ignore
      }
    }
  }

  setMusicMode(mode: MusicMode) {
    this.musicMode = mode;
  }

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.startMusicScheduler();
  }

  private ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();

        // Clean master gain with generous headroom (lighter & more stable than DynamicsCompressor)
        const master = this.ctx.createGain();
        master.gain.setValueAtTime(0.85, this.ctx.currentTime);
        master.connect(this.ctx.destination);

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.setValueAtTime(this._sfxEnabled ? 0.72 : 0.0001, this.ctx.currentTime);
        this.sfxBus.connect(master);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.setValueAtTime(this._musicEnabled ? 0.24 : 0.0001, this.ctx.currentTime);
        this.musicBus.connect(master);

        // Pre-allocate shared white noise buffer (0.9s)
        const noiseLen = Math.floor(this.ctx.sampleRate * 0.9);
        const wBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
        const wCh = wBuf.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) {
          wCh[i] = Math.random() * 2 - 1;
        }
        this.whiteNoiseBuffer = wBuf;

        // Pre-allocate shared low-rumble noise buffer (0.9s)
        const dBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
        const dCh = dBuf.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < noiseLen; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.08 * white) / 1.08;
          dCh[i] = Math.max(-1, Math.min(1, lastOut * 3.0));
        }
        this.darkNoiseBuffer = dBuf;
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getSfxContext(): { ctx: AudioContext; out: GainNode } | null {
    if (!this._sfxEnabled) return null;
    if (this.activeVoices >= MAX_ACTIVE_VOICES) return null;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus || ctx.state !== 'running') return null;
    return { ctx, out: this.sfxBus };
  }

  private allowPlay(key: string, minIntervalMs: number): boolean {
    const nowMs = performance.now();
    const prev = this.lastPlayed[key] ?? 0;
    if (nowMs - prev < minIntervalMs) return false;
    this.lastPlayed[key] = nowMs;
    return true;
  }

  // Track voice count and guarantee full AudioNode disconnect when finished (ZERO audio graph leaks!)
  private trackVoice(source: AudioScheduledSourceNode, nodesToDisconnect: AudioNode[]) {
    this.activeVoices++;
    let cleaned = false;
    source.onended = () => {
      if (cleaned) return;
      cleaned = true;
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      for (let i = 0; i < nodesToDisconnect.length; i++) {
        try {
          nodesToDisconnect[i].disconnect();
        } catch {
          // already disconnected
        }
      }
    };
  }

  // =========================================================================
  // ADAPTIVE CINEMATIC SCORE SCHEDULER (Max 1 Step/Tick — Never Bursts!)
  // =========================================================================
  private startMusicScheduler() {
    if (this.schedulerTimer !== null || !this.ctx) return;
    this.nextStepTime = this.ctx.currentTime + 0.1;

    this.schedulerTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus) return;
      if (document.hidden || this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;
      const bpm = this.musicMode === 'boss' ? 130 : this.musicMode === 'combat' ? 116 : 84;
      const sixteenthDur = 60 / bpm / 4;

      // If behind due to pause/tab-switch, snap forward cleanly (NEVER burst-loop!)
      if (this.nextStepTime < now - 0.15) {
        this.nextStepTime = now + 0.04;
      }

      if (this.nextStepTime < now + 0.16) {
        if (this._musicEnabled && this.activeVoices < MAX_ACTIVE_VOICES - 4) {
          const t = Math.max(now + 0.01, this.nextStepTime);
          this.scheduleMusicStep(this.currentStep, this.barIndex, t);
        }
        this.nextStepTime += sixteenthDur;
        this.currentStep = (this.currentStep + 1) % 16;
        if (this.currentStep === 0) {
          this.barIndex = (this.barIndex + 1) % 4;
        }
      }
    }, 65);
  }

  private scheduleMusicStep(step: number, bar: number, time: number) {
    const ctx = this.ctx;
    const out = this.musicBus;
    if (!ctx || !out) return;

    try {
      const mode = this.musicMode;
      const chord = CHORD_PROGRESSION[bar % CHORD_PROGRESSION.length];

      // 1. Atmospheric Dark Cinematic Pad / Brass Swell on bar start (step 0)
      if (step === 0) {
        const padDur = mode === 'prep' ? 2.4 : mode === 'combat' ? 1.7 : 1.5;
        const padGainLevel = mode === 'prep' ? 0.13 : mode === 'combat' ? 0.14 : 0.18;
        // 2-voice rich chord (root + 5th/3rd) keeps voice budget lean and warm
        const notes = [chord[0], chord[2]];
        notes.forEach((noteName, idx) => {
          const freq = NOTE_FREQ[noteName];
          if (!freq) return;
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc.type = mode === 'prep' ? 'triangle' : 'sawtooth';
          osc.frequency.setValueAtTime(freq, time);
          osc.detune.setValueAtTime(idx === 0 ? -5 : 5, time);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(mode === 'prep' ? 400 : 580, time);
          filter.frequency.linearRampToValueAtTime(
            mode === 'boss' ? 1500 : mode === 'combat' ? 1050 : 620,
            time + padDur * 0.45
          );
          filter.frequency.exponentialRampToValueAtTime(300, time + padDur);

          gain.gain.setValueAtTime(0.001, time);
          gain.gain.linearRampToValueAtTime(padGainLevel * 0.55, time + padDur * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, time + padDur);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(out);

          this.trackVoice(osc, [osc, filter, gain]);
          osc.start(time);
          osc.stop(time + padDur + 0.03);
        });
      }

      // 2. Prep Mode: Calm Tactical Sub-Pulse & Soft Sonar Chime
      if (mode === 'prep') {
        if (step === 0 || step === 8) {
          this.scheduleSubPulse(ctx, out, bar === 1 ? NOTE_FREQ.Bb1 : NOTE_FREQ.D1, time, 0.75, 0.22);
        }
        if ((step === 4 && bar % 2 === 0) || (step === 12 && bar === 2)) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(step === 4 ? NOTE_FREQ.A4 : NOTE_FREQ.D5, time);
          gain.gain.setValueAtTime(0.001, time);
          gain.gain.linearRampToValueAtTime(0.045, time + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
          osc.connect(gain);
          gain.connect(out);
          this.trackVoice(osc, [osc, gain]);
          osc.start(time);
          osc.stop(time + 0.64);
        }
        return;
      }

      // 3. Combat & Boss Mode: Pulsing Tactical Bassline
      const bassPattern = mode === 'boss' ? BOSS_BASS_PATTERN : COMBAT_BASS_PATTERN;
      const playBass = mode === 'boss' ? step % 2 === 0 || step === 3 || step === 15 : step % 2 === 0;
      if (playBass) {
        const bassNote = bassPattern[step];
        const freq = NOTE_FREQ[bassNote] ?? NOTE_FREQ.D2;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.Q.setValueAtTime(2.6, time);
        filter.frequency.setValueAtTime(mode === 'boss' ? 920 : 680, time);
        filter.frequency.exponentialRampToValueAtTime(160, time + 0.13);

        gain.gain.setValueAtTime(mode === 'boss' ? 0.2 : 0.16, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, filter, gain]);
        osc.start(time);
        osc.stop(time + 0.16);
      }

      // 4. Cinematic War Drums (Taiko Kick & Rim Ticks)
      const isHeavyKick = step === 0 || step === 6 || step === 10 || (mode === 'boss' && step === 14);
      if (isHeavyKick) {
        this.scheduleWarDrum(ctx, out, time, step === 0 ? 1.0 : 0.72);
      }

      const isSnareHit = step === 4 || step === 12;
      if (isSnareHit) {
        this.scheduleMetallicTick(ctx, out, time, 0.14, 1500);
      }

      // 5. Boss / Combat Brass Stabs
      if (mode === 'boss' && (step === 0 || step === 8)) {
        const leadNotes = ['D4', 'Eb3', 'F4', 'A3'];
        const freq = NOTE_FREQ[leadNotes[bar % leadNotes.length]] ?? NOTE_FREQ.D4;
        this.scheduleBrassStab(ctx, out, freq, time, 0.28, 0.13);
      } else if (mode === 'combat' && step === 8 && bar % 2 === 1) {
        this.scheduleBrassStab(ctx, out, NOTE_FREQ.A3, time, 0.32, 0.09);
      }
    } catch {
      // ignore transient audio errors
    }
  }

  private scheduleSubPulse(ctx: AudioContext, out: GainNode, freq: number, time: number, dur: number, level: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(out);
    this.trackVoice(osc, [osc, gain]);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private scheduleWarDrum(ctx: AudioContext, out: GainNode, time: number, strength: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(112, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.2);

    gain.gain.setValueAtTime(0.34 * strength, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

    osc.connect(gain);
    gain.connect(out);
    this.trackVoice(osc, [osc, gain]);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private scheduleMetallicTick(ctx: AudioContext, out: GainNode, time: number, level: number, freq: number) {
    if (!this.whiteNoiseBuffer) return;
    const n = ctx.createBufferSource();
    n.buffer = this.whiteNoiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, time);
    f.Q.setValueAtTime(2.2, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.065);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    this.trackVoice(n, [n, f, g]);
    n.start(time);
    n.stop(time + 0.075);
  }

  private scheduleBrassStab(ctx: AudioContext, out: GainNode, freq: number, time: number, dur: number, level: number) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, time);
    filter.frequency.linearRampToValueAtTime(1950, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(480, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    this.trackVoice(osc, [osc, filter, gain]);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  // =========================================================================
  // LAYERED MILITARY SFX (Voice-Capped + Auto-Disconnecting + Throttled)
  // =========================================================================

  // 1. CIWS Rotary Vulcan Cannon Burst
  playGatling() {
    if (!this.allowPlay('gatling', 62)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(165 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.065);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(980, now);
      filter.Q.setValueAtTime(2.2, now);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.004, now + 0.07);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      this.trackVoice(osc, [osc, filter, gain]);
      osc.start(now);
      osc.stop(now + 0.076);
    } catch {
      // ignore
    }
  }

  // 2. Layered SAM Missile Launch (Ignition Thump + Rocket Motor Whoosh)
  playMissileLaunch(heavy = false) {
    if (!this.allowPlay(heavy ? 'missileHeavy' : 'missile', heavy ? 120 : 95)) return;
    const bus = this.getSfxContext();
    if (!bus || !this.whiteNoiseBuffer) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const dur = heavy ? 0.38 : 0.28;

      const pop = ctx.createOscillator();
      const popGain = ctx.createGain();
      pop.type = 'triangle';
      pop.frequency.setValueAtTime(heavy ? 120 : 185, now);
      pop.frequency.exponentialRampToValueAtTime(38, now + 0.085);
      popGain.gain.setValueAtTime(heavy ? 0.24 : 0.14, now);
      popGain.gain.exponentialRampToValueAtTime(0.004, now + 0.095);
      pop.connect(popGain);
      popGain.connect(out);
      this.trackVoice(pop, [pop, popGain]);
      pop.start(now);
      pop.stop(now + 0.105);

      const noise = ctx.createBufferSource();
      noise.buffer = heavy && this.darkNoiseBuffer ? this.darkNoiseBuffer : this.whiteNoiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(heavy ? 240 : 420, now);
      filter.frequency.exponentialRampToValueAtTime(heavy ? 950 : 1450, now + dur * 0.85);
      filter.Q.setValueAtTime(1.4, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(heavy ? 0.24 : 0.16, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.004, now + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      this.trackVoice(noise, [noise, filter, gain]);
      noise.start(now);
      noise.stop(now + dur + 0.02);
    } catch {
      // ignore
    }
  }

  // 3. Multi-Layer Explosion (Sub Pressure Drop + Fiery Rumble)
  playExplosion(scale = 1.0) {
    const isHeavy = scale >= 1.5;
    if (!this.allowPlay(isHeavy ? 'explosionHeavy' : 'explosion', isHeavy ? 130 : 95)) return;
    const bus = this.getSfxContext();
    if (!bus || !this.darkNoiseBuffer) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const dur = isHeavy ? 0.65 : 0.36;

      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(isHeavy ? 88 : 115, now);
      sub.frequency.exponentialRampToValueAtTime(24, now + dur * 0.85);
      subGain.gain.setValueAtTime(isHeavy ? 0.36 : 0.24, now);
      subGain.gain.exponentialRampToValueAtTime(0.004, now + dur);
      sub.connect(subGain);
      subGain.connect(out);
      this.trackVoice(sub, [sub, subGain]);
      sub.start(now);
      sub.stop(now + dur + 0.02);

      const rumble = ctx.createBufferSource();
      rumble.buffer = this.darkNoiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isHeavy ? 780 : 580, now);
      lp.frequency.exponentialRampToValueAtTime(75, now + dur);
      const rg = ctx.createGain();
      rg.gain.setValueAtTime(isHeavy ? 0.32 : 0.21, now);
      rg.gain.exponentialRampToValueAtTime(0.004, now + dur);
      rumble.connect(lp);
      lp.connect(rg);
      rg.connect(out);
      this.trackVoice(rumble, [rumble, lp, rg]);
      rumble.start(now);
      rumble.stop(now + dur + 0.02);
    } catch {
      // ignore
    }
  }

  // 4. Strategic Vertical Cold-Launch Heavy SAM Ignition (S-400 / THAAD)
  playHeavySamLaunch() {
    if (!this.allowPlay('heavy_sam', 150)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;

      // Vertical cold-launch pneumatic canister pop
      const pop = ctx.createOscillator();
      const popGain = ctx.createGain();
      pop.type = 'triangle';
      pop.frequency.setValueAtTime(165, now);
      pop.frequency.exponentialRampToValueAtTime(36, now + 0.22);
      popGain.gain.setValueAtTime(0.36, now);
      popGain.gain.exponentialRampToValueAtTime(0.004, now + 0.25);
      pop.connect(popGain);
      popGain.connect(out);
      this.trackVoice(pop, [pop, popGain]);
      pop.start(now);
      pop.stop(now + 0.27);

      // Supersonic booster motor ignition roar (delayed 55ms after cold-launch pop)
      if (this.darkNoiseBuffer) {
        const roar = ctx.createBufferSource();
        roar.buffer = this.darkNoiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1450, now + 0.05);
        bp.frequency.exponentialRampToValueAtTime(340, now + 0.48);
        bp.Q.setValueAtTime(0.85, now + 0.05);
        const rGain = ctx.createGain();
        rGain.gain.setValueAtTime(0.001, now);
        rGain.gain.linearRampToValueAtTime(0.34, now + 0.075);
        rGain.gain.exponentialRampToValueAtTime(0.004, now + 0.52);
        roar.connect(bp);
        bp.connect(rGain);
        rGain.connect(out);
        this.trackVoice(roar, [roar, bp, rGain]);
        roar.start(now + 0.04);
        roar.stop(now + 0.55);
      }

      // High-altitude supersonic crackle
      if (this.whiteNoiseBuffer) {
        const hiss = ctx.createBufferSource();
        hiss.buffer = this.whiteNoiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2200, now + 0.05);
        const hGain = ctx.createGain();
        hGain.gain.setValueAtTime(0.001, now);
        hGain.gain.linearRampToValueAtTime(0.14, now + 0.08);
        hGain.gain.exponentialRampToValueAtTime(0.003, now + 0.34);
        hiss.connect(hp);
        hp.connect(hGain);
        hGain.connect(out);
        this.trackVoice(hiss, [hiss, hp, hGain]);
        hiss.start(now + 0.05);
        hiss.stop(now + 0.36);
      }
    } catch {
      // ignore
    }
  }

  // 5. Tactical Radar Wave-Start Ping
  playRadarPing() {
    if (!this.allowPlay('radar', 200)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      [1320, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.055;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.004, t + 0.22);
        osc.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, gain]);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch {
      // ignore
    }
  }

  // 6. Base Hit Impact & Klaxon Warning
  playBaseHit() {
    if (!this.allowPlay('baseHit', 170)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(370, now + 0.14);
      osc.frequency.linearRampToValueAtTime(145, now + 0.28);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.004, now + 0.3);
      osc.connect(gain);
      gain.connect(out);
      this.trackVoice(osc, [osc, gain]);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // ignore
    }
  }

  // 7. Tower Placement (Hydraulic Metallic Lock + Tactical Chirp)
  playBuild() {
    if (!this.allowPlay('build', 80)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const clunk = ctx.createOscillator();
      const cg = ctx.createGain();
      clunk.type = 'triangle';
      clunk.frequency.setValueAtTime(160, now);
      clunk.frequency.exponentialRampToValueAtTime(55, now + 0.08);
      cg.gain.setValueAtTime(0.22, now);
      cg.gain.exponentialRampToValueAtTime(0.004, now + 0.09);
      clunk.connect(cg);
      cg.connect(out);
      this.trackVoice(clunk, [clunk, cg]);
      clunk.start(now);
      clunk.stop(now + 0.095);

      const beep = ctx.createOscillator();
      const bg = ctx.createGain();
      beep.type = 'sine';
      beep.frequency.setValueAtTime(480, now + 0.04);
      beep.frequency.exponentialRampToValueAtTime(920, now + 0.14);
      bg.gain.setValueAtTime(0.11, now + 0.04);
      bg.gain.exponentialRampToValueAtTime(0.004, now + 0.16);
      beep.connect(bg);
      bg.connect(out);
      this.trackVoice(beep, [beep, bg]);
      beep.start(now + 0.04);
      beep.stop(now + 0.17);
    } catch {
      // ignore
    }
  }

  // 8. Tower Hardware Upgrade Chord
  playUpgrade(newLevel: number) {
    if (!this.allowPlay('upgrade', 95)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const notes = newLevel >= 3 ? [440, 587.33, 880, 1174.66] : [392, 523.25, 783.99];
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.045;
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.004, t + 0.22);
        osc.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, gain]);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch {
      // ignore
    }
  }

  // 9. Commander EMP Shockwave Pulse
  playEmpPulse() {
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(840, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.58);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.004, now + 0.62);
      osc.connect(gain);
      gain.connect(out);
      this.trackVoice(osc, [osc, gain]);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // ignore
    }
  }

  // 10. Commander Emergency Repair & Overdrive Chime
  playRepairBoost() {
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.004, t + 0.3);
        osc.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, gain]);
        osc.start(t);
        osc.stop(t + 0.32);
      });
    } catch {
      // ignore
    }
  }

  // 11. Cinematic Boss Arrival Horn (Deep Epic BRAAAM!)
  playBossHorn() {
    if (!this.allowPlay('bossHorn', 2500)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      [55, 73.42].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(i === 0 ? -8 : 8, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, now);
        filter.frequency.linearRampToValueAtTime(920, now + 0.32);
        filter.frequency.exponentialRampToValueAtTime(180, now + 1.4);

        gain.gain.setValueAtTime(0.002, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.003, now + 1.45);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);

        this.trackVoice(osc, [osc, filter, gain]);
        osc.start(now);
        osc.stop(now + 1.5);
      });
    } catch {
      // ignore
    }
  }

  // 12. Heroic Stage Victory Fanfare
  playVictoryFanfare() {
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const fanfare = [
        { f: 293.66, t: 0, d: 0.2 },
        { f: 369.99, t: 0.16, d: 0.2 },
        { f: 440.0, t: 0.32, d: 0.22 },
        { f: 587.33, t: 0.48, d: 0.65 },
      ];
      fanfare.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1850, now + t);
        gain.gain.setValueAtTime(0.002, now + t);
        gain.gain.linearRampToValueAtTime(0.16, now + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.003, now + t + d);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, filter, gain]);
        osc.start(now + t);
        osc.stop(now + t + d + 0.04);
      });
    } catch {
      // ignore
    }
  }

  // 13. Solemn Defeat Brass Chord
  playDefeatHorn() {
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      [220, 196, 174.61, 146.83].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const t = now + idx * 0.2;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(720, t);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.003, t + 0.4);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, filter, gain]);
        osc.start(t);
        osc.stop(t + 0.44);
      });
    } catch {
      // ignore
    }
  }

  // 14. Precision Airstrike Jet Flyby + Triple Warhead Sonic Boom
  playAirstrike() {
    if (!this.allowPlay('airstrike', 350)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;

      // Supersonic jet pass noise sweep
      if (this.whiteNoiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.whiteNoiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600, now);
        filter.frequency.exponentialRampToValueAtTime(240, now + 0.65);
        filter.Q.setValueAtTime(1.4, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.003, now);
        gain.gain.linearRampToValueAtTime(0.26, now + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.003, now + 0.7);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        this.trackVoice(src, [src, filter, gain]);
        src.start(now);
        src.stop(now + 0.72);
      }

      // Staggered sub-bass impact thumps
      [0.18, 0.34, 0.5].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(135, now + offset);
        osc.frequency.exponentialRampToValueAtTime(34, now + offset + 0.32);
        gain.gain.setValueAtTime(0.24, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.003, now + offset + 0.36);

        osc.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, gain]);
        osc.start(now + offset);
        osc.stop(now + offset + 0.38);
      });
    } catch {
      // ignore
    }
  }

  // 15. Tech Lab Permanent Upgrade Unlock Chime
  playTechUnlock() {
    if (!this.allowPlay('tech', 120)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.002, t + 0.24);
        osc.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, gain]);
        osc.start(t);
        osc.stop(t + 0.26);
      });
    } catch {
      // ignore
    }
  }

  // 16. Scramble CAP Friendly Fighter Squadron Afterburner Launch
  playJetScramble() {
    if (!this.allowPlay('jet_scramble', 400)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;

      // Twin-jet turbine rising whine
      [420, 630].forEach((baseFreq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.08;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.15, t + 0.45);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, t + 0.85);
        gain.gain.setValueAtTime(0.002, t);
        gain.gain.linearRampToValueAtTime(0.07, t + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.002, t + 0.88);
        osc.connect(gain);
        gain.connect(out);
        this.trackVoice(osc, [osc, gain]);
        osc.start(t);
        osc.stop(t + 0.9);
      });

      // Afterburner roar wash
      if (this.whiteNoiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.whiteNoiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(620, now);
        filter.frequency.exponentialRampToValueAtTime(2200, now + 0.35);
        filter.frequency.exponentialRampToValueAtTime(420, now + 0.88);
        filter.Q.setValueAtTime(1.1, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.004, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.003, now + 0.88);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        this.trackVoice(src, [src, filter, gain]);
        src.start(now);
        src.stop(now + 0.9);
      }
    } catch {
      // ignore
    }
  }

  // 17. Enemy Countermeasure Thermal Flare Ejection Pop + Sizzle
  playFlarePop() {
    if (!this.allowPlay('flare_pop', 110)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;

      // Crisp pyrotechnic pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.075);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.09);
      osc.connect(gain);
      gain.connect(out);
      this.trackVoice(osc, [osc, gain]);
      osc.start(now);
      osc.stop(now + 0.1);

      // Brief magnesium burn hiss
      if (this.whiteNoiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.whiteNoiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2800, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.09, now);
        nGain.gain.exponentialRampToValueAtTime(0.002, now + 0.22);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        this.trackVoice(src, [src, filter, nGain]);
        src.start(now);
        src.stop(now + 0.24);
      }
    } catch {
      // ignore
    }
  }

  // 18. Secondary Crashing Wreckage Ground / Water Impact Boom
  playGroundCrash(heavy = false) {
    if (!this.allowPlay('ground_crash', 140)) return;
    const bus = this.getSfxContext();
    if (!bus) return;
    const { ctx, out } = bus;
    try {
      const now = ctx.currentTime + 0.005;
      const dur = heavy ? 0.72 : 0.46;

      // Deep seismic thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(heavy ? 95 : 120, now);
      osc.frequency.exponentialRampToValueAtTime(26, now + dur);
      gain.gain.setValueAtTime(heavy ? 0.34 : 0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.003, now + dur);
      osc.connect(gain);
      gain.connect(out);
      this.trackVoice(osc, [osc, gain]);
      osc.start(now);
      osc.stop(now + dur + 0.04);

      // Fiery debris rumble
      if (this.darkNoiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.darkNoiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(heavy ? 680 : 920, now);
        filter.frequency.exponentialRampToValueAtTime(160, now + dur);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(heavy ? 0.3 : 0.2, now);
        nGain.gain.exponentialRampToValueAtTime(0.003, now + dur);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        this.trackVoice(src, [src, filter, nGain]);
        src.start(now);
        src.stop(now + dur + 0.04);
      }
    } catch {
      // ignore
    }
  }
}

export const soundManager = new SoundManager();
