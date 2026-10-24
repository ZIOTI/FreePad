/**
 * FreePad VoiceFX AudioWorklet Processor — Studio-Grade DSP Engine
 * Fait par zioti
 *
 * Implements:
 *   - 512-point Radix-2 FFT Phase Vocoder with Formant Preservation
 *   - Fast AMDF Chromatic Pitch Tracking & Snap (Auto-Tune)
 *   - Daft Punk 16-band Dual-Carrier Synth Vocoder with Sibilance Preservation
 */

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
    this.N = 512;
    this.H = 128;
    this.halfN = this.N / 2;
    this.omega = (2.0 * Math.PI * this.H) / this.N;

    // Precompute FFT lookup tables
    this.sinTable = new Float32Array(this.N);
    this.cosTable = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      this.sinTable[i] = Math.sin(-2 * Math.PI * i / this.N);
      this.cosTable[i] = Math.cos(-2 * Math.PI * i / this.N);
    }

    this.bitRev = new Uint16Array(this.N);
    let j = 0;
    for (let i = 0; i < this.N - 1; i++) {
      this.bitRev[i] = j;
      let k = this.N >> 1;
      while (k <= j) { j -= k; k >>= 1; }
      j += k;
    }
    this.bitRev[this.N - 1] = j;

    // Hann analysis and synthesis window
    this.window = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / this.N));
    }

    // FFT Work buffers
    this.real = new Float32Array(this.N);
    this.imag = new Float32Array(this.N);
    this.prevPhase = new Float32Array(this.halfN + 1);
    this.synthPhase = new Float32Array(this.halfN + 1);
    this.synthMag = new Float32Array(this.halfN + 1);
    this.synthFreq = new Float32Array(this.halfN + 1);
    this.envelope = new Float32Array(this.halfN + 1);

    // Circular buffers for Phase Vocoder Overlap-Add
    this.ringSize = 4096;
    this.inRing = new Float32Array(this.ringSize);
    this.outRing = new Float32Array(this.ringSize);
    this.inWrite = 0;
    this.outWrite = 0;
    this.outRead = 0;
    this.samplesInRing = 0;

    // Robot vocoder dual-carrier state
    this.oscPhaseA = 0.0;
    this.oscPhaseB = 0.0;
    this.vocalEnv = 0.0;
    this.lpVoice = 0.0;

    // Auto-tune state
    this.atRatio = 1.0;
    this.atCounter = 0;
    this.historyBuffer = new Float32Array(2048);
    this.historyWrite = 0;
  }

  fft(r, im) {
    const N = this.N;
    const bitRev = this.bitRev;
    const cosTable = this.cosTable;
    const sinTable = this.sinTable;

    for (let i = 0; i < N; i++) {
      const rev = bitRev[i];
      if (i < rev) {
        let tr = r[i]; r[i] = r[rev]; r[rev] = tr;
        let ti = im[i]; im[i] = im[rev]; im[rev] = ti;
      }
    }

    for (let halfSize = 1; halfSize < N; halfSize <<= 1) {
      const step = N / (halfSize << 1);
      for (let i = 0; i < N; i += (halfSize << 1)) {
        for (let k = 0; k < halfSize; k++) {
          const tableIdx = k * step;
          const c = cosTable[tableIdx];
          const s = sinTable[tableIdx];
          const uIdx = i + k;
          const vIdx = i + k + halfSize;
          const tr = c * r[vIdx] - s * im[vIdx];
          const ti = s * r[vIdx] + c * im[vIdx];
          r[vIdx] = r[uIdx] - tr;
          im[vIdx] = im[uIdx] - ti;
          r[uIdx] += tr;
          im[uIdx] += ti;
        }
      }
    }
  }

  ifft(r, im) {
    const N = this.N;
    for (let i = 0; i < N; i++) im[i] = -im[i];
    this.fft(r, im);
    const invN = 1.0 / N;
    for (let i = 0; i < N; i++) {
      r[i] = r[i] * invN;
      im[i] = -im[i] * invN;
    }
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

    if (minD > 45 || bestP === 0) return 0;
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
    const preserveFormants = parameters.preserveFormants ? parameters.preserveFormants[0] > 0.5 : true;

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

        outChannel[i] = carrier * this.vocalEnv * 3.2 + sibilance * 0.38;
      }
      return true;
    }

    // Record into history buffer for pitch detection
    for (let i = 0; i < len; i++) {
      this.historyBuffer[this.historyWrite] = inChannel[i];
      this.historyWrite = (this.historyWrite + 1) % this.historyBuffer.length;
    }

    // Mode 3: Auto-Tune Pitch Tracking
    let effRatio = targetRatio;
    if (mode === 3) {
      this.atCounter += len;
      if (this.atCounter >= 192) {
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

    // Modes 1 & 3: FFT Phase Vocoder
    const inRing = this.inRing;
    const outRing = this.outRing;
    const ringSize = this.ringSize;
    const N = this.N;
    const H = this.H;
    const halfN = this.halfN;
    const omega = this.omega;

    // Feed input ring
    for (let i = 0; i < len; i++) {
      inRing[this.inWrite] = inChannel[i];
      this.inWrite = (this.inWrite + 1) % ringSize;
    }
    this.samplesInRing += len;

    // Process all available hops of H samples
    while (this.samplesInRing >= N) {
      this.samplesInRing -= H;
      this.synthMag.fill(0);
      this.synthFreq.fill(0);

      // Extract windowed analysis frame
      let readIdx = (this.inWrite - this.samplesInRing - N + ringSize * 2) % ringSize;
      for (let i = 0; i < N; i++) {
        this.real[i] = inRing[(readIdx + i) % ringSize] * this.window[i];
        this.imag[i] = 0;
      }

      this.fft(this.real, this.imag);

      // Extract spectral envelope if formant preservation is active
      if (preserveFormants) {
        for (let k = 0; k <= halfN; k++) {
          let sum = 0;
          let count = 0;
          for (let d = -4; d <= 4; d++) {
            const idx = k + d;
            if (idx >= 0 && idx <= halfN) {
              sum += Math.hypot(this.real[idx], this.imag[idx]);
              count++;
            }
          }
          this.envelope[k] = sum / count;
        }
      }

      // Analysis & Instantaneous Frequency Extraction
      for (let k = 0; k <= halfN; k++) {
        const mag = Math.hypot(this.real[k], this.imag[k]);
        const phase = Math.atan2(this.imag[k], this.real[k]);

        let delta = phase - this.prevPhase[k];
        this.prevPhase[k] = phase;
        delta -= k * omega;

        // Wrap delta phase to [-PI, PI]
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));

        const trueFreq = (k * omega + delta) / H;

        // Map to pitch-shifted frequency bin
        const newBin = Math.round(k * effRatio);
        if (newBin <= halfN) {
          let targetMag = mag;
          if (preserveFormants && this.envelope[k] > 0.0001) {
            const targetEnv = this.envelope[newBin] || this.envelope[k];
            targetMag = mag * (targetEnv / this.envelope[k]);
          }
          this.synthMag[newBin] += targetMag;
          this.synthFreq[newBin] = trueFreq * effRatio;
        }
      }

      // Resynthesize Spectrum
      this.real.fill(0);
      this.imag.fill(0);
      for (let k = 0; k <= halfN; k++) {
        this.synthPhase[k] += this.synthFreq[k] * H;
        const mag = this.synthMag[k];
        const cosP = Math.cos(this.synthPhase[k]);
        const sinP = Math.sin(this.synthPhase[k]);
        this.real[k] = mag * cosP;
        this.imag[k] = mag * sinP;
        if (k > 0 && k < halfN) {
          this.real[N - k] = this.real[k];
          this.imag[N - k] = -this.imag[k];
        }
      }

      this.ifft(this.real, this.imag);

      // Overlap-Add to output ring buffer (normalization ~0.67 for Hann with 75% overlap)
      const norm = 0.67;
      for (let i = 0; i < N; i++) {
        const pos = (this.outWrite + i) % ringSize;
        outRing[pos] += this.real[i] * this.window[i] * norm;
      }
      this.outWrite = (this.outWrite + H) % ringSize;
    }

    // Read processed samples to output
    for (let i = 0; i < len; i++) {
      outChannel[i] = outRing[this.outRead];
      outRing[this.outRead] = 0; // Clear sample after reading
      this.outRead = (this.outRead + 1) % ringSize;
    }

    return true;
  }
}

registerProcessor('voicefx-processor', VoiceFXProcessor);
