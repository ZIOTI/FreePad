import React, { useState } from 'react';
import {
  Mic,
  Volume2,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  Send,
  Languages,
  Check,
  Flame,
  MessageSquare,
  BookmarkPlus
} from 'lucide-react';
import soundEngine from '../audio/SoundEngine';

const QUICK_PRESETS = [
  { label: "MDR t'es trop nul", text: "MDR, t'es vraiment trop nul." },
  { label: "Cheh !", text: "Cheh ! Bien fait pour toi." },
  { label: "Quoi feur", text: "Quoi feur !" },
  { label: "Le boss du jeu", text: "Je suis le boss incontesté du jeu vidéo." },
  { label: "Appelez l'ambulance", text: "Appelez une ambulance, mais pas pour moi !" },
  { label: "Clown", text: "T'es un clown mon reuf." },
  { label: "Bruh", text: "Moment de silence, c'est gênant." },
  { label: "GG l'équipe", text: "Bien joué l'équipe, on est trop forts !" }
];

const LANGUAGES = [
  { code: 'fr', name: 'Français (Fille Google)' },
  { code: 'en', name: 'Anglais (English)' },
  { code: 'es', name: 'Espagnol (Español)' },
  { code: 'ja', name: 'Japonais (日本語)' },
  { code: 'de', name: 'Allemand (Deutsch)' },
  { code: 'it', name: 'Italien (Italiano)' }
];

export default function GoogleTtsPanel({ onAddToSoundboard }) {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('fr');
  const [isLoading, setIsLoading] = useState(false);
  const [recentTts, setRecentTts] = useState([
    { text: "MDR t'es trop nul", time: "12:00" },
    { text: "Cheh ! Bien fait pour toi.", time: "12:01" }
  ]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Generate TTS Audio via Electron or Web fallback
  const generateTtsAudio = async (sentence, targetLang = lang) => {
    if (!sentence || !sentence.trim()) return null;

    if (window.electronAPI && typeof window.electronAPI.generateTts === 'function') {
      const res = await window.electronAPI.generateTts({ text: sentence, lang: targetLang });
      if (res && res.success) {
        return {
          id: `tts-${Date.now()}`,
          title: `🗣️ ${sentence}`,
          url: res.dataUrl || res.filePath,
          filePath: res.filePath,
          duration: '0:03'
        };
      }
    }

    // Browser fallback
    const clean = encodeURIComponent(sentence.trim().slice(0, 200));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${clean}&tl=${targetLang}&client=tw-ob`;
    return {
      id: `tts-${Date.now()}`,
      title: `🗣️ ${sentence}`,
      url: url,
      duration: '0:03'
    };
  };

  const handleSpeak = async (customSentence = null) => {
    const toSpeak = customSentence || text;
    if (!toSpeak.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const sound = await generateTtsAudio(toSpeak);
      if (sound) {
        await soundEngine.play(sound);

        // Add to recents
        setRecentTts((prev) => [
          { text: toSpeak, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ...prev.filter((p) => p.text !== toSpeak).slice(0, 7)
        ]);
      }
    } catch (err) {
      console.error("TTS Speak error:", err);
      alert("Erreur lors de la génération vocale Google : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToSoundboard = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const sound = await generateTtsAudio(text);
      if (sound) {
        onAddToSoundboard({
          id: `tts-pad-${Date.now()}`,
          title: `🗣️ ${text.length > 25 ? text.slice(0, 25) + '...' : text}`,
          url: sound.url,
          filePath: sound.filePath,
          duration: '0:03',
          hotkey: '',
          category: 'Voix TTS',
          addedOn: new Date().toISOString().split('T')[0],
          volumeMultiplier: 1.0
        });
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="glass-panel p-5 rounded-2xl border border-pink-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-indigo-950/50 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 p-0.5 shadow-lg shadow-pink-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Languages className="w-6 h-6 text-pink-400" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Voix Google Traduction (TTS Fille)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300">
                DIRECT MICRO
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Tapez n'importe quelle phrase : la voix féminine culte de Google Traduction parlera directement dans votre appel / micro !
            </p>
          </div>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400">Langue :</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-slate-950 border border-pink-500/40 rounded-xl px-3 py-2 text-xs text-pink-200 focus:outline-none focus:border-pink-400 font-semibold cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Input Box */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
        <div className="relative">
          <textarea
            rows="3"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSpeak();
              }
            }}
            placeholder="Écrivez le message que Google Traduction doit dire dans l'appel (ex: 'Vous êtes vraiment nuls', 'Attention derrière toi !')..."
            className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors resize-none font-medium"
          />
          <span className="absolute bottom-3 right-3 text-[11px] text-slate-500 font-mono">
            {text.length}/200
          </span>
        </div>

        {/* Controls buttons */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSpeak()}
              disabled={!text.trim() || isLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-pink-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>{isLoading ? "Envoi dans le micro..." : "Parler dans le micro (Entrée)"}</span>
            </button>

            <button
              onClick={handleSaveToSoundboard}
              disabled={!text.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Créer un bouton permanent dans votre soundboard"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Ajouté à la soundboard !</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4 text-amber-400" />
                  <span>Enregistrer en bouton</span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => setText('')}
            disabled={!text}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 disabled:opacity-30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Effacer</span>
          </button>
        </div>
      </div>

      {/* Quick Gaming Presets */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          Phrases cultes rapides (1 clic pour envoyer dans l'appel) :
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {QUICK_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setText(p.text);
                handleSpeak(p.text);
              }}
              className="p-3 rounded-xl glass-panel border border-slate-800 hover:border-pink-500/50 bg-slate-900/40 hover:bg-pink-950/20 text-left transition-all hover:scale-[1.02] active:scale-95 group flex flex-col justify-between"
            >
              <span className="text-xs font-bold text-slate-200 group-hover:text-pink-300 transition-colors line-clamp-1">
                {p.label}
              </span>
              <span className="text-[11px] text-slate-400 line-clamp-1 mt-1 font-mono">
                "{p.text}"
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent TTS history */}
      {recentTts.length > 0 && (
        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/80 space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            Historique récent :
          </h4>
          <div className="flex flex-wrap gap-2">
            {recentTts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setText(item.text);
                  handleSpeak(item.text);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-slate-300 flex items-center gap-2 transition-all hover:scale-105"
              >
                <span>{item.text}</span>
                <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
