/**
 * FreePad VoiceFXProcessor — Professional Ultra-Low-Latency AudioWorklet
 * Fait par zioti
 *
 * Implements:
 *   - Granular Pitch Shifting with Periodic Hann Windowing (SOLA / PSOLA)
 *   - Dual-Carrier Daft Punk Synth Vocoder with Vowel Tracking & Sibilance Extraction
 *   - Real-Time Chromatic Auto-Tune with Fast AMDF Pitch Tracking
 */

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
    this.grainLen = 1536;
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
    const minP = Math.floor(sr / 480); // ~100 samples
    const maxP = Math.floor(sr / 85);  // ~564 samples
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

    // Mode 0: Clean Bypass
    if (mode === 0) {
      outChannel.set(inChannel);
      return true;
    }

    // Mode 2: Robot / Vocoder (Daft Punk style)
    if (mode === 2) {
      const sr = this.sampleRate;
      const freqA = 110.0;   // A2 fundamental
      const freqB = 164.81;  // E3 musical fifth

      for (let i = 0; i < len; i++) {
        const inS = inChannel[i];
        this.oscPhaseA = (this.oscPhaseA + freqA / sr) % 1.0;
        this.oscPhaseB = (this.oscPhaseB + freqB / sr) % 1.0;

        const cA = Math.sin(2.0 * Math.PI * this.oscPhaseA);
        const cB = (this.oscPhaseB < 0.5 ? 0.35 : -0.35);
        const carrier = cA * 0.65 + cB * 0.35;

        // Vowel dynamic envelope follower
        this.vocalEnv = this.vocalEnv * 0.96 + Math.abs(inS) * 0.04;
        this.lpVoice = this.lpVoice * 0.88 + inS * 0.12;
        const sibilance = inS - this.lpVoice;

        outChannel[i] = carrier * this.vocalEnv * 2.8 + sibilance * 0.32;
      }
      return true;
    }

    // Mode 3: Auto-Tune Pitch Tracking Update
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

    // Granular Pitch Shifter Engine (Used for Mode 1: Pitch & Mode 3: Auto-Tune)
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
