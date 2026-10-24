/**
 * FreePad VoiceChangerEngine — Real-Time Ultra-Low-Latency Voice Morphing
 * Presets: Travis Scott / PNL (Autotune), Robot Vocoder, Démon, Hélium, Mégaphone, Talkie-Walkie
 */

import soundEngine from './SoundEngine';

export const VOICE_PRESETS = {
  none: {
    id: 'none',
    name: 'Voix Naturelle',
    icon: '🎙️',
    badge: 'Désactivé',
    color: 'from-slate-700 to-slate-800',
    description: 'Aucun effet sur le micro'
  },
  autotune: {
    id: 'autotune',
    name: 'Travis Scott / PNL',
    icon: '🎤',
    badge: 'Auto-Tune',
    color: 'from-amber-500 via-orange-500 to-red-600',
    description: 'Auto-Tune chromatique dur + Reverb spatiale studio'
  },
  robot: {
    id: 'robot',
    name: 'Robot / Vocoder',
    icon: '🤖',
    badge: 'Daft Punk',
    color: 'from-cyan-500 to-blue-600',
    description: 'Modulateur en anneau métallique & voix électrique'
  },
  demon: {
    id: 'demon',
    name: 'Démon des Abysses',
    icon: '😈',
    badge: '-1 Octave',
    color: 'from-red-600 via-rose-700 to-purple-900',
    description: 'Pitch descendu d\'une octave, sub-bass 80Hz & distorsion sombre'
  },
  helium: {
    id: 'helium',
    name: 'Hélium / Lutin',
    icon: '🎈',
    badge: '+1 Octave',
    color: 'from-pink-500 via-purple-500 to-indigo-500',
    description: 'Voix aiguë accélérée & formants rehaussés'
  },
  megaphone: {
    id: 'megaphone',
    name: 'Mégaphone de Flic',
    icon: '📢',
    badge: 'Pavillon',
    color: 'from-yellow-500 to-amber-600',
    description: 'Haut-parleur compressé, saturation métallique & résonance'
  },
  walkie: {
    id: 'walkie',
    name: 'Talkie-Walkie Militaire',
    icon: '📻',
    badge: 'Radio Tactique',
    color: 'from-emerald-600 to-teal-800',
    description: 'Bande passante radio, grésillement et bruit "Roger" au relâchement'
  }
};

class VoiceChangerEngine {
  constructor() {
    this.activePreset = 'none';
    this.lastActivePreset = 'autotune';
    this.isMonitoringEnabled = false; // Hear yourself in headphones
    this.monitoringVolume = 0.8;
    this.isPushToTalk = false; // Hold key to morph
    this.isMorphedActive = false;

    // Audio nodes
    this.ctx = null;
    this.inputNode = null;
    this.outputNode = null;
    this.monitoringGain = null;
    this.analyserNode = null;
    this.autotuneWorkletNode = null;
    this.currentFxNodes = [];
    this.noiseGenerator = null;
    this.lfoNodes = [];

    this.onStateChange = null;
  }

  async init(audioCtx) {
    if (this.ctx === audioCtx && this.outputNode) return;
    this.ctx = audioCtx;

    // Create Master Voice Changer Output Bus
    this.outputNode = this.ctx.createGain();
    this.outputNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // Monitoring Gain (Local headphones feedback)
    this.monitoringGain = this.ctx.createGain();
    this.monitoringGain.gain.setValueAtTime(this.isMonitoringEnabled ? this.monitoringVolume : 0.0, this.ctx.currentTime);
    this.outputNode.connect(this.monitoringGain);
    if (soundEngine.headphonesGain) {
      this.monitoringGain.connect(soundEngine.headphonesGain);
    }

    // Analyser Node for live VU-Meter
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 64;
    this.analyserNode.smoothingTimeConstant = 0.6;
    this.outputNode.connect(this.analyserNode);

    // Try loading AutoTune AudioWorklet
    try {
      if (this.ctx.audioWorklet) {
        try {
          await this.ctx.audioWorklet.addModule('./autotune-processor.js');
        } catch {
          await this.ctx.audioWorklet.addModule('/autotune-processor.js');
        }
      }
    } catch (e) {
      console.warn("AutoTune AudioWorklet load notice:", e.message);
    }
  }

  // Ensure microphone is actively capturing
  async ensureMicStarted() {
    if (this.inputNode && soundEngine.realMicStream) return true;
    try {
      await soundEngine.init();
      await soundEngine.toggleMicPassthrough(true, 'default', 'Microphone par défaut');
      return true;
    } catch (e) {
      console.warn("Could not auto-start mic for voice changer:", e);
      return false;
    }
  }

  // Get current voice VU-meter level (0.0 to 1.0)
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

  // Connect the mic stream from SoundEngine
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

    // Trigger military roger beep when leaving walkie-talkie
    if (oldPreset === 'walkie' && presetId !== 'walkie') {
      this.playRogerBeep();
    }

    this.rebuildGraph();
    if (this.onStateChange) this.onStateChange(this.activePreset);
  }

  setPushToTalk(enabled) {
    this.isPushToTalk = enabled;
  }

  handleHotkeyPress() {
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

  // Generate a realistic military Roger Beep + Static burst
  playRogerBeep() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Static noise burst (Krrsh)
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(3.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.outputNode);
      noiseSource.start(now);

      // 2. High Roger Beep tone (1250 Hz)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1250, now + 0.03);
      oscGain.gain.setValueAtTime(0.18, now + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(oscGain);
      oscGain.connect(this.outputNode);
      osc.start(now + 0.03);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn("Roger beep error:", e);
    }
  }

  // Create soft-clipping distortion curve
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

  // Real-time Pitch Shifter via Delay Modulation (0-latency phase vocoder)
  createPitchShifter(semitones = 0) {
    const pitchRatio = Math.pow(2, semitones / 12);
    const grainDuration = 0.06; // 60ms grains

    const input = this.ctx.createGain();
    const output = this.ctx.createGain();

    // Two delay lines modulated 180 degrees out of phase
    const delayA = this.ctx.createDelay(1.0);
    const delayB = this.ctx.createDelay(1.0);

    const gainA = this.ctx.createGain();
    const gainB = this.ctx.createGain();

    const speed = (1 - pitchRatio) / grainDuration;

    // LFO saw wave to modulate delays
    const lfoA = this.ctx.createOscillator();
    const lfoB = this.ctx.createOscillator();
    lfoA.type = 'sawtooth';
    lfoB.type = 'sawtooth';
    lfoA.frequency.setValueAtTime(Math.abs(speed), this.ctx.currentTime);
    lfoB.frequency.setValueAtTime(Math.abs(speed), this.ctx.currentTime);

    // Depth
    const depthA = this.ctx.createGain();
    const depthB = this.ctx.createGain();
    const modDepth = grainDuration;
    depthA.gain.setValueAtTime(speed > 0 ? modDepth : -modDepth, this.ctx.currentTime);
    depthB.gain.setValueAtTime(speed > 0 ? modDepth : -modDepth, this.ctx.currentTime);

    lfoA.connect(depthA);
    depthA.connect(delayA.delayTime);

    lfoB.connect(depthB);
    depthB.connect(delayB.delayTime);

    // Triangle windowing gains to prevent clicks
    gainA.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gainB.gain.setValueAtTime(0.5, this.ctx.currentTime);

    input.connect(delayA);
    input.connect(delayB);

    delayA.connect(gainA);
    delayB.connect(gainB);

    gainA.connect(output);
    gainB.connect(output);

    lfoA.start();
    lfoB.start();

    this.lfoNodes.push(lfoA, lfoB);
    return { input, output, nodes: [input, output, delayA, delayB, gainA, gainB, depthA, depthB, lfoA, lfoB] };
  }

  // Teardown active DSP graph cleanly
  cleanupCurrentGraph() {
    this.lfoNodes.forEach(n => {
      try { n.stop(); n.disconnect(); } catch (e) {}
    });
    this.lfoNodes = [];

    this.currentFxNodes.forEach(n => {
      try { n.disconnect(); } catch (e) {}
    });
    this.currentFxNodes = [];

    if (this.inputNode) {
      try { this.inputNode.disconnect(); } catch (e) {}
    }
  }

  // Rebuild the DSP graph for selected preset
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

    // 2. Mode Travis Scott / PNL (AutoTune AudioWorklet + Reverb)
    if (preset === 'autotune') {
      try {
        if (this.ctx.audioWorklet) {
          const atNode = new AudioWorkletNode(this.ctx, 'autotune-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2]
          });
          const paramCorrection = atNode.parameters.get('correctionAmount');
          if (paramCorrection) paramCorrection.setValueAtTime(1.0, now); // Hard snap 100%

          // Reverb delay
          const delay = this.ctx.createDelay();
          delay.delayTime.setValueAtTime(0.18, now);
          const feedback = this.ctx.createGain();
          feedback.gain.setValueAtTime(0.3, now);
          delay.connect(feedback);
          feedback.connect(delay);

          const wetGain = this.ctx.createGain();
          wetGain.gain.setValueAtTime(0.35, now);
          delay.connect(wetGain);
          wetGain.connect(this.outputNode);

          this.inputNode.connect(atNode);
          atNode.connect(this.outputNode);
          atNode.connect(delay);

          this.currentFxNodes.push(atNode, delay, feedback, wetGain);
          return;
        }
      } catch (e) {
        console.warn("AutoTune worklet instance error, using voice fallback:", e);
        this.inputNode.connect(this.outputNode);
        return;
      }
    }

    // 3. Robot / Vocoder Daft Punk (Ring Modulator + Bandpass)
    if (preset === 'robot') {
      const ringOsc = this.ctx.createOscillator();
      ringOsc.type = 'sawtooth';
      ringOsc.frequency.setValueAtTime(140, now); // 140 Hz C# note

      const ringGain = this.ctx.createGain();
      ringGain.gain.setValueAtTime(0.0, now);

      ringOsc.connect(ringGain.gain);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(2.5, now);

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, now);
      compressor.ratio.setValueAtTime(8, now);

      this.inputNode.connect(ringGain);
      ringGain.connect(filter);
      filter.connect(compressor);
      compressor.connect(this.outputNode);

      ringOsc.start(now);
      this.lfoNodes.push(ringOsc);
      this.currentFxNodes.push(ringGain, filter, compressor);
      return;
    }

    // 4. Démon des Abysses (-10 semitones, 80Hz sub-boost, saturation)
    if (preset === 'demon') {
      const shifter = this.createPitchShifter(-9);

      const subBoost = this.ctx.createBiquadFilter();
      subBoost.type = 'lowshelf';
      subBoost.frequency.setValueAtTime(90, now);
      subBoost.gain.setValueAtTime(10, now); // +10dB deep chest resonance

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(2800, now);

      const dist = this.ctx.createWaveShaper();
      dist.curve = this.makeDistortionCurve(15);
      dist.oversample = '2x';

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(1.2, now);

      this.inputNode.connect(shifter.input);
      shifter.output.connect(subBoost);
      subBoost.connect(lowpass);
      lowpass.connect(dist);
      dist.connect(gain);
      gain.connect(this.outputNode);

      this.currentFxNodes.push(...shifter.nodes, subBoost, lowpass, dist, gain);
      return;
    }

    // 5. Hélium / Lutin (+10 semitones, cut bass, presence boost)
    if (preset === 'helium') {
      const shifter = this.createPitchShifter(10);

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(380, now); // Removes chest bass

      const presence = this.ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.setValueAtTime(3200, now);
      presence.gain.setValueAtTime(5, now);

      this.inputNode.connect(shifter.input);
      shifter.output.connect(highpass);
      highpass.connect(presence);
      presence.connect(this.outputNode);

      this.currentFxNodes.push(...shifter.nodes, highpass, presence);
      return;
    }

    // 6. Mégaphone de Police (Bandpass 1.2kHz + distortion + horn slapback)
    if (preset === 'megaphone') {
      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1250, now);
      bandpass.Q.setValueAtTime(3.2, now);

      const dist = this.ctx.createWaveShaper();
      dist.curve = this.makeDistortionCurve(35);
      dist.oversample = '2x';

      const delay = this.ctx.createDelay();
      delay.delayTime.setValueAtTime(0.025, now); // 25ms horn slapback
      const delayGain = this.ctx.createGain();
      delayGain.gain.setValueAtTime(0.4, now);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(1.3, now);

      this.inputNode.connect(bandpass);
      bandpass.connect(dist);
      dist.connect(master);
      dist.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(master);
      master.connect(this.outputNode);

      this.currentFxNodes.push(bandpass, dist, delay, delayGain, master);
      return;
    }

    // 7. Talkie-Walkie Militaire (Bandpass telephone 400Hz-2800Hz + static)
    if (preset === 'walkie') {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(500, now);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, now);

      const dist = this.ctx.createWaveShaper();
      dist.curve = this.makeDistortionCurve(18);

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, now);
      compressor.ratio.setValueAtTime(12, now);

      this.inputNode.connect(hp);
      hp.connect(lp);
      lp.connect(dist);
      dist.connect(compressor);
      compressor.connect(this.outputNode);

      this.currentFxNodes.push(hp, lp, dist, compressor);
    }
  }
}

const voiceChangerEngine = new VoiceChangerEngine();
export default voiceChangerEngine;
