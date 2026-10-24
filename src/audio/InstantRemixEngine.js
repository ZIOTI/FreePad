/**
 * FreePad Instant Remix Engine
 * Captures friend's voice from Discord in real-time, auto-chops it into rhythm,
 * and drops it onto high-energy Drill, Phonk, or Trap beats directly into the microphone!
 */

import soundEngine from './SoundEngine';
import { audioBufferToWav } from '../utils/audioTrimmer';

export const BEAT_PRESETS = {
  drill: {
    id: 'drill',
    name: 'Drill FR / UK',
    bpm: 140,
    url: './beats/drill_140bpm.wav',
    icon: '🔥',
    badge: '140 BPM',
    color: 'from-orange-500 to-red-600',
    description: 'Basse 808 glissante, snares syncopées et hi-hats agressifs'
  },
  phonk: {
    id: 'phonk',
    name: 'Drift Phonk',
    bpm: 130,
    url: './beats/phonk_130bpm.wav',
    icon: '🏎️',
    badge: '130 BPM',
    color: 'from-purple-600 to-indigo-600',
    description: 'Mélodie Cowbell iconique de Memphis & kicks ultra saturés'
  },
  trap: {
    id: 'trap',
    name: 'Trap Banger',
    bpm: 135,
    url: './beats/trap_135bpm.wav',
    icon: '🎹',
    badge: '135 BPM',
    color: 'from-cyan-500 to-blue-600',
    description: '808 sub lourd, claps nets et roulements rapides'
  }
};

class InstantRemixEngine {
  constructor() {
    this.status = 'idle'; // 'idle' | 'capturing' | 'cooking' | 'playing' | 'error'
    this.currentRemixBuffer = null;
    this.currentStyle = 'drill';
    this.captureSeconds = 2.5;
    this.isLooping = false;
    this.onStatusChange = null;
    this.cachedBeatBuffers = new Map();
  }

  setStatus(st) {
    this.status = st;
    if (this.onStatusChange) {
      this.onStatusChange(st);
    }
  }

  // Pre-load beat buffers in background so remix is generated in < 100ms
  async preloadBeats() {
    await soundEngine.init();
    const ctx = soundEngine.ctx;
    if (!ctx) return;

    for (const [key, preset] of Object.entries(BEAT_PRESETS)) {
      if (this.cachedBeatBuffers.has(key)) continue;
      try {
        const resp = await fetch(preset.url);
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab);
          this.cachedBeatBuffers.set(key, buf);
        }
      } catch (e) {
        console.warn(`Could not preload beat ${key}:`, e);
      }
    }
  }

  // Detect and trim silence from friend's voice
  trimVocalSilence(audioBuffer, threshold = 0.02) {
    const channelData = audioBuffer.getChannelData(0);
    const length = channelData.length;
    let start = 0;
    let end = length - 1;

    // Find first sample above threshold
    for (let i = 0; i < length; i++) {
      if (Math.abs(channelData[i]) > threshold) {
        start = Math.max(0, i - 100); // 2ms safety margin
        break;
      }
    }

    // Find last sample above threshold
    for (let i = length - 1; i >= 0; i--) {
      if (Math.abs(channelData[i]) > threshold) {
        end = Math.min(length - 1, i + 100);
        break;
      }
    }

    const trimmedLength = Math.max(1024, end - start + 1);
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offline = new OfflineCtxClass(audioBuffer.numberOfChannels, trimmedLength, audioBuffer.sampleRate);
    const trimmedBuf = offline.createBuffer(audioBuffer.numberOfChannels, trimmedLength, audioBuffer.sampleRate);

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = trimmedBuf.getChannelData(ch);
      for (let j = 0; j < trimmedLength; j++) {
        dst[j] = src[start + j] || 0;
      }
    }

    return trimmedBuf;
  }

  /**
   * Main function: Trigger Instant Remix
   */
  async triggerRemix({ style = 'drill', captureSeconds = 2.5, isLooping = false } = {}) {
    this.currentStyle = style;
    this.captureSeconds = captureSeconds;
    this.isLooping = isLooping;

    try {
      this.setStatus('capturing');
      await soundEngine.init();

      // 1. Grab last N seconds from Windows WASAPI loopback
      if (!window.electronAPI?.clipInstantReplay) {
        throw new Error("L'API de capture audio n'est pas disponible");
      }

      const clipRes = await window.electronAPI.clipInstantReplay({
        seconds: Math.round(captureSeconds),
        title: 'remix_voice_snippet'
      });

      if (!clipRes?.success || !clipRes?.filePath) {
        throw new Error(clipRes?.error || "Impossible de capturer la voix (activez l'écoute F8 ou parlez dans l'appel)");
      }

      this.setStatus('cooking');

      // 2. Fetch and decode voice buffer
      let voiceArrayBuffer = null;
      if (window.electronAPI.fetchAudio) {
        const fetched = await window.electronAPI.fetchAudio(clipRes.filePath);
        if (fetched?.success && fetched?.data) {
          voiceArrayBuffer = new Uint8Array(fetched.data).buffer;
        }
      }

      if (!voiceArrayBuffer) {
        const resp = await fetch(clipRes.fileUrl || `file://${clipRes.filePath}`);
        voiceArrayBuffer = await resp.arrayBuffer();
      }

      const voiceAudioBuffer = await soundEngine.ctx.decodeAudioData(voiceArrayBuffer);
      const cleanVoiceBuffer = this.trimVocalSilence(voiceAudioBuffer, 0.025);

      // 3. Load / Retrieve Beat buffer
      const preset = BEAT_PRESETS[style] || BEAT_PRESETS.drill;
      let beatBuffer = this.cachedBeatBuffers.get(style);
      if (!beatBuffer) {
        const bResp = await fetch(preset.url);
        const bAb = await bResp.arrayBuffer();
        beatBuffer = await soundEngine.ctx.decodeAudioData(bAb);
        this.cachedBeatBuffers.set(style, beatBuffer);
      }

      // 4. Arrange remix using OfflineAudioContext for studio precision
      const bpm = preset.bpm;
      const beatDur = 60.0 / bpm; // duration of 1 quarter-note beat
      const totalDur = beatBuffer.duration;
      const sampleRate = beatBuffer.sampleRate || 48000;

      const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const offlineCtx = new OfflineAudioContextClass(2, Math.ceil(sampleRate * totalDur), sampleRate);

      // A. Layer 1: The Instrumental Beat
      const beatSource = offlineCtx.createBufferSource();
      beatSource.buffer = beatBuffer;
      const beatGain = offlineCtx.createGain();
      beatGain.gain.setValueAtTime(0.92, 0);
      beatSource.connect(beatGain);
      beatGain.connect(offlineCtx.destination);
      beatSource.start(0);

      // B. Layer 2: The Friend's Voice Chops
      // Intro Stutter Chops (first 0.25s of the vocal repeated on the beat grid)
      const vocalDuration = cleanVoiceBuffer.duration;
      const stutterDur = Math.min(0.24, vocalDuration * 0.4);

      // Master Vocal Bus with Presence Equalizer & Compressor
      const vocalMasterGain = offlineCtx.createGain();
      vocalMasterGain.gain.setValueAtTime(1.15, 0); // Boost vocal to cut through beat
      vocalMasterGain.connect(offlineCtx.destination);

      // Stereo Delay effect on vocal for rap studio depth
      const delay = offlineCtx.createDelay();
      delay.delayTime.setValueAtTime(beatDur * 0.5, 0); // 8th note delay
      const delayFeedback = offlineCtx.createGain();
      delayFeedback.gain.setValueAtTime(0.28, 0);
      delay.connect(delayFeedback);
      delayFeedback.connect(delay);
      delay.connect(offlineCtx.destination);

      // Helper to schedule a vocal slice
      const scheduleVocalSlice = (startTime, sliceOffset = 0, duration = null, gainVal = 1.0) => {
        if (startTime >= totalDur) return;
        const src = offlineCtx.createBufferSource();
        src.buffer = cleanVoiceBuffer;

        const g = offlineCtx.createGain();
        g.gain.setValueAtTime(gainVal, startTime);
        // smooth anti-pop fade in/out
        g.gain.setValueAtTime(0.001, startTime);
        g.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.005);
        if (duration) {
          g.gain.setValueAtTime(gainVal, startTime + duration - 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        }

        src.connect(g);
        g.connect(vocalMasterGain);
        g.connect(delay); // send to echo delay

        if (duration) {
          src.start(startTime, sliceOffset, duration);
        } else {
          src.start(startTime, sliceOffset);
        }
      };

      // 🎵 ARRANGEMENT :
      // Bar 1: Intro vocal stutter on the beat (ex: "Qu... Qu... Qu-Quoi ?!")
      scheduleVocalSlice(0.0, 0, stutterDur, 0.9);
      scheduleVocalSlice(beatDur * 0.5, 0, stutterDur, 0.95);
      scheduleVocalSlice(beatDur * 1.0, 0, stutterDur, 1.0);
      scheduleVocalSlice(beatDur * 1.25, 0, stutterDur * 0.8, 1.05);

      // Bar 2 (Beat 2.0 or 1.5): THE DROP! The full punchline drops with the heavy 808 bass!
      const dropTime = beatDur * 1.75;
      scheduleVocalSlice(dropTime, 0, vocalDuration, 1.2);

      // Bar 3: Repeat the punchline climax or second phrase
      const secondDrop = dropTime + Math.max(vocalDuration + 0.2, beatDur * 4.0);
      if (secondDrop + 0.5 < totalDur) {
        scheduleVocalSlice(secondDrop, 0, vocalDuration, 1.15);
      }

      // 5. Render final master AudioBuffer
      const renderedRemixBuffer = await offlineCtx.startRendering();
      this.currentRemixBuffer = renderedRemixBuffer;

      // 6. Play through SoundEngine (Local Headphones + Discord Physical Mic APO!)
      this.setStatus('playing');
      await soundEngine.playAudioBuffer(renderedRemixBuffer, 'instant-remix', 1.0, this.isLooping);

      soundEngine.onEnded = (id) => {
        if (id === 'instant-remix') {
          this.setStatus('idle');
        }
      };

      return {
        success: true,
        buffer: renderedRemixBuffer,
        duration: totalDur,
        preset,
        saveToPad: async (title = 'Remix Pote') => {
          return await this.saveRemixToPad(renderedRemixBuffer, title);
        }
      };
    } catch (err) {
      console.error("Instant Remix error:", err);
      this.setStatus('error');
      return { success: false, error: err.message };
    }
  }

  // Stop currently playing remix
  stop() {
    soundEngine.stop();
    this.setStatus('idle');
  }

  // Convert the rendered remix buffer to WAV and save it as a permanent soundboard pad
  async saveRemixToPad(audioBuffer, title = 'Remix Pote') {
    if (!audioBuffer) return null;
    try {
      const wavArrayBuffer = audioBufferToWav(audioBuffer);
      const bytes = new Uint8Array(wavArrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      if (window.electronAPI?.saveRecordedClip) {
        const res = await window.electronAPI.saveRecordedClip({
          base64Data: base64,
          title: `Remix_${title.replace(/[^a-zA-Z0-9]/g, '_')}`,
          durationSeconds: audioBuffer.duration
        });

        if (res?.success && res?.filePath) {
          const m = Math.floor(audioBuffer.duration / 60);
          const s = Math.floor(audioBuffer.duration % 60);
          return {
            id: `remix-${Date.now()}`,
            title: `🔥 ${title}`,
            url: res.fileUrl || `file://${res.filePath}`,
            duration: `${m}:${s < 10 ? '0' : ''}${s}`,
            category: 'Mes sons',
            addedOn: new Date().toISOString().split('T')[0],
            volumeMultiplier: 1.0
          };
        }
      }
      return null;
    } catch (e) {
      console.error("saveRemixToPad error:", e);
      return null;
    }
  }
}

const instantRemixEngine = new InstantRemixEngine();
export default instantRemixEngine;
