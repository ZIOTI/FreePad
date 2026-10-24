import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Play,
  Pause,
  Plus,
  ExternalLink,
  Sparkles,
  Download,
  Check,
  Loader2,
  Flame,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import soundEngine from '../audio/SoundEngine';

// Verified fallback offline sounds
const FALLBACK_SOUNDS = [
  { id: 'myinstants-bruh', title: 'Bruh Sound Effect', url: 'https://www.myinstants.com/media/sounds/movie_1.mp3', duration: '0:02', category: 'Mèmes' },
  { id: 'myinstants-fbi', title: 'FBI Open Up', url: 'https://www.myinstants.com/media/sounds/fbi-open-up-sfx.mp3', duration: '0:03', category: 'Mèmes' },
  { id: 'myinstants-oof', title: 'Roblox Oof Death', url: 'https://www.myinstants.com/media/sounds/roblox-death-sound_1.mp3', duration: '0:01', category: 'Jeux' },
  { id: 'myinstants-wow', title: 'Anime Wow Sound', url: 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3', duration: '0:02', category: 'Anime' },
  { id: 'myinstants-metalgear', title: 'Metal Gear Alert (!)', url: 'https://www.myinstants.com/media/sounds/metal-gear-alert-sound-effect.mp3', duration: '0:03', category: 'Jeux' },
  { id: 'myinstants-winxp', title: 'Windows XP Error', url: 'https://www.myinstants.com/media/sounds/windows-xp-error.mp3', duration: '0:01', category: 'Système' },
  { id: 'myinstants-noice', title: 'Michael Rosen — Noice', url: 'https://www.myinstants.com/media/sounds/noice.mp3', duration: '0:02', category: 'Humour' },
  { id: 'myinstants-sadviolin', title: 'Sad Violin Meme', url: 'https://www.myinstants.com/media/sounds/sad-violin.mp3', duration: '0:08', category: 'Musique' },
  { id: 'myinstants-bababooey', title: 'Baba Booey', url: 'https://www.myinstants.com/media/sounds/baba-booey.mp3', duration: '0:02', category: 'Mèmes' },
  { id: 'myinstants-illuminati', title: 'X-Files Illuminati', url: 'https://www.myinstants.com/media/sounds/the-x-files-theme-song.mp3', duration: '0:12', category: 'Effets' },
  { id: 'myinstants-coffin', title: 'Coffin Dance Astronomia', url: 'https://www.myinstants.com/media/sounds/coffin-dance-meme.mp3', duration: '0:15', category: 'Musique' },
  { id: 'myinstants-bonk', title: 'Cheems Bonk SFX', url: 'https://www.myinstants.com/media/sounds/bonk-sound-effect.mp3', duration: '0:01', category: 'Humour' }
];

const BUTTON_COLORS = [
  'from-blue-600 to-cyan-500',
  'from-red-600 to-amber-500',
  'from-emerald-500 to-teal-400',
  'from-purple-600 to-indigo-500',
  'from-pink-500 to-rose-400',
  'from-amber-500 to-yellow-400',
  'from-violet-600 to-fuchsia-500',
  'from-cyan-600 to-blue-500'
];

export default function MyInstantsTab({ onImportSound, existingSoundUrls = [] }) {
  const [activeTab, setActiveTab] = useState('trending'); // 'trending' | 'best' | 'recent' | 'search'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sounds, setSounds] = useState(FALLBACK_SOUNDS);
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [customUrl, setCustomUrl] = useState('');
  const [importedIds, setImportedIds] = useState(new Set());
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [isImporting, setIsImporting] = useState(false);

  // Fetch sounds based on active tab and page
  const fetchCategorySounds = async (tab, p, query = '') => {
    setIsLoading(true);
    try {
      if (!window.electronAPI) {
        setSounds(FALLBACK_SOUNDS);
        return;
      }

      let res;
      if (tab === 'search' && query.trim()) {
        res = await window.electronAPI.searchMyInstants({ query: query.trim(), page: p });
      } else if (tab === 'best') {
        res = await window.electronAPI.getBestMyInstants({ page: p });
      } else if (tab === 'recent') {
        res = await window.electronAPI.getRecentMyInstants({ page: p });
      } else {
        res = await window.electronAPI.getTrendingMyInstants({ page: p });
      }

      if (res && res.success && res.sounds && res.sounds.length > 0) {
        setSounds(res.sounds);
      } else if (tab === 'trending' && p === 1) {
        setSounds(FALLBACK_SOUNDS);
      }
    } catch (err) {
      console.warn("MyInstants fetch failed, using fallback:", err);
      if (sounds.length === 0) setSounds(FALLBACK_SOUNDS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorySounds(activeTab, page, search);
  }, [activeTab, page]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (!search.trim()) return;
    setActiveTab('search');
    setPage(1);
    fetchCategorySounds('search', 1, search);
  };

  const handlePreview = async (instant) => {
    if (playingId === instant.id) {
      soundEngine.stop();
      setPlayingId(null);
    } else {
      setPlayingId(instant.id);
      const ok = await soundEngine.play(instant);
      if (!ok) setPlayingId(null);
    }
  };

  const handleAdd = async (instant) => {
    setDownloadingIds((prev) => new Set([...prev, instant.id]));
    let soundUrl = instant.url;
    let soundTitle = instant.title;
    let localPath = null;

    if (window.electronAPI && typeof window.electronAPI.downloadSound === 'function') {
      try {
        const res = await window.electronAPI.downloadSound({ url: instant.url, title: instant.title });
        if (res && res.success) {
          soundUrl = res.dataUrl || res.filePath;
          localPath = res.filePath;
          if (res.title) soundTitle = res.title;
        }
      } catch (e) {
        console.warn("downloadSound error:", e);
      }
    }

    onImportSound({
      id: `myinstant-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: soundTitle,
      url: soundUrl,
      filePath: localPath,
      duration: instant.duration || '0:02',
      hotkey: '',
      category: 'MyInstants',
      addedOn: new Date().toISOString().split('T')[0],
      volumeMultiplier: 1.0
    });

    setDownloadingIds((prev) => {
      const next = new Set(prev);
      next.delete(instant.id);
      return next;
    });
    setImportedIds((prev) => new Set([...prev, instant.id]));
  };

  const handleImportCustomUrl = async () => {
    if (!customUrl.trim() || isImporting) return;
    setIsImporting(true);
    let url = customUrl.trim();
    let name = "Son MyInstants";

    try {
      if (window.electronAPI && typeof window.electronAPI.downloadSound === 'function') {
        const res = await window.electronAPI.downloadSound({ url, title: name });
        if (res && res.success) {
          onImportSound({
            id: `custom-instant-${Date.now()}`,
            title: res.title || name,
            url: res.dataUrl || res.filePath,
            filePath: res.filePath,
            duration: '0:03',
            hotkey: '',
            category: 'MyInstants',
            addedOn: new Date().toISOString().split('T')[0],
            volumeMultiplier: 1.0
          });
          setCustomUrl('');
          setIsImporting(false);
          alert(`Succès : "${res.title || name}" a été téléchargé et ajouté à votre soundboard !`);
          return;
        }
      }

      onImportSound({
        id: `custom-instant-${Date.now()}`,
        title: name,
        url: url,
        duration: '0:03',
        hotkey: '',
        category: 'MyInstants',
        addedOn: new Date().toISOString().split('T')[0],
        volumeMultiplier: 1.0
      });

      setCustomUrl('');
      setIsImporting(false);
      alert(`Son "${name}" importé avec succès dans FreePad !`);
    } catch (err) {
      setIsImporting(false);
      alert("Erreur lors de l'importation : " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950/60 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 p-0.5 shadow-lg shadow-rose-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Explorateur MyInstants
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300">
                API COMPLÈTE
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Recherchez parmi des dizaines de milliers de sons MyInstants et téléchargez-les instantanément.
            </p>
          </div>
        </div>

        {/* Quick URL Import Box */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Collez un lien myinstants.com..."
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400 w-full sm:w-64"
          />
          <button
            onClick={handleImportCustomUrl}
            disabled={isImporting || !customUrl.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importation...</span>
              </>
            ) : (
              <span>Importer</span>
            )}
          </button>
        </div>
      </div>

      {/* Category Pills & Live Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Tabs (API abdipr/myinstants-api) */}
        <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('trending');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'trending'
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Tendances</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('best');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'best'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Les Meilleurs</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('recent');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'recent'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Récents</span>
          </button>
        </div>

        {/* Live Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher sur MyInstants (ex: Bruh, Fart, Anime, GTA...)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-20 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all shadow-sm"
          >
            Chercher
          </button>
        </form>
      </div>

      {/* Grid of Sounds */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Chargement des sons MyInstants en direct...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {sounds.map((instant, idx) => {
            const isPlaying = playingId === instant.id;
            const isAlreadyAdded = importedIds.has(instant.id) || existingSoundUrls.includes(instant.url);
            const isDownloading = downloadingIds.has(instant.id);
            const colorClass = BUTTON_COLORS[idx % BUTTON_COLORS.length];

            return (
              <div
                key={instant.id || idx}
                className={`glass-panel p-3.5 rounded-2xl flex flex-col justify-between border transition-all duration-200 hover:scale-[1.02] ${
                  isPlaying
                    ? 'border-cyan-400 bg-cyan-950/30 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                {/* Category tag */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 truncate max-w-[85px]">
                    {instant.category || 'MyInstants'}
                  </span>
                  <span className="text-cyan-400">{instant.duration || '0:02'}</span>
                </div>

                {/* Center Big Play Button */}
                <div className="flex flex-col items-center justify-center my-2 text-center">
                  <button
                    onClick={() => handlePreview(instant)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-lg transition-transform active:scale-95 ${
                      isPlaying
                        ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/40 animate-pulse'
                        : `bg-gradient-to-tr ${colorClass} text-white shadow-indigo-600/20 hover:scale-105`
                    }`}
                    title={isPlaying ? "Arrêter" : "Écouter l'aperçu"}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>
                  <span className="text-xs font-semibold text-slate-200 line-clamp-2 h-8" title={instant.title}>
                    {instant.title}
                  </span>
                </div>

                {/* Bottom: Add to Soundboard Button */}
                <button
                  onClick={() => handleAdd(instant)}
                  disabled={isAlreadyAdded || isDownloading}
                  className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-1 ${
                    isAlreadyAdded
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 cursor-default'
                      : isDownloading
                      ? 'bg-indigo-600/50 text-white cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                  }`}
                >
                  {isAlreadyAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Ajouté</span>
                    </>
                  ) : isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Téléchargement...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || isLoading}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Page précédente</span>
        </button>

        <span className="text-xs font-mono text-slate-400">
          Page <strong className="text-white">{page}</strong>
        </span>

        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors"
        >
          <span>Page suivante</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
