const { app, BrowserWindow, globalShortcut, ipcMain, dialog, session, desktopCapturer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn, exec, execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');
const remoteServer = require('./remoteServer.cjs');

// Configure autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = {
  info: (msg) => console.log('[AutoUpdater]', msg),
  warn: (msg) => console.warn('[AutoUpdater]', msg),
  error: (msg) => console.error('[AutoUpdater]', msg)
};

// Audio & Performance switches for background soundboard operation and zero CORS restrictions
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('enable-features', 'AudioServiceOutOfProcess');
app.commandLine.appendSwitch('disable-features', 'AudioServiceSandbox');

let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 850,
    minHeight: 600,
    title: 'FreePad — Ultimate Soundboard',
    backgroundColor: '#030712',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // allow local audio file playback
      backgroundThrottling: false // Keep audio mixing 100% active when minimized or in-game
    },
    autoHideMenuBar: true
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  if (process.env.VITE_DEV === 'true') {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      }
    });
  } else if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {});
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Global hotkeys registration from UI
ipcMain.handle('register-global-hotkey', (event, { soundId, hotkey }) => {
  try {
    // Convert format if needed: e.g. "Ctrl + Alt + 1" to "CommandOrControl+Alt+1"
    const electronKey = hotkey
      .replace(/Ctrl/g, 'CommandOrControl')
      .replace(/Win/g, 'Super')
      .replace(/ \+ /g, '+');

    const success = globalShortcut.register(electronKey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-sound-hotkey', soundId);
      }
    });
    return { success };
  } catch (err) {
    console.error('Failed to register shortcut:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('unregister-all-hotkeys', () => {
  globalShortcut.unregisterAll();
  return true;
});

// Native file picker
ipcMain.handle('open-audio-dialog', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Fichiers Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'wma'] },
      { name: 'Soundpad Soundlist (.spl)', extensions: ['spl', 'xml'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });
  return result.filePaths || [];
});

// Fetch raw audio buffer directly without browser CORS restrictions
ipcMain.handle('fetch-audio', async (event, url) => {
  try {
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1];
      const buf = Buffer.from(base64Data, 'base64');
      return { success: true, data: Array.from(buf) };
    }
    if (url.startsWith('file://')) {
      const localPath = decodeURIComponent(url.replace(/^file:\/\/\/?/, ''));
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath);
        return { success: true, data: Array.from(buf) };
      }
    }
    if (fs.existsSync(url)) {
      const buf = fs.readFileSync(url);
      return { success: true, data: Array.from(buf) };
    }
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    const ab = await resp.arrayBuffer();
    return { success: true, data: Array.from(new Uint8Array(ab)) };
  } catch (err) {
    console.error('fetch-audio error:', err.message);
    return { success: false, error: err.message };
  }
});

// Download and cache any MyInstants or remote sound to local disk for offline playback
ipcMain.handle('download-sound', async (event, { url, title }) => {
  try {
    let realUrl = url;
    let resolvedTitle = title;

    // Handle MyInstants page URLs (e.g. https://www.myinstants.com/en/instant/bruh/)
    if (url.includes('myinstants.com') && !url.includes('/media/sounds/')) {
      const pageResp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await pageResp.text();

      const audioMatch = html.match(/var preloadAudioUrl = '([^']+)';/) ||
                         html.match(/play\('([^']+\.mp3)'\)/) ||
                         html.match(/src="([^"]+\.mp3)"/);
      if (audioMatch) {
        realUrl = audioMatch[1].startsWith('http')
          ? audioMatch[1]
          : `https://www.myinstants.com${audioMatch[1]}`;
      }

      if (html.includes('<title>')) {
        const rawTitle = html.split('<title>')[1].split('</title>')[0];
        resolvedTitle = rawTitle.split('-')[0].replace('Instant Sound Effect Button', '').trim();
      }
    }

    const resp = await fetch(realUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save permanently in AppData/FreePad/sounds
    const soundsDir = path.join(app.getPath('userData'), 'sounds');
    if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });

    const safeName = (resolvedTitle || 'sound')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);
    const fileName = `${safeName}_${Date.now()}.mp3`;
    const filePath = path.join(soundsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const base64 = buffer.toString('base64');
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    return {
      success: true,
      filePath,
      dataUrl,
      title: resolvedTitle,
      realUrl
    };
  } catch (err) {
    console.error('download-sound error:', err.message);
    return { success: false, error: err.message };
  }
});

// ==========================================
// 1. FREEPAD NATIVE APO DRIVER BRIDGE (100% INDEPENDENT - ZERO SOUNDPAD)
// ==========================================
let apoBridgeProcess = null;

function setupBinaries() {
  try {
    const binDir = path.join(app.getPath('userData'), 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const filesToCopy = [
      { name: 'FreePadApoBridge.exe', subpath: 'driver/FreePadApoBridge.exe' },
      { name: 'UniteFx.dll', subpath: 'driver/UniteFx.dll' },
      { name: 'install_apo.ps1', subpath: 'installer/install_apo.ps1' },
      { name: 'yt-dlp.exe', subpath: 'driver/yt-dlp.exe' }
    ];

    for (const item of filesToCopy) {
      const dest = path.join(binDir, item.name);
      const possibleSources = [
        path.join(process.resourcesPath, item.subpath),
        path.join(process.resourcesPath, 'app.asar.unpacked', item.subpath),
        path.join(__dirname, '..', item.subpath),
        path.join(path.dirname(app.getPath('exe')), item.subpath),
        path.join(process.cwd(), item.subpath)
      ];

      for (const src of possibleSources) {
        if (fs.existsSync(src)) {
          try {
            const srcBuf = fs.readFileSync(src);
            const needsCopy = !fs.existsSync(dest) || fs.statSync(dest).size !== srcBuf.length || item.name.endsWith('.ps1') || item.name === 'FreePadApoBridge.exe';
            if (needsCopy) {
              if (item.name === 'FreePadApoBridge.exe') {
                try {
                  execSync('taskkill /F /IM FreePadApoBridge.exe 2>nul');
                } catch (e) {}
              }
              fs.writeFileSync(dest, srcBuf);
            }
            break;
          } catch (copyErr) {
            console.warn(`Could not copy ${item.name}:`, copyErr.message);
          }
        }
      }
    }

    // Copy vbcable directory if present
    const vbcableDest = path.join(binDir, 'vbcable');
    const vbcableSources = [
      path.join(process.resourcesPath, 'driver', 'vbcable'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'driver', 'vbcable'),
      path.join(__dirname, '..', 'driver', 'vbcable'),
      path.join(path.dirname(app.getPath('exe')), 'driver', 'vbcable'),
      path.join(process.cwd(), 'driver', 'vbcable')
    ];
    for (const srcDir of vbcableSources) {
      if (fs.existsSync(srcDir) && !fs.existsSync(path.join(vbcableDest, 'VBCABLE_Setup_x64.exe'))) {
        try {
          fs.cpSync(srcDir, vbcableDest, { recursive: true });
          break;
        } catch (e) {
          console.warn('Could not copy vbcable directory:', e.message);
        }
      }
    }

    return path.join(binDir, 'FreePadApoBridge.exe');
  } catch (err) {
    console.error("setupBinaries error:", err.message);
    return path.join(app.getPath('userData'), 'bin', 'FreePadApoBridge.exe');
  }
}

function getYtDlpPath() {
  const binDir = path.join(app.getPath('userData'), 'bin');
  const candidates = [
    path.join(binDir, 'yt-dlp.exe'),
    path.join(process.resourcesPath, 'driver', 'yt-dlp.exe'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'driver', 'yt-dlp.exe'),
    path.join(__dirname, '..', 'driver', 'yt-dlp.exe'),
    path.join(path.dirname(app.getPath('exe')), 'driver', 'yt-dlp.exe'),
    path.join(process.cwd(), 'driver', 'yt-dlp.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'yt-dlp';
}

function getFfmpegPath() {
  const candidates = [
    path.join(app.getPath('userData'), 'bin', 'ffmpeg.exe'),
    path.join(process.resourcesPath, 'driver', 'ffmpeg.exe'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'driver', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'driver', 'ffmpeg.exe'),
    path.join(path.dirname(app.getPath('exe')), 'driver', 'ffmpeg.exe'),
    path.join(process.cwd(), 'driver', 'ffmpeg.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

function ensureApoBridgeRunning() {
  return new Promise((resolve) => {
    const probe = net.connect('\\\\.\\pipe\\freepad_apo', () => {
      probe.end();
      resolve(true);
    });

    probe.on('error', () => {
      try {
        const bridgeExe = setupBinaries();
        if (fs.existsSync(bridgeExe)) {
          apoBridgeProcess = spawn(bridgeExe, [], {
            detached: true,
            windowsHide: true,
            stdio: 'ignore'
          });
          apoBridgeProcess.on('error', (err) => {
            console.warn("apoBridgeProcess spawn error:", err.message);
          });
          apoBridgeProcess.unref();
        }
      } catch (e) {
        console.warn("Could not spawn FreePadApoBridge:", e.message);
      }
      setTimeout(() => resolve(true), 600);
    });
  });
}

function sendApoCommand(cmd, payload = null) {
  return new Promise(async (resolve) => {
    try {
      await ensureApoBridgeRunning();
      let attempts = 0;
      const maxAttempts = 4;

      function tryConnect() {
        attempts++;
        const client = net.connect('\\\\.\\pipe\\freepad_apo', () => {
          let buffer = '';
          const onData = (chunk) => {
            buffer += chunk.toString('utf8');
            if (buffer.includes('\n')) {
              client.off('data', onData);
              client.end();
              resolve({ success: true, response: buffer.trim() });
            }
          };
          client.on('data', onData);

          client.write(cmd + '\n');
          if (payload) {
            client.write(payload);
          }
        });

        client.on('error', (err) => {
          if (attempts < maxAttempts) {
            setTimeout(tryConnect, 100);
          } else {
            resolve({ success: false, error: err.message });
          }
        });

        const timeoutMs = payload ? Math.max(30000, Math.ceil((payload.length / 192000) * 1000) + 15000) : 15000;
        setTimeout(() => {
          try { client.destroy(); } catch (e) {}
        }, timeoutMs);
      }

      tryConnect();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

ipcMain.handle('check-apo-status', async () => {
  try {
    const dllInstalled = fs.existsSync('C:\\Windows\\System32\\UniteFx1.8.0.dll');
    const res = await sendApoCommand('STATUS');
    let isActive = false;
    let details = null;
    if (res.success && res.response) {
      try {
        const clean = res.response.replace(/^\uFEFF/, '').trim();
        const json = JSON.parse(clean);
        isActive = !!json.active;
        details = json;
      } catch (e) {
        console.warn("check-apo-status JSON parse failed:", e.message, "raw:", res.response);
      }
    }
    return { 
      isAvailable: dllInstalled || isActive, 
      isActive,
      details 
    };
  } catch (err) {
    const dllInstalled = fs.existsSync('C:\\Windows\\System32\\UniteFx1.8.0.dll');
    return { isAvailable: dllInstalled, error: err.message };
  }
});

// Stream raw IEEE 754 32-bit Float 48,000 Hz PCM into physical microphone APO bridge
ipcMain.handle('play-apo-pcm', async (event, { pcmArray, sampleRate = 48000, channels = 1 }) => {
  try {
    const pcmBuffer = Buffer.from(pcmArray);
    const cmd = `PLAY_PCM ${pcmBuffer.length}`;
    const res = await sendApoCommand(cmd, pcmBuffer);
    return res;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-apo-pcm', async () => {
  return await sendApoCommand('STOP');
});

// Persistent low-latency streaming socket for real-time Voice Changer APO injection
let voiceStreamSocket = null;

ipcMain.handle('start-voice-stream', async (event, { blockVoice = true } = {}) => {
  try {
    await ensureApoBridgeRunning();
    if (blockVoice) {
      await sendApoCommand('SET_BLOCK_VOICE 1');
    }
    if (voiceStreamSocket) {
      try { voiceStreamSocket.destroy(); } catch (e) {}
      voiceStreamSocket = null;
    }

    return new Promise((resolve) => {
      const socket = net.connect('\\\\.\\pipe\\freepad_apo', () => {
        socket.write('START_VOICE_STREAM\n');
      });

      socket.once('data', (data) => {
        const text = data.toString('utf8').trim();
        if (text.includes('STREAM_READY')) {
          voiceStreamSocket = socket;
          resolve({ success: true });
        } else {
          resolve({ success: false, error: text });
        }
      });

      socket.on('error', (err) => {
        console.warn('voiceStreamSocket error:', err.message);
        voiceStreamSocket = null;
        resolve({ success: false, error: err.message });
      });

      socket.on('close', () => {
        voiceStreamSocket = null;
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('send-voice-stream-chunk', async (event, { pcmArray }) => {
  if (!voiceStreamSocket || voiceStreamSocket.destroyed) {
    return { success: false, error: 'Stream socket not active' };
  }
  try {
    const buffer = Buffer.isBuffer(pcmArray) ? pcmArray : Buffer.from(pcmArray);
    const lenBuf = Buffer.allocUnsafe(4);
    lenBuf.writeInt32LE(buffer.length, 0);
    voiceStreamSocket.write(lenBuf);
    voiceStreamSocket.write(buffer);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// High-speed one-way event for real-time live voice changer stream (zero Promise overhead)
ipcMain.on('send-voice-stream-chunk-fast', (event, pcmArray) => {
  if (!voiceStreamSocket || voiceStreamSocket.destroyed) return;
  try {
    const buffer = Buffer.isBuffer(pcmArray) ? pcmArray : Buffer.from(pcmArray.buffer || pcmArray);
    const lenBuf = Buffer.allocUnsafe(4);
    lenBuf.writeInt32LE(buffer.length, 0);
    voiceStreamSocket.write(lenBuf);
    voiceStreamSocket.write(buffer);
  } catch (e) {}
});

ipcMain.handle('stop-voice-stream', async () => {
  try {
    if (voiceStreamSocket) {
      try { voiceStreamSocket.end(); } catch (e) {}
      voiceStreamSocket = null;
    }
    await sendApoCommand('SET_BLOCK_VOICE 0');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Run 1-click APO driver installer with administrator UAC elevation
ipcMain.handle('install-apo-driver', async () => {
  try {
    setupBinaries();
    const binDir = path.join(app.getPath('userData'), 'bin');
    const ps1Path = path.join(binDir, 'install_apo.ps1');

    // Always ensure the latest install_apo.ps1 is copied to userData/bin
    const altSources = [
      path.join(process.resourcesPath, 'installer', 'install_apo.ps1'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'installer', 'install_apo.ps1'),
      path.join(__dirname, '..', 'installer', 'install_apo.ps1'),
      path.join(path.dirname(app.getPath('exe')), 'installer', 'install_apo.ps1'),
      path.join(process.cwd(), 'installer', 'install_apo.ps1')
    ];
    for (const src of altSources) {
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, ps1Path);
          break;
        } catch (e) {
          console.warn('Could not copy updated install_apo.ps1:', e.message);
        }
      }
    }

    if (!fs.existsSync(ps1Path)) {
      return { success: false, error: "Fichier install_apo.ps1 introuvable" };
    }

    const winDir = process.env.WINDIR || 'C:\\Windows';
    const sysnativePs = path.join(winDir, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const sys32Ps = path.join(winDir, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const nativePs = fs.existsSync(sysnativePs) ? sysnativePs : (fs.existsSync(sys32Ps) ? sys32Ps : 'powershell.exe');

    // Create an installer batch script in userData/bin
    const batPath = path.join(binDir, 'run_install.bat');
    const batContent = `@echo off
chcp 65001 >nul
title FreePad — Installation du Pilote Micro Direct (APO) — Fait par zioti
cd /d "%~dp0"
cls
if exist "%WINDIR%\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe" (
    "%WINDIR%\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"
)
`;
    fs.writeFileSync(batPath, batContent, 'utf8');

    // 100% Reliable Native Windows UAC Elevation directly via PowerShell Start-Process (Fait par zioti)
    // Avoids wscript/cscript dependency which can be blocked by security software
    const psCmd = `Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""${ps1Path}""'`;
    exec(`"${nativePs}" -NoProfile -Command "${psCmd}"`, (err) => {
      if (err) {
        console.warn("Direct PowerShell elevation failed, trying batch fallback:", err.message);
        try {
          const vbsPath = path.join(binDir, 'elevate.vbs');
          const vbsContent = `Set objShell = CreateObject("Shell.Application")\r\nobjShell.ShellExecute "cmd.exe", "/c """"${batPath}""""", "", "runas", 1\r\n`;
          fs.writeFileSync(vbsPath, vbsContent, 'utf8');
          const wscript = spawn('wscript.exe', [vbsPath], { detached: true, windowsHide: false, stdio: 'ignore' });
          wscript.unref();
        } catch (e) {}
      }
    });

    return { success: true };
  } catch (err) {
    console.error('install-apo-driver error:', err.message);
    return { success: false, error: err.message };
  }
});

// Run 1-click Virtual Audio Cable driver installer with administrator UAC elevation
ipcMain.handle('install-virtual-cable', async () => {
  try {
    setupBinaries();
    const binDir = path.join(app.getPath('userData'), 'bin');

    const possibleSetups = [
      path.join(binDir, 'vbcable', 'VBCABLE_Setup_x64.exe'),
      path.join(process.resourcesPath, 'driver', 'vbcable', 'VBCABLE_Setup_x64.exe'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'driver', 'vbcable', 'VBCABLE_Setup_x64.exe'),
      path.join(__dirname, '..', 'driver', 'vbcable', 'VBCABLE_Setup_x64.exe'),
      path.join(process.cwd(), 'driver', 'vbcable', 'VBCABLE_Setup_x64.exe')
    ];
    let setupPath = null;
    for (const p of possibleSetups) {
      if (fs.existsSync(p)) {
        setupPath = p;
        break;
      }
    }

    if (!setupPath) {
      return { success: false, error: "Installateur du câble audio virtuel introuvable" };
    }

    const setupDir = path.dirname(setupPath);
    const batPath = path.join(binDir, 'run_install_cable.bat');
    const batContent = `@echo off
chcp 65001 >nul
title FreePad — Installation du Câble Audio Virtuel
cd /d "${setupDir}"
"${setupPath}" -i -h
net stop audiosrv >nul 2>&1
net start audiosrv >nul 2>&1
`;
    fs.writeFileSync(batPath, batContent, 'utf8');

    const vbsPath = path.join(binDir, 'elevate_cable.vbs');
    const vbsContent = `Set objShell = CreateObject("Shell.Application")
objShell.ShellExecute "cmd.exe", "/c """"${batPath}""""", "", "runas", 1
`;
    fs.writeFileSync(vbsPath, vbsContent, 'utf8');

    const wscript = spawn('wscript.exe', [vbsPath], {
      detached: true,
      windowsHide: false,
      stdio: 'ignore'
    });
    wscript.unref();

    return { success: true };
  } catch (err) {
    console.error('install-virtual-cable error:', err.message);
    return { success: false, error: err.message };
  }
});

// ==========================================
// 2. GOOGLE TRANSLATE FRENCH FEMALE TTS
// ==========================================
ipcMain.handle('generate-tts', async (event, { text, lang = 'fr' }) => {
  try {
    if (!text || !text.trim()) throw new Error("Texte vide");
    const cleanText = text.trim().slice(0, 200);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`;

    const resp = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!resp.ok) throw new Error(`Google TTS error: ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ttsDir = path.join(app.getPath('userData'), 'sounds', 'tts');
    if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true });

    const safeSnippet = cleanText.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    const fileName = `tts_${safeSnippet}_${Date.now()}.mp3`;
    const filePath = path.join(ttsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const base64 = buffer.toString('base64');
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    return {
      success: true,
      text: cleanText,
      filePath,
      dataUrl,
      title: `🗣️ "${cleanText}"`
    };
  } catch (err) {
    console.error("TTS generation error:", err.message);
    return { success: false, error: err.message };
  }
});

// ==========================================
// 3. MYINSTANTS FULL API SCRAPER (abdipr/myinstants-api)
// ==========================================
async function scrapeMyInstantsPage(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const sounds = [];

  const regex = /<button class="small-button"[^>]*onclick="play\('([^']+\.mp3)'[^"]*"[^>]*>[\s\S]*?<a href="([^"]+)" class="instant-link[^"]*">([^<]+)<\/a>/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const mp3 = m[1].startsWith('http') ? m[1] : `https://www.myinstants.com${m[1]}`;
    const pageUrl = m[2].startsWith('http') ? m[2] : `https://www.myinstants.com${m[2]}`;
    const title = m[3].trim();
    sounds.push({
      id: `instant-${Math.random().toString(36).slice(2, 9)}`,
      title,
      url: mp3,
      pageUrl,
      duration: '0:02',
      category: 'MyInstants'
    });
  }
  return sounds;
}

ipcMain.handle('search-myinstants', async (event, { query, page = 1 }) => {
  try {
    const url = `https://www.myinstants.com/en/search/?name=${encodeURIComponent(query)}&page=${page}`;
    const sounds = await scrapeMyInstantsPage(url);
    return { success: true, sounds, page, query };
  } catch (err) {
    return { success: false, error: err.message, sounds: [] };
  }
});

ipcMain.handle('get-trending-myinstants', async (event, { page = 1 }) => {
  try {
    const url = `https://www.myinstants.com/en/index/fr/?page=${page}`;
    const sounds = await scrapeMyInstantsPage(url);
    return { success: true, sounds, page };
  } catch (err) {
    return { success: false, error: err.message, sounds: [] };
  }
});

ipcMain.handle('get-best-myinstants', async (event, { page = 1 }) => {
  try {
    const url = `https://www.myinstants.com/en/favorites/?page=${page}`;
    const sounds = await scrapeMyInstantsPage(url);
    return { success: true, sounds, page };
  } catch (err) {
    return { success: false, error: err.message, sounds: [] };
  }
});

ipcMain.handle('get-recent-myinstants', async (event, { page = 1 }) => {
  try {
    const url = `https://www.myinstants.com/en/recent/?page=${page}`;
    const sounds = await scrapeMyInstantsPage(url);
    return { success: true, sounds, page };
  } catch (err) {
    return { success: false, error: err.message, sounds: [] };
  }
});

// ==========================================
// 4. VOICEMOD TUNA SOUNDBOARD API
// ==========================================
ipcMain.handle('search-voicemod', async (event, { query = '', page = 1, size = 24 }) => {
  try {
    const cleanQuery = query ? query.trim() : '';
    const url = `https://tuna-api.voicemod.net/v1/sounds/search?search=${encodeURIComponent(cleanQuery)}&page=${page}&size=${size}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!resp.ok) throw new Error(`Voicemod API returned status ${resp.status}`);
    const data = await resp.json();
    const sounds = (data.items || []).map((item) => {
      const durSec = item.properties?.duration ? Math.round(item.properties.duration / 1000) : 3;
      const m = Math.floor(durSec / 60);
      const s = durSec % 60;
      return {
        id: `voicemod-${item.id}`,
        title: item.title,
        url: item.path,
        oggUrl: item.oggPath,
        image: item.imagePath || item.thumbnailM || item.thumbnailS,
        duration: `${m}:${s < 10 ? '0' : ''}${s}`,
        category: item.category ? (item.category.charAt(0).toUpperCase() + item.category.slice(1)) : 'Voicemod',
        likes: item.social?.likeCount || 0,
        downloads: item.stats?.downloadCount || 0,
        plays: item.stats?.playedCount || 0,
        tags: item.tags || []
      };
    });
    return {
      success: true,
      sounds,
      total: data.total || 0,
      page: data.page || page,
      lastPage: data.lastPage || 1
    };
  } catch (err) {
    console.error('search-voicemod error:', err.message);
    return { success: false, error: err.message, sounds: [] };
  }
});

// ==========================================
// 5. INSTANT REPLAY / CLIPPER DISCORD (5S)
// ==========================================
// HOTKEYS: INSTANT REPLAY (F8), INSTANT REMIX (F7), VOICE CHANGER (F6)
// ==========================================
let currentReplayHotkey = 'F8';
let currentRemixHotkey = 'F7';
let currentVoiceChangerHotkey = 'F6';

function registerInstantReplayHotkey(key = 'F8') {
  try {
    if (currentReplayHotkey) {
      try { globalShortcut.unregister(currentReplayHotkey); } catch (e) {}
    }
    const registered = globalShortcut.register(key, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-instant-replay', { duration: 5 });
      }
    });
    if (registered) {
      currentReplayHotkey = key;
    }
    return registered;
  } catch (err) {
    console.warn('Could not register instant replay hotkey:', err.message);
    return false;
  }
}

function registerInstantRemixHotkey(key = 'F7') {
  try {
    if (currentRemixHotkey) {
      try { globalShortcut.unregister(currentRemixHotkey); } catch (e) {}
    }
    const registered = globalShortcut.register(key, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-instant-remix');
      }
    });
    if (registered) {
      currentRemixHotkey = key;
    }
    return registered;
  } catch (err) {
    console.warn('Could not register instant remix hotkey:', err.message);
    return false;
  }
}

function registerVoiceChangerHotkey(key = 'F6') {
  try {
    if (currentVoiceChangerHotkey) {
      try { globalShortcut.unregister(currentVoiceChangerHotkey); } catch (e) {}
    }
    const registered = globalShortcut.register(key, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-voice-changer');
      }
    });
    if (registered) {
      currentVoiceChangerHotkey = key;
    }
    return registered;
  } catch (err) {
    console.warn('Could not register voice changer hotkey:', err.message);
    return false;
  }
}

ipcMain.handle('set-replay-hotkey', (event, { hotkey }) => {
  const success = registerInstantReplayHotkey(hotkey);
  return { success, hotkey: currentReplayHotkey };
});

ipcMain.handle('set-remix-hotkey', (event, { hotkey }) => {
  const success = registerInstantRemixHotkey(hotkey);
  return { success, hotkey: currentRemixHotkey };
});

ipcMain.handle('set-voice-changer-hotkey', (event, { hotkey }) => {
  const success = registerVoiceChangerHotkey(hotkey);
  return { success, hotkey: currentVoiceChangerHotkey };
});

// NATIVE WINDOWS WASAPI LOOPBACK (DISCORD & SYSTEM AUDIO)
ipcMain.handle('start-instant-replay', async () => {
  try {
    const res = await sendApoCommand('START_REPLAY');
    return { success: res.success && res.response === 'REPLAY_STARTED' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('stop-instant-replay', async () => {
  try {
    const res = await sendApoCommand('STOP_REPLAY');
    return { success: res.success && res.response === 'REPLAY_STOPPED' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-replay-status', async () => {
  try {
    const res = await sendApoCommand('STATUS_REPLAY');
    if (res.success && res.response) {
      const clean = res.response.replace(/^\uFEFF/, '').trim();
      const json = JSON.parse(clean);
      return { success: true, ...json };
    }
  } catch (e) {}
  return { success: false, active: false };
});

ipcMain.handle('clip-instant-replay', async (event, { seconds = 5, title = null }) => {
  try {
    const clipsDir = path.join(app.getPath('userData'), 'sounds', 'clips');
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const safeTitle = (title || 'clip_discord')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);
    const fileName = `${safeTitle}_${timestamp}.wav`;
    const filePath = path.join(clipsDir, fileName);

    // Call native Windows WASAPI loopback engine
    const res = await sendApoCommand(`CLIP_REPLAY ${seconds} ${filePath}`);
    if (res.success && res.response && res.response.startsWith('CLIP_OK')) {
      const buffer = fs.readFileSync(filePath);
      const base64Data = buffer.toString('base64');
      const dataUrl = `data:audio/wav;base64,${base64Data}`;
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      const durationFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;

      return {
        success: true,
        filePath,
        dataUrl,
        title: title || `🗣️ Clip Discord ${new Date().toLocaleTimeString('fr-FR')}`,
        duration: durationFormatted
      };
    } else {
      return { success: false, error: res.response || res.error || "Échec capture loopback" };
    }
  } catch (err) {
    console.error('clip-instant-replay error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-recorded-clip', async (event, { base64Data, title, durationSeconds }) => {
  try {
    const clipsDir = path.join(app.getPath('userData'), 'sounds', 'clips');
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const safeTitle = (title || 'clip_discord')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);
    const fileName = `${safeTitle}_${timestamp}.wav`;
    const filePath = path.join(clipsDir, fileName);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const dataUrl = `data:audio/wav;base64,${base64Data}`;
    const dur = durationSeconds || 5;
    const m = Math.floor(dur / 60);
    const s = Math.floor(dur % 60);
    const durationFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;

    return {
      success: true,
      filePath,
      dataUrl,
      title: title || `🗣️ Clip Discord ${new Date().toLocaleTimeString('fr-FR')}`,
      duration: durationFormatted
    };
  } catch (err) {
    console.error('save-recorded-clip error:', err.message);
    return { success: false, error: err.message };
  }
});

// ==========================================
// EXPORT / DOWNLOAD CLIPS & SOUNDS TO PC (FAIT PAR ZIOTI)
// ==========================================
ipcMain.handle('export-audio-file', async (event, { filePath, dataUrl, title, ext = 'wav' }) => {
  try {
    const cleanTitle = (title || 'clip_freepad')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim()
      .slice(0, 60);
    const safeExt = (ext || 'wav').toLowerCase().replace(/^\./, '');
    const defaultFileName = cleanTitle.toLowerCase().endsWith(`.${safeExt}`)
      ? cleanTitle
      : `${cleanTitle}.${safeExt}`;

    const downloadsDir = app.getPath('downloads');
    const defaultPath = path.join(downloadsDir, defaultFileName);

    const { canceled, filePath: targetPath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le clip audio sur votre PC — Fait par zioti',
      defaultPath,
      filters: [
        { name: 'Fichier Audio (*.wav, *.mp3)', extensions: ['wav', 'mp3', 'ogg', 'm4a'] },
        { name: 'Tous les fichiers (*.*)', extensions: ['*'] }
      ]
    });

    if (canceled || !targetPath) {
      return { success: false, canceled: true };
    }

    // 1. If physical filePath exists on disk
    if (filePath && fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, targetPath);
      return { success: true, savedPath: targetPath, fileName: path.basename(targetPath) };
    }

    // 2. If dataUrl (base64)
    if (dataUrl && dataUrl.startsWith('data:')) {
      const parts = dataUrl.split(',');
      if (parts.length > 1) {
        const buffer = Buffer.from(parts[1], 'base64');
        fs.writeFileSync(targetPath, buffer);
        return { success: true, savedPath: targetPath, fileName: path.basename(targetPath) };
      }
    }

    // 3. If dataUrl is a local file path
    if (dataUrl && fs.existsSync(dataUrl)) {
      fs.copyFileSync(dataUrl, targetPath);
      return { success: true, savedPath: targetPath, fileName: path.basename(targetPath) };
    }

    // 4. If dataUrl is an HTTP/HTTPS url
    if (dataUrl && (dataUrl.startsWith('http://') || dataUrl.startsWith('https://'))) {
      const resp = await fetch(dataUrl);
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();
      fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
      return { success: true, savedPath: targetPath, fileName: path.basename(targetPath) };
    }

    return { success: false, error: "Fichier audio introuvable" };
  } catch (err) {
    console.error('export-audio-file error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-clips-folder', async () => {
  try {
    const clipsDir = path.join(app.getPath('userData'), 'sounds', 'clips');
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }
    await shell.openPath(clipsDir);
    return { success: true, path: clipsDir };
  } catch (err) {
    console.error('open-clips-folder error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-item-in-folder', async (event, { filePath }) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }
    return { success: false, error: "Fichier introuvable sur le disque" };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ==========================================
// 6. DIRECT MEDIA IMPORTER (YOUTUBE, TIKTOK, SHORTS, TWITTER/X, MP4) & AUDIO TRIMMER
// ==========================================
ipcMain.handle('get-media-info', async (event, { url }) => {
  try {
    if (!url || !url.trim()) throw new Error("URL invalide ou vide");
    const cleanUrl = url.trim();

    // Check if direct audio or video file
    if (/\.(mp3|wav|ogg|m4a|aac|flac|mp4|webm)($|\?)/i.test(cleanUrl)) {
      const fileName = path.basename(cleanUrl.split('?')[0]);
      return {
        success: true,
        info: {
          id: 'direct-media',
          title: decodeURIComponent(fileName.replace(/\.[^/.]+$/, '')),
          duration: 0,
          durationFormatted: '0:00',
          thumbnail: null,
          uploader: 'Lien direct média',
          url: cleanUrl,
          isDirect: true
        }
      };
    }

    const ytDlp = getYtDlpPath();
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      cleanUrl
    ];

    return new Promise((resolve) => {
      const child = spawn(ytDlp, args, { windowsHide: true });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
      child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const data = JSON.parse(stdout.trim());
            const durationSec = Math.round(data.duration || 0);
            const m = Math.floor(durationSec / 60);
            const s = durationSec % 60;
            const durationFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;

            resolve({
              success: true,
              info: {
                id: data.id || 'media',
                title: data.title || 'Extrait Audio',
                duration: durationSec,
                durationFormatted,
                thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails.length > 0 ? data.thumbnails[data.thumbnails.length - 1].url : null),
                uploader: data.uploader || data.channel || 'Vidéo Web',
                url: cleanUrl,
                webpage_url: data.webpage_url || cleanUrl
              }
            });
          } catch (e) {
            resolve({ success: false, error: "Échec de lecture des données vidéo" });
          }
        } else {
          resolve({ success: false, error: stderr.trim() || `Erreur d'extraction vidéo (code ${code})` });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      setTimeout(() => {
        try { child.kill(); } catch (e) {}
        resolve({ success: false, error: "Délai d'attente dépassé (timeout 30s)" });
      }, 30000);
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-media', async (event, { url, title, category, startTime, endTime }) => {
  try {
    if (!url || !url.trim()) throw new Error("URL invalide ou vide");
    const cleanUrl = url.trim();

    const downloadsDir = path.join(app.getPath('userData'), 'sounds', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const ytDlp = getYtDlpPath();
    const ffmpegPath = getFfmpegPath();
    const ffmpegDir = path.dirname(ffmpegPath);

    const timestamp = Date.now();
    const safeTitle = (title || 'son')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);
    const outputTemplate = path.join(downloadsDir, `${safeTitle}_${timestamp}_%(id)s.%(ext)s`);

    const args = [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-playlist',
      '--no-warnings'
    ];

    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      args.push('--ffmpeg-location', ffmpegDir);
    }

    const hasStart = startTime !== undefined && startTime !== null && startTime !== '' && parseFloat(startTime) > 0;
    const hasEnd = endTime !== undefined && endTime !== null && endTime !== '' && parseFloat(endTime) > 0;

    if (hasStart || hasEnd) {
      const formatTime = (sec) => {
        const s = Math.max(0, parseFloat(sec) || 0);
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = (s % 60).toFixed(2);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
      };
      const startStr = formatTime(startTime || 0);
      const endStr = hasEnd ? formatTime(endTime) : 'inf';
      args.push('--download-sections', `*${startStr}-${endStr}`);
    }

    args.push('-o', outputTemplate);
    args.push(cleanUrl);

    return new Promise((resolve) => {
      const child = spawn(ytDlp, args, { windowsHide: true });
      let stderr = '';
      let stdout = '';

      child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
      child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

      child.on('close', (code) => {
        // Look for the created audio file
        const createdFiles = fs.readdirSync(downloadsDir)
          .filter(f => f.startsWith(`${safeTitle}_${timestamp}`) && (f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav') || f.endsWith('.opus')));

        if (createdFiles.length > 0) {
          const fileName = createdFiles[0];
          const filePath = path.join(downloadsDir, fileName);
          const buf = fs.readFileSync(filePath);
          const base64 = buf.toString('base64');
          const mime = fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
          const dataUrl = `data:${mime};base64,${base64}`;

          let durSec = 3;
          if (hasStart && hasEnd) {
            durSec = Math.max(1, Math.round(parseFloat(endTime) - parseFloat(startTime)));
          }
          const m = Math.floor(durSec / 60);
          const s = durSec % 60;
          const durationFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;

          resolve({
            success: true,
            sound: {
              id: `imported-${timestamp}`,
              title: title || 'Son Téléchargé',
              url: dataUrl,
              filePath,
              duration: durationFormatted,
              durationSeconds: durSec,
              hotkey: '',
              category: category || 'Mes sons',
              addedOn: new Date().toISOString().split('T')[0],
              volumeMultiplier: 1.0,
              isImported: true
            }
          });
        } else {
          resolve({ success: false, error: stderr.trim() || `Échec du téléchargement audio (code ${code})` });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      setTimeout(() => {
        try { child.kill(); } catch (e) {}
        resolve({ success: false, error: "Téléchargement trop long (timeout 60s)" });
      }, 60000);
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-trimmed-sound', async (event, { base64Data, title, durationSeconds, category }) => {
  try {
    const trimmedDir = path.join(app.getPath('userData'), 'sounds', 'trimmed');
    if (!fs.existsSync(trimmedDir)) {
      fs.mkdirSync(trimmedDir, { recursive: true });
    }

    const timestamp = Date.now();
    const safeTitle = (title || 'son_decoupe')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);
    const fileName = `${safeTitle}_${timestamp}.wav`;
    const filePath = path.join(trimmedDir, fileName);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const dataUrl = `data:audio/wav;base64,${base64Data}`;
    const dur = Math.max(1, Math.round(durationSeconds || 3));
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    const durationFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;

    return {
      success: true,
      sound: {
        id: `trimmed-${timestamp}`,
        title: title || `✂️ ${safeTitle}`,
        url: dataUrl,
        filePath,
        duration: durationFormatted,
        durationSeconds: dur,
        hotkey: '',
        category: category || 'Mes sons',
        addedOn: new Date().toISOString().split('T')[0],
        volumeMultiplier: 1.0,
        isClip: true
      }
    };
  } catch (err) {
    console.error('save-trimmed-sound error:', err.message);
    return { success: false, error: err.message };
  }
});

// ==========================================
// FREEPAD STREAM DECK MOBILE (REMOTE SERVER)
// ==========================================
function handleRemoteAction(action, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (action === 'play') {
    mainWindow.webContents.send('remote-play-sound', payload.soundId);
  } else if (action === 'stop') {
    mainWindow.webContents.send('remote-stop-sound');
  } else if (action === 'clip') {
    mainWindow.webContents.send('trigger-instant-replay', { duration: payload.seconds || 5 });
  }
}

ipcMain.handle('get-remote-info', async () => {
  return await remoteServer.getRemoteServerInfo();
});

ipcMain.on('sync-remote-sounds', (event, { sounds, categories }) => {
  remoteServer.syncSounds(sounds, categories);
});

ipcMain.on('broadcast-remote-state', (event, state) => {
  remoteServer.broadcastRemoteState(state);
});

ipcMain.handle('toggle-remote-server', async (event, enable) => {
  if (enable) {
    remoteServer.startRemoteServer(4899, handleRemoteAction);
  } else {
    remoteServer.stopRemoteServer();
  }
  return await remoteServer.getRemoteServerInfo();
});

app.whenReady().then(() => {
  // Pre-seed native binaries and launch APO bridge immediately
  setupBinaries();
  ensureApoBridgeRunning().catch(() => {});

  // Launch FreePad Stream Deck Mobile HTTP server
  try {
    remoteServer.startRemoteServer(4899, handleRemoteAction);
  } catch (err) {
    console.warn("Could not start remoteServer:", err.message);
  }

  // Strip CORS headers on all network requests so Web Audio API can fetch any sound
  if (session.defaultSession) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      headers['access-control-allow-origin'] = ['*'];
      headers['access-control-allow-methods'] = ['GET, POST, OPTIONS, HEAD'];
      headers['access-control-allow-headers'] = ['*'];
      callback({ responseHeaders: headers });
    });

    // Zero-prompt Loopback Audio capture for Discord / System Sounds
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        if (sources && sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' });
        } else {
          callback({ audio: 'loopback' });
        }
      }).catch((err) => {
        console.warn('setDisplayMediaRequestHandler error:', err.message);
        callback({});
      });
    });

    session.defaultSession.setPermissionCheckHandler(() => true);
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(true));
  }

  // Register default hotkeys: Instant Replay (F8), Instant Remix (F7), Voice Changer (F6)
  registerInstantReplayHotkey('F8');
  registerInstantRemixHotkey('F7');
  registerVoiceChangerHotkey('F6');

  createWindow();

  // Check for updates automatically 5 seconds after startup (non-blocking)
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates().catch(err => {
        console.log('[AutoUpdater] Notice:', err.message);
      });
    } catch (e) {}
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ==========================================
// AUTO-UPDATER EVENTS & IPC CHANNELS
// ==========================================
autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] Update available:', info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] App is up to date.');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-not-available', info);
  }
});

autoUpdater.on('error', (err) => {
  console.warn('[AutoUpdater] Error:', err ? err.message : err);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', err ? err.message : 'Erreur de vérification');
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] Update downloaded successfully');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const res = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: res?.updateInfo };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('start-download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('quit-and-install-update', () => {
  // Silent update: true = zero install wizard popups, true = force relaunch app updated
  autoUpdater.quitAndInstall(true, true);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try {
    remoteServer.stopRemoteServer();
  } catch (e) {}
  if (apoBridgeProcess) {
    try {
      sendApoCommand('EXIT').catch(() => {});
      apoBridgeProcess.kill();
    } catch (e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
