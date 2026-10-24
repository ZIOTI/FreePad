/**
 * FreePad VoiceChangerEngine — Studio-Grade Real-Time Voice Morphing
 * Fait par zioti
 *
 * Implements:
 *   - Auto-Tune Travis Scott / PNL (Chromatic Pitch Snap + Spatial Reverb)
 *   - Robot / Vocoder Daft Punk (Dual-Carrier Synth + Formant Sibilance Tracking)
 *   - Démon des Abysses (-8.5 Semitones + Sub-Octave Layer + 85Hz Sub-Bass + Tube Saturation)
 *   - Hélium / Lutin (+9.5 Semitones + Formant Reshaping + High-Shelf Clarity)
 *   - Mégaphone de Police (Horn Bandpass + Slapback Reflection + Diode Saturation)
 *   - Talkie-Walkie Militaire (Tactical Radio Bandpass + Compression + Roger Beep static burst)
 *   - Voix Naturelle (Bypass direct)
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
    description: 'Snap chromatique dur instantané + Reverb studio spatiale'
  },
  robot: {
    id: 'robot',
    name: 'Robot / Vocoder',
    icon: '🤖',
    badge: 'Daft Punk',
    color: 'from-cyan-500 to-blue-600',
    description: 'Synthé accord A2/E3 + suivi d\'enveloppe vocal & sibilance'
  },
  demon: {
    id: 'demon',
    name: 'Démon des Abysses',
    icon: '😈',
    badge: '-1 Octave',
    color: 'from-red-600 via-rose-700 to-purple-900',
    description: 'Pitch descendu (-8.5 st) + sous-octave + sub-bass 85Hz & saturation'
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
    description: 'Pavillon résonant 1.2kHz, écho de rue 22ms & distorsion mégaphone'
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

// Inlined AudioWorklet Processor source code
const WORKLET_PROCESSOR_CODE = `
class VoiceFXProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 4 }, // 0: bypass, 1: pitch, 2: robot, 3: autotune
      { name: 'pitchRatio', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 },
      { name: 'grainSize', defaultValue: 1536, minValue: 512, maxValue: 4096 }
    ];
  }

  constructor() {
    super();
    this.sampleRate = 48000;
    this.bufferSize = 32768;
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;

    // Granular pitch shifter window (Hann)
    this.grainLen = 1536; // 32ms at 48kHz
    this.halfGrain = this.grainLen / 2;
    this.grainWindow = new Float32Array(this.grainLen);
    for (let i = 0; i < this.grainLen; i++) {
      this.grainWindow[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.grainLen));
    }
    this.phase0 = 0.0;
    this.phase1 = this.halfGrain;

    // Robot vocoder carrier state
    this.oscPhaseA = 0.0;
    this.oscPhaseB = 0.0;
    this.vocalEnv = 0.0;
    this.lpVoice = 0.0;

    // Autotune state
    this.atRatio = 1.0;
    this.atCounter = 0;
  }

  detectPitchAMDF(buf, startIdx, sr) {
    const minP = Math.floor(sr / 480);
    const maxP = Math.floor(sr / 85);
    let bestP = 0;
    let minD = Infinity;

    for (let tau = minP; tau <= maxP; tau += 2) {
      let diff = 0;
      for (let i = 0; i < 384; i += 2) {
        const idxA = (startIdx + i) % this.bufferSize;
        const idxB = (startIdx + i + tau) % this.bufferSize;
        diff += Math.abs(buf[idxA] - buf[idxB]);
      }
      if (diff < minD) {
        minD = diff;
        bestP = tau;
      }
    }
    if (minD > 65 || bestP === 0) return 0;
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

    if (mode === 0) {
      outChannel.set(inChannel);
      return true;
    }

    // Mode 2: Robot / Vocoder (Daft Punk style dual-carrier)
    if (mode === 2) {
      const sr = this.sampleRate;
      const freqA = 110.0;  // A2 note
      const freqB = 164.81; // E3 fifth note

      for (let i = 0; i < len; i++) {
        const inS = inChannel[i];
        this.oscPhaseA = (this.oscPhaseA + freqA / sr) % 1.0;
        this.oscPhaseB = (this.oscPhaseB + freqB / sr) % 1.0;

        const cA = Math.sin(2.0 * Math.PI * this.oscPhaseA);
        const cB = (this.oscPhaseB < 0.5 ? 0.35 : -0.35);
        const carrier = cA * 0.65 + cB * 0.35;

        this.vocalEnv = this.vocalEnv * 0.96 + Math.abs(inS) * 0.04;
        this.lpVoice = this.lpVoice * 0.88 + inS * 0.12;
        const sibilance = inS - this.lpVoice;

        outChannel[i] = carrier * this.vocalEnv * 2.8 + sibilance * 0.32;
      }
      return true;
    }

    // Mode 3: Auto-Tune Pitch Tracking
    let effRatio = targetRatio;
    if (mode === 3) {
      this.atCounter += len;
      if (this.atCounter >= 256) {
        this.atCounter = 0;
        const start = (this.writeIndex - 1024 + this.bufferSize) % this.bufferSize;
        const pitch = this.detectPitchAMDF(this.ringBuffer, start, this.sampleRate);
        if (pitch > 80 && pitch < 500) {
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

    // Mode 1 & 3: Granular Pitch Shifter
    for (let i = 0; i < len; i++) {
      const inS = inChannel[i];
      this.ringBuffer[this.writeIndex] = inS;

      const delay0 = this.halfGrain + this.phase0 * (1.0 - effRatio);
      let r0 = this.writeIndex - delay0;
      while (r0 < 0) r0 += this.bufferSize;
      while (r0 >= this.bufferSize) r0 -= this.bufferSize;
      const i0 = Math.floor(r0);
      const f0 = r0 - i0;
      const v0 = this.ringBuffer[i0] * (1.0 - f0) + this.ringBuffer[(i0 + 1) % this.bufferSize] * f0;
      const w0 = this.grainWindow[Math.floor(this.phase0) % this.grainLen];

      const delay1 = this.halfGrain + this.phase1 * (1.0 - effRatio);
      let r1 = this.writeIndex - delay1;
      while (r1 < 0) r1 += this.bufferSize;
      while (r1 >= this.bufferSize) r1 -= this.bufferSize;
      const i1 = Math.floor(r1);
      const f1 = r1 - i1;
      const v1 = this.ringBuffer[i1] * (1.0 - f1) + this.ringBuffer[(i1 + 1) % this.bufferSize] * f1;
      const w1 = this.grainWindow[Math.floor(this.phase1) % this.grainLen];

      outChannel[i] = v0 * w0 + v1 * w1;

      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.phase0 = (this.phase0 + 1) % this.grainLen;
      this.phase1 = (this.phase1 + 1) % this.grainLen;
    }

    return true;
  }
}

registerProcessor('voicefx-processor', VoiceFXProcessor);
`;

// ScriptProcessor fallback for 100% universal guarantee
class FallbackVoiceFXDSP {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.bufferSize = 32768;
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;

    this.grainLen = 1536;
    this.halfGrain = this.grainLen / 2;
    this.grainWindow = new Float32Array(this.grainLen);
    for (let i = 0; i < this.grainLen; i++) {
      this.grainWindow[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.grainLen));
    }
    this.phase0 = 0.0;
    this.phase1 = this.halfGrain;

    this.oscPhaseA = 0.0;
    this.oscPhaseB = 0.0;
    this.vocalEnv = 0.0;
    this.lpVoice = 0.0;
    this.atRatio = 1.0;
    this.atCounter = 0;

    this.mode = 0;
    this.pitchRatio = 1.0;
  }

  detectPitchAMDF(buf, startIdx, sr) {
    const minP = Math.floor(sr / 480);
    const maxP = Math.floor(sr / 85);
    let bestP = 0;
    let minD = Infinity;

    for (let tau = minP; tau <= maxP; tau += 2) {
      let diff = 0;
      for (let i = 0; i < 384; i += 2) {
        const idxA = (startIdx + i) % this.bufferSize;
        const idxB = (startIdx + i + tau) % this.bufferSize;
        diff += Math.abs(buf[idxA] - buf[idxB]);
      }
      if (diff < minD) {
        minD = diff;
        bestP = tau;
      }
    }
    if (minD > 65 || bestP === 0) return 0;
    return sr / bestP;
  }

  processBlock(inChannel, outChannel) {
    const len = inChannel.length;
    if (this.mode === 0) {
      outChannel.set(inChannel);
      return;
    }

    if (this.mode === 2) {
      const sr = this.sampleRate;
      const freqA = 110.0;
      const freqB = 164.81;

      for (let i = 0; i < len; i++) {
        const inS = inChannel[i];
        this.oscPhaseA = (this.oscPhaseA + freqA / sr) % 1.0;
        this.oscPhaseB = (this.oscPhaseB + freqB / sr) % 1.0;

        const cA = Math.sin(2.0 * Math.PI * this.oscPhaseA);
        const cB = (this.oscPhaseB < 0.5 ? 0.35 : -0.35);
        const carrier = cA * 0.65 + cB * 0.35;

        this.vocalEnv = this.vocalEnv * 0.96 + Math.abs(inS) * 0.04;
        this.lpVoice = this.lpVoice * 0.88 + inS * 0.12;
        const sibilance = inS - this.lpVoice;

        outChannel[i] = carrier * this.vocalEnv * 2.8 + sibilance * 0.32;
      }
      return;
    }

    let effRatio = this.pitchRatio;
    if (this.mode === 3) {
      this.atCounter += len;
      if (this.atCounter >= 256) {
        this.atCounter = 0;
        const start = (this.writeIndex - 1024 + this.bufferSize) % this.bufferSize;
        const pitch = this.detectPitchAMDF(this.ringBuffer, start, this.sampleRate);
        if (pitch > 80 && pitch < 500) {
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

    for (let i = 0; i < len; i++) {
      const inS = inChannel[i];
      this.ringBuffer[this.writeIndex] = inS;

      const delay0 = this.halfGrain + this.phase0 * (1.0 - effRatio);
      let r0 = this.writeIndex - delay0;
      while (r0 < 0) r0 += this.bufferSize;
      while (r0 >= this.bufferSize) r0 -= this.bufferSize;
      const i0 = Math.floor(r0);
      const f0 = r0 - i0;
      const v0 = this.ringBuffer[i0] * (1.0 - f0) + this.ringBuffer[(i0 + 1) % this.bufferSize] * f0;
      const w0 = this.grainWindow[Math.floor(this.phase0) % this.grainLen];

      const delay1 = this.halfGrain + this.phase1 * (1.0 - effRatio);
      let r1 = this.writeIndex - delay1;
      while (r1 < 0) r1 += this.bufferSize;
      while (r1 >= this.bufferSize) r1 -= this.bufferSize;
      const i1 = Math.floor(r1);
      const f1 = r1 - i1;
      const v1 = this.ringBuffer[i1] * (1.0 - f1) + this.ringBuffer[(i1 + 1) % this.bufferSize] * f1;
      const w1 = this.grainWindow[Math.floor(this.phase1) % this.grainLen];

      outChannel[i] = v0 * w0 + v1 * w1;

      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.phase0 = (this.phase0 + 1) % this.grainLen;
      this.phase1 = (this.phase1 + 1) % this.grainLen;
    }
  }
}

class VoiceChangerEngine {
  constructor() {
    this.activePreset = 'none';
    this.lastActivePreset = 'autotune';
    this.isMonitoringEnabled = true; // Hear yourself in headphones by default for instant feedback
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

    // Always ensure audio context is active
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
    for (let i = 0; i < array.length; i++) {
      sum += array[i];
    }
    return Math.min(1.0, (sum / (array.length * 255)) * 2.2);
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

    // Trigger tactical military roger beep when leaving walkie-talkie
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
    if (this.onStateChange) this.onStateChange(this.activePreset);
  }

  setMonitoringVolume(val) {
    this.monitoringVolume = Math.max(0, Math.min(1.5, val));
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

  // Realistic military Roger Beep + Static burst
  playRogerBeep() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Filtered static burst ("Krrsh")
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.10);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(2.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.outputNode);
      noiseSource.start(now);

      // 2. High tactical Roger Beep tone (1250 Hz)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1250, now + 0.02);
      oscGain.gain.setValueAtTime(0.18, now + 0.02);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(oscGain);
      oscGain.connect(this.outputNode);
      osc.start(now + 0.02);
      osc.stop(now + 0.11);
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

  // Create core VoiceFX Node (AudioWorklet with ScriptProcessor fallback)
  createFXNode(mode = 0, pitchRatio = 1.0) {
    const now = this.ctx.currentTime;
    if (this.workletSupported) {
      try {
        const atNode = new AudioWorkletNode(this.ctx, 'voicefx-processor');
        const mParam = atNode.parameters.get('mode');
        if (mParam) mParam.setValueAtTime(mode, now);
        const pParam = atNode.parameters.get('pitchRatio');
        if (pParam) pParam.setValueAtTime(pitchRatio, now);
        return atNode;
      } catch (e) {
        console.warn("Worklet instantiation fallback:", e.message);
      }
    }

    // Fallback: ScriptProcessorNode
    const spNode = this.ctx.createScriptProcessor(1024, 1, 1);
    const dsp = new FallbackVoiceFXDSP(this.ctx.sampleRate);
    dsp.mode = mode;
    dsp.pitchRatio = pitchRatio;
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

  // Rebuild the DSP graph for the selected preset
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
      const fxNode = this.createFXNode(3, 1.0); // Mode 3 = Auto-Tune

      // Ping-Pong Delay & Studio Reverb
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(0.16, now);
      const feedback = this.ctx.createGain();
      feedback.gain.setValueAtTime(0.28, now);
      delay.connect(feedback);
      feedback.connect(delay);

      const delayWet = this.ctx.createGain();
      delayWet.gain.setValueAtTime(0.32, now);
      delay.connect(delayWet);
      delayWet.connect(this.outputNode);

      // High-shelf clarity polish (8 kHz)
      const highShelf = this.ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(7500, now);
      highShelf.gain.setValueAtTime(4.0, now);

      this.inputNode.connect(fxNode);
      fxNode.connect(highShelf);
      highShelf.connect(this.outputNode);
      highShelf.connect(delay);

      this.currentFxNodes.push(fxNode, delay, feedback, delayWet, highShelf);
      return;
    }

    // 3. Robot / Vocoder Daft Punk (Dual-Carrier Synth + Formant Sibilance)
    if (preset === 'robot') {
      const fxNode = this.createFXNode(2, 1.0); // Mode 2 = Vocoder

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1400, now);
      bandpass.Q.setValueAtTime(2.0, now);

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
      const demonPitch = this.createFXNode(1, 0.612); // -8.5 semitones

      // Sub-octave parallel layer (-12 semitones = full octave down)
      const subOctave = this.createFXNode(1, 0.50);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.35, now);
      subOctave.connect(subGain);

      // 85Hz Sub-bass chest resonance boost
      const subBoost = this.ctx.createBiquadFilter();
      subBoost.type = 'lowshelf';
      subBoost.frequency.setValueAtTime(85, now);
      subBoost.gain.setValueAtTime(9.0, now);

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(3400, now);

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

      const heliumPitch = this.createFXNode(1, 1.74); // +9.5 semitones

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

    // 6. Mégaphone de Police (Bandpass 650Hz-2500Hz + Pavillon 1250Hz + Echo Slapback 22ms)
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
      hornPeak.gain.setValueAtTime(8.0, now);
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
