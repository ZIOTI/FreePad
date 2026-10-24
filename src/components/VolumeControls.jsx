import React from 'react';
import { Volume2, VolumeX, Mic, MicOff, Shield, ShieldCheck, Repeat, Square, Play, Pause, Crown, Sparkles } from 'lucide-react';
import soundEngine from '../audio/SoundEngine';

export default function VolumeControls({
  headphonesVol,
  setHeadphonesVol,
  micVol,
  setMicVol,
  isNormalized,
  setIsNormalized,
  isLooping,
  setIsLooping,
  isPlaying,
  isPaused,
  currentSound,
  onPlayPause,
  onStop,
  currentTime,
  duration
}) {
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-panel p-4 rounded-2xl flex flex-col gap-4 border border-indigo-500/20 shadow-xl">
      {/* Top row: Transport Controls & Current Sound */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            disabled={!currentSound}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
            title={isPlaying ? "Pause" : "Lecture"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          {/* Panic Stop Button */}
          <button
            onClick={onStop}
            className="w-11 h-11 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-400 hover:text-white flex items-center justify-center transition-all shadow-lg shadow-rose-600/10 active:scale-95"
            title="Arrêt d'urgence (Panic Stop / Echap)"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>

          {/* Loop toggle */}
          <button
            onClick={() => {
              const next = !isLooping;
              setIsLooping(next);
              soundEngine.setLoop(next);
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
              isLooping
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-md shadow-cyan-500/20'
                : 'border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
            title="Lecture en boucle"
          >
            <Repeat className="w-4 h-4" />
            <span className="hidden sm:inline">Boucle</span>
          </button>

          {/* Normalization / Protection toggle */}
          <button
            onClick={() => {
              const next = !isNormalized;
              setIsNormalized(next);
              soundEngine.setNormalization(next);
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
              isNormalized
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-md shadow-emerald-500/20'
                : 'border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
            title="Normalisation dynamique du volume (anti-saturation sonore)"
          >
            {isNormalized ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <Shield className="w-4 h-4" />}
            <span className="hidden sm:inline">Anti-Saturation</span>
          </button>
        </div>

        {/* Current Sound display */}
        <div className="flex-1 min-w-[200px] bg-slate-900/60 rounded-xl px-4 py-2 border border-slate-800/80 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-200 truncate max-w-[220px]">
              {currentSound ? currentSound.title : 'Aucun son en cours'}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              if (currentSound) soundEngine.seek(percent, currentSound);
            }}
          >
            <div
              className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Bottom row: Dual Volume Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
        {/* Headphones volume */}
        <div className="flex items-center gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
          <button
            onClick={() => {
              const next = headphonesVol > 0 ? 0 : 0.8;
              setHeadphonesVol(next);
              soundEngine.setHeadphonesVolume(next);
            }}
            className="text-slate-400 hover:text-cyan-400 transition-colors"
            title="Activer / Couper mes écouteurs"
          >
            {headphonesVol > 0 ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-rose-400" />}
          </button>
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-slate-300">Mes Écouteurs (Local)</span>
              <span className="font-mono text-cyan-400">{Math.round(headphonesVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={headphonesVol}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setHeadphonesVol(val);
                soundEngine.setHeadphonesVolume(val);
              }}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* Microphone / Broadcast volume */}
        <div className="flex items-center gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
          <button
            onClick={() => {
              const next = micVol > 0 ? 0 : 1.0;
              setMicVol(next);
              soundEngine.setMicVolume(next);
            }}
            className="text-slate-400 hover:text-indigo-400 transition-colors"
            title="Activer / Couper l'envoi vers le microphone"
          >
            {micVol > 0 ? <Mic className="w-5 h-5 text-indigo-400" /> : <MicOff className="w-5 h-5 text-rose-400" />}
          </button>
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-slate-300">Diffusion Vocale (Discord / Jeux)</span>
              <span className="font-mono text-indigo-400">{Math.round(micVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={micVol}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setMicVol(val);
                soundEngine.setMicVolume(val);
              }}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Footer Branding Badge — Fait par zioti */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
        <span className="text-slate-400 font-medium">FreePad Pro • Driver Micro Direct Hardware</span>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-indigo-500/20 border border-amber-400/60 shadow-md shadow-amber-500/20">
          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
          <span className="font-black uppercase tracking-wider text-amber-300">
            Fait par zioti
          </span>
        </div>
      </div>
    </div>
  );
}
