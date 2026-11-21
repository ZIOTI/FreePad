import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  Send,
  Languages,
  Check,
  Flame,
  MessageSquare,
  BookmarkPlus,
  Key,
  Globe2,
  Radio,
  RefreshCw,
  Sliders,
  Play,
  RotateCcw,
  Headphones,
  Zap,
  Info
} from 'lucide-react';
import soundEngine from '../audio/SoundEngine';
import { ACCENTS, WORLD_LANGUAGES } from '../audio/AccentTransformer';

const QUICK_PRESETS = [
  { label: "MDR t'es trop nul", text: "MDR, t'es vraiment trop nul.", accent: 'none' },
  { label: "Cheh ! Bien fait", text: "Cheh ! Bien fait pour toi.", accent: 'none' },
  { label: "Mon frère dé (Congo)", text: "Eh ya ! Mon frère, c'est comment là-bas ? Faut pas fâcher dé !", accent: 'congolese' },
  { label: "Mamma Mia (Italie)", text: "Mamma mia ! Ma qué bella jornada, c'est magnifique !", accent: 'italian' },
  { label: "Direct Goulag (Russie)", text: "Da ! Camarade, toi direction goulag, direct !", accent: 'russian' },
  { label: "Achtung ! (Allemand)", text: "Achtung ! Ponjour, ya c'est très clair, natürlich !", accent: 'german' },
  { label: "Ni Hao (Chinois)", text: "Ni hao ! Tlès bien mon ami, toi tlès tlès fort !", accent: 'chinese' },
  { label: "Tabarnak (Québec)", text: "Allô mon chum ! Ça va-tu bien icitte ? C'est ben tiguidou !", accent: 'quebec' },
  { label: "Peuchère (Marseille)", text: "Oh peuchère ! Mais t'es complètement fada mon sang, putain con !", accent: 'marseille' },
  { label: "Wallah sah (Maghreb)", text: "Wallah mon khouya, c'est réel sah to the sah !", accent: 'arabic' },
  { label: "Nani Baka (Anime JP)", text: "Nani ?! Omae wa mou shindeiru, baka !", accent: 'anime' },
  { label: "Appelez l'ambulance", text: "Appelez une ambulance, mais pas pour moi !", accent: 'none' }
];

export default function AiVoiceStudioPanel({ onAddToSoundboard }) {
  const [activeTab, setActiveTab] = useState('accents'); // 'accents' | 'translate' | 'elevenlabs' | 'presets'
  const [text, setText] = useState('');
  const [selectedAccentId, setSelectedAccentId] = useState('congolese');
  const [selectedLang, setSelectedLang] = useState('ja'); // For translation
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [applySlang, setApplySlang] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // ElevenLabs State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('freepad_elevenlabs_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [selectedElevenVoiceId, setSelectedElevenVoiceId] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [elevenStability, setElevenStability] = useState(0.5);
  const [elevenSimilarity, setElevenSimilarity] = useState(0.75);

  const [recentSpeeches, setRecentSpeeches] = useState(() => {
    try {
      const saved = localStorage.getItem('freepad_recent_tts');
      return saved ? JSON.parse(saved) : [
        { text: "Eh ya ! Mon frère dé !", accent: "congolese", time: "12:00" },
        { text: "Mamma mia ! Ma qué !", accent: "italian", time: "12:01" }
      ];
    } catch {
      return [];
    }
  });

  const selectedAccent = ACCENTS.find(a => a.id === selectedAccentId) || ACCENTS[0];

  // Load ElevenLabs voices if key exists
  useEffect(() => {
    if (elevenLabsApiKey && window.electronAPI?.getElevenLabsVoices) {
      loadElevenLabsVoices();
    }
  }, []);

  const loadElevenLabsVoices = async () => {
    if (!elevenLabsApiKey.trim() || !window.electronAPI?.getElevenLabsVoices) return;
    setIsLoadingVoices(true);
    try {
      const res = await window.electronAPI.getElevenLabsVoices({ apiKey: elevenLabsApiKey.trim() });
      if (res && res.success && res.voices) {
        setElevenLabsVoices(res.voices);
        if (res.voices.length > 0 && !selectedElevenVoiceId) {
          setSelectedElevenVoiceId(res.voices[0].voice_id);
        }
      }
    } catch (e) {
      console.warn("ElevenLabs load voices error:", e);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const handleSaveElevenApiKey = () => {
    localStorage.setItem('freepad_elevenlabs_key', elevenLabsApiKey.trim());
    loadElevenLabsVoices();
  };

  // Instant Translation
  const handleTranslate = async (target = selectedLang) => {
    if (!text.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      if (window.electronAPI?.translateText) {
        const res = await window.electronAPI.translateText({
          text: text.trim(),
          targetLang: target,
          sourceLang: 'auto'
        });
        if (res && res.success) {
          setTranslatedText(res.translatedText);
        }
      } else {
        // Web fallback
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text.trim())}`;
        const resp = await fetch(url);
        const json = await resp.json();
        setTranslatedText(json[0].map(s => s[0]).join(''));
      }
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Generate TTS Audio
  const generateAudio = async (sentenceToUse, overrideEngineLang = null) => {
    const rawText = sentenceToUse || text;
    if (!rawText || !rawText.trim()) return null;

    // Mode 1: ElevenLabs Pro
    if (activeTab === 'elevenlabs' && elevenLabsApiKey.trim() && selectedElevenVoiceId) {
      if (window.electronAPI?.generateElevenLabsTts) {
        const res = await window.electronAPI.generateElevenLabsTts({
          apiKey: elevenLabsApiKey.trim(),
          voiceId: selectedElevenVoiceId,
          text: rawText.trim(),
          stability: elevenStability,
          similarityBoost: elevenSimilarity
        });
        if (res && res.success) {
          return {
            id: `tts-11-${Date.now()}`,
            title: `💎 ${rawText.slice(0, 30)}`,
            url: res.dataUrl || res.filePath,
            filePath: res.filePath,
            duration: '0:03'
          };
        } else {
          throw new Error(res?.error || "Erreur ElevenLabs");
        }
      }
    }

    // Mode 2: Multi-Language Translation
    if (activeTab === 'translate') {
      const textToSpeak = translatedText || rawText;
      const targetLang = overrideEngineLang || selectedLang;
      if (window.electronAPI?.generateTts) {
        const res = await window.electronAPI.generateTts({ text: textToSpeak, lang: targetLang });
        if (res && res.success) {
          return {
            id: `tts-tr-${Date.now()}`,
            title: `🌐 [${targetLang.toUpperCase()}] ${textToSpeak.slice(0, 30)}`,
            url: res.dataUrl || res.filePath,
            filePath: res.filePath,
            duration: '0:03'
          };
        }
      }
    }

    // Mode 3: Accents & Comic Dialects
    let finalSpeechText = rawText;
    let engineLang = overrideEngineLang || selectedAccent.engineLang || 'fr';

    if (applySlang && selectedAccent.transform) {
      finalSpeechText = selectedAccent.transform(rawText);
    }

    if (window.electronAPI?.generateTts) {
      const res = await window.electronAPI.generateTts({ text: finalSpeechText, lang: engineLang });
      if (res && res.success) {
        return {
          id: `tts-acc-${Date.now()}`,
          title: `${selectedAccent.flag} ${rawText.slice(0, 30)}`,
          url: res.dataUrl || res.filePath,
          filePath: res.filePath,
          duration: '0:03'
        };
      }
    }

    // Browser fallback
    const clean = encodeURIComponent(finalSpeechText.trim().slice(0, 200));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${clean}&tl=${engineLang}&client=tw-ob`;
    return {
      id: `tts-fb-${Date.now()}`,
      title: `${selectedAccent.flag} ${rawText.slice(0, 30)}`,
      url: url,
      duration: '0:03'
    };
  };

  const handleSpeak = async (customText = null, overrideAccent = null) => {
    let toSpeak = customText || text;
    if (activeTab === 'translate' && translatedText) {
      toSpeak = translatedText;
    }
    if (!toSpeak || !toSpeak.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const sound = await generateAudio(toSpeak, overrideAccent ? overrideAccent.engineLang : null);
      if (sound) {
        await soundEngine.play(sound);

        // Update recents
        const newRecent = [
          {
            text: toSpeak,
            accent: overrideAccent ? overrideAccent.id : (activeTab === 'translate' ? selectedLang : selectedAccentId),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...recentSpeeches.filter(p => p.text !== toSpeak).slice(0, 9)
        ];
        setRecentSpeeches(newRecent);
        try { localStorage.setItem('freepad_recent_tts', JSON.stringify(newRecent)); } catch {}
      }
    } catch (err) {
      console.error("Speak error:", err);
      alert("Erreur de synthèse vocale : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToSoundboard = async () => {
    const toSave = (activeTab === 'translate' && translatedText) ? translatedText : text;
    if (!toSave.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const sound = await generateAudio(toSave);
      if (sound) {
        const cat = activeTab === 'elevenlabs' ? 'Voix ElevenLabs' : (activeTab === 'translate' ? 'Voix Multilingue' : 'Voix Accents');
        onAddToSoundboard({
          id: `voice-${Date.now()}`,
          title: sound.title || `🗣️ ${toSave.slice(0, 25)}`,
          url: sound.url,
          filePath: sound.filePath,
          duration: '0:03',
          hotkey: '',
          category: cat,
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HEADER BANNER */}
      <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/50 via-purple-950/40 to-slate-950/80 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              Studio Voix IA & Accents Multilingues
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold">
                DIRECT MICRO APO
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                FAIT PAR ZIOTI
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Parlez dans n'importe quelle langue, appliquez des accents cultes (Congolais, Italien, Allemand, Russe...) ou connectez ElevenLabs !
            </p>
          </div>
        </div>

        {/* Studio Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/[0.08] rounded-xl self-stretch md:self-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('accents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accents'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <span>🎭</span>
            <span>Accents & Humour</span>
          </button>

          <button
            onClick={() => setActiveTab('translate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'translate'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Traducteur 50+ Langues</span>
          </button>

          <button
            onClick={() => setActiveTab('elevenlabs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'elevenlabs'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <span>💎</span>
            <span>ElevenLabs Pro</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Répliques Cultes</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ACCENTS & HUMOUR */}
      {activeTab === 'accents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <span>🎭 Choisissez un accent ou une voix :</span>
            </h3>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applySlang}
                onChange={(e) => setApplySlang(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span>Ajouter automatiquement expressions & tics de langage</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {ACCENTS.map((acc) => {
              const isSelected = selectedAccentId === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccentId(acc.id);
                    if (!text.trim()) {
                      setText(acc.samplePhrase);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500'
                      : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{acc.flag}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    )}
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {acc.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                      {acc.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TRANSLATOR */}
      {activeTab === 'translate' && (
        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/20 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">Traduire automatiquement vers :</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Tapez en français, choisissez la langue et parlez instantanément dans votre micro !
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {WORLD_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setSelectedLang(l.code);
                  if (text.trim()) handleTranslate(l.code);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedLang === l.code
                    ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>

          {translatedText && (
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between gap-3 mt-2">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                  Traduction prête pour le micro :
                </span>
                <p className="text-sm text-cyan-100 font-semibold mt-0.5">
                  "{translatedText}"
                </p>
              </div>
              <button
                onClick={() => handleSpeak(translatedText)}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dire en direct</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ELEVENLABS PRO */}
      {activeTab === 'elevenlabs' && (
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 to-slate-950 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Connexion ElevenLabs (Clé API)
                  {elevenLabsVoices.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                      {elevenLabsVoices.length} voix synchronisées
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Entrez votre clé API ElevenLabs pour utiliser vos clones et voix ultra-réalistes directement dans FreePad.
                </p>
              </div>
            </div>

            <a
              href="https://elevenlabs.io"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-400 hover:text-amber-300 underline font-medium"
            >
              Obtenir une clé ElevenLabs →
            </a>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? "text" : "password"}
                value={elevenLabsApiKey}
                onChange={(e) => setElevenLabsApiKey(e.target.value)}
                placeholder="sk_..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showApiKey ? "Masquer" : "Afficher"}
              </button>
            </div>
            <button
              onClick={handleSaveElevenApiKey}
              disabled={!elevenLabsApiKey.trim() || isLoadingVoices}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVoices ? 'animate-spin' : ''}`} />
              <span>{isLoadingVoices ? "Connexion..." : "Synchroniser"}</span>
            </button>
          </div>

          {elevenLabsVoices.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Sélectionnez votre voix ElevenLabs :</span>
                <span className="text-[11px] text-slate-500 font-mono">Modèle: Eleven Multilingual v2</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {elevenLabsVoices.map((v) => {
                  const isSelected = selectedElevenVoiceId === v.voice_id;
                  return (
                    <button
                      key={v.voice_id}
                      onClick={() => setSelectedElevenVoiceId(v.voice_id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">{v.name}</span>
                        <span className="text-[10px] text-slate-500 capitalize block truncate">
                          {v.labels?.accent ? `${v.labels.accent} • ` : ''}{v.category || 'Standard'}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PRESETS RAPIDES */}
      {activeTab === 'presets' && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            Phrases cultes & Trolls gaming (1 clic pour parler en direct) :
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {QUICK_PRESETS.map((p, idx) => {
              const matchedAcc = ACCENTS.find(a => a.id === p.accent);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setText(p.text);
                    if (p.accent) setSelectedAccentId(p.accent);
                    handleSpeak(p.text, matchedAcc);
                  }}
                  className="p-3 rounded-xl glass-panel border border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 hover:bg-indigo-950/20 text-left transition-all hover:scale-[1.02] active:scale-95 group flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {p.label}
                    </span>
                    {matchedAcc && <span className="text-sm">{matchedAcc.flag}</span>}
                  </div>
                  <span className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 font-mono">
                    "{p.text}"
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN TEXT INPUT BOX */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl space-y-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-slate-400">Message à prononcer :</span>
            {activeTab === 'accents' && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
                <span>{selectedAccent.flag}</span>
                <span>{selectedAccent.name}</span>
              </span>
            )}
            {activeTab === 'translate' && (
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
                <span>{WORLD_LANGUAGES.find(l => l.code === selectedLang)?.flag}</span>
                <span>Traduire en {WORLD_LANGUAGES.find(l => l.code === selectedLang)?.name}</span>
              </span>
            )}
            {activeTab === 'elevenlabs' && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                <span>💎</span>
                <span>ElevenLabs</span>
              </span>
            )}
          </div>

          {activeTab === 'translate' && (
            <button
              onClick={() => handleTranslate()}
              disabled={!text.trim() || isTranslating}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin' : ''}`} />
              <span>{isTranslating ? "Traduction..." : "Traduire le texte"}</span>
            </button>
          )}
        </div>

        <div className="relative">
          <textarea
            rows="3"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTranslatedText('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSpeak();
              }
            }}
            placeholder={
              activeTab === 'translate'
                ? "Tapez en français votre phrase à traduire et parler dans le micro..."
                : activeTab === 'accents'
                ? `Tapez ce que vous voulez dire avec l'accent ${selectedAccent.name} (ou appuyez sur Entrée)...`
                : "Tapez votre message pour la synthèse vocale..."
            }
            className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none font-medium"
          />
          <span className="absolute bottom-3 right-3 text-[11px] text-slate-500 font-mono">
            {text.length} caractères
          </span>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Speak Button */}
            <button
              onClick={() => handleSpeak()}
              disabled={!text.trim() || isLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isLoading ? "Envoi dans le micro..." : "Parler dans le micro (Entrée)"}</span>
            </button>

            {/* Save to Soundboard Button */}
            <button
              onClick={handleSaveToSoundboard}
              disabled={!text.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
              title="Ajouter comme bouton permanent sur votre grille Soundboard"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Ajouté au Soundboard !</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4 text-amber-400" />
                  <span>Enregistrer en bouton</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setText('');
                setTranslatedText('');
              }}
              disabled={!text}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 disabled:opacity-30 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          </div>
        </div>
      </div>

      {/* RECENT TTS HISTORY */}
      {recentSpeeches.length > 0 && (
        <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/80 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            Historique récent (Cliquez pour rejouer direct) :
          </h4>
          <div className="flex flex-wrap gap-2">
            {recentSpeeches.map((item, idx) => {
              const matchedAcc = ACCENTS.find(a => a.id === item.accent);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setText(item.text);
                    handleSpeak(item.text, matchedAcc);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-slate-300 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer group"
                >
                  {matchedAcc && <span>{matchedAcc.flag}</span>}
                  <span className="truncate max-w-[200px]">{item.text}</span>
                  <span className="text-[10px] text-slate-500 font-mono group-hover:text-indigo-400">{item.time}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
