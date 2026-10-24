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
  Power
} from 'lucide-react';
import voiceChangerEngine, { VOICE_PRESETS } from '../audio/VoiceChangerEngine';

export default function VoiceChangerModal({ isOpen, onClose }) {
  const [activePreset, setActivePreset] = useState(voiceChangerEngine.activePreset || 'none');
  const [isMonitoring, setIsMonitoring] = useState(voiceChangerEngine.isMonitoringEnabled);
  const [monitoringVol, setMonitoringVol] = useState(voiceChangerEngine.monitoringVolume);
  const [isPushToTalk, setIsPushToTalk] = useState(voiceChangerEngine.isPushToTalk);
  const [vuLevel, setVuLevel] = useState(0);
  const [currentHotkey, setCurrentHotkey] = useState('F6');
  const [isSettingHotkey, setIsSettingHotkey] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const animFrameRef = useRef(null);

  // Sync state on open
  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    // Auto-start microphone if not already active
    voiceChangerEngine.ensureMicStarted().then(ok => setMicActive(ok));

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
                  Voice Changer Pro
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  Zéro Latence
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Modulateur de voix en temps réel • <span className="text-indigo-400 font-medium">Fait par zioti</span>
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
        <div className="mt-4 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <Activity className={`w-4 h-4 ${vuLevel > 5 ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="text-xs font-medium text-slate-300">Signal Microphone :</span>
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
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

        {/* Bottom Options & Controls */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Headphone Monitoring Panel */}
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Headphones className={`w-4 h-4 ${isMonitoring ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="text-xs font-semibold text-slate-200">
                  Retour Casque (S'entendre parler)
                </span>
              </div>
              <button
                onClick={() => handleToggleMonitoring(!isMonitoring)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isMonitoring ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isMonitoring ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Active le retour audio direct dans ton casque pour entendre et tester les effets en direct.
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
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
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

        {/* Discord / In-Game Tip */}
        <div className="mt-4 p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-start space-x-2.5 text-xs text-indigo-200">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-indigo-300">Pour envoyer ta voix modifiée à tes potes sur Discord / Jeux :</strong>{' '}
            Assure-toi que FreePad est connecté à ton micro, ou sélectionne <em>CABLE Output (VB-Audio Virtual Cable)</em> comme microphone dans Discord.
          </p>
        </div>
      </div>
    </div>
  );
}
