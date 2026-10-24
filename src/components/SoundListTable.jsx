import React from 'react';
import { Play, Pause, Keyboard, Trash2, Music2, FolderOpen, Scissors } from 'lucide-react';

export default function SoundListTable({
  sounds,
  currentPlayingId,
  isPlaying,
  onPlay,
  onStop,
  onEditHotkey,
  onDeleteSound,
  onTrimSound
}) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-mono tracking-wider uppercase text-[11px]">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">Titre</th>
              <th className="py-3 px-4 w-32">Raccourci</th>
              <th className="py-3 px-4 w-24 text-right">Durée</th>
              <th className="py-3 px-4 w-28">Catégorie</th>
              <th className="py-3 px-4 w-28">Ajouté le</th>
              <th className="py-3 px-4 w-24 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {sounds.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-500">
                  <Music2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-400" />
                  Aucun son dans cette catégorie. Glissez-déposez des fichiers ici ou cliquez sur "Ajouter un son".
                </td>
              </tr>
            ) : (
              sounds.map((sound, index) => {
                const isThisPlaying = currentPlayingId === sound.id && isPlaying;
                return (
                  <tr
                    key={sound.id}
                    onDoubleClick={() => {
                      if (isThisPlaying) onStop();
                      else onPlay(sound);
                    }}
                    className={`hover:bg-slate-850/60 transition-colors cursor-pointer group ${
                      isThisPlaying ? 'bg-indigo-950/40 border-l-2 border-cyan-400' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isThisPlaying) onStop();
                          else onPlay(sound);
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          isThisPlaying
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40'
                            : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {isThisPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                    </td>

                    <td className="py-2.5 px-4 font-medium text-slate-200">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(sound.isClip || sound.category === 'Mes Clips') && (
                            <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/30 border border-rose-400/40 text-rose-300 flex items-center gap-0.5 shadow-xs">
                              <Scissors className="w-2.5 h-2.5" /> CLIP
                            </span>
                          )}
                          <span className="font-semibold text-sm group-hover:text-cyan-300 transition-colors">
                            {sound.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-sm">
                          {sound.url}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-4 font-mono">
                      {sound.hotkey ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHotkey(sound);
                          }}
                          className="inline-block px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold hover:bg-indigo-500/30 transition-colors cursor-pointer"
                        >
                          {sound.hotkey}
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHotkey(sound);
                          }}
                          className="text-[11px] text-slate-500 hover:text-indigo-400 underline decoration-dotted"
                        >
                          Définir
                        </button>
                      )}
                    </td>

                    <td className="py-2.5 px-4 font-mono text-slate-400 text-right">
                      {sound.duration || '0:00'}
                    </td>

                    <td className="py-2.5 px-4 text-slate-400">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-medium">
                        {sound.category || 'Mes sons'}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                      {sound.addedOn || 'Aujourd\'hui'}
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onTrimSound) onTrimSound(sound);
                          }}
                          className="p-1.5 rounded-lg hover:bg-cyan-600/30 text-slate-400 hover:text-cyan-300 transition-colors"
                          title="Découper / Rogner ce son"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHotkey(sound);
                          }}
                          className="p-1.5 rounded-lg hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 transition-colors"
                          title="Modifier le raccourci"
                        >
                          <Keyboard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSound(sound.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Supprimer ce son"
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
