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
  Languages,
  Crown,
  Scissors,
  CheckCircle,
  AlertCircle,
  Headphones,
  Zap,
  Smartphone,
  SquarePlay,
  Download
} from 'lucide-react';
import soundEngine from './audio/SoundEngine';
import audioClipRecorder from './audio/AudioClipRecorder';
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
import { parseSpl, exportToSpl } from './utils/splParser';

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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table' | 'myinstants' | 'voicemod' | 'tts'

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

  // Injection Mode: 'direct' (APO bridge directly into microphone)
  const [injectionMode, setInjectionMode] = useState(() => {
    return localStorage.getItem('freepad_injection_mode') || 'direct';
  });
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

  // Instant Remix F7 Global Trigger
  useEffect(() => {
    if (!window.electronAPI) return;
    const unregRemix = window.electronAPI.onTriggerInstantRemix?.(() => {
      showToast("Remix en cours dans ton micro !", "info");
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
    setApoBannerMsg("Installation du pilote micro en cours... Accepte la fenêtre Windows (UAC) !");
    try {
      if (window.electronAPI && typeof window.electronAPI.installApoDriver === 'function') {
        const res = await window.electronAPI.installApoDriver();
        if (res && res.success) {
          setApoBannerMsg("Configuration du pilote sur vos microphones...");
          setTimeout(async () => {
            const check = await window.electronAPI.checkApoStatus();
            if (check && check.isAvailable) {
              setIsApoInstalled(true);
              setApoBannerMsg("Pilote micro activé ! Vos sons entrent directement dans Discord.");
              setTimeout(() => setApoBannerMsg(''), 5000);
            } else {
              setApoBannerMsg("Si Windows a demandé confirmation, redémarrez FreePad pour valider.");
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

  // Ensure AudioContext is running on user interaction
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
  useEffect(() => {
    const scanDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
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

          const isVirtualDevice = (lbl) => {
            const s = (lbl || '').toLowerCase();
            return s.includes('cable') || s.includes('vb-audio') || s.includes('voicemeeter') || 
                   s.includes('virtual') || s.includes('stereo mix') || s.includes('mixage');
          };

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
            setSelectedMicInput(bestRealMic.deviceId);
            localStorage.setItem('freepad_selected_mic', bestRealMic.deviceId);
            soundEngine.toggleMicPassthrough(isMicPassthrough, bestRealMic.deviceId, bestRealMic.label, true);
          } else if (currentMicObj) {
            soundEngine.toggleMicPassthrough(isMicPassthrough, currentMicObj.deviceId, currentMicObj.label, false);
          }

          const savedBroadcast = localStorage.getItem('freepad_broadcast_output');
          if (!savedBroadcast || savedBroadcast === 'default') {
            const virtualOut = outputs.find(d => {
              const l = (d.label || '').toLowerCase();
              return (l.includes('cable') || l.includes('vb-audio') || l.includes('freepad') || l.includes('virtual')) && !l.includes('steam');
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

    soundEngine.onEnded = () => {
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

  // Sync audioClipRecorder status
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
        await audioClipRecorder.startListening(replaySource, replaySource === 'mic' ? selectedMicInput : null);
        setIsReplayListening(true);
        showToast("Écoute Discord active ! Appuyez sur F8 pour clipper.", "success");
      }
    } catch (err) {
      setIsReplayListening(false);
      showToast("Erreur écoute audio : " + (err.message || err), "error");
    }
  };

  const handleInstantClip = async (seconds = 5) => {
    try {
      if (!audioClipRecorder.isListening()) {
        showToast("Démarrage de l'écoute Discord... Ré-appuyez sur F8 dans quelques secondes !", "info");
        await audioClipRecorder.startListening(replaySource, replaySource === 'mic' ? selectedMicInput : null);
        setIsReplayListening(true);
        return;
      }

      showToast(`Découpage des ${seconds} dernières secondes...`, "info");
      const newClip = await audioClipRecorder.clipLastSeconds(seconds);

      setSounds((prev) => [newClip, ...prev]);

      setCategories((prev) => {
        if (!prev.includes('Mes Clips')) {
          return ['Tous les sons', 'Mes Clips', ...prev.filter(c => c !== 'Tous les sons')];
        }
        return prev;
      });
      setActiveCategory('Mes Clips');

      showToast(`Clip de ${seconds}s enregistré ! Rejouez-le ou téléchargez-le sur votre PC.`, "success");
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
          showToast(`Clip "${res.fileName || sound.title}" enregistré sur votre PC !`, "success");
        } else {
          showToast(res?.error || "Erreur lors de l'enregistrement", "error");
        }
        return;
      }

      if (sound.url) {
        const a = document.createElement('a');
        a.href = sound.url;
        const cleanName = (sound.title || 'clip_freepad').replace(/[/\\?%*:|"<>]/g, '_');
        a.download = cleanName.endsWith('.wav') || cleanName.endsWith('.mp3') ? cleanName : `${cleanName}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`"${sound.title}" téléchargé !`, "success");
      }
    } catch (err) {
      console.warn("handleExportSound error:", err);
      showToast("Erreur lors du téléchargement : " + err.message, "error");
    }
  };

  // IPC listener for F8 global hotkey
  useEffect(() => {
    if (window.electronAPI?.onTriggerInstantReplay) {
      const cleanup = window.electronAPI.onTriggerInstantReplay(({ duration }) => {
        handleInstantClip(duration || clipDuration);
      });
      return cleanup;
    }
  }, [clipDuration, replaySource, selectedMicInput]);

  // Sync sounds & categories with Stream Deck Mobile
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

  // Remote phone listener
  useEffect(() => {
    if (window.electronAPI?.onRemotePlaySound) {
      const cleanupPlay = window.electronAPI.onRemotePlaySound((soundId) => {
        const sound = sounds.find((s) => s.id === soundId);
        if (sound) {
          soundEngine.play(sound);
          showToast(`Lancé depuis votre smartphone : "${sound.title}"`, 'info');
        }
      });
      const cleanupStop = window.electronAPI.onRemoteStopSound(() => {
        soundEngine.stop();
        showToast('Arrêté depuis votre smartphone', 'info');
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
      if (e.repeat) return;
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
      alert(`Impossible de lire le son "${sound.title}". Le fichier ou l'URL est inaccessible.`);
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
    showToast(`"${newSound.title}" importé dans votre bibliothèque !`, "success");
  };

  const handleSaveTrimmedSound = (newSound, replaceOriginalId) => {
    if (replaceOriginalId) {
      setSounds((prev) => prev.map((s) => (s.id === replaceOriginalId ? newSound : s)));
      showToast(`Son "${newSound.title}" mis à jour !`, "success");
    } else {
      setSounds((prev) => [newSound, ...prev]);
      if (!categories.includes(newSound.category)) {
        setCategories((prev) => [...prev, newSound.category]);
      }
      setActiveCategory(newSound.category);
      showToast(`Son découpé "${newSound.title}" ajouté !`, "success");
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
      className="flex flex-col h-screen max-h-screen bg-[#080a10] text-slate-100 overflow-hidden relative font-['Plus_Jakarta_Sans',sans-serif]"
    >
      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#080a10]/90 backdrop-blur-md border-2 border-dashed border-indigo-500 flex flex-col items-center justify-center pointer-events-none animate-in fade-in">
          <Upload className="w-12 h-12 text-indigo-400 animate-bounce mb-2" />
          <h2 className="text-xl font-bold text-white mb-1">Déposez vos fichiers audio ici</h2>
          <p className="text-xs text-slate-400">MP3, WAV, OGG, M4A, FLAC acceptés</p>
        </div>
      )}

      {/* TOP COMPACT STUDIO HEADER */}
      <header className="h-14 px-4 bg-[#0d1019]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between gap-3 z-20 shrink-0">
        
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Radio className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white">FreePad</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-slate-400 font-medium">PRO</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-semibold tracking-wide">
              <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Fait par zioti</span>
            </div>
          </div>
        </div>

        {/* Center: Clean Segmented View Selector */}
        <nav className="flex items-center bg-black/40 p-1 rounded-xl border border-white/[0.06] shrink-0">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'table' : 'grid')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid' || viewMode === 'table'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>Soundboard</span>
          </button>

          <button
            onClick={() => setViewMode('myinstants')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'myinstants'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">MyInstants</span>
          </button>

          <button
            onClick={() => setViewMode('voicemod')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'voicemod'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Sons Voicemod</span>
          </button>

          <button
            onClick={() => setViewMode('tts')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'tts'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Languages className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Voix TTS</span>
          </button>
        </nav>

        {/* Right: Studio Actions & Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Stream Deck Mobile */}
          <button
            onClick={() => setIsRemoteModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Contrôler depuis un smartphone (Stream Deck tactile)"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Téléphone</span>
          </button>

          {/* Media URL Importer */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Importer directement depuis YouTube, TikTok ou lien audio"
          >
            <SquarePlay className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline">Importer URL</span>
          </button>

          {/* Instant Remix */}
          <button
            onClick={() => setIsRemixModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Instant Remix (F7)"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Remix (F7)</span>
          </button>

          {/* Add Local Sound Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.spl"
            onChange={(e) => {
              if (e.dataTransfer?.files || e.target.files) handleAddFiles(e.target.files);
            }}
            className="hidden"
          />

          {/* View Mode Toggle (Grid / List) */}
          {(viewMode === 'grid' || viewMode === 'table') && (
            <div className="flex bg-black/40 border border-white/[0.06] rounded-lg p-0.5 ml-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Vue Grille"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Vue Liste"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
            title="Paramètres d'injection micro & sorties"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* DISMISSIBLE BANNERS (COMPACT) */}
      {!isApoInstalled && (
        <div className="bg-amber-950/90 text-amber-200 px-4 py-1.5 border-b border-amber-500/30 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Activez l'injection micro directe pour diffuser dans Discord sans VB-Cable. Fait par zioti.</span>
          </div>
          <button
            onClick={handleQuickInstallApo}
            disabled={isInstallingApo}
            className="px-2.5 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold cursor-pointer transition-all"
          >
            {isInstallingApo ? "Activation..." : "Activer mon micro"}
          </button>
        </div>
      )}
      {apoBannerMsg && (
        <div className="bg-emerald-950/90 text-emerald-200 border-b border-emerald-500/40 px-4 py-1 text-xs text-center flex items-center justify-center gap-2 shrink-0">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>{apoBannerMsg}</span>
        </div>
      )}
      {showDiscordTip && (
        <div className="bg-slate-900/90 text-slate-300 border-b border-white/[0.06] px-4 py-1 text-[11px] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <span className="font-semibold text-indigo-400 shrink-0">Conseil Discord :</span>
            <span className="truncate">
              Dans Discord &gt; Voix &amp; Vidéo, désactivez <strong>'Suppression du bruit (Krisp)'</strong> et <strong>'Annulation de l'écho'</strong> pour que vos sons ne soient pas étouffés.
            </span>
          </div>
          <button
            onClick={() => {
              setShowDiscordTip(false);
              localStorage.setItem('freepad_hide_discord_tip', 'true');
            }}
            className="text-slate-400 hover:text-white text-xs px-1.5 py-0.2 rounded hover:bg-white/[0.06] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="absolute top-16 right-5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none">
          <div className={`px-3.5 py-2 rounded-xl shadow-xl backdrop-blur-md border flex items-center gap-2 text-xs font-medium ${
            toast.type === 'success'
              ? 'bg-[#0f172a]/95 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-[#0f172a]/95 border-rose-500/40 text-rose-200'
              : 'bg-[#0f172a]/95 border-indigo-500/40 text-indigo-200'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-spin" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* COMPACT STUDIO TOOLBAR STRIP (Categories + Search + Instant Replay Clipper) */}
      {(viewMode === 'grid' || viewMode === 'table') && (
        <div className="px-4 py-2 bg-[#0b0e17]/80 border-b border-white/[0.06] flex items-center justify-between gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          
          {/* Left: Category Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {categories.map((cat) => {
              const count = cat === 'Tous les sons' ? sounds.length : sounds.filter(s => s.category === cat).length;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 border border-white/[0.04]'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 rounded-full ${
                    isActive ? 'bg-indigo-800 text-indigo-200' : 'bg-black/40 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Group: Search + Integrated Clipper Capsule */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative w-40 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Clipper Capsule */}
            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-xl border border-white/[0.06]">
              <button
                onClick={handleToggleReplayListening}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  isReplayListening
                    ? 'text-emerald-300 hover:bg-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
                title={isReplayListening ? "Écoute Discord active (cliquez pour désactiver)" : "Activer l'écoute Discord"}
              >
                <span className={`w-2 h-2 rounded-full ${isReplayListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="hidden md:inline">{isReplayListening ? 'Écoute Discord' : 'Écoute'}</span>
              </button>

              <div className="flex bg-white/[0.04] p-0.5 rounded-md text-[10px] font-mono">
                <button
                  onClick={() => setClipDuration(5)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    clipDuration === 5 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  5s
                </button>
                <button
                  onClick={() => setClipDuration(10)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    clipDuration === 10 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  10s
                </button>
              </div>

              <button
                onClick={() => handleInstantClip(clipDuration)}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Clipper les dernières secondes de ce que ton pote vient de dire !"
              >
                <Scissors className="w-3 h-3" />
                <span>Clip {clipDuration}s</span>
                <span className="px-1 py-0.2 rounded bg-black/40 text-[9px] font-mono">F8</span>
              </button>

              <button
                onClick={async () => {
                  if (window.electronAPI?.openClipsFolder) {
                    await window.electronAPI.openClipsFolder();
                    showToast("Dossier des clips ouvert !", "info");
                  }
                }}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Ouvrir le dossier des clips sur votre PC"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto">
        {(viewMode === 'grid' || viewMode === 'table') && activeCategory === 'Mes Clips' && (
          <div className="mb-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Scissors className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Mes Clips Discord &amp; Instant Replay</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-300">
                    {filteredSounds.length} clip{filteredSounds.length > 1 ? 's' : ''}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Rejouez vos clips en direct dans votre micro ou téléchargez-les avec le bouton 📥.
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                if (window.electronAPI?.openClipsFolder) {
                  await window.electronAPI.openClipsFolder();
                  showToast("Dossier des clips ouvert !", "info");
                }
              }}
              className="px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5 text-rose-400" />
              <span>Ouvrir le dossier</span>
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
      <footer className="p-3 bg-[#080a10] border-t border-white/[0.08] z-20 shrink-0">
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
          showToast(`Remix ajouté à votre bibliothèque : ${newSound.title}`, 'success');
        }}
      />
    </div>
  );
}
