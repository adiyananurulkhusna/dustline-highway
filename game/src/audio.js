// Dustline Highway — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, gunshots, punches, sirens, cash, and a dusty desert tune.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.muted = false;
    this.musicStep = 0;
  }

  // Must be called from a user gesture (or a click) before any sound plays.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noise(0.12, 0.5, 2500); this.tone(180, 0.08, 'square', 0.25, 60); }
  punch() { this.noise(0.08, 0.35, 700); }
  crash() { this.noise(0.3, 0.5, 500); this.tone(90, 0.25, 'sawtooth', 0.2, 40); }
  cash() { this.tone(880, 0.09, 'sine', 0.25); setTimeout(() => this.tone(1318, 0.14, 'sine', 0.25), 90); }
  pickup() { this.tone(660, 0.08, 'sine', 0.22); setTimeout(() => this.tone(990, 0.1, 'sine', 0.22), 70); }
  siren() { this.tone(750, 0.35, 'sine', 0.12, 950); }
  busted() { this.tone(220, 0.5, 'sawtooth', 0.25, 110); }
  door() { this.noise(0.06, 0.2, 900); }
  missionStart() { this.tone(523, 0.12, 'triangle', 0.25); setTimeout(() => this.tone(784, 0.2, 'triangle', 0.25), 120); }

  startEngine() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = g;
  }

  setEngine(speed01, on) {
    if (!this.engineOsc || !this.ctx) return;
    const target = on ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, this.ctx.currentTime, 0.08);
  }

  // A slow, dusty desert tune: minor pentatonic plucks over a low drone.
  startMusic() {
    const scale = [110, 130.8, 146.8, 164.8, 196, 220, 261.6];
    const melody = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 3, 5, 6, 5, 3, 2];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || document.hidden) return;
      const note = melody[this.musicStep % melody.length];
      this.musicStep++;
      if (this.musicStep % 4 === 1) this.tone(55, 0.9, 'sine', 0.12);
      if (note !== undefined && this.musicStep % 2 === 0) {
        this.tone(scale[note], 0.5, 'triangle', 0.1);
      }
    }, 340);
  }
}
