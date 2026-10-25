import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Mic,
  Volume2,
  Upload,
  Download,
  Sparkles,
  Radio,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  ShieldCheck,
  Headphones,
  Users,
  Check,
  Cpu,
  Play,
  Crown,
  Scissors,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import soundEngine from '../audio/SoundEngine';

export default function SettingsModal({
  isOpen,
  onClose,
  onImportSpl,
  onExportSpl,
  audioDevices,
  audioInputDevices,
  localOutput,
  setLocalOutput,
  broadcastOutput,
  setBroadcastOutput,
  selectedMicInput,
  setSelectedMicInput,
  isMicPassthrough,
  setIsMicPassthrough,
  realMicVol = 1.0,
  setRealMicVol,
  injectionMode = 'apo',
  setInjectionMode,
  loudnessBoost = 1.3,
  setLoudnessBoost
}) {
  const [micLevel, setMicLevel] = useState(0);
  const [apoStatus, setApoStatus] = useState({ checked: false, isAvailable: false, details: null });
  const [isInstalling, setIsInstalling] = useState(false);
  const [testToneActive, setTestToneActive] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(v => {
        if (v) setAppVersion(v);
      }).catch(() => {});
    }
  }, []);

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatusText('Recherche...');
    try {
      if (window.electronAPI?.checkForUpdates) {
        const res = await window.electronAPI.checkForUpdates();
        if (!res?.success) {
          setUpdateStatusText(res?.error ? 'Serveur inaccessible' : 'À jour');
        } else {
          setUpdateStatusText('Recherche effectuée');
        }
      }
    } catch (err) {
      setUpdateStatusText('Erreur');
    } finally {
      setTimeout(() => {
        setCheckingUpdate(false);
      }, 2500);
    }
  };

  // Poll mic level in real-time when modal is open
  useEffect(() => {
    if (!isOpen) return;
    let animId;
    const poll = () => {
      const lvl = soundEngine.getMicLevel();
      setMicLevel(lvl);
      animId = requestAnimationFrame(poll);
    };
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  // Check FreePad Native APO Driver Status
  useEffect(() => {
    if (!isOpen) return;
    const checkDriver = async () => {
      if (window.electronAPI && typeof window.electronAPI.checkApoStatus === 'function') {
        const res = await window.electronAPI.checkApoStatus();
        setApoStatus({ checked: true, isAvailable: !!res.isAvailable, details: res.details });
      }
    };
    checkDriver();
  }, [isOpen]);

  // Ensure microphone stream is active when SettingsModal opens
  useEffect(() => {
    if (!isOpen) return;

    const startMic = async () => {
      await soundEngine.init();
      if (soundEngine.ctx && soundEngine.ctx.state === 'suspended') {
        await soundEngine.ctx.resume();
      }
      if (!soundEngine.realMicStream || !soundEngine.realMicStream.active) {
        let targetMicId = selectedMicInput;
        if (!targetMicId || targetMicId === 'none') {
          const defaultMic = audioInputDevices.find(d => d.deviceId === 'default') || audioInputDevices[0];
          if (defaultMic) targetMicId = defaultMic.deviceId;
        }
        if (targetMicId && targetMicId !== 'none') {
          const micObj = audioInputDevices.find(d => d.deviceId === targetMicId);
          await soundEngine.toggleMicPassthrough(true, targetMicId, micObj?.label || '');
        }
      }
    };

    startMic().catch(e => console.warn("Settings mic activation:", e));
  }, [isOpen]);

  const handleInstallApo = async () => {
    setIsInstalling(true);
    setFeedbackMsg("Lancement de l'installateur Windows...");
    if (window.electronAPI && typeof window.electronAPI.installApoDriver === 'function') {
      const res = await window.electronAPI.installApoDriver();
      if (res && res.success) {
        setFeedbackMsg("Accepte la fenêtre de confirmation Windows (UAC) !");

        // Poll every 2.5s to see when installation completes
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const check = await window.electronAPI.checkApoStatus();
          if (check && check.isAvailable) {
            clearInterval(interval);
            setApoStatus({ checked: true, isAvailable: true, details: check.details });
            setIsInstalling(false);
            setFeedbackMsg("🎉 Pilote installé et opérationnel !");
            return;
          }

          if (attempts >= 15) {
            clearInterval(interval);
            setIsInstalling(false);
            const finalCheck = await window.electronAPI.checkApoStatus();
            setApoStatus({ checked: true, isAvailable: !!finalCheck.isAvailable, details: finalCheck.details });
            setFeedbackMsg(finalCheck.isAvailable ? "🎉 Pilote installé avec succès !" : "Installation terminée. Redémarrez FreePad si nécessaire.");
          }
        }, 2500);
      } else {
        setIsInstalling(false);
        setFeedbackMsg(res?.error || "Erreur au lancement de l'installateur");
      }
    } else {
      setIsInstalling(false);
    }
  };

  const handleTestTone = async () => {
    setTestToneActive(true);
    setFeedbackMsg("🔔 Bip sonore envoyé dans ton casque et ton appel !");
    await soundEngine.playTestTone();
    setTimeout(() => {
      setTestToneActive(false);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-indigo-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-white">Paramètres Audio & Micro</h3>
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-400/60 text-amber-300 text-[10px] font-black tracking-wider uppercase">
                  <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Fait par zioti</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">Pilote Micro Direct • Développé par zioti</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODE SELECTOR: PILOTE DIRECT (RECOMMANDÉ) vs VB-CABLE */}
        <div className="mb-4 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-1.5">
          <button
            onClick={() => setInjectionMode('direct')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              injectionMode === 'direct'
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-300" />
            <span>Mode Pilote Direct</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-emerald-200 border border-emerald-400/30 font-black">
              ⭐ ZÉRO ÉCHO
            </span>
          </button>
          <button
            onClick={() => setInjectionMode('virtual')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              injectionMode === 'virtual'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-300" />
            <span>Mode Câble Virtuel (VB-Cable)</span>
          </button>
        </div>

        {/* PRIMARY BANNER DEPENDING ON MODE */}
        {injectionMode === 'direct' ? (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-emerald-950/70 border border-emerald-500/40 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Injection Directe dans ton Vrai Micro
                    {apoStatus.isAvailable ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIF & CONNECTÉ
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        NON INSTALLÉ
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Les sons entrent <strong>directement</strong> dans ton microphone physique sans aucun câble virtuel ni boucle d'écho.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="flex items-center gap-1.5 font-semibold text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Dans Discord : choisis simplement ton <strong>vrai microphone habituel</strong>.</span>
              </p>
              <div className="text-[11px] bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-slate-300 space-y-1">
                <p className="font-bold text-cyan-300">💡 Réglages Discord recommandés :</p>
                <p>• <strong>Désactive Krisp</strong> (Voix & Vidéo → Suppression du bruit → Mets sur <u>Aucun</u>) pour que Discord ne coupe pas tes sons.</p>
                <p>• <strong>Désactive l'Annulation d'écho</strong> dans les paramètres vocaux de Discord.</p>
                <p>• Préfère l'<strong>application Discord officielle</strong> plutôt que le site web Chrome (qui bloque parfois les bruits de fond).</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={handleTestTone}
                disabled={testToneActive}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-slate-700"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>{testToneActive ? "Envoi du bip..." : "Tester le micro (Bip sonore)"}</span>
              </button>

              {!apoStatus.isAvailable ? (
                <button
                  onClick={handleInstallApo}
                  disabled={isInstalling}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isInstalling ? "Installation..." : "⚡ Installer le Pilote Micro (1 clic)"}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> Pilote opérationnel
                  </span>
                  <button
                    onClick={handleInstallApo}
                    disabled={isInstalling}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold transition-all border border-slate-700 active:scale-95"
                    title="Nettoyer les anciens filtres et réappliquer sur tes micros actifs"
                  >
                    {isInstalling ? "Réparation..." : "🔄 Réparer / Réinstaller"}
                  </button>
                </div>
              )}
            </div>

            {feedbackMsg && (
              <p className="mt-2 text-[11px] font-bold text-amber-300 animate-pulse text-center">
                {feedbackMsg}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-cyan-950/80 via-slate-900/90 to-indigo-950/70 border border-cyan-500/40 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Mode Câble Virtuel (VB-Audio)
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      ANTI-ÉCHO ACTIF
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Les sons sont envoyés dans <strong>CABLE Input</strong> pour être captés dans Discord via <strong>CABLE Output</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-cyan-500/30 text-xs text-slate-300 space-y-1.5">
              <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Configuration parfaite pour éviter toute répétition de son :
              </p>
              <ul className="text-[11px] space-y-1 text-slate-300 pl-1">
                <li>1️⃣ <strong>Sortie de diffusion :</strong> Mets <code>CABLE Input (VB-Audio Virtual Cable)</code> ci-dessous.</li>
                <li>2️⃣ <strong>Microphone Actif :</strong> Mets ton <u>vrai micro</u> (casque ou USB) pour qu'on t'entende parler.</li>
                <li>3️⃣ <strong>Dans Discord :</strong> Périphérique d'entrée = <code>CABLE Output</code>.</li>
              </ul>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-cyan-500/30">
              <button
                onClick={handleTestTone}
                disabled={testToneActive}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-cyan-500/40"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>{testToneActive ? "Envoi du bip..." : "Tester l'envoi vers Discord (Bip)"}</span>
              </button>
              <span className="text-[11px] text-cyan-300/80 font-mono">
                Joué dans ton casque + VB-Cable
              </span>
            </div>
          </div>
        )}

        {/* LOUDNESS PUNCH BOOST */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Puissance & Volume dans le micro :</span>
            </div>
            <p className="text-[10px] text-slate-400">Règle le gain envoyé dans l'appel pour que tes potes t'entendent fort</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setLoudnessBoost(1.0);
                soundEngine.setLoudnessBoost(1.0);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                loudnessBoost <= 1.0 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => {
                setLoudnessBoost(1.3);
                soundEngine.setLoudnessBoost(1.3);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                loudnessBoost === 1.3 ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fort (+3dB)
            </button>
            <button
              onClick={() => {
                setLoudnessBoost(1.6);
                soundEngine.setLoudnessBoost(1.6);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                loudnessBoost >= 1.6 ? 'bg-rose-500 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Puissant (+6dB)
            </button>
          </div>
        </div>

        {/* AUDIO DEVICES SETUP */}
        <div className="space-y-4">
          {/* MICROPHONE DETECT */}
          <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-cyan-400" />
                Microphone Actif Détecté
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await soundEngine.init();
                      if (soundEngine.ctx && soundEngine.ctx.state === 'suspended') {
                        await soundEngine.ctx.resume();
                      }
                      const isVirtual = (lbl) => {
                        const s = (lbl || '').toLowerCase();
                        return s.includes('cable') || s.includes('vb-audio') || s.includes('voicemeeter') || 
                               s.includes('virtual') || s.includes('stereo mix') || s.includes('mixage') ||
                               s.includes('voicemod');
                      };
                      const physicalMics = audioInputDevices.filter(d => !isVirtual(d.label) && d.deviceId !== 'default' && d.deviceId !== 'communications');
                      const fallbackMics = audioInputDevices.filter(d => !isVirtual(d.label));
                      const best = physicalMics[0] || fallbackMics[0] || audioInputDevices[0];
                      if (best) {
                        setSelectedMicInput(best.deviceId);
                        localStorage.setItem('freepad_selected_mic', best.deviceId);
                        await soundEngine.toggleMicPassthrough(true, best.deviceId, best.label, true);
                        setFeedbackMsg(`🎙️ Micro physique détecté : ${best.label}`);
                      }
                    } catch (e) {
                      console.warn("Auto-detect error:", e);
                    }
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold transition-all flex items-center gap-1 active:scale-95"
                  title="Sélectionne automatiquement ton vrai micro physique (USB / Casque) en éliminant les câbles virtuels muets"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>🎯 Détecter mon vrai micro</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await soundEngine.init();
                    if (soundEngine.ctx && soundEngine.ctx.state === 'suspended') {
                      await soundEngine.ctx.resume();
                    }
                    const micObj = audioInputDevices.find(d => d.deviceId === selectedMicInput);
                    await soundEngine.toggleMicPassthrough(true, selectedMicInput, micObj?.label || '', true);
                    setFeedbackMsg("Flux micro réveillé et reconnecté !");
                  }}
                  className="text-[10px] px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold transition-all flex items-center gap-1 active:scale-95"
                  title="Force la réinitialisation matérielle du flux audio Windows"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Réveiller le micro</span>
                </button>
              </div>
            </div>

            {(() => {
              const currentMic = audioInputDevices.find(d => d.deviceId === selectedMicInput);
              const isVirtual = currentMic && (
                currentMic.label.toLowerCase().includes('cable') ||
                currentMic.label.toLowerCase().includes('vb-audio') ||
                currentMic.label.toLowerCase().includes('voicemeeter') ||
                currentMic.label.toLowerCase().includes('virtual') ||
                currentMic.label.toLowerCase().includes('stereo mix') ||
                currentMic.label.toLowerCase().includes('mixage') ||
                currentMic.label.toLowerCase().includes('voicemod')
              );
              return isVirtual ? (
                <div className="mb-3 p-3 rounded-xl bg-rose-950/90 border border-rose-500 text-xs text-rose-200 flex items-start gap-2.5 shadow-lg shadow-rose-950/60 animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-100 text-xs">⚠️ ATTENTION : Périphérique virtuel sélectionné !</p>
                    <p className="text-[11px] text-rose-300 mt-0.5 leading-relaxed">
                      Tu as sélectionné <strong>"{currentMic.label}"</strong> comme micro d'entrée. Aucun son ne peut être capté depuis ce câble.
                    </p>
                    <p className="text-[11px] text-white font-semibold mt-1">
                      👉 Clique sur <strong>"🎯 Détecter mon vrai micro"</strong> ci-dessus pour basculer sur ton vrai micro USB ou casque !
                    </p>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="flex items-center justify-between text-[11px] mb-1.5 px-0.5">
              <span className="text-slate-400">Microphone sélectionné :</span>
              <span className="font-semibold text-cyan-300 truncate max-w-[320px]">
                {audioInputDevices.find(d => d.deviceId === selectedMicInput)?.label || 'Sélectionner un micro...'}
              </span>
            </div>

            <select
              value={selectedMicInput}
              onChange={(e) => {
                const devId = e.target.value;
                setSelectedMicInput(devId);
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors mb-3"
            >
              <option value="none">🔇 Aucun microphone (Ne pas diffuser ma voix - Sons uniquement)</option>
              {audioInputDevices.map((d) => {
                const lbl = (d.label || '').toLowerCase();
                const isVirt = lbl.includes('cable') || lbl.includes('vb-audio') || lbl.includes('virtual') || lbl.includes('stereo mix') || lbl.includes('mixage') || lbl.includes('voicemod');
                return (
                  <option key={d.deviceId} value={d.deviceId}>
                    {isVirt ? `⚠️ ${d.label || d.deviceId} (CÂBLE VIRTUEL - NE PAS SÉLECTIONNER)` : `🎙️ ${d.label || `Microphone (${d.deviceId.slice(0, 8)}...)`} (Recommandé)`}
                  </option>
                );
              })}
            </select>

            {/* LIVE VU-METER */}
            <div className="space-y-1.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${micLevel > 0.02 ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                  <span className="text-slate-300 font-medium">Test voix en direct :</span>
                </span>
                <span className={`font-mono text-[11px] font-bold ${micLevel > 0.02 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {micLevel > 0.02 ? `Signal Voix Détecté 🎤 (${Math.round(micLevel * 100)}%)` : "Silence (0%)"}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-500"
                  style={{ width: `${Math.min(100, Math.max(3, Math.round(micLevel * 100)))}%` }}
                />
              </div>
            </div>

            {/* Diagnostic Alert Helper */}
            <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
              <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Si la jauge reste sur Silence quand tu parles :</span>
              </p>
              <ul className="text-slate-400 pl-4 list-disc space-y-0.5 text-[10px]">
                <li>Clique sur le bouton vert <strong>"🎯 Détecter mon vrai micro"</strong> ci-dessus pour sélectionner ton micro physique USB ou casque.</li>
                <li>Vérifie que le bouton Mute physique sur ton micro n'est pas activé.</li>
                <li>Vérifie Windows : <strong>Paramètres &gt; Confidentialité &gt; Microphone</strong> &rarr; vérifie que <em>"Autoriser les applications de bureau à accéder à votre microphone"</em> est activé.</li>
              </ul>
            </div>

            {/* In Virtual Mode: Volume of user's voice into virtual cable */}
            {injectionMode === 'virtual' && selectedMicInput !== 'none' && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  Volume de ma voix dans Discord :
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={realMicVol}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (setRealMicVol) setRealMicVol(val);
                      soundEngine.setRealMicVolume(val);
                    }}
                    className="w-32 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className="font-mono text-cyan-400 font-bold w-10 text-right">
                    {Math.round(realMicVol * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* In Direct Mode: Explanation note */}
            {injectionMode === 'direct' && (
              <div className="mt-2.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Dans Discord, choisis directement ton vrai micro ci-dessus. Tes potes t'entendront naturellement !</span>
              </div>
            )}
          </div>

          {/* HEADPHONES OUTPUT */}
          <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400" />
                Mon Casque / Écouteurs (Retour Audio Personnel)
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                POUR TOI
              </span>
            </div>

            <select
              value={localOutput}
              onChange={(e) => {
                setLocalOutput(e.target.value);
                soundEngine.setOutputDevice('local', e.target.value);
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 transition-colors"
            >
              <option value="default">Casque par défaut (Windows)</option>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Casque (${d.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>
          </div>

          {/* BROADCAST / VIRTUAL CABLE OUTPUT */}
          <div className="bg-slate-900/50 p-3.5 rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-950/20">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                Sortie de Diffusion (Câble Virtuel VB-Cable / Envoi dans l'Appel)
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-bold">
                VERS DISCORD
              </span>
            </div>

            <select
              value={broadcastOutput}
              onChange={(e) => {
                setBroadcastOutput(e.target.value);
                soundEngine.setOutputDevice('broadcast', e.target.value);
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors mb-2"
            >
              <option value="default">Périphérique par défaut (Windows)</option>
              {audioDevices.map((d) => {
                const label = d.label || '';
                const isCable = label.toLowerCase().includes('cable input') || label.toLowerCase().includes('vb-audio');
                return (
                  <option key={d.deviceId} value={d.deviceId}>
                    {isCable ? `⭐ ${label} (RECOMMANDÉ POUR VB-CABLE)` : (label || `Périphérique (${d.deviceId.slice(0, 8)}...)`)}
                  </option>
                );
              })}
            </select>

            {/* Clear Visual Explainer for VB-Cable */}
            <div className="mt-2 p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Règle d'or pour VB-Audio Virtual Cable :</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 pl-1">
                <li>1️⃣ <strong>Dans FreePad (menu déroulant ci-dessus) :</strong> Choisis <code>CABLE Input (VB-Audio Virtual Cable)</code>.</li>
                <li>2️⃣ <strong>Dans Discord (Paramètres &gt; Voix &amp; Vidéo &gt; Périphérique d'entrée) :</strong> Choisis <code>CABLE Output (VB-Audio Virtual Cable)</code>.</li>
                <li>3️⃣ <strong>Microphone :</strong> Si ton pote n'a pas de vrai micro, choisis <em>"Aucun microphone (Soundboard uniquement)"</em> en haut.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* INSTANT REPLAY INFO */}
        <div className="bg-gradient-to-r from-rose-950/30 via-indigo-950/20 to-slate-900/40 p-3.5 rounded-xl border border-rose-500/30 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-0.5">
              <Scissors className="w-4 h-4 text-rose-400" />
              <span>Enregistreur Instantané Discord (Touche F8)</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Garde en mémoire les 30 dernières secondes de ce que tes potes disent dans l'appel. Dès qu'un pote bégaye ou sort une dinguerie, appuie sur F8 pour lui rebalancer direct !
            </p>
          </div>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 shrink-0">
            F8 (Global)
          </span>
        </div>

        {/* APP VERSION, BRANDING & UPDATER */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/icon.png" alt="FreePad" className="w-8 h-8 rounded-lg shadow-sm border border-cyan-500/30" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">FreePad</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-bold">
                  v{appVersion}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Fait par <strong className="text-cyan-400">zioti</strong> — Logiciel libre &amp; open-source
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {updateStatusText && (
              <span className="text-[10px] text-slate-400 italic">
                {updateStatusText}
              </span>
            )}
            <button
              onClick={handleCheckUpdates}
              disabled={checkingUpdate}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>Vérifier les mises à jour</span>
            </button>
          </div>
        </div>

        {/* BACKUP & IMPORT/EXPORT */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 cursor-pointer flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Importer .spl</span>
              <input
                type="file"
                accept=".spl"
                onChange={onImportSpl}
                className="hidden"
              />
            </label>

            <button
              onClick={onExportSpl}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter .spl</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            Enregistrer & Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
