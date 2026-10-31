import React from 'react';
import { Play, Pause, Keyboard, Trash2, Scissors, Download, Plus } from 'lucide-react';

export default function SoundPadGrid({
  sounds,
  currentPlayingId,
  isPlaying,
  onPlay,
  onStop,
  onEditHotkey,
  onDeleteSound,
  onTrimSound,
  onExportSound,
  onAddSoundClick
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
      {sounds.map((sound) => {
        const isThisPlaying = currentPlayingId === sound.id && isPlaying;
        return (
          <div
            key={sound.id}
            onClick={() => {
              if (isThisPlaying) {
                onStop();
              } else {
                onPlay(sound);
              }
            }}
            className={`group relative flex flex-col justify-between p-3 rounded-xl cursor-pointer transition-all duration-150 select-none overflow-hidden min-h-[108px] ${
              isThisPlaying
                ? 'bg-gradient-to-b from-indigo-950/70 to-[#0e111a] border border-indigo-500/80 shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500/30'
                : 'bg-[#121622]/90 hover:bg-[#181d2c] border border-white/[0.07] hover:border-white/[0.18]'
            }`}
          >
            {/* Top row: Hotkey keycap & action icons */}
            <div className="flex items-center justify-between gap-1 w-full z-10">
              <div className="flex items-center gap-1">
                {(sound.isClip || sound.category === 'Mes Clips') && (
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-center gap-0.5">
                    <Scissors className="w-2.5 h-2.5" /> CLIP
                  </span>
                )}
                {sound.hotkey ? (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-slate-300 shadow-xs">
                    {sound.hotkey}
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditHotkey(sound);
                    }}
                    className="text-slate-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    title="Assigner un raccourci clavier"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Actions (Hover revealed, clean & quiet) */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onExportSound) onExportSound(sound);
                  }}
                  className={`p-1 transition-all rounded hover:bg-emerald-500/20 ${
                    sound.isClip || sound.category === 'Mes Clips'
                      ? 'text-emerald-400 opacity-90 group-hover:opacity-100'
                      : 'text-slate-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100'
                  }`}
                  title="Télécharger ce clip / son sur ton PC"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTrimSound) onTrimSound(sound);
                  }}
                  className="text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-cyan-500/20"
                  title="Découper / Rogner ce son"
                >
                  <Scissors className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSound(sound.id);
                  }}
                  className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-500/20"
                  title="Supprimer ce son"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Center: Play status & Title */}
            <div className="flex flex-col items-center justify-center text-center my-1.5 z-10">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 transition-transform group-hover:scale-105 ${
                  isThisPlaying
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40 animate-pulse'
                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.08] group-hover:text-white group-hover:border-indigo-500/40'
                }`}
              >
                {isThisPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </div>
              <span className={`text-xs font-medium line-clamp-2 leading-snug px-1 ${
                isThisPlaying ? 'text-white font-semibold' : 'text-slate-300 group-hover:text-white'
              }`}>
                {sound.title}
              </span>
            </div>

            {/* Bottom: Category tag & Duration */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono w-full z-10 pt-1 border-t border-white/[0.04]">
              <span className="truncate max-w-[75px] text-slate-400">{sound.category || 'Général'}</span>
              <span className={isThisPlaying ? 'text-indigo-400 font-bold' : 'text-slate-400'}>
                {sound.duration || '0:00'}
              </span>
            </div>

            {/* Subtle active glow overlay */}
            {isThisPlaying && (
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/10 to-transparent pointer-events-none" />
            )}
          </div>
        );
      })}

      {/* Add Sound Card Slot */}
      <div
        onClick={onAddSoundClick}
        className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-white/[0.02] text-slate-500 hover:text-indigo-300 cursor-pointer transition-all min-h-[108px] group"
        title="Ajouter un son depuis votre PC (MP3, WAV, M4A, OGG, FLAC)"
      >
        <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.08] group-hover:border-indigo-500/40 flex items-center justify-center mb-1 transition-transform group-hover:scale-105">
          <Plus className="w-3.5 h-3.5" />
        </div>
        <span className="text-[11px] font-medium">Ajouter un son</span>
      </div>
    </div>
  );
}
