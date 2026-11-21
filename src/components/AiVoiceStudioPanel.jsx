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
  Info,
  Layers,
  Crown
} from 'lucide-react';
import soundEngine from '../audio/SoundEngine';
import {
  VOICE_ENGINES,
  NEURAL_VOICES,
  GOOGLE_VOICES,
  WORLD_LANGUAGES
} from '../audio/AccentTransformer';

export default function AiVoiceStudioPanel({ onAddToSoundboard }) {
  // 1. Engine & Category Selection
  const [selectedEngine, setSelectedEngine] = useState('neural'); // 'neural' | 'google' | 'elevenlabs'
  const [activeCategory, setActiveCategory] = useState('fr_standard'); // 'fr_standard' | 'fr_accents' | 'intl_accents' | 'translate'
  
  // 2. Selected Voice State
  const [selectedVoiceId, setSelectedVoiceId] = useState('fr-henri');
  const [selectedGoogleVoiceId, setSelectedGoogleVoiceId] = useState('google-fr');

  // 3. Text & Translation State
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('ja');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // 4. ElevenLabs State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('freepad_elevenlabs_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [selectedElevenVoiceId, setSelectedElevenVoiceId] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [elevenStability, setElevenStability] = useState(0.5);
  const [elevenSimilarity, setElevenSimilarity] = useState(0.75);

  // 5. Playback & UI State
  const [isLoading, setIsLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const [recentSpeeches, setRecentSpeeches] = useState([
    { text: "Bonjour les amis, comment vous allez ?", voiceName: "Henri", flag: "🇫🇷", engine: "neural", time: "12:00" },
    { text: "Salut l'équipe, on est chauds pour la game !", voiceName: "Remy", flag: "🇫🇷", engine: "neural", time: "12:05" }
  ]);

  // Load ElevenLabs voices if key exists on mount
  useEffect(() => {
    if (elevenLabsApiKey && elevenLabsApiKey.trim().length > 15) {
      loadElevenLabsVoices(elevenLabsApiKey.trim());
    }
  }, []);

  const saveApiKey = (newKey) => {
    setElevenLabsApiKey(newKey);
    localStorage.setItem('freepad_elevenlabs_key', newKey);
    if (newKey.trim().length > 15) {
      loadElevenLabsVoices(newKey.trim());
    }
  };

  const loadElevenLabsVoices = async (apiKey) => {
    if (!apiKey) return;
    setIsLoadingVoices(true);
    try {
      if (window.electronAPI?.getElevenLabsVoices) {
        const res = await window.electronAPI.getElevenLabsVoices({ apiKey });
        if (res.success && res.voices) {
          setElevenLabsVoices(res.voices);
          if (res.voices.length > 0 && !selectedElevenVoiceId) {
            setSelectedElevenVoiceId(res.voices[0].voice_id);
          }
        }
      }
    } catch (e) {
      console.warn("ElevenLabs voices load error:", e);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // Instant Translation Handler
  const handleTranslate = async (textToTranslate, targetCode) => {
    if (!textToTranslate || !textToTranslate.trim()) {
      setTranslatedText('');
      return;
    }
    setIsTranslating(true);
    try {
      if (window.electronAPI?.translateText) {
        const res = await window.electronAPI.translateText({
          text: textToTranslate,
          targetLang: targetCode,
          sourceLang: 'auto'
        });
        if (res.success) {
          setTranslatedText(res.translatedText);
        }
      } else {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
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

  // Helper to get active selected voice object
  const getSelectedVoice = () => {
    if (selectedEngine === 'google') {
      return GOOGLE_VOICES.find(v => v.id === selectedGoogleVoiceId) || GOOGLE_VOICES[0];
    }
    return NEURAL_VOICES.find(v => v.id === selectedVoiceId) || NEURAL_VOICES[0];
  };

  // Core Speech Synthesis Generator
  const generateSpeechAudio = async (textToSpeak, forcedVoice = null, forcedEngine = null) => {
    const speechText = (textToSpeak || text).trim();
    if (!speechText) return null;

    const engineToUse = forcedEngine || selectedEngine;
    const voiceObj = forcedVoice || getSelectedVoice();

    try {
      // 1. ELEVENLABS PRO ENGINE
      if (engineToUse === 'elevenlabs') {
        if (!elevenLabsApiKey) throw new Error("Veuillez renseigner votre clé API ElevenLabs");
        if (!selectedElevenVoiceId) throw new Error("Sélectionnez une voix ElevenLabs");
        if (window.electronAPI?.generateElevenLabsTts) {
          const res = await window.electronAPI.generateElevenLabsTts({
            apiKey: elevenLabsApiKey,
            voiceId: selectedElevenVoiceId,
            text: speechText,
            stability: elevenStability,
            similarityBoost: elevenSimilarity
          });
          if (!res.success) throw new Error(res.error || "Erreur ElevenLabs");
          return res;
        }
        throw new Error("Electron API non disponible");
      }

      // 2. MICROSOFT NEURAL ENGINE (Default Studio HD)
      if (engineToUse === 'neural') {
        const edgeVoice = voiceObj.edgeVoice || 'fr-FR-HenriNeural';
        if (window.electronAPI?.generateTts) {
          const res = await window.electronAPI.generateTts({
            text: speechText,
            voice: edgeVoice,
            engine: 'neural',
            lang: 'fr'
          });
          if (res.success) return res;
          console.warn("Neural fallback:", res.error);
        }
      }

      // 3. GOOGLE TRANSLATE ENGINE (Optionnel ou Fallback)
      const googleLang = voiceObj.googleLang || 'fr';
      if (window.electronAPI?.generateTts) {
        const res = await window.electronAPI.generateTts({
          text: speechText,
          lang: googleLang,
          engine: 'google'
        });
        if (res.success) return res;
      }

      // Web Fallback if outside Electron
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(speechText.slice(0, 180))}&tl=${googleLang}&client=tw-ob`;
      return {
        success: true,
        text: speechText,
        dataUrl: ttsUrl,
        filePath: null,
        title: `🗣️ "${speechText.slice(0, 30)}"`
      };
    } catch (err) {
      console.error("Generate speech error:", err);
      alert(`Erreur synthèse vocale : ${err.message}`);
      return null;
    }
  };

  // Play audio directly into Microphone (APO) and monitor headphones
  const handleSpeak = async (overrideText = null, overrideVoice = null, overrideEngine = null) => {
    const rawText = overrideText || (activeCategory === 'translate' && translatedText ? translatedText : text);
    if (!rawText || !rawText.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const speechRes = await generateSpeechAudio(rawText, overrideVoice, overrideEngine);
      if (speechRes && (speechRes.dataUrl || speechRes.filePath)) {
        const audioSrc = speechRes.filePath || speechRes.dataUrl;
        await soundEngine.playSound({
          id: `speech-${Date.now()}`,
          title: `Voix: ${rawText.slice(0, 20)}`,
          url: audioSrc,
          volume: 1.0
        });

        // Add to recent speeches
        const activeV = overrideVoice || getSelectedVoice();
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        setRecentSpeeches(prev => [
          {
            text: rawText,
            voiceName: activeV.name,
            flag: activeV.flag || '🎙️',
            engine: overrideEngine || selectedEngine,
            time: timeStr
          },
          ...prev.slice(0, 9)
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Preview voice sample
  const handlePreviewVoice = async (voice, engine) => {
    if (previewingVoiceId) return;
    setPreviewingVoiceId(voice.id);
    try {
      const sample = voice.samplePhrase || "Bonjour, voici ma voix naturelle.";
      const speechRes = await generateSpeechAudio(sample, voice, engine);
      if (speechRes && (speechRes.dataUrl || speechRes.filePath)) {
        await soundEngine.playSound({
          id: `preview-${voice.id}`,
          title: `Preview: ${voice.name}`,
          url: speechRes.filePath || speechRes.dataUrl,
          volume: 0.9
        });
      }
    } finally {
      setPreviewingVoiceId(null);
    }
  };

  // Save speech as permanent Soundboard Button
  const handleSaveToSoundboard = async () => {
    const rawText = activeCategory === 'translate' && translatedText ? translatedText : text;
    if (!rawText || !rawText.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const speechRes = await generateSpeechAudio(rawText);
      if (speechRes && onAddToSoundboard) {
        const activeV = getSelectedVoice();
        const newSound = {
          id: `sound-ai-${Date.now()}`,
          title: `${activeV.flag || '🎙️'} ${rawText.slice(0, 24)}`,
          url: speechRes.filePath || speechRes.dataUrl,
          duration: '0:03',
          hotkey: '',
          volume: 1.0,
          color: selectedEngine === 'elevenlabs' ? '#a855f7' : selectedEngine === 'neural' ? '#10b981' : '#f59e0b',
          category: selectedEngine === 'elevenlabs' ? 'ElevenLabs' : 'Voix IA',
          isFavorite: false
        };
        onAddToSoundboard(newSound);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle enter key in textarea
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSpeak();
    }
  };

  // Filter voices for current category
  const getFilteredVoices = () => {
    if (selectedEngine === 'google') return GOOGLE_VOICES;
    if (activeCategory === 'fr_standard') return NEURAL_VOICES.filter(v => v.category === 'fr_standard');
    if (activeCategory === 'fr_accents') return NEURAL_VOICES.filter(v => v.category === 'fr_accents');
    if (activeCategory === 'intl_accents') return NEURAL_VOICES.filter(v => v.category === 'intl_accents');
    return NEURAL_VOICES;
  };

  const selectedVoice = getSelectedVoice();

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-8">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </span>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Studio Voix IA & Multilingue
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Micro Direct (APO)
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Vraies voix neurales studio HD, accents authentiques sans modification de texte, traducteur 50+ langues & ElevenLabs Pro.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <Headphones className="w-3.5 h-3.5 text-indigo-400" />
              Microphone + Casque synchronisés
            </span>
          </div>
        </div>
      </div>

      {/* 1. MOTEUR VOCAL SELECTOR BAR */}
      <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          Moteur Vocal Actif :
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {VOICE_ENGINES.map((eng) => {
            const isSelected = selectedEngine === eng.id;
            return (
              <button
                key={eng.id}
                onClick={() => setSelectedEngine(eng.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {eng.name}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${eng.badgeColor}`}>
                    {eng.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">
                  {eng.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SUB-TABS (Quand le moteur Neural est sélectionné) */}
      {selectedEngine === 'neural' && (
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveCategory('fr_standard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeCategory === 'fr_standard'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🇫🇷</span>
            <span>Voix Françaises Studio (5)</span>
          </button>

          <button
            onClick={() => setActiveCategory('fr_accents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeCategory === 'fr_accents'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🇨🇦 🇧🇪 🇨🇭</span>
            <span>Accents Francophones (6)</span>
          </button>

          <button
            onClick={() => setActiveCategory('intl_accents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeCategory === 'intl_accents'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🎭</span>
            <span>Accents Internationaux (10)</span>
          </button>

          <button
            onClick={() => setActiveCategory('translate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeCategory === 'translate'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Traducteur 50+ Langues</span>
          </button>
        </div>
      )}

      {/* 3. CONTENU SELON LE MOTEUR & LA CATÉGORIE */}

      {/* A. ELEVENLABS PRO PANEL */}
      {selectedEngine === 'elevenlabs' && (
        <div className="bg-slate-900/60 rounded-2xl p-5 border border-purple-500/30 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-400" />
                Configuration ElevenLabs Pro
              </h3>
              <p className="text-xs text-slate-400">
                Synchronisez vos voix clonées ultra-réalistes et le catalogue complet ElevenLabs.
              </p>
            </div>
            <button
              onClick={() => loadElevenLabsVoices(elevenLabsApiKey)}
              disabled={isLoadingVoices || !elevenLabsApiKey}
              className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVoices ? 'animate-spin' : ''}`} />
              <span>{isLoadingVoices ? "Chargement..." : "Synchroniser mes voix"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                Clé API ElevenLabs (xi-api-key) :
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={elevenLabsApiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="Collez votre clé API ElevenLabs ici..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-[11px] text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? "Masquer" : "Afficher"}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                Voix active :
              </label>
              <select
                value={selectedElevenVoiceId}
                onChange={(e) => setSelectedElevenVoiceId(e.target.value)}
                disabled={elevenLabsVoices.length === 0}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              >
                {elevenLabsVoices.length === 0 ? (
                  <option value="">Entrez votre clé API ci-contre pour charger vos voix</option>
                ) : (
                  elevenLabsVoices.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.name} ({v.category || 'perso'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Stabilité :</span>
                <span className="text-purple-400 font-mono font-bold">{Math.round(elevenStability * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={elevenStability}
                onChange={(e) => setElevenStability(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Clarté / Similitude :</span>
                <span className="text-purple-400 font-mono font-bold">{Math.round(elevenSimilarity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={elevenSimilarity}
                onChange={(e) => setElevenSimilarity(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* B. GOOGLE TRADUCTION PANEL */}
      {selectedEngine === 'google' && (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-300">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Mode <strong>Google Traduction</strong> actif : voix synthétique classique robotique. Aucune modification de vos mots.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {GOOGLE_VOICES.map((v) => {
              const isSelected = selectedGoogleVoiceId === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedGoogleVoiceId(v.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-600/15 border-amber-500 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-lg">{v.flag}</span>
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                        Google
                      </span>
                    </div>
                    <div className="font-bold text-xs text-white">{v.name}</div>
                    <div className="text-[11px] text-slate-400">{v.subtitle}</div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewVoice(v, 'google');
                      }}
                      disabled={previewingVoiceId === v.id}
                      className="text-[11px] font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>{previewingVoiceId === v.id ? "Lecture..." : "Écouter"}</span>
                    </button>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* C. NEURAL VOICE GRID */}
      {selectedEngine === 'neural' && activeCategory !== 'translate' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {getFilteredVoices().map((v) => {
            const isSelected = selectedVoiceId === v.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedVoiceId(v.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{v.flag}</span>
                      <span className="text-xs font-bold text-white">{v.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {v.gender === 'homme' ? '👨 Homme' : '👩 Femme'}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-indigo-300">
                    {v.subtitle}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {v.description}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewVoice(v, 'neural');
                    }}
                    disabled={previewingVoiceId === v.id}
                    className="text-[11px] font-semibold text-slate-400 hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>{previewingVoiceId === v.id ? "Lecture..." : "Écouter l'accent"}</span>
                  </button>

                  {isSelected ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Sélectionnée
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      Cliquer pour choisir
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* D. TRADUCTEUR 50+ LANGUES */}
      {selectedEngine === 'neural' && activeCategory === 'translate' && (
        <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Globe2 className="w-4 h-4 text-cyan-400" />
              Sélectionnez la langue cible vers laquelle traduire et parler :
            </div>
            {isTranslating && (
              <span className="text-[11px] text-cyan-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Traduction en direct...
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
            {WORLD_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setTargetLang(l.code);
                  if (text) handleTranslate(text, l.code);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  targetLang === l.code
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>

          {translatedText && (
            <div className="bg-slate-950 rounded-xl p-3 border border-cyan-500/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-cyan-400">
                  Résultat traduit (sera prononcé dans le micro) :
                </span>
                <p className="text-sm font-semibold text-white">{translatedText}</p>
              </div>
              <button
                onClick={() => {
                  const langItem = WORLD_LANGUAGES.find(w => w.code === targetLang);
                  const voice = {
                    id: `tr-${targetLang}`,
                    name: langItem?.name || targetLang,
                    edgeVoice: langItem?.edgeVoice || 'en-US-JennyNeural',
                    googleLang: targetLang
                  };
                  handleSpeak(translatedText, voice);
                }}
                className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Parler direct</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. ZONE DE SAISIE DE TEXTE (VERBATIM, SANS MODIFICATION DE MOTS) */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            <span>Votre message (prononcé mot pour mot avec l'accent choisi) :</span>
          </label>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Voix active :</span>
            <span className="font-bold text-indigo-400 flex items-center gap-1">
              <span>{selectedVoice.flag}</span>
              <span>{selectedVoice.name}</span>
            </span>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (activeCategory === 'translate' && e.target.value) {
                handleTranslate(e.target.value, targetLang);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Tapez ce que vous voulez dire avec la voix de ${selectedVoice.name} (ou appuyez sur Entrée)...`}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none font-medium"
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
              className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
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

      {/* 5. HISTORIQUE RÉCENT DES PAROLES */}
      {recentSpeeches.length > 0 && (
        <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/80 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            Historique récent (Cliquez pour rejouer direct dans le micro) :
          </h4>
          <div className="flex flex-wrap gap-2">
            {recentSpeeches.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setText(item.text);
                  handleSpeak(item.text);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-slate-300 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer group"
              >
                <span>{item.flag}</span>
                <span className="truncate max-w-[200px]">{item.text}</span>
                <span className="text-[10px] text-slate-500 font-mono group-hover:text-indigo-400">{item.time}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
