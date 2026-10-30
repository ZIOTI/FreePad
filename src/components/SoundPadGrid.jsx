import React from 'react';
import { Play, Pause, Keyboard, Volume2, Trash2, Plus, Music, Scissors, Download } from 'lucide-react';

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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
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
            className={`group relative flex flex-col justify-between p-3.5 rounded-2xl cursor-pointer transition-all duration-200 select-none overflow-hidden min-h-[125px] ${
              isThisPlaying
                ? 'bg-gradient-to-br from-indigo-900/80 via-slate-900/90 to-cyan-950/90 border-2 border-cyan-400 shadow-xl shadow-cyan-500/20 scale-[1.02]'
                : 'glass-card hover:border-indigo-500/40'
            }`}
          >
            {/* Top row: Hotkey badge & actions */}
            <div className="flex items-center justify-between gap-1 w-full z-10">
              <div className="flex items-center gap-1">
                {(sound.isClip || sound.category === 'Mes Clips') && (
                  <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/30 border border-rose-400/40 text-rose-300 flex items-center gap-0.5 shadow-xs">
                    <Scissors className="w-2.5 h-2.5" /> CLIP
                  </span>
                )}
                {sound.hotkey ? (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 shadow-xs">
                    {sound.hotkey}
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditHotkey(sound);
                    }}
                    className="text-slate-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Assigner un raccourci clavier"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Actions: Download, Trim & Delete */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onExportSound) onExportSound(sound);
                  }}
                  className={`p-1 transition-all rounded hover:bg-emerald-500/20 ${
                    sound.isClip || sound.category === 'Mes Clips'
                      ? 'text-emerald-400 hover:text-emerald-300 opacity-90 group-hover:opacity-100'
                      : 'text-slate-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100'
                  }`}
                  title="Télécharger ce clip / son sur ton PC"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTrimSound) onTrimSound(sound);
                  }}
                  className="text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-cyan-500/20"
                  title="Découper / Rogner ce son"
                >
                  <Scissors className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSound(sound.id);
                  }}
                  className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-500/20"
                  title="Supprimer ce son"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Center: Title & icon */}
            <div className="flex flex-col items-center justify-center text-center my-2 z-10">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${
                  isThisPlaying
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/50 animate-pulse'
                    : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {isThisPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight">
                {sound.title}
              </span>
            </div>

            {/* Bottom row: Duration & category */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono w-full z-10 pt-1 border-t border-slate-800/60">
              <span className="truncate max-w-[70px] text-slate-500">{sound.category || 'Défaut'}</span>
              <span className="text-cyan-400/90">{sound.duration || '0:00'}</span>
            </div>

            {/* Playing background wave effect */}
            {isThisPlaying && (
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/15 via-transparent to-transparent pointer-events-none"></div>
            )}
          </div>
        );
      })}

      {/* Add Sound Slot */}
      <div
        onClick={onAddSoundClick}
        className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-slate-500 hover:text-indigo-400 cursor-pointer transition-all min-h-[125px] group"
        title="Ajouter un son (MP3, WAV, M4A, OGG)"
      >
        <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-indigo-500/40 flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110">
          <Plus className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium">Ajouter un son</span>
      </div>
    </div>
  );
}
