import React, { useState, useEffect } from 'react';
import {
  Search,
  Play,
  Pause,
  Plus,
  Check,
  Loader2,
  Sparkles,
  Flame,
  ThumbsUp,
  Download,
  ChevronLeft,
  ChevronRight,
  Radio,
  Zap,
  Music2
} from 'lucide-react';
import soundEngine from '../audio/SoundEngine';

const QUICK_CATEGORIES = [
  { label: '🔥 Tendances', query: '' },
  { label: '😂 Mèmes', query: 'meme' },
  { label: '🎌 Anime', query: 'anime' },
  { label: '🎮 Gaming', query: 'gaming' },
  { label: '💀 Screamer & Horreur', query: 'scream' },
  { label: '🎵 Musique', query: 'music' },
  { label: '🔊 Effets & SFX', query: 'sound effect' },
  { label: '📱 TikTok', query: 'tiktok' },
];

export default function VoicemodTab({ onImportSound, existingSoundUrls = [] }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [page, setPage] = useState(1);
  const [sounds, setSounds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [importedIds, setImportedIds] = useState(new Set());
  const [totalSounds, setTotalSounds] = useState(0);

  const fetchSounds = async (searchQuery, p = 1) => {
    setIsLoading(true);
    try {
      if (window.electronAPI && typeof window.electronAPI.searchVoicemod === 'function') {
        const res = await window.electronAPI.searchVoicemod({ query: searchQuery, page: p, size: 24 });
        if (res && res.success && res.sounds) {
          setSounds(res.sounds);
          setTotalSounds(res.total || 0);
          return;
        }
      }

      // Fallback direct browser fetch if in dev/browser
      const cleanQ = encodeURIComponent(searchQuery || '');
      const resp = await fetch(`https://tuna-api.voicemod.net/v1/sounds/search?search=${cleanQ}&page=${p}&size=24`);
      if (resp.ok) {
        const data = await resp.json();
        const parsed = (data.items || []).map((item) => {
          const durSec = item.properties?.duration ? Math.round(item.properties.duration / 1000) : 3;
          const m = Math.floor(durSec / 60);
          const s = durSec % 60;
          return {
            id: `voicemod-${item.id}`,
            title: item.title,
            url: item.path,
            image: item.imagePath || item.thumbnailM,
            duration: `${m}:${s < 10 ? '0' : ''}${s}`,
            category: item.category ? (item.category.charAt(0).toUpperCase() + item.category.slice(1)) : 'Voicemod',
            likes: item.social?.likeCount || 0,
            downloads: item.stats?.downloadCount || 0,
            plays: item.stats?.playedCount || 0,
          };
        });
        setSounds(parsed);
        setTotalSounds(data.total || 0);
      }
    } catch (err) {
      console.warn("Voicemod fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSounds(activeCategory, page);
  }, [activeCategory, page]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setPage(1);
    fetchSounds(query, 1);
  };

  const handleCategoryClick = (catQuery) => {
    setActiveCategory(catQuery);
    setQuery(catQuery);
    setPage(1);
  };

  const handlePreviewPlay = async (sound) => {
    if (playingId === sound.id) {
      soundEngine.stop();
      setPlayingId(null);
      return;
    }

    setPlayingId(sound.id);
    const ok = await soundEngine.play({
      id: sound.id,
      title: sound.title,
      url: sound.url,
      volumeMultiplier: 1.0
    });

    if (!ok) {
      setPlayingId(null);
    }
  };

  useEffect(() => {
    const handleEnded = () => setPlayingId(null);
    const oldEnded = soundEngine.onEnded;
    soundEngine.onEnded = (id) => {
      setPlayingId(null);
      if (oldEnded) oldEnded(id);
    };
    return () => {
      soundEngine.onEnded = oldEnded;
    };
  }, []);

  const handleAddSound = async (sound) => {
    if (downloadingIds.has(sound.id)) return;

    setDownloadingIds((prev) => new Set([...prev, sound.id]));
    try {
      let finalUrl = sound.url;
      let finalFilePath = '';

      if (window.electronAPI && typeof window.electronAPI.downloadSound === 'function') {
        const res = await window.electronAPI.downloadSound({
          url: sound.url,
          title: sound.title
        });
        if (res && res.success) {
          finalUrl = res.dataUrl || res.filePath || sound.url;
          finalFilePath = res.filePath || '';
        }
      }

      const soundboardItem = {
        id: `voicemod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: sound.title,
        url: finalUrl,
        filePath: finalFilePath,
        duration: sound.duration || '0:03',
        hotkey: '',
        category: 'Voicemod',
        addedOn: new Date().toISOString().split('T')[0],
        volumeMultiplier: 1.0
      };

      if (onImportSound) onImportSound(soundboardItem);
      setImportedIds((prev) => new Set([...prev, sound.id]));
    } catch (err) {
      console.error("Failed to add Voicemod sound:", err);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(sound.id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-950/80 via-slate-900/90 to-cyan-950/70 border border-violet-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 via-violet-600 to-pink-500 flex items-center justify-center p-0.5 shadow-lg shadow-violet-500/30">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-wide">
                Catalogue Voicemod (Tuna API)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 uppercase tracking-widest">
                Officiel
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Explorez et ajoutez des centaines de milliers de mèmes sonores Voicemod en 1 clic
            </p>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher sur Voicemod (ex: anime, scream, meme, bruh, gta)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-950 border border-violet-500/30 rounded-xl pl-10 pr-20 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner transition-colors"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            Chercher
          </button>
        </form>
      </div>

      {/* Quick Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {QUICK_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.query;
          return (
            <button
              key={cat.label}
              onClick={() => handleCategoryClick(cat.query)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-violet-500/30 scale-105'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Sounds Grid */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm font-medium">Recherche dans la base de données Voicemod...</p>
        </div>
      ) : sounds.length === 0 ? (
        <div className="py-20 text-center text-slate-400 glass-panel rounded-2xl border border-slate-800">
          <Music2 className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">Aucun son trouvé sur Voicemod pour cette recherche</p>
          <p className="text-xs text-slate-500 mt-1">Essayez un autre mot-clé (ex: "scream", "bonk", "anime", "roblox")</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {sounds.map((sound) => {
            const isPlayingThis = playingId === sound.id;
            const isDownloaded = importedIds.has(sound.id) || existingSoundUrls.includes(sound.url);
            const isDownloading = downloadingIds.has(sound.id);

            return (
              <div
                key={sound.id}
                className={`p-3.5 rounded-2xl transition-all border flex flex-col justify-between gap-3 ${
                  isPlayingThis
                    ? 'bg-violet-950/40 border-cyan-400/80 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80 hover:border-violet-500/40 shadow-sm'
                }`}
              >
                {/* Top Row: Avatar/Image + Info */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner">
                    {sound.image ? (
                      <img
                        src={sound.image}
                        alt={sound.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Music2 className="w-6 h-6 text-violet-400" />
                    )}
                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-white truncate" title={sound.title}>
                      {sound.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30 truncate">
                        {sound.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {sound.duration}
                      </span>
                    </div>
                    {sound.likes > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                        <ThumbsUp className="w-3 h-3 text-slate-500" />
                        <span>{sound.likes} likes</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row Actions: Preview and Add */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
                  <button
                    onClick={() => handlePreviewPlay(sound)}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isPlayingThis
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isPlayingThis ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Écouter</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleAddSound(sound)}
                    disabled={isDownloaded || isDownloading}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isDownloaded
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 cursor-default'
                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md active:scale-95'
                    }`}
                  >
                    {isDownloading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isDownloaded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ajouté</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {sounds.length > 0 && (
        <div className="flex items-center justify-between p-4 glass-panel rounded-2xl border border-slate-800 text-xs text-slate-400 mt-2">
          <span>Page {page} {totalSounds > 0 && `(sur ${Math.ceil(totalSounds / 24)} pages disponibles)`}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>
            <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1 font-semibold"
            >
              <span>Suivant</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
