/**
 * AutoTune AudioWorklet Processor — "Mode Travis Scott / PNL"
 *
 * Real-time monophonic pitch correction running inside an AudioWorklet.
 *
 * Pipeline per quantum (128 samples @ 48 kHz):
 *   1.  Accumulate samples into a 2048-sample ring buffer.
 *   2.  Run the YIN pitch detector on the ring buffer.
 *   3.  If a voiced pitch is found, compute the nearest chromatic semitone.
 *   4.  Pitch-shift via granular overlap-add (two 512-sample grains, Hann window,
 *       50 % overlap) to reach the target frequency — hard snap, no portamento.
 *   5.  Mix dry / wet according to the `dryWet` AudioParam.
 *
 * AudioParams:
 *   correctionAmount  0.0 … 1.0  (default 1.0) — 1.0 = hard snap
 *   dryWet            0.0 … 1.0  (default 1.0) — 1.0 = fully processed
 *
 * Registered name: 'autotune-processor'
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SAMPLE_RATE       = 48000;
const RING_SIZE         = 2048;   // samples kept for YIN analysis
const GRAIN_SIZE        = 512;    // granular synthesis grain length
const GRAIN_OVERLAP     = 0.5;    // 50 % overlap → hop = GRAIN_SIZE / 2
const HOP_SIZE          = (GRAIN_SIZE * GRAIN_OVERLAP) | 0; // 256
const MIN_FREQ          = 80;     // Hz  — lowest pitch we detect
const MAX_FREQ          = 800;    // Hz  — highest pitch we detect
const YIN_THRESHOLD     = 0.15;   // confidence threshold for YIN
const TAU_MIN           = Math.floor(SAMPLE_RATE / MAX_FREQ);  //  60
const TAU_MAX           = Math.floor(SAMPLE_RATE / MIN_FREQ);  // 600
const A4_FREQ           = 440.0;

// Pre-compute Hann window for grains
const hannWindow = new Float32Array(GRAIN_SIZE);
for (let i = 0; i < GRAIN_SIZE; i++) {
  hannWindow[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (GRAIN_SIZE - 1)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the nearest chromatic semitone frequency for a given Hz value.
 * Uses equal-temperament tuning: f = A4 * 2^(n/12).
 */
function snapToChromatic(freq) {
  // n = 12 * log2(freq / A4)
  const semitones = 12.0 * Math.log2(freq / A4_FREQ);
  const rounded   = Math.round(semitones);
  return A4_FREQ * Math.pow(2.0, rounded / 12.0);
}

/**
 * YIN pitch detection on a Float32Array buffer.
 * Returns detected frequency in Hz, or 0 if unvoiced / uncertain.
 */
function yinDetectPitch(buf, sampleRate) {
  const halfLen = Math.min((buf.length / 2) | 0, TAU_MAX + 1);
  if (halfLen <= TAU_MIN) return 0;

  // Step 1 + 2: Difference function
  const diff = new Float32Array(halfLen);
  for (let tau = 1; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 3: Cumulative mean normalized difference (CMND)
  const cmnd = new Float32Array(halfLen);
  cmnd[0] = 1.0;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1.0;
  }

  // Step 4: Absolute threshold — find first tau where cmnd < threshold
  let bestTau = -1;
  for (let tau = TAU_MIN; tau < halfLen; tau++) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      // Walk forward while cmnd keeps decreasing (find local minimum)
      while (tau + 1 < halfLen && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau < 1) return 0;

  // Step 5: Parabolic interpolation around bestTau for sub-sample accuracy
  let betterTau = bestTau;
  if (bestTau > 0 && bestTau < halfLen - 1) {
    const s0 = cmnd[bestTau - 1];
    const s1 = cmnd[bestTau];
    const s2 = cmnd[bestTau + 1];
    const denom = 2.0 * s1 - s2 - s0;
    if (Math.abs(denom) > 1e-12) {
      betterTau = bestTau + (s0 - s2) / (2.0 * denom);
    }
  }

  if (betterTau <= 0) return 0;

  const freq = sampleRate / betterTau;
  if (freq < MIN_FREQ || freq > MAX_FREQ) return 0;
  return freq;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------
class AutotuneProcessor extends AudioWorkletProcessor {

  static get parameterDescriptors() {
    return [
      { name: 'correctionAmount', defaultValue: 1.0, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'dryWet',           defaultValue: 1.0, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super(options);

    // Ring buffer for pitch detection (last RING_SIZE input samples)
    this.ringBuffer = new Float32Array(RING_SIZE);
    this.ringWritePos = 0;

    // Granular synthesis state
    // We maintain two grains that overlap by 50 %.
    // grainPhase tracks how many samples into the current grain pair we are.
    this.grainPhase = 0;

    // Grain read buffers — double-buffered so we always have two overlapping
    // grains in flight.  Each grain is GRAIN_SIZE samples extracted from the
    // ring buffer at a resampled rate.
    this.grainA = new Float32Array(GRAIN_SIZE);
    this.grainB = new Float32Array(GRAIN_SIZE);
    this.grainAReady = false;
    this.grainBReady = false;

    // Pitch tracking
    this.detectedPitch = 0;    // Hz, 0 = unvoiced
    this.targetPitch   = 0;    // Hz after chromatic snap
    this.pitchRatio    = 1.0;  // target / detected

    // Analysis counter — run YIN every HOP_SIZE samples to save CPU
    this.analysisCounter = 0;

    // Output overlap-add buffer (circular)
    this.olaBuffer = new Float32Array(GRAIN_SIZE * 2);
    this.olaReadPos = 0;
    this.olaWritePos = 0;

    // Grain scheduling positions within the ring buffer
    this.grainReadPos = 0;  // fractional read cursor for resampling
  }

  /**
   * Fill a grain buffer by reading GRAIN_SIZE samples from the ring buffer
   * with resampling at `pitchRatio`.
   */
  fillGrain(grain, startReadPos, ratio) {
    for (let i = 0; i < GRAIN_SIZE; i++) {
      // Fractional position in the ring buffer
      const readPos = startReadPos + i * ratio;
      const idx  = Math.floor(readPos);
      const frac = readPos - idx;

      // Wrap into ring buffer with modulo
      const i0 = ((idx % RING_SIZE) + RING_SIZE) % RING_SIZE;
      const i1 = ((idx + 1) % RING_SIZE + RING_SIZE) % RING_SIZE;

      // Linear interpolation
      grain[i] = this.ringBuffer[i0] * (1.0 - frac) + this.ringBuffer[i1] * frac;

      // Apply Hann window
      grain[i] *= hannWindow[i];
    }
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0];
    const output = outputs[0];

    // Mono processing — use first channel only
    if (!input || !input[0] || !output || !output[0]) return true;

    const inChannel  = input[0];
    const outChannel = output[0];
    const blockSize  = inChannel.length; // 128

    const correctionAmount = parameters.correctionAmount.length > 1
      ? parameters.correctionAmount[0]
      : parameters.correctionAmount[0];
    const dryWet = parameters.dryWet.length > 1
      ? parameters.dryWet[0]
      : parameters.dryWet[0];

    // ------------------------------------------------------------------
    // 1.  Write input into ring buffer
    // ------------------------------------------------------------------
    for (let i = 0; i < blockSize; i++) {
      this.ringBuffer[this.ringWritePos] = inChannel[i];
      this.ringWritePos = (this.ringWritePos + 1) % RING_SIZE;
    }

    // ------------------------------------------------------------------
    // 2.  Periodic pitch analysis (every HOP_SIZE samples)
    // ------------------------------------------------------------------
    this.analysisCounter += blockSize;
    if (this.analysisCounter >= HOP_SIZE) {
      this.analysisCounter -= HOP_SIZE;

      // Build a contiguous analysis buffer from the ring
      const analysisBuf = new Float32Array(RING_SIZE);
      for (let i = 0; i < RING_SIZE; i++) {
        analysisBuf[i] = this.ringBuffer[(this.ringWritePos + i) % RING_SIZE];
      }

      const detected = yinDetectPitch(analysisBuf, SAMPLE_RATE);

      if (detected > 0) {
        this.detectedPitch = detected;
        const snapped = snapToChromatic(detected);
        // Blend between detected and snapped based on correctionAmount
        this.targetPitch = detected + (snapped - detected) * correctionAmount;
        this.pitchRatio = detected / this.targetPitch;
      } else {
        // Unvoiced — pass through without pitch shift
        this.detectedPitch = 0;
        this.targetPitch   = 0;
        this.pitchRatio    = 1.0;
      }

      // Prepare new grain at current analysis point
      const grainStart = ((this.ringWritePos - RING_SIZE + RING_SIZE) % RING_SIZE);
      this.grainReadPos = grainStart + RING_SIZE - GRAIN_SIZE;

      // Alternate filling grains A and B for overlap
      if (!this.grainAReady) {
        this.fillGrain(this.grainA, this.grainReadPos, this.pitchRatio);
        this.grainAReady = true;
      } else {
        this.fillGrain(this.grainB, this.grainReadPos, this.pitchRatio);
        this.grainBReady = true;
      }
    }

    // ------------------------------------------------------------------
    // 3.  Granular overlap-add synthesis
    // ------------------------------------------------------------------
    // We produce output by overlapping grains.  grainPhase walks through
    // the current overlap window.  Every HOP_SIZE samples we add a new grain.

    for (let i = 0; i < blockSize; i++) {
      let wet = 0;

      // Contribution from grain A
      if (this.grainAReady && this.grainPhase < GRAIN_SIZE) {
        wet += this.grainA[this.grainPhase];
      }

      // Contribution from grain B (offset by HOP_SIZE)
      const bPhase = this.grainPhase - HOP_SIZE;
      if (this.grainBReady && bPhase >= 0 && bPhase < GRAIN_SIZE) {
        wet += this.grainB[bPhase];
      }

      this.grainPhase++;

      // When we reach the next hop boundary, cycle grains
      if (this.grainPhase >= HOP_SIZE * 2) {
        this.grainPhase = 0;
        // Swap: B becomes A, B is now stale and will be refilled at next analysis
        const tmp = this.grainA;
        this.grainA = this.grainB;
        this.grainB = tmp;
        this.grainAReady = this.grainBReady;
        this.grainBReady = false;
      }

      // Dry / wet mix
      const dry = inChannel[i];

      // If unvoiced or no correction, just pass dry through the wet path
      // to keep volume consistent.
      if (this.detectedPitch === 0 || correctionAmount === 0) {
        outChannel[i] = dry;
      } else {
        outChannel[i] = dry * (1.0 - dryWet) + wet * dryWet;
      }
    }

    // Copy channel 0 to all other output channels (mono → multi)
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(outChannel);
    }

    return true;
  }
}

registerProcessor('autotune-processor', AutotuneProcessor);
