import React from 'react';
import { Play, Pause, Keyboard, Trash2, Music2, Scissors, Download } from 'lucide-react';

export default function SoundListTable({
  sounds,
  currentPlayingId,
  isPlaying,
  onPlay,
  onStop,
  onEditHotkey,
  onDeleteSound,
  onTrimSound,
  onExportSound
}) {
  return (
    <div className="bg-[#0e111a]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.06] text-slate-400 font-mono tracking-wider uppercase text-[10px]">
              <th className="py-2.5 px-3.5 w-12 text-center">#</th>
              <th className="py-2.5 px-3.5">Titre</th>
              <th className="py-2.5 px-3.5 w-28">Raccourci</th>
              <th className="py-2.5 px-3.5 w-20 text-right">Durée</th>
              <th className="py-2.5 px-3.5 w-28">Catégorie</th>
              <th className="py-2.5 px-3.5 w-24 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sounds.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-slate-500">
                  <Music2 className="w-7 h-7 mx-auto mb-2 opacity-30 text-indigo-400" />
                  <p className="text-xs">Aucun son dans cette catégorie.</p>
                </td>
              </tr>
            ) : (
              sounds.map((sound) => {
                const isThisPlaying = currentPlayingId === sound.id && isPlaying;
                return (
                  <tr
                    key={sound.id}
                    onDoubleClick={() => {
                      if (isThisPlaying) onStop();
                      else onPlay(sound);
                    }}
                    className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                      isThisPlaying ? 'bg-indigo-950/30 border-l-2 border-indigo-400' : ''
                    }`}
                  >
                    <td className="py-2 px-3.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isThisPlaying) onStop();
                          else onPlay(sound);
                        }}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                          isThisPlaying
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'bg-white/[0.04] text-slate-400 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {isThisPlaying ? (
                          <Pause className="w-3 h-3 fill-current" />
                        ) : (
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        )}
                      </button>
                    </td>

                    <td className="py-2 px-3.5 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        {(sound.isClip || sound.category === 'Mes Clips') && (
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-center gap-0.5">
                            <Scissors className="w-2.5 h-2.5" /> CLIP
                          </span>
                        )}
                        <span className={`text-xs ${isThisPlaying ? 'text-indigo-300 font-semibold' : 'text-slate-200 group-hover:text-white'}`}>
                          {sound.title}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-3.5 font-mono">
                      {sound.hotkey ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHotkey(sound);
                          }}
                          className="inline-block px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-slate-300 text-[10px] font-bold hover:border-indigo-400/50 cursor-pointer"
                        >
                          {sound.hotkey}
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHotkey(sound);
                          }}
                          className="text-slate-600 hover:text-slate-400 text-[10px] font-mono"
                        >
                          + Définir
                        </button>
                      )}
                    </td>

                    <td className="py-2 px-3.5 text-right font-mono text-[11px] text-slate-400">
                      {sound.duration || '0:00'}
                    </td>

                    <td className="py-2 px-3.5 text-[11px] text-slate-400">
                      {sound.category || 'Général'}
                    </td>

                    <td className="py-2 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onExportSound) onExportSound(sound);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-white/[0.04] transition-colors"
                          title="Télécharger sur mon PC"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onTrimSound) onTrimSound(sound);
                          }}
                          className="p-1 text-slate-400 hover:text-cyan-400 rounded hover:bg-white/[0.04] transition-colors"
                          title="Rogner"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSound(sound.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-white/[0.04] transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
