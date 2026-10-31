import React from 'react';
import { Volume2, VolumeX, Mic, MicOff, Shield, ShieldCheck, Repeat, Square, Play, Pause, Crown, Radio } from 'lucide-react';
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
    <div className="bg-[#0e111a]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3 shadow-2xl shadow-black/60 flex flex-col gap-2.5">
      {/* Main Transport & Sliders Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap lg:flex-nowrap">
        
        {/* Left: Transport Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            disabled={!currentSound}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/25'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25'
            } disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95`}
            title={isPlaying ? "Pause" : "Lecture"}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Panic Stop Button */}
          <button
            onClick={onStop}
            className="w-9 h-9 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            title="Arrêt d'urgence (Panic Stop / Échap)"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Loop toggle */}
          <button
            onClick={() => {
              const next = !isLooping;
              setIsLooping(next);
              soundEngine.setLoop(next);
            }}
            className={`h-9 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isLooping
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-xs'
                : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`}
            title="Lecture en boucle"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Boucle</span>
          </button>

          {/* Anti-Saturation toggle */}
          <button
            onClick={() => {
              const next = !isNormalized;
              setIsNormalized(next);
              soundEngine.setNormalization(next);
            }}
            className={`h-9 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isNormalized
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-xs'
                : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`}
            title="Normalisation dynamique du volume (anti-saturation)"
          >
            {isNormalized ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Shield className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Anti-Saturation</span>
          </button>
        </div>

        {/* Center: Track Progress & Info */}
        <div className="flex-1 min-w-[200px] max-w-xl bg-black/40 rounded-xl px-3 py-1.5 border border-white/[0.06] flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-200 truncate max-w-[220px]">
              {currentSound ? currentSound.title : 'Aucun son en cours'}
            </span>
            <span className="font-mono text-[11px] text-slate-400 shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              if (currentSound) soundEngine.seek(percent, currentSound);
            }}
          >
            <div
              className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-400 h-full rounded-full transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Right: Dual Sliders in compact studio format */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Headphones volume */}
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/[0.06] w-40 sm:w-44">
            <button
              onClick={() => {
                const next = headphonesVol > 0 ? 0 : 0.8;
                setHeadphonesVol(next);
                soundEngine.setHeadphonesVolume(next);
              }}
              className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer shrink-0"
              title="Activer / Couper mes écouteurs"
            >
              {headphonesVol > 0 ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            </button>
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between text-[10px] font-medium text-slate-400 leading-tight">
                <span>Écouteurs</span>
                <span className="font-mono text-cyan-400 font-bold">{Math.round(headphonesVol * 100)}%</span>
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
                className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-800 rounded-lg mt-0.5"
              />
            </div>
          </div>

          {/* Microphone volume */}
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/[0.06] w-40 sm:w-44">
            <button
              onClick={() => {
                const next = micVol > 0 ? 0 : 1.0;
                setMicVol(next);
                soundEngine.setMicVolume(next);
              }}
              className="text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
              title="Activer / Couper l'envoi vers le microphone"
            >
              {micVol > 0 ? <Mic className="w-4 h-4 text-indigo-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
            </button>
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between text-[10px] font-medium text-slate-400 leading-tight">
                <span>Micro / Discord</span>
                <span className="font-mono text-indigo-400 font-bold">{Math.round(micVol * 100)}%</span>
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
                className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded-lg mt-0.5"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Micro Status Ribbon & Author Mark */}
      <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.06] text-[11px] text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-medium text-slate-300">
            Injection Micro Directe Active <span className="text-slate-500 font-mono hidden sm:inline">(Pilote 64-bit matériel sans VB-Cable)</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-400/90 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] tracking-wide">
          <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>Fait par zioti</span>
        </div>
      </div>
    </div>
  );
}
