/**
 * FreePad SoundEngine — Dual-Output (Headphones + Mic Injection) with Microphone Passthrough
 */
import voiceChangerEngine from './VoiceChangerEngine';
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.broadcastCtx = null;
    this.audioCache = new Map(); // url -> AudioBuffer

    // Sources and state
    this.currentSources = [];
    this.currentSoundId = null;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.duration = 0;

    // Gain nodes
    this.headphonesGain = null;
    this.broadcastGain = null;
    this.broadcastMasterGain = null;
    this.broadcastLimiter = null;
    this.micPassthroughGain = null;
    this.compressor = null;
    this.analyser = null;
    this.micAnalyser = null;

    // Microphone Passthrough Stream
    this.realMicStream = null;
    this.realMicSourceNode = null;
    this.isMicPassthroughEnabled = false;

    // Device IDs
    this.localDeviceId = 'default';
    this.broadcastDeviceId = 'default';

    // Volumes (calibrated with headroom to prevent Windows/Discord saturation)
    this.headphonesVolume = 0.8;
    this.micVolume = 0.9;
    this.realMicVolume = 1.0;
    this.loudnessBoost = 1.3; // Extra punch
    this.isNormalized = true;
    this.isLooping = false;
    this.isApoMode = true; // Direct Hardware APO Injection
    this.isSoundpadMode = true; // Legacy alias
    this.playSessionId = 0; // Concurrency guard to eliminate double playback
    this.lastPlayTime = 0;
    this.lastPlaySoundId = null;

    // Callbacks
    this.onStateChange = null;
    this.onTimeUpdate = null;
    this.onEnded = null;

    this.rafId = null;
  }

  async get48kMonoPcm(buffer, volumeMultiplier = 1.0, loudnessBoost = 1.0, startOffset = 0) {
    try {
      const targetSampleRate = 48000;
      const duration = Math.max(0.01, buffer.duration - startOffset);
      const numFrames = Math.ceil(duration * targetSampleRate);
      const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const offlineCtx = new OfflineAudioContextClass(1, numFrames, targetSampleRate);

      const src = offlineCtx.createBufferSource();
      src.buffer = buffer;

      const gain = offlineCtx.createGain();
      // Keep clear sound level without digital distortion / clipping
      const effectiveGain = Math.min(1.15, (volumeMultiplier || 1.0) * (loudnessBoost || 1.0));
      gain.gain.setValueAtTime(effectiveGain, 0);

      src.connect(gain);
      gain.connect(offlineCtx.destination);

      src.start(0, startOffset);
      const rendered = await offlineCtx.startRendering();
      const float32 = rendered.getChannelData(0);

      // Clamp samples cleanly to [-1.0, 1.0] to avoid DAC / Discord saturation
      for (let i = 0; i < float32.length; i++) {
        if (float32[i] > 1.0) float32[i] = 1.0;
        else if (float32[i] < -1.0) float32[i] = -1.0;
      }

      const bytes = new Uint8Array(float32.buffer, float32.byteOffset, float32.byteLength);
      return Array.from(bytes);
    } catch (e) {
      console.warn("PCM conversion error:", e);
      return null;
    }
  }

  async init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

    // Local Headphones Master Gain
    this.headphonesGain = this.ctx.createGain();
    this.headphonesGain.gain.setValueAtTime(this.headphonesVolume, this.ctx.currentTime);

    // Dynamic Compressor for anti-saturation (Local headphones)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Analyser for real-time visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.8;

    // Connect Local Chain
    this.updateGraphRouting();

    // Create Second AudioContext for Broadcast / Virtual Microphone (Steam Streaming Mic / Voicemod)
    try {
      this.broadcastCtx = new AudioContextClass({ latencyHint: 'interactive' });

      // Master Broadcast Gain Bus
      this.broadcastMasterGain = this.broadcastCtx.createGain();
      this.broadcastMasterGain.gain.setValueAtTime(1.0, this.broadcastCtx.currentTime);

      // Studio Brickwall Limiter: clamps any sum above -3.0 dBFS so distortion is physically impossible
      this.broadcastLimiter = this.broadcastCtx.createDynamicsCompressor();
      this.broadcastLimiter.threshold.setValueAtTime(-3.0, this.broadcastCtx.currentTime);
      this.broadcastLimiter.knee.setValueAtTime(3.0, this.broadcastCtx.currentTime);
      this.broadcastLimiter.ratio.setValueAtTime(16.0, this.broadcastCtx.currentTime);
      this.broadcastLimiter.attack.setValueAtTime(0.002, this.broadcastCtx.currentTime);
      this.broadcastLimiter.release.setValueAtTime(0.05, this.broadcastCtx.currentTime);

      // Soundboard sound injection gain node: full volume with headroom
      this.broadcastGain = this.broadcastCtx.createGain();
      this.broadcastGain.gain.setValueAtTime(this.micVolume * this.loudnessBoost, this.broadcastCtx.currentTime);
      this.broadcastGain.connect(this.broadcastMasterGain);

      // Route: MasterBus -> Brickwall Limiter -> Destination (Single clean WASAPI endpoint - zero double routing)
      this.broadcastMasterGain.connect(this.broadcastLimiter);
      this.broadcastLimiter.connect(this.broadcastCtx.destination);

      if (this.broadcastDeviceId && this.broadcastDeviceId !== 'default') {
        this.setOutputDevice('broadcast', this.broadcastDeviceId).catch(() => {});
      } else {
        // Auto-detect virtual device (Voicemod, Steam, VB-Cable) for zero-config Discord routing
        this.autoDetectVirtualDevice().then(dev => {
          if (dev && this.broadcastDeviceId === 'default') {
            this.setOutputDevice('broadcast', dev.deviceId).catch(() => {});
          }
        });
      }
    } catch (e) {
      console.warn("Broadcast context:", e);
    }
  }

  async autoDetectVirtualDevice() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return null;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      const virtualKeywords = ['cable input', 'vb-audio', 'voicemod', 'steam streaming', 'steam', 'virtual', 'cable', 'ligne (voicemod'];
      for (const kw of virtualKeywords) {
        const found = outputs.find(d => d.label && d.label.toLowerCase().includes(kw));
        if (found) {
          console.log(`[SoundEngine] Auto-detected virtual broadcast device: ${found.label} (${found.deviceId})`);
          return found;
        }
      }
    } catch (e) {
      console.warn("Virtual device detection notice:", e);
    }
    return null;
  }

  ensureBroadcastBridge() {
    if (!this.ctx || !this.broadcastCtx) return;

    if (this.broadcastCtx.state === 'suspended') {
      this.broadcastCtx.resume().catch(() => {});
    }

    if (!this.micPassthroughGain) {
      this.micPassthroughGain = this.broadcastCtx.createGain();
      if (this.broadcastMasterGain) {
        this.micPassthroughGain.connect(this.broadcastMasterGain);
      } else {
        this.micPassthroughGain.connect(this.broadcastCtx.destination);
      }
    }
    this.micPassthroughGain.gain.setValueAtTime(this.realMicVolume, this.broadcastCtx.currentTime);

    if (!this.micBroadcastBridgeStream && voiceChangerEngine && voiceChangerEngine.outputNode) {
      try {
        this.micBroadcastBridgeDest = this.ctx.createMediaStreamDestination();
        voiceChangerEngine.outputNode.connect(this.micBroadcastBridgeDest);
        this.micBroadcastBridgeStream = this.broadcastCtx.createMediaStreamSource(this.micBroadcastBridgeDest.stream);
        this.micBroadcastBridgeStream.connect(this.micPassthroughGain);
      } catch (e) {
        console.warn("ensureBroadcastBridge bridge notice:", e);
      }
    }
  }

  updateGraphRouting() {
    if (!this.ctx) return;
    try {
      this.headphonesGain.disconnect();
      this.compressor.disconnect();
      this.analyser.disconnect();

      if (this.isNormalized) {
        this.headphonesGain.connect(this.compressor);
        this.compressor.connect(this.analyser);
      } else {
        this.headphonesGain.connect(this.analyser);
      }

      this.analyser.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Routing update:", e);
    }
  }

  async setOutputDevice(type, deviceId) {
    if (type === 'local') {
      this.localDeviceId = deviceId;
      if (this.ctx && typeof this.ctx.setSinkId === 'function') {
        try {
          await this.ctx.setSinkId(deviceId);
        } catch (e) {
          console.warn("Error setting local sink ID:", e);
        }
      }
    } else if (type === 'broadcast') {
      this.broadcastDeviceId = deviceId;
      if (this.broadcastCtx && typeof this.broadcastCtx.setSinkId === 'function') {
        try {
          await this.broadcastCtx.setSinkId(deviceId);
        } catch (e) {
          console.warn("Error setting broadcastCtx sink ID:", e);
        }
      }
      this.ensureBroadcastBridge();
    }
  }

  async toggleMicPassthrough(enabled, inputDeviceId = null, inputDeviceLabel = '') {
    if (!enabled || !inputDeviceId || inputDeviceId === 'none') {
      this.isMicPassthroughEnabled = false;
      this.stopRealMic();
      return;
    }

    // ANTI-FEEDBACK LOOP GUARD:
    // Never allow a virtual device (CABLE Output, Stereo Mix, Voicemeeter) to loop back into the broadcast bus!
    const lbl = (inputDeviceLabel || '').toLowerCase();
    const isVirtual = lbl.includes('cable') || lbl.includes('vb-audio') || lbl.includes('voicemeeter') || 
                      lbl.includes('virtual') || lbl.includes('stereo mix') || lbl.includes('mixage') || 
                      lbl.includes('what u hear');
    if (isVirtual) {
      console.warn("Anti-Feedback Loop Guard: Blocked virtual cable from being fed into broadcast output:", inputDeviceLabel);
      this.isMicPassthroughEnabled = false;
      this.stopRealMic();
      return { blocked: true, reason: 'feedback_loop_prevention' };
    }

    this.isMicPassthroughEnabled = true;

    try {
      await this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      if (this.broadcastCtx && this.broadcastCtx.state === 'suspended') {
        await this.broadcastCtx.resume();
      }

      // If already connected to this device and active, do not recreate stream
      if (this.realMicStream && this.realMicDeviceId === inputDeviceId && this.realMicStream.active) {
        return;
      }

      // Stop previous mic stream cleanly
      this.stopRealMic();

      // Fix Chromium OverconstrainedError: never use { exact: 'default' }
      const hasSpecificId = inputDeviceId && inputDeviceId !== 'default' && inputDeviceId !== 'none';
      const constraints = {
        audio: {
          deviceId: hasSpecificId ? { exact: inputDeviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };

      this.realMicStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.realMicDeviceId = inputDeviceId || 'default';

      // Create mic source and analyser in this.ctx
      this.realMicSourceNode = this.ctx.createMediaStreamSource(this.realMicStream);

      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 64;
      this.realMicSourceNode.connect(this.micAnalyser);

      // Connect Voice Changer Engine in this.ctx
      await voiceChangerEngine.init(this.ctx);
      voiceChangerEngine.connectMicSource(this.realMicSourceNode);

      // Connect local monitoring cleanly
      if (this.headphonesGain && voiceChangerEngine.monitoringGain) {
        try {
          voiceChangerEngine.monitoringGain.disconnect();
        } catch (e) {}
        voiceChangerEngine.monitoringGain.connect(this.headphonesGain);
      }

      // Forward morphed voice to broadcast bus (VB-Cable / Discord)
      this.ensureBroadcastBridge();
    } catch (err) {
      console.error("Failed to enable mic passthrough:", err);
      this.isMicPassthroughEnabled = false;
    }
  }

  stopRealMic() {
    if (this.realMicStream) {
      try { this.realMicStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this.realMicStream = null;
    }
    if (this.realMicSourceNode) {
      try { this.realMicSourceNode.disconnect(); } catch (e) {}
      this.realMicSourceNode = null;
    }
    if (this.micBroadcastBridgeStream) {
      try { this.micBroadcastBridgeStream.disconnect(); } catch (e) {}
      this.micBroadcastBridgeStream = null;
    }
    if (this.micBroadcastBridgeDest) {
      try { this.micBroadcastBridgeDest.disconnect(); } catch (e) {}
      this.micBroadcastBridgeDest = null;
    }
    voiceChangerEngine.stopApoVoiceStream();
    voiceChangerEngine.cleanupCurrentGraph();
  }

  async playTestTone() {
    await this.init();
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.broadcastCtx && this.broadcastCtx.state === 'suspended') await this.broadcastCtx.resume();

    const sr = 48000;
    const dur = 0.45;
    const frames = Math.floor(sr * dur);
    const floatArr = new Float32Array(frames);

    // Pleasant dual chime: 587 Hz (D5) -> 880 Hz (A5)
    for (let i = 0; i < frames; i++) {
      const t = i / sr;
      const freq = t < 0.22 ? 587.33 : 880.00;
      const env = Math.sin((i / frames) * Math.PI); // smooth bell envelope
      floatArr[i] = Math.sin(2 * Math.PI * freq * t) * 0.75 * env;
    }

    // 1. Play in user's headphones so they HEAR the test immediately
    if (this.ctx && this.headphonesGain) {
      try {
        const audioBuf = this.ctx.createBuffer(1, frames, sr);
        audioBuf.getChannelData(0).set(floatArr);
        const src = this.ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(this.headphonesGain);
        src.start(0);
      } catch (e) {
        console.warn("Test tone local error:", e);
      }
    }

    // 2. Play in broadcast channel (Discord / Vocal)
    if (this.isApoMode) {
      // Direct driver: send raw PCM to Windows APO driver
      if (window.electronAPI && typeof window.electronAPI.playApoPcm === 'function') {
        const bytes = new Uint8Array(floatArr.buffer);
        window.electronAPI.playApoPcm({ pcmArray: Array.from(bytes) }).catch(() => {});
      }
    } else {
      // VB-Cable: send to broadcastCtx destination
      if (this.broadcastCtx && this.broadcastGain) {
        try {
          const bBuf = this.broadcastCtx.createBuffer(1, frames, sr);
          bBuf.getChannelData(0).set(floatArr);
          const bSrc = this.broadcastCtx.createBufferSource();
          bSrc.buffer = bBuf;
          bSrc.connect(this.broadcastGain);
          bSrc.start(0);
        } catch (e) {
          console.warn("Test tone broadcast error:", e);
        }
      }
    }
  }

  async recordVoiceEchoTest(durationSec = 3.0, onProgress = null) {
    await this.init();
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();

    // Ensure mic is running
    if (!this.realMicStream || !this.realMicSourceNode) {
      await this.toggleMicPassthrough(true, this.realMicDeviceId || 'default', 'Microphone');
    }

    const sr = this.ctx.sampleRate || 48000;
    const totalSamples = Math.floor(sr * durationSec);
    const recordedBuffer = new Float32Array(totalSamples);
    let writeIdx = 0;

    const sourceToRecord = (voiceChangerEngine && voiceChangerEngine.outputNode) 
      ? voiceChangerEngine.outputNode 
      : this.realMicSourceNode;

    if (!sourceToRecord) return false;

    const recorderNode = this.ctx.createScriptProcessor(1024, 1, 1);
    recorderNode.onaudioprocess = (e) => {
      const inData = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < inData.length && writeIdx < totalSamples; i++) {
        recordedBuffer[writeIdx++] = inData[i];
      }
      if (typeof onProgress === 'function') {
        onProgress(Math.min(1.0, writeIdx / totalSamples));
      }
    };

    sourceToRecord.connect(recorderNode);
    const nullGain = this.ctx.createGain();
    nullGain.gain.setValueAtTime(0, this.ctx.currentTime);
    recorderNode.connect(nullGain);
    nullGain.connect(this.ctx.destination);

    await new Promise((resolve) => setTimeout(resolve, durationSec * 1000 + 150));

    try {
      recorderNode.disconnect();
      nullGain.disconnect();
    } catch (e) {}

    // Immediate playback into user's headphones
    const validCount = Math.max(writeIdx, 1024);
    const audioBuf = this.ctx.createBuffer(1, validCount, sr);
    audioBuf.copyToChannel(recordedBuffer.subarray(0, validCount), 0);

    const playSource = this.ctx.createBufferSource();
    playSource.buffer = audioBuf;

    const playGain = this.ctx.createGain();
    playGain.gain.setValueAtTime(1.1, this.ctx.currentTime);

    playSource.connect(playGain);
    if (this.headphonesGain) {
      playGain.connect(this.headphonesGain);
    } else {
      playGain.connect(this.ctx.destination);
    }

    playSource.start(0);
    return true;
  }

  async loadAudio(url) {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url);
    }

    await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.broadcastCtx && this.broadcastCtx.state === 'suspended') await this.broadcastCtx.resume();

    let arrayBuffer = null;

    // 1. If running inside Electron, use Node-level fetch (100% bypass of CORS and network blocks)
    if (window.electronAPI && typeof window.electronAPI.fetchAudio === 'function') {
      try {
        const res = await window.electronAPI.fetchAudio(url);
        if (res && res.success && res.data) {
          arrayBuffer = new Uint8Array(res.data).buffer;
        }
      } catch (e) {
        console.warn("electronAPI.fetchAudio error, falling back to direct fetch:", e);
      }
    }

    // 2. Direct browser fetch
    if (!arrayBuffer) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      arrayBuffer = await response.arrayBuffer();
    }

    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.audioCache.set(url, audioBuffer);
    return audioBuffer;
  }

  duckMonitoringForSoundboard(duck) {
    if (voiceChangerEngine && voiceChangerEngine.monitoringGain && this.ctx) {
      const target = (duck || !voiceChangerEngine.isMonitoringEnabled) ? 0.0 : voiceChangerEngine.monitoringVolume;
      try {
        voiceChangerEngine.monitoringGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
      } catch (e) {}
    }
  }

  async play(sound, startOffset = 0) {
    if (!sound) return false;
    const now = Date.now();
    if (this.lastPlayTime && (now - this.lastPlayTime < 100) && this.lastPlaySoundId === sound.id) {
      return false; // Debounce rapid multi-clicks
    }
    this.lastPlayTime = now;
    this.lastPlaySoundId = sound.id;

    const sessionId = ++this.playSessionId;
    await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.broadcastCtx && this.broadcastCtx.state === 'suspended') await this.broadcastCtx.resume();

    // Stop local playback nodes and previous APO pipe
    this.currentSources.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    this.currentSources = [];
    cancelAnimationFrame(this.rafId);
    if (window.electronAPI && typeof window.electronAPI.stopApoPcm === 'function') {
      window.electronAPI.stopApoPcm().catch(() => {});
    }

    try {
      const buffer = await this.loadAudio(sound.url);
      if (sessionId !== this.playSessionId) {
        return false;
      }
      this.duration = buffer.duration;
      this.currentSoundId = sound.id;
      this.currentSources = [];

      const offset = Math.max(0, Math.min(startOffset, buffer.duration));
      const vol = sound.volumeMultiplier !== undefined ? sound.volumeMultiplier : 1.0;

      // Duck mic monitoring temporarily if APO injection is used to prevent acoustic double echo in headphones
      if (this.isApoMode) {
        this.duckMonitoringForSoundboard(true);
      }

      // 1. Play into Local Headphones
      const localSource = this.ctx.createBufferSource();
      localSource.buffer = buffer;
      localSource.loop = this.isLooping;

      const localGain = this.ctx.createGain();
      localGain.gain.setValueAtTime(vol, this.ctx.currentTime);
      localSource.connect(localGain);
      localGain.connect(this.headphonesGain);

      localSource.onended = () => {
        if (sessionId === this.playSessionId && this.currentSources.includes(localSource)) {
          this.isPlaying = false;
          this.isPaused = false;
          this.currentSoundId = null;
          this.duckMonitoringForSoundboard(false);
          cancelAnimationFrame(this.rafId);
          if (this.onEnded) this.onEnded(sound.id);
          if (this.onStateChange) this.onStateChange();
        }
      };

      localSource.start(0, offset);
      this.currentSources.push(localSource);

      // 2. Route according to injection mode (Strictly mutually exclusive - zero duplicate playback)
      if (this.isApoMode) {
        // Direct Hardware APO Injection: injects raw PCM directly into physical mic driver
        if (window.electronAPI && typeof window.electronAPI.playApoPcm === 'function') {
          this.get48kMonoPcm(buffer, vol, this.loudnessBoost, offset).then((pcmArray) => {
            if (sessionId === this.playSessionId && pcmArray && this.isPlaying && this.currentSoundId === sound.id) {
              window.electronAPI.playApoPcm({ pcmArray });
            }
          }).catch((err) => {
            console.warn("Direct APO injection error:", err);
          });
        }
      } else {
        // Virtual Cable Mode: injects strictly into broadcastCtx (VB-Cable Input)
        if (this.broadcastCtx && this.broadcastGain) {
          const broadcastSource = this.broadcastCtx.createBufferSource();
          broadcastSource.buffer = buffer;
          broadcastSource.loop = this.isLooping;

          const bGain = this.broadcastCtx.createGain();
          bGain.gain.setValueAtTime(vol, this.broadcastCtx.currentTime);
          broadcastSource.connect(bGain);
          bGain.connect(this.broadcastGain);

          broadcastSource.start(0, offset);
          this.currentSources.push(broadcastSource);
        }
      }

      this.startTime = this.ctx.currentTime - offset;
      this.pauseOffset = 0;
      this.isPlaying = true;
      this.isPaused = false;

      this.startProgressTracker();
      if (this.onStateChange) this.onStateChange();
      return true;
    } catch (err) {
      console.error("Playback error:", err);
      return false;
    }
  }

  async playAudioBuffer(buffer, id = 'instant-remix', volumeMultiplier = 1.0, isLooping = false) {
    const sessionId = ++this.playSessionId;
    await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.broadcastCtx && this.broadcastCtx.state === 'suspended') await this.broadcastCtx.resume();

    this.currentSources.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    this.currentSources = [];
    cancelAnimationFrame(this.rafId);
    if (window.electronAPI && typeof window.electronAPI.stopApoPcm === 'function') {
      window.electronAPI.stopApoPcm().catch(() => {});
    }

    try {
      if (sessionId !== this.playSessionId) return false;
      this.duration = buffer.duration;
      this.currentSoundId = id;
      this.currentSources = [];

      const vol = volumeMultiplier !== undefined ? volumeMultiplier : 1.0;

      // 1. Play into Local Headphones
      const localSource = this.ctx.createBufferSource();
      localSource.buffer = buffer;
      localSource.loop = isLooping;

      const localGain = this.ctx.createGain();
      localGain.gain.setValueAtTime(vol, this.ctx.currentTime);
      localSource.connect(localGain);
      localGain.connect(this.headphonesGain);

      localSource.onended = () => {
        if (sessionId === this.playSessionId && this.currentSources.includes(localSource)) {
          this.isPlaying = false;
          this.isPaused = false;
          this.currentSoundId = null;
          cancelAnimationFrame(this.rafId);
          if (this.onEnded) this.onEnded(id);
          if (this.onStateChange) this.onStateChange();
        }
      };

      localSource.start(0);
      this.currentSources.push(localSource);

      // 2. Play into Micro APO or Virtual Broadcast
      if (this.isApoMode) {
        if (window.electronAPI && typeof window.electronAPI.playApoPcm === 'function') {
          this.get48kMonoPcm(buffer, vol, this.loudnessBoost, 0).then((pcmArray) => {
            if (sessionId === this.playSessionId && pcmArray && this.isPlaying && this.currentSoundId === id) {
              window.electronAPI.playApoPcm({ pcmArray });
            }
          }).catch((err) => {
            console.warn("Direct APO remix injection error:", err);
          });
        }
      } else {
        if (this.broadcastCtx && this.broadcastGain) {
          const broadcastSource = this.broadcastCtx.createBufferSource();
          broadcastSource.buffer = buffer;
          broadcastSource.loop = isLooping;

          const bGain = this.broadcastCtx.createGain();
          bGain.gain.setValueAtTime(vol, this.broadcastCtx.currentTime);
          broadcastSource.connect(bGain);
          bGain.connect(this.broadcastGain);

          broadcastSource.start(0);
          this.currentSources.push(broadcastSource);
        }
      }

      this.startTime = this.ctx.currentTime;
      this.pauseOffset = 0;
      this.isPlaying = true;
      this.isPaused = false;

      this.startProgressTracker();
      if (this.onStateChange) this.onStateChange();
      return true;
    } catch (err) {
      console.error("playAudioBuffer error:", err);
      return false;
    }
  }

  pause() {
    this.playSessionId++;
    if (!this.isPlaying || this.isPaused) return;

    this.pauseOffset = this.ctx.currentTime - this.startTime;
    this.currentSources.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    this.currentSources = [];

    // Stop APO hardware stream
    if (window.electronAPI && typeof window.electronAPI.stopApoPcm === 'function') {
      window.electronAPI.stopApoPcm().catch(() => {});
    }

    this.duckMonitoringForSoundboard(false);
    this.isPlaying = false;
    this.isPaused = true;
    cancelAnimationFrame(this.rafId);
    if (this.onStateChange) this.onStateChange();
  }

  resume(sound) {
    if (!this.isPaused) return;
    this.play(sound, this.pauseOffset);
  }

  stop(notify = true) {
    this.playSessionId++;
    this.currentSources.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    this.currentSources = [];

    // Stop APO hardware stream
    if (window.electronAPI && typeof window.electronAPI.stopApoPcm === 'function') {
      window.electronAPI.stopApoPcm().catch(() => {});
    }

    this.duckMonitoringForSoundboard(false);
    this.isPlaying = false;
    this.isPaused = false;
    const oldId = this.currentSoundId;
    this.currentSoundId = null;
    this.pauseOffset = 0;
    cancelAnimationFrame(this.rafId);

    if (notify && this.onEnded && oldId) this.onEnded(oldId);
    if (notify && this.onStateChange) this.onStateChange();
  }

  seek(timePercent, sound) {
    if (!this.duration) return;
    const targetTime = timePercent * this.duration;
    if (this.isPlaying) {
      this.play(sound, targetTime);
    } else {
      this.pauseOffset = targetTime;
      if (this.onTimeUpdate) this.onTimeUpdate(targetTime, this.duration);
    }
  }

  startProgressTracker() {
    cancelAnimationFrame(this.rafId);
    const update = () => {
      if (this.isPlaying && this.ctx) {
        const current = (this.ctx.currentTime - this.startTime) % this.duration;
        if (this.onTimeUpdate) this.onTimeUpdate(current, this.duration);
        this.rafId = requestAnimationFrame(update);
      }
    };
    this.rafId = requestAnimationFrame(update);
  }

  setHeadphonesVolume(val) {
    this.headphonesVolume = Math.max(0, Math.min(1, val));
    if (this.headphonesGain && this.ctx) {
      this.headphonesGain.gain.setValueAtTime(this.headphonesVolume, this.ctx.currentTime);
    }
  }

  setMicVolume(val) {
    this.micVolume = Math.max(0, Math.min(2.0, val));
    if (this.broadcastGain && this.broadcastCtx) {
      // Scaled with boost factor so sounds punch through loud & clean in Discord
      const factor = 0.50 * this.loudnessBoost;
      this.broadcastGain.gain.setValueAtTime(this.micVolume * factor, this.broadcastCtx.currentTime);
    }
  }

  setLoudnessBoost(boost) {
    this.loudnessBoost = boost; // 1.0, 1.3, 1.7
    this.setMicVolume(this.micVolume);
  }

  setSoundpadMode(enabled) {
    this.isSoundpadMode = enabled;
    this.isApoMode = enabled;
  }

  setRealMicVolume(val) {
    this.realMicVolume = Math.max(0, Math.min(2.0, val));
    if (this.micPassthroughGain && this.broadcastCtx) {
      this.micPassthroughGain.gain.setValueAtTime(this.realMicVolume * 0.75, this.broadcastCtx.currentTime);
    }
  }

  getMicLevel() {
    if (!this.micAnalyser) return 0;
    const data = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / (data.length * 255);
  }

  setNormalization(enabled) {
    this.isNormalized = enabled;
    this.updateGraphRouting();
  }

  setLoop(enabled) {
    this.isLooping = enabled;
    this.currentSources.forEach(s => { s.loop = enabled; });
  }

  getVisualizerData() {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

export const soundEngine = new SoundEngine();
export default soundEngine;
