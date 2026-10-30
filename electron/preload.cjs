const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  registerGlobalHotkey: (soundId, hotkey) => ipcRenderer.invoke('register-global-hotkey', { soundId, hotkey }),
  unregisterAllHotkeys: () => ipcRenderer.invoke('unregister-all-hotkeys'),
  openAudioDialog: () => ipcRenderer.invoke('open-audio-dialog'),
  fetchAudio: (url) => ipcRenderer.invoke('fetch-audio', url),
  downloadSound: (opts) => ipcRenderer.invoke('download-sound', opts),

  // Google Translate French Female Voice TTS
  generateTts: (opts) => ipcRenderer.invoke('generate-tts', opts),

  // MyInstants Scraper API
  searchMyInstants: (opts) => ipcRenderer.invoke('search-myinstants', opts),
  getTrendingMyInstants: (opts) => ipcRenderer.invoke('get-trending-myinstants', opts),
  getBestMyInstants: (opts) => ipcRenderer.invoke('get-best-myinstants', opts),
  getRecentMyInstants: (opts) => ipcRenderer.invoke('get-recent-myinstants', opts),

  // Voicemod Tuna Soundboard API
  searchVoicemod: (opts) => ipcRenderer.invoke('search-voicemod', opts),

  // FreePad Native APO Driver Direct Injection
  checkApoStatus: () => ipcRenderer.invoke('check-apo-status'),
  playApoPcm: (opts) => ipcRenderer.invoke('play-apo-pcm', opts),
  stopApoPcm: () => ipcRenderer.invoke('stop-apo-pcm'),
  installApoDriver: () => ipcRenderer.invoke('install-apo-driver'),
  installVirtualCable: () => ipcRenderer.invoke('install-virtual-cable'),

  // Real-Time Voice Changer APO Live Injection
  startVoiceStream: (opts) => ipcRenderer.invoke('start-voice-stream', opts),
  sendVoiceStreamChunk: (opts) => ipcRenderer.invoke('send-voice-stream-chunk', opts),
  sendVoiceStreamChunkFast: (pcmArray) => ipcRenderer.send('send-voice-stream-chunk-fast', pcmArray),
  stopVoiceStream: () => ipcRenderer.invoke('stop-voice-stream'),

  // Backward compatibility aliases
  checkSoundpadStatus: () => ipcRenderer.invoke('check-apo-status'),
  playSoundpadSound: (opts) => ipcRenderer.invoke('play-apo-pcm', opts),
  stopSoundpadSound: () => ipcRenderer.invoke('stop-apo-pcm'),

  // Instant Replay Discord / Loopback Capture (Native Windows WASAPI)
  clipInstantReplay: (opts) => ipcRenderer.invoke('clip-instant-replay', opts),
  startInstantReplay: () => ipcRenderer.invoke('start-instant-replay'),
  stopInstantReplay: () => ipcRenderer.invoke('stop-instant-replay'),
  getReplayStatus: () => ipcRenderer.invoke('get-replay-status'),
  saveRecordedClip: (opts) => ipcRenderer.invoke('save-recorded-clip', opts),
  setReplayHotkey: (opts) => ipcRenderer.invoke('set-replay-hotkey', opts),
  onTriggerInstantReplay: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('trigger-instant-replay', handler);
    return () => ipcRenderer.removeListener('trigger-instant-replay', handler);
  },

  // Export & Download Clips and Sounds to PC (Fait par zioti)
  exportAudioFile: (opts) => ipcRenderer.invoke('export-audio-file', opts),
  openClipsFolder: () => ipcRenderer.invoke('open-clips-folder'),
  showItemInFolder: (opts) => ipcRenderer.invoke('show-item-in-folder', opts),

  // Instant Remix Pote (F7)
  setRemixHotkey: (opts) => ipcRenderer.invoke('set-remix-hotkey', opts),
  onTriggerInstantRemix: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('trigger-instant-remix', handler);
    return () => ipcRenderer.removeListener('trigger-instant-remix', handler);
  },

  // Voice Changer Pro (F6)
  setVoiceChangerHotkey: (opts) => ipcRenderer.invoke('set-voice-changer-hotkey', opts),
  onTriggerVoiceChanger: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('trigger-voice-changer', handler);
    return () => ipcRenderer.removeListener('trigger-voice-changer', handler);
  },

  onTriggerSound: (callback) => {
    const handler = (event, soundId) => callback(soundId);
    ipcRenderer.on('trigger-sound-hotkey', handler);
    return () => ipcRenderer.removeListener('trigger-sound-hotkey', handler);
  },

  // Direct Media Importer (YouTube, TikTok, Shorts, Twitter / X, MP4) & Audio Trimmer
  getMediaInfo: (opts) => ipcRenderer.invoke('get-media-info', opts),
  downloadMedia: (opts) => ipcRenderer.invoke('download-media', opts),
  saveTrimmedSound: (opts) => ipcRenderer.invoke('save-trimmed-sound', opts),

  // FreePad Stream Deck Mobile (Remote Server)
  getRemoteInfo: () => ipcRenderer.invoke('get-remote-info'),
  syncRemoteSounds: (opts) => ipcRenderer.send('sync-remote-sounds', opts),
  broadcastRemoteState: (state) => ipcRenderer.send('broadcast-remote-state', state),
  toggleRemoteServer: (enable) => ipcRenderer.invoke('toggle-remote-server', enable),
  onRemotePlaySound: (callback) => {
    const handler = (event, soundId) => callback(soundId);
    ipcRenderer.on('remote-play-sound', handler);
    return () => ipcRenderer.removeListener('remote-play-sound', handler);
  },
  onRemoteStopSound: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('remote-stop-sound', handler);
    return () => ipcRenderer.removeListener('remote-stop-sound', handler);
  },

  // Auto-Updater API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  startDownloadUpdate: () => ipcRenderer.invoke('start-download-update'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdateAvailable: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateNotAvailable: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (event, progress) => callback(progress);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateError: (callback) => {
    const handler = (event, err) => callback(err);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  }
});
