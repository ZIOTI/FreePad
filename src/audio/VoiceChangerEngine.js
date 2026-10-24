/**
 * FreePad VoiceChangerEngine — Studio-Grade Real-Time Voice Morphing
 * Fait par zioti
 *
 * Implements:
 *   - Constant-Power 3-Tap Granular Pitch Shifter (Zero Flutter, Zero Dropouts, Low Latency)
 *   - Auto-Tune Travis Scott / PNL (Chromatic Pitch Snap 0 ms + Stereo Space Delay + High Shelf)
 *   - Robot / Vocoder Daft Punk (Dual-Carrier A2/E3 Analog Synth + Sibilance Preservation)
 *   - Démon des Abysses (-8.5 Semitones + Sub-Octave Layer + 85Hz Sub-Bass + Tube Saturation)
 *   - Hélium / Lutin (+9.5 Semitones + Formant Reshaping + 380Hz Low-Cut + Presence Boost)
 *   - Mégaphone de Police (Acoustic Horn Bandpass + Slapback Reflection + Diode Saturation)
 *   - Talkie-Walkie Militaire (Tactical Radio Bandpass + Compression + Roger Beep static burst)
 *   - Isolated Discord Broadcast via Virtual Cable / Voicemod Virtual Audio Device (Zero-Feedback Guarantee)
 */

import soundEngine from './SoundEngine';

export const VOICE_PRESETS = {
  none: {
    id: 'none',
    name: 'Voix Naturelle',
    icon: '🎙️',
    badge: 'Bypass',
    color: 'from-slate-700 to-slate-800',
    description: 'Voix originale claire sans aucun effet'
  },
  autotune: {
    id: 'autotune',
    name: 'Travis Scott / PNL',
    icon: '🎤',
    badge: 'Auto-Tune',
    color: 'from-amber-500 via-orange-500 to-red-600',
    description: 'Snap chromatique dur instantané (0 ms) + Reverb studio spatiale'
  },
  robot: {
    id: 'robot',
    name: 'Robot / Vocoder',
    icon: '🤖',
    badge: 'Daft Punk',
    color: 'from-cyan-500 to-blue-600',
    description: 'Synthé accordé A2/E3 + suivi d\'enveloppe vocal & sibilance'
  },
  demon: {
    id: 'demon',
    name: 'Démon des Abysses',
    icon: '😈',
    badge: '-1 Octave',
    color: 'from-red-600 via-rose-700 to-purple-900',
    description: 'Pitch descendu (-8.5 st) + sous-octave + sub-bass 85Hz & saturation tube'
  },
  helium: {
    id: 'helium',
    name: 'Hélium / Lutin',
    icon: '🎈',
    badge: '+1 Octave',
    color: 'from-pink-500 via-purple-500 to-indigo-500',
    description: 'Voix aiguë (+9.5 st) + formants accélérés & coupe-bas 380Hz'
  },
  megaphone: {
    id: 'megaphone',
    name: 'Mégaphone de Police',
    icon: '📢',
    badge: 'Pavillon',
    color: 'from-yellow-500 to-amber-600',
    description: 'Pavillon résonant 1.25kHz, écho de rue 22ms & distorsion mégaphone'
  },
  walkie: {
    id: 'walkie',
    name: 'Talkie-Walkie Militaire',
    icon: '📻',
    badge: 'Radio Tactique',
    color: 'from-emerald-600 to-teal-800',
    description: 'Bande passante radio VHF, compression & bip "Roger" au relâchement'
  }
};

// Inlined AudioWorklet Processor Source Code
const WORKLET_PROCESSOR_CODE = `
class VoiceFXProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 4 }, // 0: bypass, 1: pitch, 2: robot, 3: autotune
      { name: 'pitchRatio', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 },
      { name: 'preserveFormants', defaultValue: 1.0, minValue: 0.0, maxValue: 1.0 }
    ];
  }

  constructor() {
    super();
    this.sampleRate = 48000;
    this.bufferSize = 16384;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;

    // Grain size: 1536 samples (~32ms at 48kHz)
    this.grainSize = 1536;
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.grainSize));
    }

    // 3 equidistant Hann window taps spaced at 120 degrees for constant-power summing
    this.phase0 = 0.0;
    this.phase1 = this.grainSize / 3.0;
    this.phase2 = (2.0 * this.grainSize) / 3.0;

    // Robot vocoder dual-carrier state
    this.oscPhaseA = 0.0;
    this.oscPhaseB = 0.0;
    this.vocalEnv = 0.0;
    this.lpVoice = 0.0;

    // Auto-tune AMDF pitch tracking state
    this.atRatio = 1.0;
    this.atCounter = 0;
    this.historyBuffer = new Float32Array(2048);
    this.historyWrite = 0;
  }

  detectPitchAMDF() {
    const sr = this.sampleRate;
    const minP = Math.floor(sr / 480);
    const maxP = Math.floor(sr / 80);
    let bestP = 0;
    let minD = Infinity;

    const hist = this.historyBuffer;
    const hLen = hist.length;
    const startIdx = (this.historyWrite - 768 + hLen) % hLen;

    for (let tau = minP; tau <= maxP; tau += 2) {
      let diff = 0;
      for (let i = 0; i < 320; i += 2) {
        const idxA = (startIdx + i) % hLen;
        const idxB = (startIdx + i + tau) % hLen;
        diff += Math.abs(hist[idxA] - hist[idxB]);
      }
      if (diff < minD) {
        minD = diff;
        bestP = tau;
      }
    }

    if (minD > 50 || bestP === 0) return 0;
    return sr / bestP;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inChannel = input[0];
    const outChannel = output[0];
    const len = inChannel.length;

    const mode = Math.round(parameters.mode ? parameters.mode[0] : 0);
    const targetRatio = parameters.pitchRatio ? parameters.pitchRatio[0] : 1.0;

    // Mode 0: Pure bypass
    if (mode === 0) {
      outChannel.set(inChannel);
      return true;
    }

    // Mode 2: Daft Punk Robot Vocoder (Dual-Carrier Synth + Sibilance Preservation)
    if (mode === 2) {
      const sr = this.sampleRate;
      const freqA = 110.0;  // Note A2 fundamental
      const freqB = 164.81; // Note E3 musical fifth

      for (let i = 0; i < len; i++) {
        const inS = inChannel[i];
        this.oscPhaseA = (this.oscPhaseA + freqA / sr) % 1.0;
        this.oscPhaseB = (this.oscPhaseB + freqB / sr) % 1.0;

        const saw = (this.oscPhaseA * 2.0) - 1.0;
        const pulse = (this.oscPhaseB < 0.5 ? 0.45 : -0.45);
        const carrier = saw * 0.65 + pulse * 0.35;

        this.vocalEnv = this.vocalEnv * 0.95 + Math.abs(inS) * 0.05;
        this.lpVoice = this.lpVoice * 0.86 + inS * 0.14;
        const sibilance = inS - this.lpVoice;

        outChannel[i] = carrier * this.vocalEnv * 3.0 + sibilance * 0.35;
      }
      return true;
    }

    // Record into history buffer for pitch detection
    for (let i = 0; i < len; i++) {
      this.historyBuffer[this.historyWrite] = inChannel[i];
      this.historyWrite = (this.historyWrite + 1) % this.historyBuffer.length;
    }

    // Mode 3: Auto-Tune Pitch Tracking & Snap
    let effRatio = targetRatio;
    if (mode === 3) {
      this.atCounter += len;
      if (this.atCounter >= 160) {
        this.atCounter = 0;
        const pitch = this.detectPitchAMDF();
        if (pitch >= 80 && pitch <= 520) {
          const semitones = 12.0 * Math.log2(pitch / 440.0);
          const snapped = Math.round(semitones);
          const targetHz = 440.0 * Math.pow(2.0, snapped / 12.0);
          this.atRatio = targetHz / pitch;
        } else {
          this.atRatio = 1.0;
        }
      }
      effRatio = this.atRatio;
    }

    // Constant-Power 3-Tap Granular Pitch Shifter
    const buf = this.buffer;
    const bSize = this.bufferSize;
    const gSize = this.grainSize;
    const win = this.window;
    const rate = effRatio;
    const norm = 2.0 / 3.0;

    for (let i = 0; i < len; i++) {
      buf[this.writePos] = inChannel[i];

      // Tap 0
      const d0 = (gSize / 2) + this.phase0 * (1.0 - rate);
      let r0 = this.writePos - d0;
      while (r0 < 0) r0 += bSize;
      while (r0 >= bSize) r0 -= bSize;
      const i0 = Math.floor(r0);
      const f0 = r0 - i0;
      const s0 = buf[i0] * (1.0 - f0) + buf[(i0 + 1) % bSize] * f0;
      const w0 = win[Math.floor(this.phase0) % gSize];

      // Tap 1
      const d1 = (gSize / 2) + this.phase1 * (1.0 - rate);
      let r1 = this.writePos - d1;
      while (r1 < 0) r1 += bSize;
      while (r1 >= bSize) r1 -= bSize;
      const i1 = Math.floor(r1);
      const f1 = r1 - i1;
      const s1 = buf[i1] * (1.0 - f1) + buf[(i1 + 1) % bSize] * f1;
      const w1 = win[Math.floor(this.phase1) % gSize];

      // Tap 2
      const d2 = (gSize / 2) + this.phase2 * (1.0 - rate);
      let r2 = this.writePos - d2;
      while (r2 < 0) r2 += bSize;
      while (r2 >= bSize) r2 -= bSize;
      const i2 = Math.floor(r2);
      const f2 = r2 - i2;
      const s2 = buf[i2] * (1.0 - f2) + buf[(i2 + 1) % bSize] * f2;
      const w2 = win[Math.floor(this.phase2) % gSize];

      outChannel[i] = (s0 * w0 + s1 * w1 + s2 * w2) * norm;

      this.writePos = (this.writePos + 1) % bSize;
      this.phase0 = (this.phase0 + 1) % gSize;
      this.phase1 = (this.phase1 + 1) % gSize;
      this.phase2 = (this.phase2 + 1) % gSize;
    }

    return true;
  }
}

registerProcessor('voicefx-processor', VoiceFXProcessor);
`;

// ScriptProcessor Universal DSP Fallback (Identical algorithm to AudioWorklet)
class FallbackVoiceFXDSP {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.mode = 0;
    this.pitchRatio = 1.0;
    this.preserveFormants = true;

    this.bufferSize = 16384;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;

    this.grainSize = 1536;
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.grainSize));
    }

    this.phase0 = 0.0;
    this.phase1 = this.grainSize / 3.0;
    this.phase2 = (2.0 * this.grainSize) / 3.0;

    this.oscPhaseA = 0.0;
    this.oscPhaseB = 0.0;
    this.vocalEnv = 0.0;
    this.lpVoice = 0.0;

    this.atRatio = 1.0;
    this.atCounter = 0;
    this.historyBuffer = new Float32Array(2048);
    this.historyWrite = 0;
  }

  detectPitchAMDF() {
    const sr = this.sampleRate;
    const minP = Math.floor(sr / 480);
    const maxP = Math.floor(sr / 80);
    let bestP = 0;
    let minD = Infinity;

    const hist = this.historyBuffer;
    const hLen = hist.length;
    const startIdx = (this.historyWrite - 768 + hLen) % hLen;

    for (let tau = minP; tau <= maxP; tau += 2) {
      let diff = 0;
      for (let i = 0; i < 320; i += 2) {
        const idxA = (startIdx + i) % hLen;
        const idxB = (startIdx + i + tau) % hLen;
        diff += Math.abs(hist[idxA] - hist[idxB]);
      }
      if (diff < minD) {
        minD = diff;
        bestP = tau;
      }
    }

    if (minD > 50 || bestP === 0) return 0;
    return sr / bestP;
  }

  processBlock(inChannel, outChannel) {
    const len = inChannel.length;
    const mode = this.mode;
    const targetRatio = this.pitchRatio;

    if (mode === 0) {
      outChannel.set(inChannel);
      return;
    }

    if (mode === 2) {
      const sr = this.sampleRate;
      const freqA = 110.0;
      const freqB = 164.81;

      for (let i = 0; i < len; i++) {
        const inS = inChannel[i];
        this.oscPhaseA = (this.oscPhaseA + freqA / sr) % 1.0;
        this.oscPhaseB = (this.oscPhaseB + freqB / sr) % 1.0;

        const saw = (this.oscPhaseA * 2.0) - 1.0;
        const pulse = (this.oscPhaseB < 0.5 ? 0.45 : -0.45);
        const carrier = saw * 0.65 + pulse * 0.35;

        this.vocalEnv = this.vocalEnv * 0.95 + Math.abs(inS) * 0.05;
        this.lpVoice = this.lpVoice * 0.86 + inS * 0.14;
        const sibilance = inS - this.lpVoice;

        outChannel[i] = carrier * this.vocalEnv * 3.0 + sibilance * 0.35;
      }
      return;
    }

    for (let i = 0; i < len; i++) {
      this.historyBuffer[this.historyWrite] = inChannel[i];
      this.historyWrite = (this.historyWrite + 1) % this.historyBuffer.length;
    }

    let effRatio = targetRatio;
    if (mode === 3) {
      this.atCounter += len;
      if (this.atCounter >= 160) {
        this.atCounter = 0;
        const pitch = this.detectPitchAMDF();
        if (pitch >= 80 && pitch <= 520) {
          const semitones = 12.0 * Math.log2(pitch / 440.0);
          const snapped = Math.round(semitones);
          const targetHz = 440.0 * Math.pow(2.0, snapped / 12.0);
          this.atRatio = targetHz / pitch;
        } else {
          this.atRatio = 1.0;
        }
      }
      effRatio = this.atRatio;
    }

    const buf = this.buffer;
    const bSize = this.bufferSize;
    const gSize = this.grainSize;
    const win = this.window;
    const rate = effRatio;
    const norm = 2.0 / 3.0;

    for (let i = 0; i < len; i++) {
      buf[this.writePos] = inChannel[i];

      const d0 = (gSize / 2) + this.phase0 * (1.0 - rate);
      let r0 = this.writePos - d0;
      while (r0 < 0) r0 += bSize;
      while (r0 >= bSize) r0 -= bSize;
      const i0 = Math.floor(r0);
      const f0 = r0 - i0;
      const s0 = buf[i0] * (1.0 - f0) + buf[(i0 + 1) % bSize] * f0;
      const w0 = win[Math.floor(this.phase0) % gSize];

      const d1 = (gSize / 2) + this.phase1 * (1.0 - rate);
      let r1 = this.writePos - d1;
      while (r1 < 0) r1 += bSize;
      while (r1 >= bSize) r1 -= bSize;
      const i1 = Math.floor(r1);
      const f1 = r1 - i1;
      const s1 = buf[i1] * (1.0 - f1) + buf[(i1 + 1) % bSize] * f1;
      const w1 = win[Math.floor(this.phase1) % gSize];

      const d2 = (gSize / 2) + this.phase2 * (1.0 - rate);
      let r2 = this.writePos - d2;
      while (r2 < 0) r2 += bSize;
      while (r2 >= bSize) r2 -= bSize;
      const i2 = Math.floor(r2);
      const f2 = r2 - i2;
      const s2 = buf[i2] * (1.0 - f2) + buf[(i2 + 1) % bSize] * f2;
      const w2 = win[Math.floor(this.phase2) % gSize];

      outChannel[i] = (s0 * w0 + s1 * w1 + s2 * w2) * norm;

      this.writePos = (this.writePos + 1) % bSize;
      this.phase0 = (this.phase0 + 1) % gSize;
      this.phase1 = (this.phase1 + 1) % gSize;
      this.phase2 = (this.phase2 + 1) % gSize;
    }
  }
}

class VoiceChangerEngine {
  constructor() {
    this.activePreset = 'none';
    this.lastActivePreset = 'autotune';
    this.isMonitoringEnabled = true;
    this.monitoringVolume = 0.85;
    this.isPushToTalk = false;
    this.isMorphedActive = false;

    // Audio context & nodes
    this.ctx = null;
    this.inputNode = null;
    this.outputNode = null;
    this.monitoringGain = null;
    this.analyserNode = null;

    this.workletSupported = false;
    this.workletModuleLoaded = false;
    this.currentFxNodes = [];

    this.onStateChange = null;
  }

  async init(audioCtx) {
    if (this.ctx === audioCtx && this.outputNode) return;
    this.ctx = audioCtx;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {}
    }

    // Master Voice Changer Bus
    this.outputNode = this.ctx.createGain();
    this.outputNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // Monitoring Gain (Local Headphones Feedback)
    this.monitoringGain = this.ctx.createGain();
    this.monitoringGain.gain.setValueAtTime(this.isMonitoringEnabled ? this.monitoringVolume : 0.0, this.ctx.currentTime);
    this.outputNode.connect(this.monitoringGain);
    if (soundEngine.headphonesGain) {
      try {
        this.monitoringGain.disconnect();
      } catch (e) {}
      this.monitoringGain.connect(soundEngine.headphonesGain);
    }

    // Analyser Node for live 60fps VU-Meter
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 64;
    this.analyserNode.smoothingTimeConstant = 0.5;
    this.outputNode.connect(this.analyserNode);

    // Automatically forward to broadcast bus (Discord / virtual cable)
    soundEngine.ensureBroadcastBridge();

    // Load AudioWorklet via Blob URL
    if (this.ctx.audioWorklet && !this.workletModuleLoaded) {
      try {
        const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        await this.ctx.audioWorklet.addModule(blobUrl);
        this.workletSupported = true;
        this.workletModuleLoaded = true;
      } catch (err) {
        console.warn("AudioWorklet Blob load note, fallback to ScriptProcessor:", err.message);
        this.workletSupported = false;
      }
    }
  }

  // Ensure microphone is actively streaming
  async ensureMicStarted() {
    try {
      await soundEngine.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      if (!soundEngine.realMicStream || !this.inputNode) {
        await soundEngine.toggleMicPassthrough(true, soundEngine.realMicDeviceId || 'default', 'Microphone');
      }
      return true;
    } catch (e) {
      console.warn("Could not auto-start mic for voice changer:", e);
      return false;
    }
  }

  // Live VU-Meter (0.0 to 1.0)
  getAudioLevel() {
    if (!this.analyserNode) return 0;
    const array = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(array);
    let sum = 0;
    for (let i = 0; i < array.length; i++) sum += array[i];
    return Math.min(1.0, sum / (array.length * 200));
  }

  connectMicSource(sourceNode) {
    this.inputNode = sourceNode;
    this.rebuildGraph();
  }

  setPreset(presetId) {
    if (!VOICE_PRESETS[presetId]) return;
    const oldPreset = this.activePreset;
    this.activePreset = presetId;

    if (presetId !== 'none') {
      this.lastActivePreset = presetId;
      this.isMorphedActive = true;
    } else {
      this.isMorphedActive = false;
    }

    if (oldPreset === 'walkie' && presetId !== 'walkie') {
      this.playRogerBeep();
    }

    this.rebuildGraph();
    if (this.onStateChange) this.onStateChange(this.activePreset);
  }

  setMonitoring(enabled) {
    this.isMonitoringEnabled = enabled;
    if (this.monitoringGain && this.ctx) {
      const targetGain = enabled ? this.monitoringVolume : 0.0;
      this.monitoringGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.02);
    }
  }

  setMonitoringVolume(vol) {
    this.monitoringVolume = Math.max(0.0, Math.min(1.5, vol));
    if (this.monitoringGain && this.isMonitoringEnabled && this.ctx) {
      this.monitoringGain.gain.setTargetAtTime(this.monitoringVolume, this.ctx.currentTime, 0.02);
    }
  }

  setPushToTalk(enabled) {
    this.isPushToTalk = enabled;
  }

  handleHotkeyPress() {
    this.ensureMicStarted();
    if (this.isPushToTalk) {
      if (this.activePreset === 'none') {
        const target = this.lastActivePreset || 'autotune';
        this.setPreset(target);
      }
    } else {
      if (this.activePreset === 'none') {
        const target = this.lastActivePreset || 'autotune';
        this.setPreset(target);
      } else {
        this.setPreset('none');
      }
    }
  }

  handleHotkeyRelease() {
    if (this.isPushToTalk && this.activePreset !== 'none') {
      this.setPreset('none');
    }
  }

  playRogerBeep() {
    if (!this.ctx || !this.outputNode) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Tactical squelch noise burst (70ms)
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.07);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(2.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.outputNode);

      // 2. High-pitched dual radio tone beep
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now + 0.04);
      osc.frequency.setValueAtTime(1600, now + 0.09);

      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.setValueAtTime(0.18, now + 0.04);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(oscGain);
      oscGain.connect(this.outputNode);

      noiseSource.start(now);
      osc.start(now + 0.04);
      osc.stop(now + 0.17);
    } catch (e) {
      console.warn("Roger beep notice:", e);
    }
  }

  makeDistortionCurve(amount = 20) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  createFXNode(mode = 0, pitchRatio = 1.0, preserveFormants = true) {
    const now = this.ctx.currentTime;
    if (this.workletSupported) {
      try {
        const atNode = new AudioWorkletNode(this.ctx, 'voicefx-processor');
        const mParam = atNode.parameters.get('mode');
        if (mParam) mParam.setValueAtTime(mode, now);
        const pParam = atNode.parameters.get('pitchRatio');
        if (pParam) pParam.setValueAtTime(pitchRatio, now);
        const fParam = atNode.parameters.get('preserveFormants');
        if (fParam) fParam.setValueAtTime(preserveFormants ? 1.0 : 0.0, now);
        return atNode;
      } catch (e) {
        console.warn("Worklet instantiation fallback:", e.message);
      }
    }

    // Fallback: Universal ScriptProcessor with Tri-Tap Constant Power DSP
    const spNode = this.ctx.createScriptProcessor(1024, 1, 1);
    const dsp = new FallbackVoiceFXDSP(this.ctx.sampleRate);
    dsp.mode = mode;
    dsp.pitchRatio = pitchRatio;
    dsp.preserveFormants = preserveFormants;
    spNode.onaudioprocess = (e) => {
      const inData = e.inputBuffer.getChannelData(0);
      const outData = e.outputBuffer.getChannelData(0);
      dsp.processBlock(inData, outData);
    };
    return spNode;
  }

  cleanupCurrentGraph() {
    this.currentFxNodes.forEach(n => {
      try {
        if (typeof n.stop === 'function') n.stop();
        n.disconnect();
      } catch (e) {}
    });
    this.currentFxNodes = [];

    if (this.inputNode) {
      try { this.inputNode.disconnect(); } catch (e) {}
    }
  }

  rebuildGraph() {
    if (!this.ctx || !this.inputNode || !this.outputNode) return;
    this.cleanupCurrentGraph();

    const now = this.ctx.currentTime;
    const preset = this.activePreset;

    // 1. Natural Voice (Bypass)
    if (preset === 'none') {
      this.inputNode.connect(this.outputNode);
      return;
    }

    // 2. Mode Travis Scott / PNL (Auto-Tune Chromatique + Reverb Spatiale)
    if (preset === 'autotune') {
      const fxNode = this.createFXNode(3, 1.0, true);

      // Ping-Pong Delay & Studio Space
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(0.18, now);
      const feedback = this.ctx.createGain();
      feedback.gain.setValueAtTime(0.28, now);
      delay.connect(feedback);
      feedback.connect(delay);

      const delayWet = this.ctx.createGain();
      delayWet.gain.setValueAtTime(0.32, now);
      delay.connect(delayWet);
      delayWet.connect(this.outputNode);

      // High-shelf clarity sheen (8 kHz +4 dB)
      const highShelf = this.ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(8000, now);
      highShelf.gain.setValueAtTime(4.0, now);

      this.inputNode.connect(fxNode);
      fxNode.connect(highShelf);
      highShelf.connect(this.outputNode);
      highShelf.connect(delay);

      this.currentFxNodes.push(fxNode, delay, feedback, delayWet, highShelf);
      return;
    }

    // 3. Robot / Vocoder Daft Punk (Dual-Carrier Synth + Sibilance Preservation)
    if (preset === 'robot') {
      const fxNode = this.createFXNode(2, 1.0, false);

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1400, now);
      bandpass.Q.setValueAtTime(1.8, now);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-16, now);
      comp.ratio.setValueAtTime(6, now);

      this.inputNode.connect(fxNode);
      fxNode.connect(bandpass);
      bandpass.connect(comp);
      comp.connect(this.outputNode);

      this.currentFxNodes.push(fxNode, bandpass, comp);
      return;
    }

    // 4. Démon des Abysses (-8.5 st + Sub-Octave + Sub-Bass 85Hz + Tube Saturation)
    if (preset === 'demon') {
      const demonPitch = this.createFXNode(1, 0.612, true); // -8.5 st

      // Sub-octave parallel layer (-12 st = full octave down)
      const subOctave = this.createFXNode(1, 0.50, true);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.35, now);
      subOctave.connect(subGain);

      // 85Hz Sub-bass chest resonance boost (+8.5 dB)
      const subBoost = this.ctx.createBiquadFilter();
      subBoost.type = 'lowshelf';
      subBoost.frequency.setValueAtTime(85, now);
      subBoost.gain.setValueAtTime(8.5, now);

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(3600, now);

      const tubeDist = this.ctx.createWaveShaper();
      tubeDist.curve = this.makeDistortionCurve(14);
      tubeDist.oversample = '2x';

      // Cavern reflection (28ms)
      const cavern = this.ctx.createDelay(0.1);
      cavern.delayTime.setValueAtTime(0.028, now);
      const cavernGain = this.ctx.createGain();
      cavernGain.gain.setValueAtTime(0.22, now);
      cavern.connect(cavernGain);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.15, now);

      this.inputNode.connect(demonPitch);
      this.inputNode.connect(subOctave);

      demonPitch.connect(subBoost);
      subGain.connect(subBoost);

      subBoost.connect(lowpass);
      lowpass.connect(tubeDist);
      tubeDist.connect(master);
      tubeDist.connect(cavern);
      cavernGain.connect(master);

      master.connect(this.outputNode);

      this.currentFxNodes.push(demonPitch, subOctave, subGain, subBoost, lowpass, tubeDist, cavern, cavernGain, master);
      return;
    }

    // 5. Hélium / Lutin (+9.5 st + Coupe-bas 380Hz + Formants 2600Hz)
    if (preset === 'helium') {
      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(380, now); // Cuts adult chest resonance

      const heliumPitch = this.createFXNode(1, 1.73, true); // +9.5 st

      const presence = this.ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.setValueAtTime(2600, now);
      presence.gain.setValueAtTime(5.5, now);
      presence.Q.setValueAtTime(1.8, now);

      const highShelf = this.ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(6500, now);
      highShelf.gain.setValueAtTime(4.0, now);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-14, now);
      comp.ratio.setValueAtTime(4, now);

      this.inputNode.connect(highpass);
      highpass.connect(heliumPitch);
      heliumPitch.connect(presence);
      presence.connect(highShelf);
      highShelf.connect(comp);
      comp.connect(this.outputNode);

      this.currentFxNodes.push(highpass, heliumPitch, presence, highShelf, comp);
      return;
    }

    // 6. Mégaphone de Police (Bandpass + Pavillon 1250Hz + Echo Slapback 22ms)
    if (preset === 'megaphone') {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(620, now);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2500, now);

      const hornPeak = this.ctx.createBiquadFilter();
      hornPeak.type = 'peaking';
      hornPeak.frequency.setValueAtTime(1250, now);
      hornPeak.gain.setValueAtTime(8.5, now);
      hornPeak.Q.setValueAtTime(3.2, now);

      const diodeDist = this.ctx.createWaveShaper();
      diodeDist.curve = this.makeDistortionCurve(22);
      diodeDist.oversample = '2x';

      const slapback = this.ctx.createDelay(0.1);
      slapback.delayTime.setValueAtTime(0.022, now);
      const slapGain = this.ctx.createGain();
      slapGain.gain.setValueAtTime(0.25, now);
      slapback.connect(slapGain);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.2, now);

      this.inputNode.connect(hp);
      hp.connect(lp);
      lp.connect(hornPeak);
      hornPeak.connect(diodeDist);

      diodeDist.connect(master);
      diodeDist.connect(slapback);
      slapGain.connect(master);

      master.connect(this.outputNode);

      this.currentFxNodes.push(hp, lp, hornPeak, diodeDist, slapback, slapGain, master);
      return;
    }

    // 7. Talkie-Walkie Militaire (Radio Bandpass + Squelch + Bip Roger)
    if (preset === 'walkie') {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(450, now);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, now);

      const radioDist = this.ctx.createWaveShaper();
      radioDist.curve = this.makeDistortionCurve(10);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, now);
      comp.ratio.setValueAtTime(10, now);

      this.inputNode.connect(hp);
      hp.connect(lp);
      lp.connect(radioDist);
      radioDist.connect(comp);
      comp.connect(this.outputNode);

      this.currentFxNodes.push(hp, lp, radioDist, comp);
    }
  }
}

const voiceChangerEngine = new VoiceChangerEngine();
export default voiceChangerEngine;
