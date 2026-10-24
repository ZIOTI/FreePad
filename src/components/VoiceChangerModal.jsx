import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Headphones,
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  X,
  Zap,
  Check,
  Activity,
  Radio,
  Keyboard,
  Info,
  Power,
  Play,
  RotateCcw,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import voiceChangerEngine, { VOICE_PRESETS } from '../audio/VoiceChangerEngine';
import soundEngine from '../audio/SoundEngine';

export default function VoiceChangerModal({
  isOpen,
  onClose,
  audioInputDevices = [],
  selectedMicInput,
  setSelectedMicInput,
  broadcastOutput,
  setBroadcastOutput
}) {
  const [activePreset, setActivePreset] = useState(voiceChangerEngine.activePreset || 'none');
  const [isMonitoring, setIsMonitoring] = useState(voiceChangerEngine.isMonitoringEnabled);
  const [monitoringVol, setMonitoringVol] = useState(voiceChangerEngine.monitoringVolume);
  const [isPushToTalk, setIsPushToTalk] = useState(voiceChangerEngine.isPushToTalk);
  const [vuLevel, setVuLevel] = useState(0);
  const [currentHotkey, setCurrentHotkey] = useState('F6');
  const [isSettingHotkey, setIsSettingHotkey] = useState(false);
  const [micActive, setMicActive] = useState(false);

  // Audio Device Selection State
  const [inputDevices, setInputDevices] = useState(audioInputDevices || []);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState(
    selectedMicInput || soundEngine.realMicDeviceId || localStorage.getItem('freepad_selected_mic') || 'default'
  );
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(
    broadcastOutput || soundEngine.broadcastDeviceId || 'default'
  );
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [testMessage, setTestMessage] = useState('');

  const animFrameRef = useRef(null);

  // Sync state and enumerate devices on modal open
  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    // Auto-start microphone if not already active
    voiceChangerEngine.ensureMicStarted().then(ok => setMicActive(ok));

    // Enumerate both audioinput (microphones) and audiooutput (virtual cables/speakers)
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devs => {
        const ins = devs.filter(d => d.kind === 'audioinput');
        const outs = devs.filter(d => d.kind === 'audiooutput');
        setInputDevices(ins);
        setOutputDevices(outs);

        // 1. Microphone Input: Auto-select physical microphone (e.g. WOODBRASS UM1, Logitech PRO X)
        const currentSavedMic = selectedMicInput || localStorage.getItem('freepad_selected_mic') || soundEngine.realMicDeviceId;
        if (currentSavedMic && currentSavedMic !== 'default' && ins.some(d => d.deviceId === currentSavedMic)) {
          setSelectedMicId(currentSavedMic);
        } else if (ins.length > 0) {
          const physMic = ins.find(d => {
            const l = (d.label || '').toLowerCase();
            return !l.includes('cable') && !l.includes('virtual') && !l.includes('mixage') && !l.includes('stereo mix') && !l.includes('voicemeeter');
          }) || ins[0];
          setSelectedMicId(physMic.deviceId);
          if (setSelectedMicInput) setSelectedMicInput(physMic.deviceId);
          soundEngine.toggleMicPassthrough(true, physMic.deviceId, physMic.label);
          localStorage.setItem('freepad_selected_mic', physMic.deviceId);
        }

        // 2. Broadcast Output: Auto-detect virtual device (Voicemod, Steam, VB-Cable)
        if (soundEngine.broadcastDeviceId && soundEngine.broadcastDeviceId !== 'default') {
          setSelectedBroadcastId(soundEngine.broadcastDeviceId);
        } else {
          soundEngine.autoDetectVirtualDevice().then(vDev => {
            if (vDev) {
              setSelectedBroadcastId(vDev.deviceId);
              soundEngine.setOutputDevice('broadcast', vDev.deviceId);
              if (setBroadcastOutput) setBroadcastOutput(vDev.deviceId);
            }
          });
        }
      });
    }

    // Register callback for external hotkey triggers
    voiceChangerEngine.onStateChange = (presetId) => {
      setActivePreset(presetId);
      setIsMonitoring(voiceChangerEngine.isMonitoringEnabled);
    };

    // Live VU-Meter loop
    const updateVu = () => {
      const lvl = voiceChangerEngine.getAudioLevel();
      setVuLevel(Math.round(lvl * 100));
      animFrameRef.current = requestAnimationFrame(updateVu);
    };
    updateVu();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      voiceChangerEngine.onStateChange = null;
    };
  }, [isOpen]);

  const handleSelectPreset = (presetId) => {
    voiceChangerEngine.ensureMicStarted();
    voiceChangerEngine.setPreset(presetId);
    setActivePreset(presetId);
  };

  const handleToggleMonitoring = (enabled) => {
    voiceChangerEngine.setMonitoring(enabled);
    setIsMonitoring(enabled);
  };

  const handleMonitoringVolChange = (e) => {
    const val = parseFloat(e.target.value);
    setMonitoringVol(val);
    voiceChangerEngine.setMonitoringVolume(val);
  };

  const handleTogglePushToTalk = (enabled) => {
    setIsPushToTalk(enabled);
    voiceChangerEngine.setPushToTalk(enabled);
  };

  const handleMicDeviceChange = async (deviceId) => {
    setSelectedMicId(deviceId);
    if (setSelectedMicInput) setSelectedMicInput(deviceId);
    localStorage.setItem('freepad_selected_mic', deviceId);
    const chosen = (inputDevices || []).find(d => d.deviceId === deviceId);
    await soundEngine.toggleMicPassthrough(
      Boolean(deviceId && deviceId !== 'none'),
      deviceId,
      chosen?.label || ''
    );
  };

  const handleBroadcastDeviceChange = (deviceId) => {
    setSelectedBroadcastId(deviceId);
    if (setBroadcastOutput) setBroadcastOutput(deviceId);
    soundEngine.setOutputDevice('broadcast', deviceId);
  };

  const handleRunEchoTest = async () => {
    if (isTestingVoice) return;
    setIsTestingVoice(true);
    setTestProgress(0);
    setTestMessage("Parle maintenant dans ton micro (enregistrement 3s)...");

    try {
      await soundEngine.recordVoiceEchoTest(3.0, (prog) => {
        setTestProgress(Math.round(prog * 100));
      });
      setTestMessage("✅ Écoute en cours dans ton casque !");
      setTimeout(() => {
        setIsTestingVoice(false);
        setTestProgress(0);
        setTestMessage('');
      }, 3500);
    } catch (e) {
      console.warn("Echo test error:", e);
      setIsTestingVoice(false);
      setTestMessage("Erreur test vocal");
    }
  };

  const handleKeyDown = async (e) => {
    if (!isSettingHotkey) return;
    e.preventDefault();
    e.stopPropagation();

    const key = e.key.toUpperCase();
    let finalKey = key;
    if (e.key.startsWith('F') && !isNaN(e.key.slice(1))) {
      finalKey = e.key.toUpperCase();
    } else if (key === 'ESCAPE') {
      setIsSettingHotkey(false);
      return;
    }

    if (window.electronAPI && typeof window.electronAPI.setVoiceChangerHotkey === 'function') {
      const res = await window.electronAPI.setVoiceChangerHotkey({ hotkey: finalKey });
      if (res && res.success) {
        setCurrentHotkey(res.hotkey);
      }
    } else {
      setCurrentHotkey(finalKey);
    }
    setIsSettingHotkey(false);
  };

  if (!isOpen) return null;

  // Determine current active broadcast target name & Discord suggestion
  const getDiscordInputSuggestion = (label = '') => {
    const l = (label || '').toLowerCase();
    if (l.includes('voicemod')) return 'Microphone (Voicemod Virtual Audio Device (WDM))';
    if (l.includes('steam')) return 'Steam Streaming Microphone';
    if (l.includes('cable') || l.includes('vb-audio')) return 'CABLE Output (VB-Audio Virtual Cable)';
    return label || 'ton périphérique virtuel';
  };

  const currentMicDevice = inputDevices.find(d => d.deviceId === selectedMicId);
  const activeMicName = currentMicDevice?.label || 'Microphone par défaut';

  const currentBroadcastDevice = outputDevices.find(d => d.deviceId === selectedBroadcastId);
  const broadcastLabel = currentBroadcastDevice?.label || 'Périphérique Virtuel';
  const discordInputName = getDiscordInputSuggestion(broadcastLabel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-white custom-scrollbar">
        {/* Glow Accent */}
        <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-t-full shadow-lg shadow-purple-500/20 pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/30">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent">
                  Voice Changer Pro Studio
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  DSP Constant-Power
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Modulateur de voix temps réel haute fidélité • <span className="text-indigo-400 font-semibold">Fait par zioti</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Master bypass / toggle button */}
            <button
              onClick={() => handleSelectPreset(activePreset === 'none' ? (voiceChangerEngine.lastActivePreset || 'autotune') : 'none')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl font-medium text-xs transition-all ${
                activePreset !== 'none'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${activePreset !== 'none' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span>{activePreset !== 'none' ? 'EFFET ACTIVÉ' : 'DÉSACTIVÉ'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live VU-Meter & Mic Status */}
        <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <Activity className={`w-4 h-4 ${vuLevel > 5 ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="text-xs font-medium text-slate-300 truncate max-w-[240px]">
              Niveau ({activeMicName}) :
            </span>
          </div>

          {/* Meter Bar */}
          <div className="flex-1 max-w-md h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                vuLevel > 60
                  ? 'bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500 shadow-md shadow-rose-500/30'
                  : 'bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-md shadow-cyan-500/30'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, vuLevel))}%` }}
            />
          </div>

          <span className="text-xs font-mono font-bold text-cyan-300 w-10 text-right">
            {vuLevel}%
          </span>
        </div>

        {/* Preset Cards Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(VOICE_PRESETS).map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                className={`group relative p-4 rounded-xl cursor-pointer transition-all border text-left ${
                  isSelected
                    ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-indigo-500 shadow-xl shadow-indigo-500/20 scale-[1.02]'
                    : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/70 hover:border-slate-700'
                }`}
              >
                {/* Active check pill */}
                {isSelected && (
                  <span className="absolute top-3 right-3 flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-indigo-500 text-white shadow-sm">
                    <Check className="w-3 h-3" />
                    <span>Actif</span>
                  </span>
                )}

                <div className="flex items-start space-x-3">
                  <div className={`text-3xl p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-inner group-hover:scale-110 transition-transform`}>
                    {preset.icon}
                  </div>
                  <div className="flex-1 pr-6">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {preset.name}
                      </h3>
                    </div>
                    <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-700/60 text-slate-300">
                      {preset.badge}
                    </span>
                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Audio Devices & Discord Setup Card */}
        <div className="mt-4 p-4 bg-slate-950/70 border border-indigo-500/30 rounded-xl shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Configuration Micro &amp; Discord :
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                🟢 Sortie Active
              </span>
            </div>

            {/* Echo Test Button */}
            <button
              onClick={handleRunEchoTest}
              disabled={isTestingVoice}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
                isTestingVoice
                  ? 'bg-purple-600/80 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isTestingVoice ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Test en cours ({testProgress}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>🎙️ Tester ce que Discord entend (3s)</span>
                </>
              )}
            </button>
          </div>

          {testMessage && (
            <div className="p-2 rounded bg-indigo-900/30 border border-indigo-500/40 text-xs text-indigo-200 animate-in fade-in">
              {testMessage}
            </div>
          )}

          {/* TWO DROPDOWNS: 1. MICROPHONE INPUT | 2. BROADCAST OUTPUT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* 1. Microphone Input */}
            <div>
              <label className="text-[11px] font-bold text-cyan-300 flex items-center space-x-1.5 mb-1.5">
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>1️⃣ Mon Vrai Microphone (Entrée audio) :</span>
              </label>
              <select
                value={selectedMicId}
                onChange={(e) => handleMicDeviceChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-medium"
              >
                {inputDevices.map((d) => {
                  const label = d.label || '';
                  const l = label.toLowerCase();
                  const isVirtual = l.includes('cable') || l.includes('vb-audio') || l.includes('voicemeeter') || l.includes('virtual') || l.includes('mixage');
                  return (
                    <option key={d.deviceId} value={d.deviceId}>
                      {isVirtual ? `⚠️ ${label} (Câble Virtuel)` : `🎙️ ${label || `Microphone (${d.deviceId.slice(0, 8)}...)`} (Recommandé)`}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Sélectionne ton vrai micro où tu parles (ex: WOODBRASS UM1, Logitech...).
              </p>
            </div>

            {/* 2. Broadcast Output */}
            <div>
              <label className="text-[11px] font-bold text-indigo-300 flex items-center space-x-1.5 mb-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                <span>2️⃣ Sortie Discord / En jeu (Câble Virtuel) :</span>
              </label>
              <select
                value={selectedBroadcastId}
                onChange={(e) => handleBroadcastDeviceChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400 font-medium"
              >
                <option value="default">-- Sélectionne un câble virtuel --</option>
                {outputDevices.map((d) => {
                  const label = d.label || '';
                  const isVirt = /cable|voicemod|steam|virtual/i.test(label);
                  return (
                    <option key={d.deviceId} value={d.deviceId}>
                      {isVirt ? `⭐ ${label} (Recommandé pour Discord)` : (label || `Périphérique (${d.deviceId.slice(0, 8)}...)`)}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Câble virtuel qui retransmet ta voix modifiée vers Discord ou tes jeux.
              </p>
            </div>
          </div>

          {/* Discord Instruction Guide */}
          <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50 text-[11px] text-slate-300 space-y-1">
            <div className="font-bold text-emerald-300 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Configuration Discord en 1 seconde :</span>
            </div>
            <p>
              Dans <strong>Discord &gt; Paramètres &gt; Voix &amp; Vidéo &gt; Périphérique d'entrée</strong> :<br />
              {selectedBroadcastId !== 'default' ? (
                <>Sélectionne 👉 <strong className="text-emerald-300 underline">{discordInputName}</strong> pour parler en direct avec les voix modifiées !</>
              ) : (
                <>Sélectionne un câble virtuel dans le menu n°2 ci-dessus (ex: <strong>Steam Streaming Microphone</strong> ou <strong>Voicemod</strong>) pour diffuser sans délai.</>
              )}
            </p>
          </div>
        </div>

        {/* Bottom Options & Controls */}
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Headphone Monitoring Panel */}
          <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Headphones className={`w-4 h-4 ${isMonitoring ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="text-xs font-semibold text-slate-200">
                  Retour Casque (S'entendre parler)
                </span>
              </div>
              <button
                onClick={() => handleToggleMonitoring(!isMonitoring)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  isMonitoring ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    isMonitoring ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Active le retour audio dans ton casque pour entendre et tester les effets en direct.
            </p>

            {isMonitoring && (
              <div className="flex items-center space-x-3 pt-1">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={monitoringVol}
                  onChange={handleMonitoringVolChange}
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-xs font-mono font-medium text-slate-300 w-10 text-right">
                  {Math.round(monitoringVol * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Hotkey & Activation Mode */}
          <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Keyboard className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">Raccourci Global</span>
              </div>

              <button
                onClick={() => setIsSettingHotkey(true)}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                  isSettingHotkey
                    ? 'bg-purple-600 border-purple-400 text-white animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-purple-300 hover:bg-slate-700'
                }`}
              >
                {isSettingHotkey ? 'Appuie sur une touche...' : currentHotkey}
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
              <span className="text-xs text-slate-300">Mode d'activation :</span>
              <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => handleTogglePushToTalk(false)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    !isPushToTalk ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bascule (Toggle)
                </button>
                <button
                  onClick={() => handleTogglePushToTalk(true)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    isPushToTalk ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Maintenir (PTT)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info branding */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>FreePad Voice Changer Pro v1.2.4 • Zéro Latence • DSP Constant-Power • Autotune &amp; Vocoder</span>
          <span className="text-indigo-400 font-medium">Fait par zioti</span>
        </div>
      </div>
    </div>
  );
}
