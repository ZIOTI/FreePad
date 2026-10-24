/**
 * AudioClipRecorder.js — FreePad Instant Replay Audio Engine
 * Uses native Windows WASAPI loopback (Logitech PRO X, Discord, Games)
 * with zero browser permission prompts and zero USB audio driver conflicts.
 */

// Gentle pleasant confirmation chime in user's headphones
function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Arpeggio chime: G5 -> C6
    osc.frequency.setValueAtTime(783.99, now);
    osc.frequency.setValueAtTime(1046.50, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  } catch (e) {
    // ignore
  }
}

class AudioClipRecorder {
  constructor() {
    this.status = 'idle'; // 'idle' | 'listening' | 'clipping' | 'error'
    this.bufferSeconds = 30;
    this.sourceType = 'loopback'; // 'loopback' (Discord/System) or 'mic'
    this.selectedDeviceId = null;
    this.onStatusChange = null;

    // Mic fallback stream
    this.micStream = null;
    this.audioContext = null;
    this.micRecorder = null;
    this.ringLeft = null;
    this.ringRight = null;
    this.writeIndex = 0;
    this.totalSamples = 0;
  }

  setStatus(newStatus) {
    this.status = newStatus;
    if (this.onStatusChange) {
      try {
        this.onStatusChange(newStatus);
      } catch (e) {
        console.warn('onStatusChange callback error:', e);
      }
    }
  }

  isListening() {
    return this.status === 'listening';
  }

  async checkNativeStatus() {
    if (window.electronAPI?.getReplayStatus) {
      try {
        const st = await window.electronAPI.getReplayStatus();
        if (st.success && st.active) {
          this.setStatus('listening');
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  async startListening(sourceType = 'loopback', deviceId = null) {
    this.sourceType = sourceType;
    this.selectedDeviceId = deviceId;

    if (sourceType === 'loopback') {
      // 1. Direct Native Windows WASAPI Loopback (No Chromium prompts or bugs)
      if (window.electronAPI?.startInstantReplay) {
        try {
          const res = await window.electronAPI.startInstantReplay();
          if (res && res.success) {
            this.setStatus('listening');
            return true;
          }
        } catch (e) {
          console.warn("Native startInstantReplay error:", e);
        }
      }

      this.setStatus('listening');
      return true;
    } else {
      // 2. Microphone capture
      try {
        this.setStatus('starting');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
          video: false
        });

        this.micStream = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx({ sampleRate: 48000 });
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        const capacity = 48000 * 30;
        this.ringLeft = new Float32Array(capacity);
        this.ringRight = new Float32Array(capacity);
        this.writeIndex = 0;
        this.totalSamples = 0;

        const src = this.audioContext.createMediaStreamSource(stream);
        const proc = this.audioContext.createScriptProcessor(4096, 2, 2);

        proc.onaudioprocess = (e) => {
          const inL = e.inputBuffer.getChannelData(0);
          const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL;
          const len = inL.length;
          for (let i = 0; i < len; i++) {
            this.ringLeft[this.writeIndex] = inL[i];
            this.ringRight[this.writeIndex] = inR[i];
            this.writeIndex = (this.writeIndex + 1) % capacity;
            this.totalSamples++;
          }
        };

        const silent = this.audioContext.createGain();
        silent.gain.value = 0;
        src.connect(proc);
        proc.connect(silent);
        silent.connect(this.audioContext.destination);

        this.setStatus('listening');
        return true;
      } catch (err) {
        console.error("Mic startListening error:", err);
        this.setStatus('error');
        throw err;
      }
    }
  }

  stopListening() {
    if (this.sourceType === 'loopback') {
      if (window.electronAPI?.stopInstantReplay) {
        window.electronAPI.stopInstantReplay().catch(() => {});
      }
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.setStatus('idle');
  }

  async clipLastSeconds(seconds = 5, customTitle = null) {
    const prevStatus = this.status;
    this.setStatus('clipping');

    try {
      if (this.sourceType === 'loopback') {
        // Native Windows WASAPI Loopback Clip
        if (!window.electronAPI?.clipInstantReplay) {
          throw new Error("L'API Instant Replay n'est pas disponible.");
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const title = customTitle || `🗣️ Clip Discord ${timeStr}`;

        const res = await window.electronAPI.clipInstantReplay({
          seconds,
          title
        });

        if (!res.success) {
          throw new Error(res.error || "Échec lors de la capture du clip audio");
        }

        playChime();
        this.setStatus(prevStatus);

        return {
          id: `clip-${Date.now()}`,
          title: res.title || title,
          url: res.dataUrl,
          filePath: res.filePath,
          duration: res.duration || `0:0${seconds}`,
          hotkey: '',
          category: 'Mes Clips',
          addedOn: now.toISOString().split('T')[0],
          volumeMultiplier: 1.0,
          isClip: true
        };
      } else {
        // Mic clip fallback
        if (this.totalSamples < 48000 * 0.5) {
          throw new Error("Pas assez d'audio micro enregistré (attends 2 secondes).");
        }

        const capacity = 48000 * 30;
        const requested = 48000 * seconds;
        const count = Math.min(requested, this.totalSamples, capacity);
        const outL = new Float32Array(count);
        const outR = new Float32Array(count);

        let readPos = (this.writeIndex - count + capacity) % capacity;
        for (let i = 0; i < count; i++) {
          outL[i] = this.ringLeft[readPos];
          outR[i] = this.ringRight[readPos];
          readPos = (readPos + 1) % capacity;
        }

        // Encode WAV
        const numChannels = 2;
        const dataSize = count * 4;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        const writeStr = (v, offset, s) => {
          for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
        };

        writeStr(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(view, 8, 'WAVE');
        writeStr(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, 48000, true);
        view.setUint32(28, 48000 * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeStr(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        let offset = 44;
        for (let i = 0; i < count; i++) {
          const sL = Math.max(-1, Math.min(1, outL[i]));
          const sR = Math.max(-1, Math.min(1, outR[i]));
          view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
          offset += 2;
          view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
          offset += 2;
        }

        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 16384;
        for (let i = 0; i < bytes.byteLength; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64Data = btoa(binary);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const title = customTitle || `🗣️ Clip Micro ${timeStr}`;

        const res = await window.electronAPI.saveRecordedClip({
          base64Data,
          title,
          durationSeconds: seconds
        });

        playChime();
        this.setStatus(prevStatus);

        return {
          id: `clip-${Date.now()}`,
          title: res.title || title,
          url: res.dataUrl,
          filePath: res.filePath,
          duration: res.duration || `0:0${seconds}`,
          hotkey: '',
          category: 'Mes Clips',
          addedOn: now.toISOString().split('T')[0],
          volumeMultiplier: 1.0,
          isClip: true
        };
      }
    } catch (err) {
      this.setStatus(prevStatus);
      throw err;
    }
  }
}

const audioClipRecorder = new AudioClipRecorder();
export default audioClipRecorder;
