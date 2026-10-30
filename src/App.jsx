import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  Settings,
  Sparkles,
  Volume2,
  FolderOpen,
  Music2,
  Upload,
  Radio,
  Flame,
  FileAudio,
  Languages,
  MessageSquare,
  Crown,
  Scissors,
  CheckCircle,
  AlertCircle,
  Headphones,
  Zap,
  Smartphone,
  SquarePlay,
  Mic,
  Download
} from 'lucide-react';
import soundEngine from './audio/SoundEngine';
import audioClipRecorder from './audio/AudioClipRecorder';
import AudioVisualizer from './components/AudioVisualizer';
import VolumeControls from './components/VolumeControls';
import SoundPadGrid from './components/SoundPadGrid';
import SoundListTable from './components/SoundListTable';
import HotkeyModal from './components/HotkeyModal';
import SettingsModal from './components/SettingsModal';
import MyInstantsTab from './components/MyInstantsTab';
import VoicemodTab from './components/VoicemodTab';
import GoogleTtsPanel from './components/GoogleTtsPanel';
import RemoteControlModal from './components/RemoteControlModal';
import MediaImportModal from './components/MediaImportModal';
import AudioTrimmerModal from './components/AudioTrimmerModal';
import UpdateModal from './components/UpdateModal';
import InstantRemixModal from './components/InstantRemixModal';
import instantRemixEngine from './audio/InstantRemixEngine';
import VoiceChangerModal from './components/VoiceChangerModal';
import voiceChangerEngine from './audio/VoiceChangerEngine';
import { parseSpl, exportToSpl, getRandomColor } from './utils/splParser';

const INITIAL_SOUNDS = [
  {
    id: 'sample-1',
    title: 'Ba Dum Tss',
    url: 'https://cdn.freesound.org/previews/171/171104_2394245-lq.mp3',
    duration: '0:03',
    hotkey: 'Num 1',
    category: 'Humour',
    addedOn: '2026-10-18',
    volumeMultiplier: 1.0,
  },
  {
    id: 'sample-2',
    title: 'Airhorn MLG',
    url: 'https://cdn.freesound.org/previews/274/274183_4939433-lq.mp3',
    duration: '0:02',
    hotkey: 'Num 2',
    category: 'Mèmes',
    addedOn: '2026-10-18',
    volumeMultiplier: 1.0,
  },
  {
    id: 'sample-3',
    title: 'Dramatic Cue',
    url: 'https://cdn.freesound.org/previews/320/320181_5260872-lq.mp3',
    duration: '0:04',
    hotkey: 'Num 3',
    category: 'Effets',
    addedOn: '2026-10-18',
    volumeMultiplier: 1.0,
  },
  {
    id: 'sample-4',
    title: 'Bruh Meme Sound',
    url: 'https://www.myinstants.com/media/sounds/movie_1.mp3',
    duration: '0:02',
    hotkey: 'Num 4',
    category: 'Mèmes',
    addedOn: '2026-10-18',
    volumeMultiplier: 1.0,
  }
];

export default function App() {
  const [sounds, setSounds] = useState(() => {
    const saved = localStorage.getItem('freepad_sounds');
    return saved ? JSON.parse(saved) : INITIAL_SOUNDS;
  });

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('freepad_categories');
    return saved ? JSON.parse(saved) : ['Tous les sons', 'Humour', 'Mèmes', 'Effets', 'Jeux', 'Anime', 'Mes sons'];
  });

  const [activeCategory, setActiveCategory] = useState('Tous les sons');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table' | 'myinstants'

  // Audio Playback state
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Audio Settings & Devices
  const [headphonesVol, setHeadphonesVol] = useState(0.8);
  const [micVol, setMicVol] = useState(1.0);
  const [isNormalized, setIsNormalized] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [localOutput, setLocalOutput] = useState(() => {
    return localStorage.getItem('freepad_local_output') || 'default';
  });
  const [broadcastOutput, setBroadcastOutput] = useState(() => {
    return localStorage.getItem('freepad_broadcast_output') || 'default';
  });
  const [selectedMicInput, setSelectedMicInput] = useState(() => {
    return localStorage.getItem('freepad_selected_mic') || '';
  });
  const [isMicPassthrough, setIsMicPassthrough] = useState(true);
  const [realMicVol, setRealMicVol] = useState(1.0);

  // Injection Mode: 'direct' (APO bridge directly into microphone) or 'virtual'
  const [injectionMode, setInjectionMode] = useState(() => {
    return localStorage.getItem('freepad_injection_mode') || 'direct';
  });
  // Loudness Boost: 1.0 (Normal), 1.4 (+3dB Fort), 2.0 (+6dB Puissant)
  const [loudnessBoost, setLoudnessBoost] = useState(() => {
    const saved = localStorage.getItem('freepad_loudness_boost');
    return saved ? parseFloat(saved) : 1.4;
  });

  // Instant Replay Discord / Rolling Buffer State
  const [isReplayListening, setIsReplayListening] = useState(false);
  const [clipDuration, setClipDuration] = useState(5); // 5s or 10s
  const [replaySource, setReplaySource] = useState('loopback'); // 'loopback' | 'mic'
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Direct APO Driver Status (Zero VB-Cable - Fait par zioti)
  const [isApoInstalled, setIsApoInstalled] = useState(true);
  const [isInstallingApo, setIsInstallingApo] = useState(false);
  const [apoBannerMsg, setApoBannerMsg] = useState('');
  const [showDiscordTip, setShowDiscordTip] = useState(() => !localStorage.getItem('freepad_hide_discord_tip'));

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Modals
  const [hotkeySound, setHotkeySound] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [trimmingSound, setTrimmingSound] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isRemixModalOpen, setIsRemixModalOpen] = useState(false);
  const [isVoiceChangerOpen, setIsVoiceChangerOpen] = useState(false);

  // Auto-updater listener
  useEffect(() => {
    if (!window.electronAPI) return;
    const unreg = window.electronAPI.onUpdateAvailable?.((info) => {
      setUpdateInfo(info);
      setUpdateModalOpen(true);
    });
    return () => {
      if (unreg) unreg();
    };
  }, []);

  // Voice Changer F6 Global Trigger
  useEffect(() => {
    if (!window.electronAPI) return;
    const unregVoice = window.electronAPI.onTriggerVoiceChanger?.(() => {
      voiceChangerEngine.handleHotkeyPress();
      const current = voiceChangerEngine.activePreset;
      if (current !== 'none') {
        const name = voiceChangerEngine.activePreset.toUpperCase();
        showToast(`🎙️ Voice Changer : ${name}`, 'info');
      } else {
        showToast('🎙️ Voice Changer désactivé', 'info');
      }
    });
    return () => {
      if (unregVoice) unregVoice();
    };
  }, []);

  // Instant Remix F7 Global Trigger
  useEffect(() => {
    if (!window.electronAPI) return;
    const unregRemix = window.electronAPI.onTriggerInstantRemix?.(() => {
      showToast("🔥 Remix en cours dans ton micro !", "info");
      instantRemixEngine.triggerRemix({ style: 'drill', captureSeconds: 2.5 }).then((res) => {
        if (!res?.success && res?.error) {
          showToast(`Erreur remix: ${res.error}`, "error");
        }
      });
    });
    return () => {
      if (unregRemix) unregRemix();
    };
  }, []);

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('freepad_sounds', JSON.stringify(sounds));
  }, [sounds]);

  useEffect(() => {
    localStorage.setItem('freepad_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    // 100% Direct Driver Mode (Zero VB-Cable - Fait par zioti)
    localStorage.setItem('freepad_injection_mode', 'direct');
    soundEngine.setSoundpadMode(true);
  }, []);

  // Monitor Direct APO Driver Status (Fait par zioti)
  useEffect(() => {
    let mounted = true;
    const checkApo = async () => {
      if (window.electronAPI && typeof window.electronAPI.checkApoStatus === 'function') {
        try {
          const res = await window.electronAPI.checkApoStatus();
          if (mounted && res) {
            setIsApoInstalled(!!res.isAvailable);
          }
        } catch (e) {
          console.warn("checkApoStatus error:", e);
        }
      }
    };
    checkApo();
    const interval = setInterval(checkApo, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleQuickInstallApo = async () => {
    setIsInstallingApo(true);
    setApoBannerMsg("⚡ Installation du pilote micro en cours... Accepte la fenêtre Windows (UAC) !");
    try {
      if (window.electronAPI && typeof window.electronAPI.installApoDriver === 'function') {
        const res = await window.electronAPI.installApoDriver();
        if (res && res.success) {
          setApoBannerMsg("🔄 Configuration du pilote sur tes micros...");
          setTimeout(async () => {
            const check = await window.electronAPI.checkApoStatus();
            if (check && check.isAvailable) {
              setIsApoInstalled(true);
              setApoBannerMsg("✅ Pilote micro activé ! Tes sons entrent direct dans Discord.");
              setTimeout(() => setApoBannerMsg(''), 5000);
            } else {
              setApoBannerMsg("⚠️ Si Windows a demandé confirmation, redémarre FreePad pour valider.");
            }
            setIsInstallingApo(false);
          }, 3500);
          return;
        }
      }
    } catch (e) {
      console.warn("installApo error:", e);
    }
    setIsInstallingApo(false);
  };

  // Ensure AudioContext is fully running on any user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (soundEngine && soundEngine.ctx && soundEngine.ctx.state === 'suspended') {
        soundEngine.ctx.resume().catch(() => {});
      }
      if (soundEngine && soundEngine.broadcastCtx && soundEngine.broadcastCtx.state === 'suspended') {
        soundEngine.broadcastCtx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('freepad_loudness_boost', loudnessBoost.toString());
    soundEngine.setLoudnessBoost(loudnessBoost);
  }, [loudnessBoost]);

  useEffect(() => {
    localStorage.setItem('freepad_local_output', localOutput);
    soundEngine.setOutputDevice('local', localOutput);
  }, [localOutput]);

  useEffect(() => {
    localStorage.setItem('freepad_broadcast_output', broadcastOutput);
    soundEngine.setOutputDevice('broadcast', broadcastOutput);
  }, [broadcastOutput]);

  useEffect(() => {
    if (!selectedMicInput) return;
    localStorage.setItem('freepad_selected_mic', selectedMicInput);
    const timer = setTimeout(() => {
      if (selectedMicInput === 'none') {
        soundEngine.toggleMicPassthrough(false);
      } else {
        const micObj = audioInputDevices.find(d => d.deviceId === selectedMicInput);
        soundEngine.toggleMicPassthrough(
          isMicPassthrough,
          selectedMicInput,
          micObj?.label || '',
          true
        );
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [selectedMicInput, isMicPassthrough, audioInputDevices]);

  // Request mic permission on start to reveal real hardware labels & bind physical mic
  // Fait par zioti
  useEffect(() => {
    const scanDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Request mic stream to unlock device labels in Chrome/Electron
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop()); // Stop immediately
        }
      } catch (err) {
        console.warn("Mic permission prompt:", err);
      }

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputs = devices.filter(d => d.kind === 'audiooutput');
          const inputs = devices.filter(d => d.kind === 'audioinput');

          setAudioDevices(outputs);
          setAudioInputDevices(inputs);

          // Helper: identify virtual loopback devices to prevent feedback loops and silent routing
          const isVirtualDevice = (lbl) => {
            const s = (lbl || '').toLowerCase();
            return s.includes('cable') || s.includes('vb-audio') || s.includes('voicemeeter') || 
                   s.includes('virtual') || s.includes('stereo mix') || s.includes('mixage') ||
                   s.includes('voicemod');
          };

          // Find Real Physical Microphone (e.g. Nor-Tec, USB, Realtek, Headset)
          const savedMic = localStorage.getItem('freepad_selected_mic');
          const currentMicObj = inputs.find(d => d.deviceId === savedMic);
          
          const physicalMics = inputs.filter(d => !isVirtualDevice(d.label) && d.deviceId !== 'default' && d.deviceId !== 'communications');
          const fallbackMics = inputs.filter(d => !isVirtualDevice(d.label));
          const bestRealMic = physicalMics[0] || fallbackMics[0] || inputs.find(d => d.deviceId !== 'default') || inputs[0] || null;

          const needsAutoSelect = !savedMic || 
                                  savedMic === 'default' || 
                                  !currentMicObj || 
                                  isVirtualDevice(currentMicObj.label);

          if (needsAutoSelect && bestRealMic) {
            console.log("[FreePad v1.3.3] Auto-selected physical microphone:", bestRealMic.label);
            setSelectedMicInput(bestRealMic.deviceId);
            localStorage.setItem('freepad_selected_mic', bestRealMic.deviceId);
            soundEngine.toggleMicPassthrough(isMicPassthrough, bestRealMic.deviceId, bestRealMic.label, true);
          } else if (currentMicObj) {
            soundEngine.toggleMicPassthrough(isMicPassthrough, currentMicObj.deviceId, currentMicObj.label, false);
          }

          // Find dedicated Virtual Audio Cable (VB-Cable, FreePad)
          const savedBroadcast = localStorage.getItem('freepad_broadcast_output');
          if (!savedBroadcast || savedBroadcast === 'default') {
            const virtualOut = outputs.find(d => {
              const l = (d.label || '').toLowerCase();
              return (l.includes('cable') || l.includes('vb-audio') || l.includes('freepad') || l.includes('voicemod') || l.includes('virtual')) && !l.includes('steam');
            });
            if (virtualOut) {
              setBroadcastOutput(virtualOut.deviceId);
              soundEngine.setOutputDevice('broadcast', virtualOut.deviceId);
            }
          }
        } catch (e) {
          console.warn("Device enumeration:", e);
        }
      }
    };

    scanDevices();
  }, []);

  // Configure SoundEngine callbacks
  useEffect(() => {
    soundEngine.onTimeUpdate = (curr, dur) => {
      setCurrentTime(curr);
      setDuration(dur);
    };

    soundEngine.onStateChange = () => {
      setIsPlaying(soundEngine.isPlaying);
      setIsPaused(soundEngine.isPaused);
      setCurrentPlayingId(soundEngine.currentSoundId);
    };

    soundEngine.onEnded = (soundId) => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentPlayingId(null);
      setCurrentTime(0);
    };

    return () => {
      soundEngine.onTimeUpdate = null;
      soundEngine.onStateChange = null;
      soundEngine.onEnded = null;
    };
  }, []);

  // Sync audioClipRecorder status and check native WASAPI loopback status
  useEffect(() => {
    audioClipRecorder.onStatusChange = (status) => {
      setIsReplayListening(status === 'listening');
    };
    audioClipRecorder.checkNativeStatus().then((active) => {
      if (active) setIsReplayListening(true);
      else {
        audioClipRecorder.startListening('loopback').then(() => {
          setIsReplayListening(true);
        }).catch(() => {});
      }
    });
    return () => {
      audioClipRecorder.onStatusChange = null;
    };
  }, []);

  const handleToggleReplayListening = async () => {
    try {
      if (audioClipRecorder.isListening()) {
        audioClipRecorder.stopListening();
        setIsReplayListening(false);
        showToast("Écoute Discord en pause.", "info");
      } else {
        showToast("Initialisation de l'écoute loopback...", "info");
        await audioClipRecorder.startListening(replaySource, replaySource === 'mic' ? selectedMicInput : null);
        setIsReplayListening(true);
        showToast("🟢 Écoute Discord active (30s en mémoire) ! Appuie sur F8 pour clipper.", "success");
      }
    } catch (err) {
      setIsReplayListening(false);
      showToast("Erreur écoute audio : " + (err.message || err), "error");
    }
  };

  const handleInstantClip = async (seconds = 5) => {
    try {
      if (!audioClipRecorder.isListening()) {
        showToast("Démarrage de l'écoute Discord... Laisse ton pote parler et ré-appuie sur F8 !", "info");
        await audioClipRecorder.startListening(replaySource, replaySource === 'mic' ? selectedMicInput : null);
        setIsReplayListening(true);
        return;
      }

      showToast(`✂️ Découpage des ${seconds} dernières secondes...`, "info");
      const newClip = await audioClipRecorder.clipLastSeconds(seconds);

      // Add clip to sounds list
      setSounds((prev) => [newClip, ...prev]);

      // Make sure category "Mes Clips" exists and switch to it
      setCategories((prev) => {
        if (!prev.includes('Mes Clips')) {
          return ['Tous les sons', 'Mes Clips', ...prev.filter(c => c !== 'Tous les sons')];
        }
        return prev;
      });
      setActiveCategory('Mes Clips');

      showToast(`🎉 Clip de ${seconds}s enregistré ! Rejoue-le avec ton micro ou télécharge-le avec l'icône 📥 !`, "success");
    } catch (err) {
      console.warn("Clip error:", err);
      showToast(err.message || "Erreur lors du découpage du clip.", "error");
    }
  };

  const handleExportSound = async (sound) => {
    if (!sound) return;
    try {
      if (window.electronAPI && typeof window.electronAPI.exportAudioFile === 'function') {
        const res = await window.electronAPI.exportAudioFile({
          filePath: sound.filePath,
          dataUrl: sound.url,
          title: sound.title || 'clip_freepad',
          ext: sound.filePath ? sound.filePath.split('.').pop() : 'wav'
        });

        if (res && res.canceled) return;

        if (res && res.success) {
          showToast(`🎉 Clip "${res.fileName || sound.title}" téléchargé sur ton PC !`, "success");
        } else {
          showToast(res?.error || "Erreur lors du téléchargement du fichier", "error");
        }
        return;
      }

      // Web / Browser fallback
      if (sound.url) {
        const a = document.createElement('a');
        a.href = sound.url;
        const cleanName = (sound.title || 'clip_freepad').replace(/[/\\?%*:|"<>]/g, '_');
        a.download = cleanName.endsWith('.wav') || cleanName.endsWith('.mp3') ? cleanName : `${cleanName}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`🎉 "${sound.title}" téléchargé !`, "success");
      }
    } catch (err) {
      console.warn("handleExportSound error:", err);
      showToast("Erreur lors du téléchargement : " + err.message, "error");
    }
  };

  // IPC listener for system-wide F8 global hotkey
  useEffect(() => {
    if (window.electronAPI?.onTriggerInstantReplay) {
      const cleanup = window.electronAPI.onTriggerInstantReplay(({ duration }) => {
        handleInstantClip(duration || clipDuration);
      });
      return cleanup;
    }
  }, [clipDuration, replaySource, selectedMicInput]);

  // Sync sounds & categories with Stream Deck Mobile remote server
  useEffect(() => {
    if (window.electronAPI?.syncRemoteSounds) {
      window.electronAPI.syncRemoteSounds({ sounds, categories });
    }
  }, [sounds, categories]);

  // Broadcast playback state to Stream Deck Mobile
  useEffect(() => {
    if (window.electronAPI?.broadcastRemoteState) {
      window.electronAPI.broadcastRemoteState({
        isPlaying,
        soundId: currentPlayingId,
        volume: headphonesVol
      });
    }
  }, [isPlaying, currentPlayingId, headphonesVol]);

  // Listen for actions sent from smartphone (Stream Deck Mobile)
  useEffect(() => {
    if (window.electronAPI?.onRemotePlaySound) {
      const cleanupPlay = window.electronAPI.onRemotePlaySound((soundId) => {
        const sound = sounds.find((s) => s.id === soundId);
        if (sound) {
          soundEngine.play(sound);
          showToast(`📱 Lancé depuis ton téléphone : "${sound.title}"`, 'info');
        }
      });
      const cleanupStop = window.electronAPI.onRemoteStopSound(() => {
        soundEngine.stop();
        showToast('📱 Arrêté depuis ton téléphone', 'info');
      });
      return () => {
        cleanupPlay();
        cleanupStop();
      };
    }
  }, [sounds]);

  // Global Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return; // Prevent key repeat from immediately stopping playback
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        soundEngine.stop();
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        handleInstantClip(clipDuration);
        return;
      }

      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Win');

      let keyName = e.key.toUpperCase();
      if (e.code.startsWith('Numpad')) {
        keyName = `Num ${e.code.replace('Numpad', '')}`;
      } else if (e.code.startsWith('Digit')) {
        keyName = e.code.replace('Digit', '');
      } else if (e.code.startsWith('Key')) {
        keyName = e.code.replace('Key', '');
      } else if (e.key === ' ') {
        keyName = 'Espace';
      }

      parts.push(keyName);
      const pressedCombo = parts.join(' + ');

      const matchedSound = sounds.find((s) => s.hotkey && s.hotkey.toLowerCase() === pressedCombo.toLowerCase());
      if (matchedSound) {
        e.preventDefault();
        if (currentPlayingId === matchedSound.id && isPlaying) {
          soundEngine.stop();
        } else {
          soundEngine.play(matchedSound);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sounds, currentPlayingId, isPlaying]);

  const filteredSounds = sounds.filter((s) => {
    const matchesCategory = activeCategory === 'Tous les sons' || s.category === activeCategory;
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.hotkey && s.hotkey.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const currentSound = sounds.find((s) => s.id === currentPlayingId);

  const handlePlaySound = async (sound) => {
    const ok = await soundEngine.play(sound);
    if (!ok) {
      alert(`Impossible de lire le son "${sound.title}". Le lien ou fichier audio n'est pas accessible.`);
    }
  };

  const handlePlayPause = async () => {
    if (!currentSound) return;
    if (isPlaying) {
      soundEngine.pause();
    } else if (isPaused) {
      soundEngine.resume(currentSound);
    } else {
      const ok = await soundEngine.play(currentSound);
      if (!ok) {
        alert(`Impossible de lire le son "${currentSound.title}".`);
      }
    }
  };

  const handleStop = () => soundEngine.stop();

  const handleAddFiles = (files) => {
    const newSounds = [];
    Array.from(files).forEach((file, i) => {
      const url = URL.createObjectURL(file);
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      newSounds.push({
        id: `sound-${Date.now()}-${i}`,
        title: fileName,
        artist: '',
        url: url,
        filePath: file.path || '',
        duration: '...',
        hotkey: '',
        category: activeCategory === 'Tous les sons' ? 'Mes sons' : activeCategory,
        addedOn: new Date().toISOString().split('T')[0],
        volumeMultiplier: 1.0,
      });

      const tempAudio = new Audio(url);
      tempAudio.addEventListener('loadedmetadata', () => {
        const m = Math.floor(tempAudio.duration / 60);
        const s = Math.floor(tempAudio.duration % 60);
        const formatted = `${m}:${s < 10 ? '0' : ''}${s}`;
        setSounds((prev) =>
          prev.map((snd) => (snd.url === url ? { ...snd, duration: formatted } : snd))
        );
      });
    });

    setSounds((prev) => [...prev, ...newSounds]);
  };

  const handleImportFromMyInstants = (instantSound) => {
    setSounds((prev) => [instantSound, ...prev]);
    if (!categories.includes(instantSound.category)) {
      setCategories((prev) => [...prev, instantSound.category]);
    }
  };

  const handleAddTtsSound = (ttsSound) => {
    setSounds((prev) => [ttsSound, ...prev]);
    if (!categories.includes(ttsSound.category)) {
      setCategories((prev) => [...prev, ttsSound.category]);
    }
  };

  const handleImportMediaSound = (newSound) => {
    setSounds((prev) => [newSound, ...prev]);
    if (!categories.includes(newSound.category)) {
      setCategories((prev) => [...prev, newSound.category]);
    }
    setActiveCategory(newSound.category);
    showToast(`🎉 "${newSound.title}" importé et ajouté à ta grille !`, "success");
  };

  const handleSaveTrimmedSound = (newSound, replaceOriginalId) => {
    if (replaceOriginalId) {
      setSounds((prev) => prev.map((s) => (s.id === replaceOriginalId ? newSound : s)));
      showToast(`✂️ Son "${newSound.title}" mis à jour avec le découpage !`, "success");
    } else {
      setSounds((prev) => [newSound, ...prev]);
      if (!categories.includes(newSound.category)) {
        setCategories((prev) => [...prev, newSound.category]);
      }
      setActiveCategory(newSound.category);
      showToast(`✂️ Nouveau son découpé "${newSound.title}" ajouté !`, "success");
    }
  };

  const handleImportSpl = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xml = event.target.result;
        const parsed = parseSpl(xml);
        setSounds((prev) => [...prev, ...parsed.sounds]);
        setCategories((prev) => Array.from(new Set([...prev, ...parsed.categories])));
        alert(`Succès : ${parsed.sounds.length} sons importés depuis la liste Soundpad !`);
      } catch (err) {
        alert("Erreur lors de la lecture du fichier .spl : " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleExportSpl = () => {
    try {
      const xml = exportToSpl(sounds, categories);
      const blob = new Blob([xml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `freepad_soundlist_${new Date().toISOString().split('T')[0]}.spl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erreur lors de l'exportation : " + err.message);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) handleAddFiles(e.dataTransfer.files);
      }}
      className="flex flex-col h-screen max-h-screen bg-slate-950 text-slate-100 overflow-hidden relative"
    >
      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center pointer-events-none animate-in fade-in">
          <Upload className="w-16 h-16 text-cyan-400 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold text-white mb-1">Déposez vos fichiers audio ici</h2>
          <p className="text-sm text-cyan-200">MP3, WAV, OGG, M4A, FLAC acceptés</p>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="px-6 py-3.5 glass-panel border-b border-indigo-500/20 flex items-center justify-between gap-4 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 p-0.5">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
                FreePad
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                PRO
              </span>

              {/* FAIT PAR ZIOTI - TRES TRES VISIBLE */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/30 via-rose-500/30 to-purple-500/30 border-2 border-amber-400 text-amber-300 shadow-xl shadow-amber-500/30 ring-1 ring-amber-400/50">
                <Crown className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                <span className="text-xs font-black tracking-widest uppercase bg-gradient-to-r from-amber-300 via-yellow-100 to-rose-300 bg-clip-text text-transparent drop-shadow">
                  Fait par zioti
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Soundboard ultra-rapide & injection vocale</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Fait par zioti
              </span>
            </p>
          </div>
        </div>

        {/* Center Live Visualizer */}
        <div className="hidden md:block flex-1 max-w-md mx-4">
          <AudioVisualizer isPlaying={isPlaying} />
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Google TTS Voice Tab Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'tts' ? 'grid' : 'tts')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              viewMode === 'tts'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-emerald-500/30 ring-2 ring-cyan-400/50'
                : 'bg-slate-900 border border-slate-800 text-emerald-300 hover:border-emerald-500/50'
            }`}
          >
            <Languages className="w-4 h-4 text-emerald-400" />
            <span>Voix Google (TTS)</span>
          </button>

          {/* MyInstants Tab Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'myinstants' ? 'grid' : 'myinstants')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              viewMode === 'myinstants'
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-rose-500/30 ring-2 ring-amber-400/50'
                : 'bg-slate-900 border border-slate-800 text-amber-300 hover:border-amber-500/50'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span>MyInstants</span>
          </button>

          {/* Voicemod Tab Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'voicemod' ? 'grid' : 'voicemod')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              viewMode === 'voicemod'
                ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-violet-500/30 ring-2 ring-cyan-400/50'
                : 'bg-slate-900 border border-slate-800 text-violet-300 hover:border-violet-500/50'
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Voicemod</span>
          </button>

          {/* Stream Deck Mobile Remote Button */}
          <button
            onClick={() => setIsRemoteModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-indigo-500/25 active:scale-95 border border-indigo-400/30"
            title="Contrôler FreePad depuis son smartphone (Stream Deck tactile sans fil)"
          >
            <Smartphone className="w-4 h-4 text-cyan-200 animate-pulse" />
            <span className="hidden sm:inline">Stream Deck</span>
            <span>Mobile</span>
          </button>

          {/* YouTube / TikTok Direct Importer */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white shadow-rose-500/25 active:scale-95 border border-rose-400/30"
            title="Importer directement un audio depuis YouTube, TikTok, Shorts, Twitter/X, MP4 avec découpage (Zéro pub)"
          >
            <SquarePlay className="w-4 h-4 text-amber-200" />
            <span className="hidden sm:inline">Importer</span>
            <span>YouTube/TikTok</span>
          </button>

          {/* Instant Remix (F7) */}
          <button
            onClick={() => setIsRemixModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white shadow-orange-500/25 active:scale-95 border border-orange-400/40"
            title="Instant Remix (Touche F7) — Capture la voix de ton pote et transforme-la en rap !"
          >
            <Flame className="w-4 h-4 text-yellow-200 animate-pulse fill-current" />
            <span className="hidden md:inline">Instant</span>
            <span>Remix (F7)</span>
          </button>

          {/* Voice Changer Pro (F6) */}
          <button
            onClick={() => setIsVoiceChangerOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white shadow-purple-500/25 active:scale-95 border border-purple-400/40"
            title="Voice Changer Pro (Touche F6) — Modulateur de voix en temps réel zéro latence !"
          >
            <Mic className="w-4 h-4 text-cyan-200 animate-pulse" />
            <span className="hidden md:inline">Voice</span>
            <span>Changer (F6)</span>
          </button>

          {/* Add Local Sounds */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Ajouter des sons</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.spl"
            onChange={(e) => {
              if (e.target.files) handleAddFiles(e.target.files);
            }}
            className="hidden"
          />

          {/* View Switcher */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mode Grille (Stream Deck / Pads)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mode Liste (Soundpad classique)"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Paramètres d'injection micro & Sorties"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* PROMINENT DIRECT DRIVER BANNER (ZERO VB-CABLE - FAIT PAR ZIOTI) */}
      {!isApoInstalled && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-6 py-2 flex items-center justify-between gap-3 shadow-lg border-b border-amber-400/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-black/20 border border-white/20">
              <Zap className="w-4 h-4 text-amber-200 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-2">
                <span>Active l'injection directe dans ton vrai micro !</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono text-amber-100 font-bold">100% Sans Câble</span>
              </p>
              <p className="text-[11px] text-amber-100">
                Requis pour que tes sons et ton modificateur de voix aillent dans Discord. Fait par <strong className="text-white">zioti</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={handleQuickInstallApo}
            disabled={isInstallingApo}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 text-xs font-black shadow flex items-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isInstallingApo ? "Activation..." : "⚡ Activer mon micro (1 clic)"}</span>
          </button>
        </div>
      )}
      {apoBannerMsg && (
        <div className="bg-emerald-950/90 text-emerald-200 border-b border-emerald-500/40 px-6 py-1.5 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{apoBannerMsg}</span>
        </div>
      )}

      {/* DISCORD AUDIO SETTINGS GUIDANCE BANNER */}
      {showDiscordTip && (
        <div className="bg-amber-950/80 text-amber-200 border-b border-amber-500/30 px-4 py-1.5 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-bold text-amber-300 shrink-0">⚠️ Réglage Discord Indispensable :</span>
            <span className="text-amber-100/90 text-[11px] truncate">
              Dans Discord &gt; Voix &amp; Vidéo &gt; Désactiver <strong>'Suppression du bruit (Krisp)'</strong> (mettre sur <u>Aucun</u>) et désactiver <strong>'Annulation de l'écho'</strong> pour que Discord ne filtre pas les sons du soundboard !
            </span>
          </div>
          <button 
            onClick={() => {
              setShowDiscordTip(false);
              localStorage.setItem('freepad_hide_discord_tip', 'true');
            }}
            className="text-amber-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-amber-900/50 shrink-0 cursor-pointer font-bold"
            title="Masquer le conseil"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="absolute top-20 right-6 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div className={`px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md border flex items-center gap-2.5 text-xs font-bold ${
            toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-400/50 text-emerald-200 shadow-emerald-500/20'
              : toast.type === 'error'
              ? 'bg-rose-950/95 border-rose-400/50 text-rose-200 shadow-rose-500/20'
              : 'bg-indigo-950/95 border-cyan-400/50 text-cyan-200 shadow-indigo-500/20'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 animate-spin" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ENREGISTREUR INSTANTANÉ DISCORD (INSTANT REPLAY BUFFER 30S) */}
      <div className="px-6 py-2 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border-b border-indigo-500/20 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner">
            <span className="relative flex h-2.5 w-2.5">
              {isReplayListening && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isReplayListening ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-600'}`}></span>
            </span>
            <span className="text-xs font-semibold">
              {isReplayListening ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  Écoute Discord active <span className="text-[10px] text-emerald-400/80 font-mono hidden sm:inline">(Mémoire 30s)</span>
                </span>
              ) : (
                <span className="text-slate-400">Écoute Discord prête</span>
              )}
            </span>
          </div>

          {/* Toggle Listen Button */}
          <button
            onClick={handleToggleReplayListening}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
              isReplayListening
                ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>{isReplayListening ? 'Désactiver' : 'Activer l\'écoute'}</span>
          </button>
        </div>

        {/* Center: The Big Instant Clip Trigger */}
        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs font-bold">
            <button
              onClick={() => setClipDuration(5)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                clipDuration === 5 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              5s
            </button>
            <button
              onClick={() => setClipDuration(10)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                clipDuration === 10 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              10s
            </button>
          </div>

          <button
            onClick={() => handleInstantClip(clipDuration)}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-black tracking-wide uppercase shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95 border border-rose-400/40 group ring-2 ring-rose-500/20"
            title="Enregistre les dernières secondes de ce que ton pote vient de dire et crée direct un son à lui renvoyer !"
          >
            <Scissors className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
            <span>Clipper les {clipDuration}s</span>
            <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/20 text-[10px] font-mono font-bold text-amber-200">
              F8
            </span>
          </button>
        </div>

        {/* Right side: Source selector */}
        <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
          <span className="hidden md:inline">Source :</span>
          <select
            value={replaySource}
            onChange={(e) => {
              const newSrc = e.target.value;
              setReplaySource(newSrc);
              if (isReplayListening) {
                audioClipRecorder.stopListening();
                audioClipRecorder.startListening(newSrc, newSrc === 'mic' ? selectedMicInput : null)
                  .then(() => setIsReplayListening(true))
                  .catch(() => setIsReplayListening(false));
              }
            }}
            className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="loopback">🔊 Casque / Discord (Loopback)</option>
            <option value="mic">🎙️ Mon Micro</option>
          </select>

          <button
            onClick={async () => {
              if (window.electronAPI?.openClipsFolder) {
                await window.electronAPI.openClipsFolder();
                showToast("📂 Dossier des clips ouvert dans l'Explorateur Windows !", "info");
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            title="Ouvrir le dossier où tous tes clips sont enregistrés sur ton PC"
          >
            <FolderOpen className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline">Dossier des clips</span>
          </button>
        </div>
      </div>

      {/* FILTER & CATEGORY BAR (when viewing sounds grid or table) */}
      {(viewMode === 'grid' || viewMode === 'table') && (
        <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {categories.map((cat) => {
              const count = cat === 'Tous les sons' ? sounds.length : sounds.filter(s => s.category === cat).length;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {/* Fait par zioti pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/15 border border-amber-400/50 text-amber-300 text-[11px] font-black uppercase tracking-wider shadow-sm shrink-0">
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Fait par zioti</span>
            </div>

            <div className="relative w-48 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un son ou touche..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 overflow-y-auto">
        {(viewMode === 'grid' || viewMode === 'table') && activeCategory === 'Mes Clips' && (
          <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-slate-900 border border-rose-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Scissors className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Mes Clips Discord &amp; Instant Replay</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    {filteredSounds.length} clip{filteredSounds.length > 1 ? 's' : ''}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Rejoue tes clips en direct dans ton micro avec Discord ou télécharge-les sur ton PC avec le bouton 📥 Télécharger.
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                if (window.electronAPI?.openClipsFolder) {
                  await window.electronAPI.openClipsFolder();
                  showToast("📂 Dossier des clips ouvert dans l'Explorateur Windows !", "info");
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-rose-500/40 hover:border-rose-400 text-rose-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm shrink-0"
            >
              <FolderOpen className="w-4 h-4 text-rose-400" />
              <span>Ouvrir le dossier sur mon PC</span>
            </button>
          </div>
        )}

        {viewMode === 'myinstants' ? (
          <MyInstantsTab
            onImportSound={handleImportFromMyInstants}
            existingSoundUrls={sounds.map(s => s.url)}
          />
        ) : viewMode === 'voicemod' ? (
          <VoicemodTab
            onImportSound={handleImportFromMyInstants}
            existingSoundUrls={sounds.map(s => s.url)}
          />
        ) : viewMode === 'tts' ? (
          <GoogleTtsPanel
            onAddToSoundboard={handleAddTtsSound}
          />
        ) : viewMode === 'grid' ? (
          <SoundPadGrid
            sounds={filteredSounds}
            currentPlayingId={currentPlayingId}
            isPlaying={isPlaying}
            onPlay={handlePlaySound}
            onStop={handleStop}
            onEditHotkey={(sound) => setHotkeySound(sound)}
            onDeleteSound={(id) => setSounds((prev) => prev.filter((s) => s.id !== id))}
            onTrimSound={(sound) => setTrimmingSound(sound)}
            onExportSound={handleExportSound}
            onAddSoundClick={() => fileInputRef.current?.click()}
          />
        ) : (
          <SoundListTable
            sounds={filteredSounds}
            currentPlayingId={currentPlayingId}
            isPlaying={isPlaying}
            onPlay={handlePlaySound}
            onStop={handleStop}
            onEditHotkey={(sound) => setHotkeySound(sound)}
            onDeleteSound={(id) => setSounds((prev) => prev.filter((s) => s.id !== id))}
            onTrimSound={(sound) => setTrimmingSound(sound)}
            onExportSound={handleExportSound}
          />
        )}
      </main>

      {/* BOTTOM PERSISTENT CONTROL BAR */}
      <footer className="p-4 bg-slate-950/90 border-t border-indigo-500/20 z-20 shrink-0">
        <VolumeControls
          headphonesVol={headphonesVol}
          setHeadphonesVol={setHeadphonesVol}
          micVol={micVol}
          setMicVol={setMicVol}
          isNormalized={isNormalized}
          setIsNormalized={setIsNormalized}
          isLooping={isLooping}
          setIsLooping={setIsLooping}
          isPlaying={isPlaying}
          isPaused={isPaused}
          currentSound={currentSound}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          currentTime={currentTime}
          duration={duration}
        />
      </footer>

      {/* MODALS */}
      <HotkeyModal
        sound={hotkeySound}
        isOpen={!!hotkeySound}
        onClose={() => setHotkeySound(null)}
        onSave={(soundId, hotkey) => {
          setSounds((prev) =>
            prev.map((s) => (s.id === soundId ? { ...s, hotkey } : s))
          );
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onImportSpl={handleImportSpl}
        onExportSpl={handleExportSpl}
        audioDevices={audioDevices}
        audioInputDevices={audioInputDevices}
        localOutput={localOutput}
        setLocalOutput={setLocalOutput}
        broadcastOutput={broadcastOutput}
        setBroadcastOutput={setBroadcastOutput}
        selectedMicInput={selectedMicInput}
        setSelectedMicInput={setSelectedMicInput}
        isMicPassthrough={isMicPassthrough}
        setIsMicPassthrough={setIsMicPassthrough}
        realMicVol={realMicVol}
        setRealMicVol={setRealMicVol}
        injectionMode={injectionMode}
        setInjectionMode={setInjectionMode}
        loudnessBoost={loudnessBoost}
        setLoudnessBoost={setLoudnessBoost}
      />

      <RemoteControlModal
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
      />

      <MediaImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportMediaSound}
        categories={categories}
      />

      <AudioTrimmerModal
        sound={trimmingSound}
        isOpen={!!trimmingSound}
        onClose={() => setTrimmingSound(null)}
        onSave={handleSaveTrimmedSound}
      />

      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={updateInfo}
      />

      <InstantRemixModal
        isOpen={isRemixModalOpen}
        onClose={() => setIsRemixModalOpen(false)}
        onAddSound={(newSound) => {
          setSounds((prev) => [newSound, ...prev]);
          showToast(`Remix ajouté à ta bibliothèque : ${newSound.title}`, 'success');
        }}
      />

      <VoiceChangerModal
        isOpen={isVoiceChangerOpen}
        onClose={() => setIsVoiceChangerOpen(false)}
        audioInputDevices={audioInputDevices}
        selectedMicInput={selectedMicInput}
        setSelectedMicInput={setSelectedMicInput}
        broadcastOutput={broadcastOutput}
        setBroadcastOutput={setBroadcastOutput}
      />
    </div>
  );
}
