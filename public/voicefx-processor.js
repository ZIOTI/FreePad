/**
 * FreePad VoiceFX AudioWorklet Processor — Studio-Grade Real-Time DSP
 * Fait par zioti
 *
 * Implements:
 *   - Constant-Power 3-Tap Granular Pitch Shifter (Zero Flutter, Zero Dropouts)
 *   - Fast AMDF Chromatic Pitch Tracker (0 ms hard snap Auto-Tune)
 *   - Dual-Carrier Daft Punk Synth Vocoder with Sibilance Consonant Preservation
 */

class VoiceFXProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 4 }, // 0: bypass, 1: pitch, 2: robot, 3: autotune
      { name: 'pitchRatio', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 }
    ];
  }

  constructor() {
    super();
    this.sampleRate = 48000;
    this.bufferSize = 16384;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;

    // Grain size: 1536 samples (32ms at 48kHz)
    this.grainSize = 1536;
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.grainSize));
    }

    // Three equidistant taps for constant-power crossfading
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
    const minP = Math.floor(sr / 480); // ~100 samples (480 Hz)
    const maxP = Math.floor(sr / 80);  // ~600 samples (80 Hz)
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

        // Rich analog-style pulse and saw harmonics
        const saw = (this.oscPhaseA * 2.0) - 1.0;
        const pulse = (this.oscPhaseB < 0.5 ? 0.45 : -0.45);
        const carrier = saw * 0.65 + pulse * 0.35;

        // Dynamic vocal envelope follower
        this.vocalEnv = this.vocalEnv * 0.95 + Math.abs(inS) * 0.05;
        this.lpVoice = this.lpVoice * 0.86 + inS * 0.14;
        const sibilance = inS - this.lpVoice; // Preserves unvoiced fricatives: "s", "t", "sh"

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
          // Snap instantly to closest chromatic semitone (0 ms retune speed)
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
    const norm = 2.0 / 3.0; // Exact normalization factor for 3 overlapping Hann windows

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
