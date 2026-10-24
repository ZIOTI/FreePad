import React, { useState, useEffect } from 'react';
import {
  X,
  Link,
  SquarePlay,
  Scissors,
  Download,
  Sparkles,
  Crown,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Clock,
  Music2,
  FileAudio,
  ClipboardPaste
} from 'lucide-react';

export default function MediaImportModal({
  isOpen,
  onClose,
  onImportComplete,
  categories = ['Mes sons', 'Humour', 'Mèmes', 'Effets']
}) {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [error, setError] = useState(null);

  // Trimming parameters (in seconds)
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [customTitle, setCustomTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Mes sons');

  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setMediaInfo(null);
      setIsAnalyzing(false);
      setIsDownloading(false);
      setError(null);
      setStartTime(0);
      setEndTime(10);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        analyzeUrl(text.trim());
      }
    } catch (e) {
      // Fallback
    }
  };

  const analyzeUrl = async (targetUrl = url) => {
    const cleanUrl = (targetUrl || url).trim();
    if (!cleanUrl) {
      setError("Veuillez saisir ou coller un lien.");
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setMediaInfo(null);

    try {
      if (window.electronAPI?.getMediaInfo) {
        const res = await window.electronAPI.getMediaInfo({ url: cleanUrl });
        if (res && res.success && res.info) {
          setMediaInfo(res.info);
          setCustomTitle(res.info.title || 'Son Importé');
          const totalDur = res.info.duration || 30;
          setStartTime(0);
          // Default trim to first 10s if video is long, or full duration if under 15s
          setEndTime(totalDur > 15 ? 10 : totalDur);
        } else {
          setError(res?.error || "Impossible d'extraire les informations de ce lien.");
        }
      } else {
        setError("API Electron non disponible.");
      }
    } catch (err) {
      setError(err.message || "Erreur lors de l'analyse du lien.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = async () => {
    if (!url.trim()) return;
    setError(null);
    setIsDownloading(true);

    try {
      if (window.electronAPI?.downloadMedia) {
        const res = await window.electronAPI.downloadMedia({
          url: url.trim(),
          title: customTitle.trim() || mediaInfo?.title || 'Son Importé',
          category: selectedCategory,
          startTime: startTime,
          endTime: endTime
        });

        if (res && res.success && res.sound) {
          onImportComplete(res.sound);
          onClose();
        } else {
          setError(res?.error || "Erreur lors du téléchargement.");
        }
      } else {
        setError("API Electron non disponible.");
      }
    } catch (err) {
      setError(err.message || "Erreur de téléchargement.");
    } finally {
      setIsDownloading(false);
    }
  };

  const maxDuration = mediaInfo?.duration || 60;
  const selectedDuration = Math.max(0.1, (endTime - startTime)).toFixed(1);

  const setPresetDuration = (seconds) => {
    setStartTime(0);
    setEndTime(Math.min(maxDuration, seconds));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-indigo-500/20 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/30 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <SquarePlay className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  Importateur YouTube / TikTok / MP4
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300">
                  ZÉRO PUB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>Téléchargement direct & découpage audio</span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Fait par zioti
                </span>
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
          {/* URL Input Box */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Lien de la vidéo ou du son</span>
              <span className="text-[11px] text-slate-500 font-normal">
                YouTube, Shorts, TikTok, Twitter/X, MP4...
              </span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=... ou tiktok.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyzeUrl()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
                  title="Coller depuis le presse-papier"
                >
                  <ClipboardPaste className="w-3 h-3 text-cyan-400" />
                  <span>Coller</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => analyzeUrl()}
                disabled={isAnalyzing || !url.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyse...</span>
                  </>
                ) : (
                  <span>Analyser</span>
                )}
              </button>
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Media Info & Trimming Card */}
          {mediaInfo && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Video Preview Card */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex gap-3.5 items-center">
                {mediaInfo.thumbnail ? (
                  <img
                    src={mediaInfo.thumbnail}
                    alt={mediaInfo.title}
                    className="w-24 h-16 object-cover rounded-xl border border-slate-800 shrink-0"
                  />
                ) : (
                  <div className="w-24 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    <Music2 className="w-6 h-6 text-indigo-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white line-clamp-1">{mediaInfo.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{mediaInfo.uploader}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Durée totale : {mediaInfo.durationFormatted || `${mediaInfo.duration}s`}
                    </span>
                  </div>
                </div>
              </div>

              {/* ✂️ Precision Audio Trimmer ("couper la taille") */}
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black tracking-wide uppercase text-indigo-300 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Découper l'audio (Début & Fin)</span>
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono font-bold text-[11px]">
                    Extrait : {selectedDuration}s
                  </span>
                </div>

                {/* Range Sliders */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="w-12 text-slate-400 text-[11px]">Début:</span>
                    <input
                      type="range"
                      min="0"
                      max={maxDuration}
                      step="0.5"
                      value={startTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setStartTime(Math.min(val, endTime - 0.5));
                      }}
                      className="flex-1 accent-indigo-500 cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max={maxDuration}
                      step="0.5"
                      value={startTime}
                      onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-center text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-500">sec</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="w-12 text-slate-400 text-[11px]">Fin:</span>
                    <input
                      type="range"
                      min="0"
                      max={maxDuration}
                      step="0.5"
                      value={endTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEndTime(Math.max(val, startTime + 0.5));
                      }}
                      className="flex-1 accent-cyan-400 cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max={maxDuration}
                      step="0.5"
                      value={endTime}
                      onChange={(e) => setEndTime(Math.min(maxDuration, parseFloat(e.target.value) || 0))}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-center text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-500">sec</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-slate-500 uppercase font-mono mr-1">Raccourcis:</span>
                  {[5, 10, 15, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setPresetDuration(sec)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-300 transition-colors"
                    >
                      {sec}s
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setStartTime(0);
                      setEndTime(maxDuration);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-cyan-300 transition-colors"
                  >
                    Tout le son
                  </button>
                </div>
              </div>

              {/* Title & Category inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400">Nom du son sur la grille</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400">Catégorie</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {categories.filter(c => c !== 'Tous les sons').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Format MP3 haute fidélité injecté automatiquement</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || !mediaInfo}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              {isDownloading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-amber-200" />
                  <span>Téléchargement...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-amber-200" />
                  <span>Ajouter au Soundboard</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
