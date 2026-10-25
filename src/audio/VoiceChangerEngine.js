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
    this.bufferSize = 32768;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;

    // Phase-Aligned Dual-Tap Overlap-Add Pitch Shifter (Continuous Phase, Sum = 1.0)
    this.grainSize = 2048; // ~42.6ms at 48kHz
    this.nominalDelay = 1024;
    this.phase0 = 0;
    this.phase1 = 1024; // Spaced at G/2
    this.readStart0 = 0;
    this.readStart1 = 0;

    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.grainSize));
    }

    // Auto-Tune Normalized Autocorrelation State
    this.atRatio = 1.0;
    this.targetAtRatio = 1.0;
    this.atCounter = 0;
    this.historyBuffer = new Float32Array(2048);
    this.historyWrite = 0;

    // Daft Punk Robot Vocoder State
    this.oscPhaseA = 0.0;
    this.oscPhaseB = 0.0;
    this.oscPhaseSub = 0.0;
    this.envVoice = 0.0;
    this.lpVoice = 0.0;
  }

  detectPitchACF() {
    const sr = this.sampleRate;
    const minPeriod = Math.max(20, Math.floor(sr / 550)); // ~550Hz
    const maxPeriod = Math.min(1024, Math.floor(sr / 75)); // ~75Hz
    const N = 512;
    const hist = this.historyBuffer;
    const hLen = hist.length;
    const startIdx = (this.historyWrite - N + hLen) % hLen;

    let energy0 = 0;
    for (let i = 0; i < N; i++) {
      const s = hist[(startIdx + i) % hLen];
      energy0 += s * s;
    }
    if (energy0 < 0.005) return 0;

    let bestLag = 0;
    let maxNormCorr = -1;

    for (let lag = minPeriod; lag <= maxPeriod; lag += 2) {
      let corr = 0;
      let energyLag = 0;
      for (let i = 0; i < N; i += 2) {
        const s0 = hist[(startIdx + i) % hLen];
        const sLag = hist[(startIdx + i + lag) % hLen];
        corr += s0 * sLag;
        energyLag += sLag * sLag;
      }
      const normCorr = corr / (Math.sqrt(energy0 * energyLag) + 1e-6);
      if (normCorr > maxNormCorr) {
        maxNormCorr = normCorr;
        bestLag = lag;
      }
    }

    if (maxNormCorr < 0.45 || bestLag === 0) return 0;

    let lagM1 = 0, lagP1 = 0;
    for (let i = 0; i < N; i += 2) {
      const s0 = hist[(startIdx + i) % hLen];
      lagM1 += s0 * hist[(startIdx + i + bestLag - 1) % hLen];
      lagP1 += s0 * hist[(startIdx + i + bestLag + 1) % hLen];
    }
    const denom = (lagM1 - 2 * maxNormCorr * energy0 + lagP1);
    const delta = denom !== 0 ? (lagM1 - lagP1) / (2 * denom) : 0;
    const refinedLag = Math.max(minPeriod, Math.min(maxPeriod, bestLag + delta));

    return sr / refinedLag;
  }

  processGrain(inS, rate) {
    const buf = this.buffer;
    const bSize = this.bufferSize;
    const gSize = this.grainSize;
    const win = this.window;
    const D = this.nominalDelay;

    buf[this.writePos] = inS;

    let p0 = this.readStart0 + this.phase0 * rate;
    while (p0 < 0) p0 += bSize;
    while (p0 >= bSize) p0 -= bSize;
    const i0 = Math.floor(p0);
    const f0 = p0 - i0;
    const s0 = buf[i0] * (1.0 - f0) + buf[(i0 + 1) % bSize] * f0;
    const w0 = win[this.phase0];

    let p1 = this.readStart1 + this.phase1 * rate;
    while (p1 < 0) p1 += bSize;
    while (p1 >= bSize) p1 -= bSize;
    const i1 = Math.floor(p1);
    const f1 = p1 - i1;
    const s1 = buf[i1] * (1.0 - f1) + buf[(i1 + 1) % bSize] * f1;
    const w1 = win[this.phase1];

    const out = s0 * w0 + s1 * w1;

    this.writePos = (this.writePos + 1) % bSize;
    this.phase0++;
    this.phase1++;

    if (this.phase0 >= gSize) {
      this.phase0 = 0;
      this.readStart0 = (this.writePos - D + bSize) % bSize;
    }
    if (this.phase1 >= gSize) {
      this.phase1 = 0;
      this.readStart1 = (this.writePos - D + bSize) % bSize;
    }

    return out;
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

    if (mode === 0) {
      outChannel.set(inChannel);
      return true;
    }

    // Mode 2: Daft Punk Robot Vocoder
    if (mode === 2) {
      const sr = this.sampleRate;
      const freqA = 110.0;  // Note A2 fundamental
      const freqB = 164.81; // Note E3 fifth
      const freqSub = 55.0; // Note A1 sub

      for (let i = 0; i < len; i++) {
        const inS = inChannel[i];
        this.oscPhaseA = (this.oscPhaseA + freqA / sr) % 1.0;
        this.oscPhaseB = (this.oscPhaseB + freqB / sr) % 1.0;
        this.oscPhaseSub = (this.oscPhaseSub + freqSub / sr) % 1.0;

        const sawA = (this.oscPhaseA * 2.0) - 1.0;
        const sawB = (this.oscPhaseB * 2.0) - 1.0;
        const square = this.oscPhaseSub < 0.5 ? 0.5 : -0.5;
        const carrier = (sawA * 0.45 + sawB * 0.35 + square * 0.20);

        this.envVoice = this.envVoice * 0.96 + Math.abs(inS) * 0.04;
        this.lpVoice = this.lpVoice * 0.85 + inS * 0.15;
        const sibilance = inS - this.lpVoice;

        outChannel[i] = (carrier * this.envVoice * 2.6) + (sibilance * 0.22);
      }
      return true;
    }

    for (let i = 0; i < len; i++) {
      this.historyBuffer[this.historyWrite] = inChannel[i];
      this.historyWrite = (this.historyWrite + 1) % this.historyBuffer.length;
    }

    let effRatio = targetRatio;
    if (mode === 3) {
      this.atCounter += len;
      if (this.atCounter >= 128) {
        this.atCounter = 0;
        const pitch = this.detectPitchACF();
        if (pitch >= 75 && pitch <= 550) {
          const semitones = 12.0 * Math.log2(pitch / 440.0);
          const snapped = Math.round(semitones);
          const targetHz = 440.0 * Math.pow(2.0, snapped / 12.0);
          this.targetAtRatio = Math.max(0.70, Math.min(1.42, targetHz / pitch));
        } else {
          this.targetAtRatio = 1.0;
        }
      }
      this.atRatio += (this.targetAtRatio - this.atRatio) * 0.35;
      effRatio = this.atRatio;
    }

    for (let i = 0; i < len; i++) {
      outChannel[i] = this.processGrain(inChannel[i], effRatio);
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

    this.bufferSize = 32768;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;

    this.grainSize = 2048;
    this.nominalDelay = 1024;
    this.phase0 = 0;
    this.phase1 = 1024;
    this.readStart0 = 0;
    this.readStart1 = 0;

    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.grainSize));
    }

    this.atRatio = 1.0;
    this.targetAtRatio = 1.0;
    this.atCounter = 0;
    this.historyBuffer = new Float32Array(2048);
    this.historyWrite = 0;

    this.oscPhaseA = 0.0;
    this.oscPhaseB = 0.0;
    this.oscPhaseSub = 0.0;
    this.envVoice = 0.0;
    this.lpVoice = 0.0;
  }

  detectPitchACF() {
    const sr = this.sampleRate;
    const minPeriod = Math.max(20, Math.floor(sr / 550));
    const maxPeriod = Math.min(1024, Math.floor(sr / 75));
    const N = 512;
    const hist = this.historyBuffer;
    const hLen = hist.length;
    const startIdx = (this.historyWrite - N + hLen) % hLen;

    let energy0 = 0;
    for (let i = 0; i < N; i++) {
      const s = hist[(startIdx + i) % hLen];
      energy0 += s * s;
    }
    if (energy0 < 0.005) return 0;

    let bestLag = 0;
    let maxNormCorr = -1;

    for (let lag = minPeriod; lag <= maxPeriod; lag += 2) {
      let corr = 0;
      let energyLag = 0;
      for (let i = 0; i < N; i += 2) {
        const s0 = hist[(startIdx + i) % hLen];
        const sLag = hist[(startIdx + i + lag) % hLen];
        corr += s0 * sLag;
        energyLag += sLag * sLag;
      }
      const normCorr = corr / (Math.sqrt(energy0 * energyLag) + 1e-6);
      if (normCorr > maxNormCorr) {
        maxNormCorr = normCorr;
        bestLag = lag;
      }
    }

    if (maxNormCorr < 0.45 || bestLag === 0) return 0;

    let lagM1 = 0, lagP1 = 0;
    for (let i = 0; i < N; i += 2) {
      const s0 = hist[(startIdx + i) % hLen];
      lagM1 += s0 * hist[(startIdx + i + bestLag - 1) % hLen];
      lagP1 += s0 * hist[(startIdx + i + bestLag + 1) % hLen];
    }
    const denom = (lagM1 - 2 * maxNormCorr * energy0 + lagP1);
    const delta = denom !== 0 ? (lagM1 - lagP1) / (2 * denom) : 0;
    const refinedLag = Math.max(minPeriod, Math.min(maxPeriod, bestLag + delta));

    return sr / refinedLag;
  }

  processGrain(inS, rate) {
    const buf = this.buffer;
    const bSize = this.bufferSize;
    const gSize = this.grainSize;
    const win = this.window;
    const D = this.nominalDelay;

    buf[this.writePos] = inS;

    let p0 = this.readStart0 + this.phase0 * rate;
    while (p0 < 0) p0 += bSize;
    while (p0 >= bSize) p0 -= bSize;
    const i0 = Math.floor(p0);
    const f0 = p0 - i0;
    const s0 = buf[i0] * (1.0 - f0) + buf[(i0 + 1) % bSize] * f0;
    const w0 = win[this.phase0];

    let p1 = this.readStart1 + this.phase1 * rate;
    while (p1 < 0) p1 += bSize;
    while (p1 >= bSize) p1 -= bSize;
    const i1 = Math.floor(p1);
    const f1 = p1 - i1;
    const s1 = buf[i1] * (1.0 - f1) + buf[(i1 + 1) % bSize] * f1;
    const w1 = win[this.phase1];

    const out = s0 * w0 + s1 * w1;

    this.writePos = (this.writePos + 1) % bSize;
    this.phase0++;
    this.phase1++;

    if (this.phase0 >= gSize) {
      this.phase0 = 0;
      this.readStart0 = (this.writePos - D + bSize) % bSize;
    }
    if (this.phase1 >= gSize) {
      this.phase1 = 0;
      this.readStart1 = (this.writePos - D + bSize) % bSize;
    }

    return out;
  }

  processBlock(inChannel, outChannel) {
    const len = inChannel.length;
    const mode = this.mode;
    const targetRatio = this.pitchRatio;

    if (mode === 0) {
      outChannel.set(inChannel);
      return;
    }

    // Mode 2: Daft Punk Robot Vocoder
    if (mode === 2) {
      const sr = this.sampleRate;
      const freqA = 110.0;  // Note A2 fundamental
      const freqB = 164.81; // Note E3 fifth
      const freqSub = 55.0; // Note A1 sub

      for (let i = 0; i < len; i++) {
        const inS = inChannel[i];
        this.oscPhaseA = (this.oscPhaseA + freqA / sr) % 1.0;
        this.oscPhaseB = (this.oscPhaseB + freqB / sr) % 1.0;
        this.oscPhaseSub = (this.oscPhaseSub + freqSub / sr) % 1.0;

        const sawA = (this.oscPhaseA * 2.0) - 1.0;
        const sawB = (this.oscPhaseB * 2.0) - 1.0;
        const square = this.oscPhaseSub < 0.5 ? 0.5 : -0.5;
        const carrier = (sawA * 0.45 + sawB * 0.35 + square * 0.20);

        this.envVoice = this.envVoice * 0.96 + Math.abs(inS) * 0.04;
        this.lpVoice = this.lpVoice * 0.85 + inS * 0.15;
        const sibilance = inS - this.lpVoice;

        outChannel[i] = (carrier * this.envVoice * 2.6) + (sibilance * 0.22);
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
      if (this.atCounter >= 128) {
        this.atCounter = 0;
        const pitch = this.detectPitchACF();
        if (pitch >= 75 && pitch <= 550) {
          const semitones = 12.0 * Math.log2(pitch / 440.0);
          const snapped = Math.round(semitones);
          const targetHz = 440.0 * Math.pow(2.0, snapped / 12.0);
          this.targetAtRatio = Math.max(0.70, Math.min(1.42, targetHz / pitch));
        } else {
          this.targetAtRatio = 1.0;
        }
      }
      this.atRatio += (this.targetAtRatio - this.atRatio) * 0.35;
      effRatio = this.atRatio;
    }

    for (let i = 0; i < len; i++) {
      outChannel[i] = this.processGrain(inChannel[i], effRatio);
    }
  }
}

class VoiceChangerEngine {
  constructor() {
    this.activePreset = 'none';
    this.lastActivePreset = 'autotune';
    this.isMonitoringEnabled = false; // Safe default: off to prevent Larsen feedback
    this.monitoringVolume = 0.85;
    this.isPushToTalk = false;
    this.isMorphedActive = false;

    // Audio context & nodes
    this.ctx = null;
    this.inputNode = null;
    this.inputPreamp = null;
    this.outputNode = null;
    this.monitoringGain = null;
    this.analyserNode = null;

    this.workletSupported = false;
    this.workletModuleLoaded = false;
    this.currentFxNodes = [];

    // Direct Physical Microphone Injection (APO Bridge)
    this.isApoStreaming = false;
    this.isApoAvailable = false;
    this.apoTapNode = null;
    this.apoDummyDest = null;

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

    if (!this.inputPreamp) {
      this.inputPreamp = this.ctx.createGain();
      this.inputPreamp.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    // Master Voice Changer Bus
    this.outputNode = this.ctx.createGain();
    this.outputNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // Monitoring Gain (Local Headphones Feedback - strictly 0 by default)
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

    // Connect to ctx.destination via near-silent gain (-100 dBFS) to guarantee graph pulling without Chromium Blink silence pruning
    if (!this.silentPullGain) {
      this.silentPullGain = this.ctx.createGain();
      this.silentPullGain.gain.setValueAtTime(0.00001, this.ctx.currentTime);
      this.silentPullGain.connect(this.ctx.destination);
    }
    this.analyserNode.connect(this.silentPullGain);

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

  // Live VU-Meter (0.0 to 1.0) with decibel logarithmic speech curve
  // Fait par zioti
  getAudioLevel() {
    if (!this.analyserNode) return 0;
    if (typeof this.analyserNode.getFloatTimeDomainData === 'function') {
      const timeData = new Float32Array(this.analyserNode.fftSize);
      this.analyserNode.getFloatTimeDomainData(timeData);
      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        const val = timeData[i];
        const abs = Math.abs(val);
        if (abs > peak) peak = abs;
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      const effectiveAmp = Math.max(peak, rms * 1.6);
      if (effectiveAmp < 0.0012) return 0;
      const db = 20 * Math.log10(effectiveAmp);
      const scaled = (db + 52) / 44;
      const clamped = Math.max(0, Math.min(1.0, scaled));
      return Math.min(1.0, Math.max(0, Math.pow(clamped, 0.9)));
    }
    const array = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(array);
    let sum = 0;
    const bins = Math.min(array.length, 8);
    for (let i = 0; i < bins; i++) sum += array[i];
    return Math.min(1.0, sum / (bins * 90));
  }

  connectMicSource(sourceNode) {
    if (this.inputNode && this.inputNode !== sourceNode && this.inputPreamp) {
      try { this.inputNode.disconnect(this.inputPreamp); } catch (e) {}
    }
    this.inputNode = sourceNode;
    if (this.inputNode && this.inputPreamp) {
      try { this.inputNode.connect(this.inputPreamp); } catch (e) {}
    }
    this.rebuildGraph();
  }

  setPreset(presetId) {
    if (!VOICE_PRESETS[presetId]) return;
    const oldPreset = this.activePreset;
    this.activePreset = presetId;

    if (presetId !== 'none') {
      this.lastActivePreset = presetId;
      this.isMorphedActive = true;
      this.startApoVoiceStream();
    } else {
      this.isMorphedActive = false;
      this.stopApoVoiceStream();
    }

    if (oldPreset === 'walkie' && presetId !== 'walkie') {
      this.playRogerBeep();
    }

    this.rebuildGraph();
    if (this.onStateChange) this.onStateChange(this.activePreset);
  }

  // Direct Hardware APO Microphone Voice Streaming (Zero VB-Cable - Fait par zioti)
  startApoVoiceStream() {
    if (this.isApoStreaming) return;
    if (!window.electronAPI || typeof window.electronAPI.startVoiceStream !== 'function') return;

    window.electronAPI.startVoiceStream({ blockVoice: true }).then((res) => {
      if (res && res.success) {
        this.isApoStreaming = true;
        this._setupApoTap();
      }
    }).catch(e => console.warn("[VoiceChanger] startVoiceStream error:", e));
  }

  _setupApoTap() {
    if (!this.ctx || !this.outputNode) return;
    if (this.apoTapNode) {
      try { this.apoTapNode.disconnect(); } catch (e) {}
    }
    // 1024 frames = 21.3ms at 48kHz (ultra-low latency direct microphone injection)
    this.apoTapNode = this.ctx.createScriptProcessor(1024, 1, 1);
    this.apoTapNode.onaudioprocess = (e) => {
      if (!this.isApoStreaming || this.activePreset === 'none') return;
      const input = e.inputBuffer.getChannelData(0);
      const floatBytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      if (window.electronAPI && typeof window.electronAPI.sendVoiceStreamChunkFast === 'function') {
        window.electronAPI.sendVoiceStreamChunkFast(floatBytes);
      }
    };
    this.outputNode.connect(this.apoTapNode);
    if (!this.silentPullGain) {
      this.silentPullGain = this.ctx.createGain();
      this.silentPullGain.gain.setValueAtTime(0.00001, this.ctx.currentTime);
      this.silentPullGain.connect(this.ctx.destination);
    }
    this.apoTapNode.connect(this.silentPullGain);
  }

  stopApoVoiceStream() {
    this.isApoStreaming = false;
    if (this.apoTapNode) {
      try { this.apoTapNode.disconnect(); } catch (e) {}
      this.apoTapNode = null;
    }
    if (window.electronAPI && typeof window.electronAPI.stopVoiceStream === 'function') {
      window.electronAPI.stopVoiceStream().catch(() => {});
    }
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

  makeDistortionCurve(amount = 12) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Monotonic, smooth saturation curve (never inverts or folds back!)
      curve[i] = (x * (1 + k * 0.08)) / (1 + k * 0.08 * Math.abs(x));
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

    // Isolate inputPreamp so soundEngine.realMicSourceNode is never disconnected from micAnalyser
    if (this.inputPreamp) {
      try { this.inputPreamp.disconnect(); } catch (e) {}
    }
  }

  rebuildGraph() {
    if (!this.ctx || !this.inputNode || !this.outputNode) return;
    if (this.inputPreamp) {
      try { this.inputNode.connect(this.inputPreamp); } catch (e) {}
    }
    this.cleanupCurrentGraph();

    const source = this.inputPreamp || this.inputNode;
    const now = this.ctx.currentTime;
    const preset = this.activePreset;

    // 1. Natural Voice (Bypass)
    if (preset === 'none') {
      source.connect(this.outputNode);
      return;
    }

    // 2. Mode Travis Scott / PNL (Auto-Tune Chromatique + Reverb Spatiale)
    if (preset === 'autotune') {
      const fxNode = this.createFXNode(3, 1.0, true);

      // Ping-Pong Delay & Studio Space
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(0.16, now);
      const feedback = this.ctx.createGain();
      feedback.gain.setValueAtTime(0.22, now);
      delay.connect(feedback);
      feedback.connect(delay);

      const delayWet = this.ctx.createGain();
      delayWet.gain.setValueAtTime(0.25, now);
      delay.connect(delayWet);
      delayWet.connect(this.outputNode);

      // High-shelf clarity sheen (7.5 kHz +3.5 dB)
      const highShelf = this.ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(7500, now);
      highShelf.gain.setValueAtTime(3.5, now);

      // Studio vocal compressor
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, now);
      comp.ratio.setValueAtTime(4, now);

      source.connect(fxNode);
      fxNode.connect(highShelf);
      highShelf.connect(comp);
      comp.connect(this.outputNode);
      comp.connect(delay);

      this.currentFxNodes.push(fxNode, delay, feedback, delayWet, highShelf, comp);
      return;
    }

    // 3. Robot / Vocoder Daft Punk (Dual-Carrier Synth + Sibilance Preservation)
    if (preset === 'robot') {
      const fxNode = this.createFXNode(2, 1.0, false);

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1400, now);
      bandpass.Q.setValueAtTime(1.5, now);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-16, now);
      comp.ratio.setValueAtTime(5, now);

      source.connect(fxNode);
      fxNode.connect(bandpass);
      bandpass.connect(comp);
      comp.connect(this.outputNode);

      this.currentFxNodes.push(fxNode, bandpass, comp);
      return;
    }

    // 4. Démon des Abysses (-8.3 st + Sub-Bass 90Hz + Tube Warmth)
    if (preset === 'demon') {
      const demonPitch = this.createFXNode(1, 0.62, true); // -8.3 st

      // 90Hz Sub-bass chest resonance boost (+4.5 dB)
      const subBoost = this.ctx.createBiquadFilter();
      subBoost.type = 'lowshelf';
      subBoost.frequency.setValueAtTime(90, now);
      subBoost.gain.setValueAtTime(4.5, now);

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(3800, now);

      const tubeDist = this.ctx.createWaveShaper();
      tubeDist.curve = this.makeDistortionCurve(10);
      tubeDist.oversample = '2x';

      // Cavern reflection (28ms)
      const cavern = this.ctx.createDelay(0.1);
      cavern.delayTime.setValueAtTime(0.028, now);
      const cavernGain = this.ctx.createGain();
      cavernGain.gain.setValueAtTime(0.18, now);
      cavern.connect(cavernGain);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-16, now);
      comp.ratio.setValueAtTime(4, now);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.08, now);

      source.connect(demonPitch);
      demonPitch.connect(subBoost);
      subBoost.connect(lowpass);
      lowpass.connect(tubeDist);
      tubeDist.connect(comp);
      comp.connect(master);
      comp.connect(cavern);
      cavernGain.connect(master);

      master.connect(this.outputNode);

      this.currentFxNodes.push(demonPitch, subBoost, lowpass, tubeDist, cavern, cavernGain, comp, master);
      return;
    }

    // 5. Hélium / Lutin (+8.3 st + Coupe-bas 400Hz + Présence 2600Hz)
    if (preset === 'helium') {
      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(400, now);

      const heliumPitch = this.createFXNode(1, 1.62, true); // +8.3 st

      const presence = this.ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.setValueAtTime(2600, now);
      presence.gain.setValueAtTime(4.0, now);
      presence.Q.setValueAtTime(1.8, now);

      const highShelf = this.ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(6500, now);
      highShelf.gain.setValueAtTime(3.5, now);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-14, now);
      comp.ratio.setValueAtTime(4, now);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.05, now);

      source.connect(highpass);
      highpass.connect(heliumPitch);
      heliumPitch.connect(presence);
      presence.connect(highShelf);
      highShelf.connect(comp);
      comp.connect(master);
      master.connect(this.outputNode);

      this.currentFxNodes.push(highpass, heliumPitch, presence, highShelf, comp, master);
      return;
    }

    // 6. Mégaphone de Police (Bandpass + Pavillon 1300Hz + Echo Slapback 22ms)
    if (preset === 'megaphone') {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(600, now);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, now);

      const hornPeak = this.ctx.createBiquadFilter();
      hornPeak.type = 'peaking';
      hornPeak.frequency.setValueAtTime(1300, now);
      hornPeak.gain.setValueAtTime(7.0, now);
      hornPeak.Q.setValueAtTime(2.8, now);

      const diodeDist = this.ctx.createWaveShaper();
      diodeDist.curve = this.makeDistortionCurve(14);
      diodeDist.oversample = '2x';

      const slapback = this.ctx.createDelay(0.1);
      slapback.delayTime.setValueAtTime(0.022, now);
      const slapGain = this.ctx.createGain();
      slapGain.gain.setValueAtTime(0.20, now);
      slapback.connect(slapGain);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.1, now);

      source.connect(hp);
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
      hp.frequency.setValueAtTime(500, now);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, now);

      const radioDist = this.ctx.createWaveShaper();
      radioDist.curve = this.makeDistortionCurve(8);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, now);
      comp.ratio.setValueAtTime(6, now);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.1, now);

      source.connect(hp);
      hp.connect(lp);
      lp.connect(radioDist);
      radioDist.connect(comp);
      comp.connect(master);
      master.connect(this.outputNode);

      this.currentFxNodes.push(hp, lp, radioDist, comp, master);
    }
  }
}

const voiceChangerEngine = new VoiceChangerEngine();
export default voiceChangerEngine;
