import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  X,
  Disc3,
  Play,
  Square,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Sliders,
  Volume2,
  Clock,
  Radio,
  Music2
} from 'lucide-react';
import instantRemixEngine, { BEAT_PRESETS } from '../audio/InstantRemixEngine';

export default function InstantRemixModal({ isOpen, onClose, onAddSound }) {
  const [selectedStyle, setSelectedStyle] = useState('drill');
  const [captureSeconds, setCaptureSeconds] = useState(2.5);
  const [isLooping, setIsLooping] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'capturing' | 'cooking' | 'playing' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [lastRemix, setLastRemix] = useState(null);
  const [saveTitle, setSaveTitle] = useState('Remix Pote');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-load beats once on modal mount
  useEffect(() => {
    instantRemixEngine.preloadBeats().catch(() => {});
    instantRemixEngine.onStatusChange = (newSt) => {
      setStatus(newSt);
    };
  }, []);

  const handleTriggerRemix = async () => {
    setStatus('capturing');
    setErrorMessage('');
    setIsSaved(false);

    const result = await instantRemixEngine.triggerRemix({
      style: selectedStyle,
      captureSeconds,
      isLooping
    });

    if (result?.success) {
      setLastRemix(result);
      const styleName = BEAT_PRESETS[selectedStyle]?.name || 'Drill';
      setSaveTitle(`Remix ${styleName} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } else {
      setStatus('error');
      setErrorMessage(result?.error || 'Erreur lors de la capture ou du mixage.');
    }
  };

  const handleStop = () => {
    instantRemixEngine.stop();
    setStatus('idle');
  };

  const handleSaveToSoundboard = async () => {
    if (!lastRemix || isSaved || isSaving) return;
    setIsSaving(true);
    try {
      const newSound = await lastRemix.saveToPad(saveTitle.trim() || 'Remix Pote');
      if (newSound && onAddSound) {
        onAddSound(newSound);
        setIsSaved(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentPreset = BEAT_PRESETS[selectedStyle] || BEAT_PRESETS.drill;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg p-6 bg-slate-900 border border-orange-500/40 rounded-3xl shadow-2xl shadow-orange-950/50 text-slate-100 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-600 text-white shadow-lg shadow-orange-500/30">
              <Flame className="w-7 h-7 animate-pulse text-yellow-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white tracking-wide">
                  Instant Remix
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-orange-950/80 text-orange-400 font-bold border border-orange-500/40 shadow-sm">
                  Touche F7
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Capture la voix de ton pote en vocal et balance-la en rap direct dans ton micro !
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (status === 'playing') handleStop();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Style Selector Tabs */}
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Music2 className="w-4 h-4 text-orange-400" />
              Choisis l'instru du Remix :
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Boucles 48 kHz prêtes
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            {Object.values(BEAT_PRESETS).map((preset) => {
              const isSelected = selectedStyle === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedStyle(preset.id)}
                  className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                    isSelected
                      ? 'bg-slate-800 border-orange-500 shadow-lg shadow-orange-500/20 ring-1 ring-orange-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{preset.icon}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-orange-300 font-bold border border-orange-500/20">
                      {preset.badge}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Capture Settings */}
        <div className="mb-5 p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Temps de parole à capturer
              </span>
              <span className="text-[10px] text-slate-400">
                Extrait les {captureSeconds}s avant l'appui
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {[1.5, 2.5, 3.5].map((sec) => (
              <button
                key={sec}
                onClick={() => setCaptureSeconds(sec)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  captureSeconds === sec
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Animation & Live Playback Status */}
        {status === 'playing' && (
          <div className="mb-5 p-4 bg-gradient-to-r from-orange-950/40 via-red-950/30 to-purple-950/40 border border-orange-500/50 rounded-2xl flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Disc3 className="w-9 h-9 text-orange-400 animate-spin shrink-0" />
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  REMIX EN COURS DANS DISCORD !
                </span>
                <p className="text-[11px] text-orange-200/80 mt-0.5">
                  Instru {currentPreset.name} en direct dans ton micro &amp; casque.
                </p>
              </div>
            </div>

            <button
              onClick={handleStop}
              className="px-3.5 py-2 bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all shrink-0 active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </div>
        )}

        {status === 'cooking' && (
          <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
            <div>
              <strong className="block text-white">Cuisine du remix en cours...</strong>
              <span>Découpe automatique, calage sur les 808 et ajout de l'écho studio</span>
            </div>
          </div>
        )}

        {status === 'capturing' && (
          <div className="mb-5 p-3.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center gap-3 text-cyan-300 text-xs">
            <Radio className="w-5 h-5 animate-pulse text-cyan-400 shrink-0" />
            <div>
              <strong className="block text-white">Capture audio active...</strong>
              <span>Extraction des {captureSeconds} dernières secondes de parole</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300">
            ⚠️ {errorMessage || 'Erreur lors de la création du remix.'}
          </div>
        )}

        {/* Save to Soundboard Section (when a remix has been created) */}
        {lastRemix && (
          <div className="mb-5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
              <span>💾 Garder ce remix sur ton Soundboard :</span>
              {isSaved && (
                <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                  <Check className="w-3.5 h-3.5" /> Enregistré dans "Mes sons" !
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={saveTitle}
                disabled={isSaved}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Nom du pad (ex: Remix Bégaiement Maxime)"
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50"
              />

              <button
                onClick={handleSaveToSoundboard}
                disabled={isSaved || isSaving}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
                  isSaved
                    ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 cursor-default'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 active:scale-95'
                }`}
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isSaved ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-orange-400" />
                )}
                <span>{isSaved ? 'Ajouté !' : 'Sauvegarder'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Big Trigger Button */}
        <div className="mt-2 flex flex-col gap-2.5">
          <button
            onClick={handleTriggerRemix}
            disabled={status === 'capturing' || status === 'cooking'}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-400 hover:via-amber-400 hover:to-red-500 text-white text-sm font-extrabold shadow-xl shadow-orange-600/30 transition-all transform active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Flame className="w-5 h-5 fill-current text-yellow-200 animate-bounce" />
            <span>
              {status === 'playing' ? 'RE-REMIXER MAINTENANT (F7)' : "🔥 REMIXER CE QU'IL VIENT DE DIRE !"}
            </span>
          </button>

          <p className="text-[11px] text-center text-slate-400">
            💡 <strong>Raccourci magique :</strong> Appuie sur <strong className="text-orange-400 font-mono">F7</strong> à n'importe quel moment en jeu pour déclencher le remix instantanément !
          </p>
        </div>
      </div>
    </div>
  );
}
