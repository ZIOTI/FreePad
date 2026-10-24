import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Scissors,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Save,
  Volume2,
  Clock,
  Crown,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import soundEngine from '../audio/SoundEngine';
import { sliceAudioBuffer, audioBufferToWav, arrayBufferToBase64 } from '../utils/audioTrimmer';

export default function AudioTrimmerModal({
  sound,
  isOpen,
  onClose,
  onSave
}) {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Trimming offsets in seconds
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [customTitle, setCustomTitle] = useState('');
  const [replaceOriginal, setReplaceOriginal] = useState(false);

  // Playback preview state
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewSourceRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !sound) {
      stopPreview();
      setAudioBuffer(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setCustomTitle(`${sound.title} (Extrait)`);

    const load = async () => {
      try {
        const buffer = await soundEngine.loadAudio(sound.url);
        if (!isMounted) return;
        setAudioBuffer(buffer);
        setDuration(buffer.duration);
        setStartTime(0);
        setEndTime(buffer.duration);
        setIsLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError("Impossible de charger le fichier audio pour le découpage.");
        setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
      stopPreview();
    };
  }, [isOpen, sound]);

  // Draw waveform on canvas
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw full waveform in muted blue
    ctx.fillStyle = '#475569';
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Highlight selected range
    if (duration > 0) {
      const startX = (startTime / duration) * width;
      const endX = (endTime / duration) * width;

      // Selection overlay
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.fillRect(startX, 0, endX - startX, height);

      // Selected waveform in bright cyan
      ctx.fillStyle = '#06b6d4';
      const startIdx = Math.floor(startX);
      const endIdx = Math.ceil(endX);

      for (let i = startIdx; i <= endIdx; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = channelData[i * step + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }

      // Draw start handle line
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(startX, 0, 2, height);

      // Draw end handle line
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(endX - 2, 0, 2, height);
    }
  }, [audioBuffer, startTime, endTime, duration]);

  const stopPreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch (e) {}
      previewSourceRef.current = null;
    }
    setIsPreviewPlaying(false);
  };

  const handleTogglePreview = () => {
    if (isPreviewPlaying) {
      stopPreview();
      return;
    }

    if (!audioBuffer) return;
    const ctx = soundEngine.ctx;
    if (!ctx) return;

    stopPreview();

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, ctx.currentTime);
    src.connect(gain);
    gain.connect(ctx.destination);

    const playDuration = Math.max(0.05, endTime - startTime);
    src.start(0, startTime, playDuration);
    previewSourceRef.current = src;
    setIsPreviewPlaying(true);

    src.onended = () => {
      setIsPreviewPlaying(false);
      previewSourceRef.current = null;
    };
  };

  const handleSaveTrim = async () => {
    if (!audioBuffer) return;
    stopPreview();
    setIsLoading(true);

    try {
      // 1. Slice audio buffer with sample accuracy
      const slicedBuffer = await sliceAudioBuffer(audioBuffer, startTime, endTime);
      const wavArrayBuffer = audioBufferToWav(slicedBuffer);
      const base64Data = arrayBufferToBase64(wavArrayBuffer);
      const durSec = Math.max(1, Math.round(endTime - startTime));

      // 2. Save via Electron IPC to user sound directory
      if (window.electronAPI?.saveTrimmedSound) {
        const res = await window.electronAPI.saveTrimmedSound({
          base64Data,
          title: customTitle.trim() || `${sound.title} (Extrait)`,
          durationSeconds: durSec,
          category: sound.category || 'Mes sons'
        });

        if (res && res.success && res.sound) {
          onSave(res.sound, replaceOriginal ? sound.id : null);
          onClose();
        } else {
          setError(res?.error || "Erreur lors de la sauvegarde du découpage.");
        }
      } else {
        // Fallback Web-only base64 URL
        const dataUrl = `data:audio/wav;base64,${base64Data}`;
        const m = Math.floor(durSec / 60);
        const s = durSec % 60;
        const newSound = {
          ...sound,
          id: `trimmed-${Date.now()}`,
          title: customTitle.trim() || `${sound.title} (Extrait)`,
          url: dataUrl,
          duration: `${m}:${s < 10 ? '0' : ''}${s}`,
          durationSeconds: durSec,
          isClip: true
        };
        onSave(newSound, replaceOriginal ? sound.id : null);
        onClose();
      }
    } catch (err) {
      setError("Erreur découpage audio: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !sound) return null;

  const currentSnippetDuration = Math.max(0.1, endTime - startTime).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-indigo-500/20 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Scissors className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Découper le son
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 border border-indigo-500/40 text-cyan-300">
                  Précision milliseconde
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                {sound.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Sparkles className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-xs text-slate-400">Chargement de la forme d'onde audio...</p>
            </div>
          ) : (
            <>
              {/* Waveform Canvas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-purple-300 flex items-center gap-1 font-bold">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    Début : {startTime.toFixed(2)}s
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold">
                    Extrait : {currentSnippetDuration}s
                  </span>
                  <span className="text-pink-300 flex items-center gap-1 font-bold">
                    <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                    Fin : {endTime.toFixed(2)}s
                  </span>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-inner bg-slate-950">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={100}
                    className="w-full h-24 block"
                  />
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Point de départ</span>
                    <span>{startTime.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    step="0.05"
                    value={startTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setStartTime(Math.min(val, endTime - 0.2));
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Point de fin</span>
                    <span>{endTime.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    step="0.05"
                    value={endTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEndTime(Math.max(val, startTime + 0.2));
                    }}
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Preview Button */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleTogglePreview}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95 ${
                    isPreviewPlaying
                      ? 'bg-rose-600 text-white shadow-rose-600/30 ring-2 ring-rose-400/50'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  {isPreviewPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Arrêter l'écoute</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                      <span>Écouter l'extrait ({currentSnippetDuration}s)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Name & Mode settings */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Nom du nouveau son</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="trimMode"
                      checked={!replaceOriginal}
                      onChange={() => setReplaceOriginal(false)}
                      className="accent-indigo-500"
                    />
                    <span>Ajouter comme nouveau son</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="trimMode"
                      checked={replaceOriginal}
                      onChange={() => setReplaceOriginal(true)}
                      className="accent-cyan-400"
                    />
                    <span>Remplacer le son actuel</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Fait par zioti</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveTrim}
              disabled={isLoading || !audioBuffer}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer le découpage</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
