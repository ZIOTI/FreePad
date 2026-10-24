const http = require('http');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

let server = null;
let currentPort = 4899;
let sseClients = [];
let cachedSounds = [];
let cachedCategories = ['Tous les sons'];
let currentPlaybackState = { isPlaying: false, soundId: null, volume: 1.0 };
let onActionCallback = null;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('169.254.') || iface.address === '127.0.0.1') continue;

        let score = 10;
        if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan')) {
          score += 100;
        } else if (lowerName.includes('ethernet')) {
          score += 50;
        }

        // Penalize virtual adapters
        if (
          lowerName.includes('virtual') ||
          lowerName.includes('vbox') ||
          lowerName.includes('vmware') ||
          lowerName.includes('host-only') ||
          iface.address.startsWith('192.168.56.') ||
          (iface.mac && iface.mac.toLowerCase().startsWith('0a:00:27'))
        ) {
          score -= 100;
        }

        candidates.push({ address: iface.address, score, name });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.length > 0 ? candidates[0].address : '127.0.0.1';
}

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((res) => {
    try {
      res.write(payload);
      return true;
    } catch (e) {
      return false;
    }
  });
}

function getMobileHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <title>FreePad Remote — Stream Deck Mobile</title>
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#030712">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%2306b6d4%22/></svg>">
  <style>
    :root {
      --bg: #030712;
      --card-bg: rgba(17, 24, 39, 0.75);
      --border: rgba(99, 102, 241, 0.2);
      --accent: #06b6d4;
      --playing: #ec4899;
      --panic: #ef4444;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    body {
      background-color: var(--bg);
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      padding-bottom: 90px;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(3, 7, 18, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: linear-gradient(135deg, #06b6d4, #6366f1, #ec4899);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.5px;
      background: linear-gradient(to right, #22d3ee, #818cf8, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .zioti-badge {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 7px;
      border-radius: 8px;
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.5);
      color: #fbbf24;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    .search-bar {
      width: 100%;
      background: rgba(17, 24, 39, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 8px 12px;
      color: #fff;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-bar:focus {
      border-color: #6366f1;
    }
    .categories {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: none;
    }
    .categories::-webkit-scrollbar {
      display: none;
    }
    .cat-chip {
      white-space: nowrap;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(31, 41, 55, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #9ca3af;
      cursor: pointer;
      transition: all 0.15s;
    }
    .cat-chip.active {
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
    .grid-container {
      padding: 14px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
      gap: 12px;
    }
    @media (min-width: 480px) {
      .grid-container {
        grid-template-columns: repeat(auto-fill, minmax(125px, 1fr));
        gap: 14px;
      }
    }
    .pad {
      aspect-ratio: 1;
      background: var(--card-bg);
      border: 2px solid var(--border);
      border-radius: 16px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    }
    .pad:active {
      transform: scale(0.92);
      filter: brightness(1.2);
    }
    .pad.playing {
      border-color: #ec4899;
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(99, 102, 241, 0.25));
      box-shadow: 0 0 24px rgba(236, 72, 153, 0.5), inset 0 0 12px rgba(236, 72, 153, 0.3);
      animation: padGlow 1.2s infinite alternate;
    }
    @keyframes padGlow {
      from { box-shadow: 0 0 15px rgba(236, 72, 153, 0.4); }
      to { box-shadow: 0 0 28px rgba(236, 72, 153, 0.7); }
    }
    .pad-hotkey {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.08);
      color: #a5b4fc;
      align-self: flex-start;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .pad-icon {
      font-size: 26px;
      margin: 4px 0;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
    }
    .pad-title {
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      color: #e5e7eb;
      max-height: 2.4em;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }
    .pad-playing-indicator {
      display: none;
      align-items: center;
      gap: 2px;
      height: 12px;
    }
    .pad.playing .pad-playing-indicator {
      display: flex;
    }
    .pad.playing .pad-icon {
      display: none;
    }
    .bar {
      width: 3px;
      height: 100%;
      background: #ec4899;
      border-radius: 2px;
      animation: barJump 0.6s infinite ease-in-out alternate;
    }
    .bar:nth-child(2) { animation-delay: 0.15s; }
    .bar:nth-child(3) { animation-delay: 0.3s; }
    .bar:nth-child(4) { animation-delay: 0.45s; }
    @keyframes barJump {
      from { height: 3px; }
      to { height: 14px; }
    }
    .bottom-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: rgba(3, 7, 18, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.6);
    }
    .btn-panic {
      flex: 1;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: 1px solid rgba(239, 68, 68, 0.6);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
      transition: all 0.1s;
    }
    .btn-panic:active {
      transform: scale(0.95);
      filter: brightness(1.2);
    }
    .btn-clip {
      height: 48px;
      padding: 0 16px;
      border-radius: 14px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border: 1px solid rgba(99, 102, 241, 0.5);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
      transition: all 0.1s;
    }
    .btn-clip:active {
      transform: scale(0.95);
    }
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }
    .empty-icon {
      font-size: 40px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>

  <header>
    <div class="header-top">
      <div class="brand">
        <div class="brand-logo">⚡</div>
        <div>
          <div class="brand-title">FreePad Remote</div>
          <div class="zioti-badge">👑 Fait par zioti</div>
        </div>
      </div>
      <div id="statusBadge" class="status-badge">
        <div class="status-dot"></div>
        <span id="statusText">En direct</span>
      </div>
    </div>

    <input type="text" id="searchInput" class="search-bar" placeholder="Rechercher un son ou un raccourci...">

    <div class="categories" id="categoryChips"></div>
  </header>

  <main class="grid-container" id="padsGrid"></main>

  <footer class="bottom-bar">
    <button class="btn-panic" id="panicBtn" onclick="stopAllSounds()">
      <span style="font-size: 18px;">⏹️</span>
      <span>ARRÊTER TOUT</span>
    </button>
    <button class="btn-clip" onclick="triggerClip(5)">
      <span style="font-size: 16px;">✂️</span>
      <span>F8 CLIP (5s)</span>
    </button>
  </footer>

  <script>
    let allSounds = [];
    let allCategories = ['Tous les sons'];
    let currentCategory = 'Tous les sons';
    let currentPlayingId = null;
    let searchQuery = '';

    function vibrate(ms = 40) {
      if (window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate(ms); } catch (e) {}
      }
    }

    async function loadSounds() {
      try {
        const res = await fetch('/api/sounds');
        const data = await res.json();
        allSounds = data.sounds || [];
        allCategories = data.categories || ['Tous les sons'];
        currentPlayingId = data.currentPlayingId || null;
        renderCategories();
        renderGrid();
      } catch (err) {
        console.warn('Erreur chargement sons:', err);
      }
    }

    function renderCategories() {
      const container = document.getElementById('categoryChips');
      container.innerHTML = allCategories.map(cat => \`
        <div class="cat-chip \${cat === currentCategory ? 'active' : ''}" onclick="selectCategory('\${cat.replace(/'/g, "\\\\'")}')">
          \${cat}
        </div>
      \`).join('');
    }

    function selectCategory(cat) {
      vibrate(20);
      currentCategory = cat;
      renderCategories();
      renderGrid();
    }

    function getEmojiForCategory(cat) {
      const c = (cat || '').toLowerCase();
      if (c.includes('mème') || c.includes('meme')) return '🐸';
      if (c.includes('humour') || c.includes('rire')) return '😂';
      if (c.includes('effet') || c.includes('fx')) return '💥';
      if (c.includes('jeu') || c.includes('game')) return '🎮';
      if (c.includes('anime') || c.includes('manga')) return '⚡';
      if (c.includes('clip')) return '✂️';
      if (c.includes('tts') || c.includes('voix')) return '🗣️';
      return '🎵';
    }

    function renderGrid() {
      const grid = document.getElementById('padsGrid');
      const filtered = allSounds.filter(s => {
        const matchesCat = currentCategory === 'Tous les sons' || s.category === currentCategory;
        const matchesSearch = !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.hotkey && s.hotkey.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCat && matchesSearch;
      });

      if (filtered.length === 0) {
        grid.innerHTML = \`
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>Aucun son trouvé</p>
          </div>
        \`;
        return;
      }

      grid.innerHTML = filtered.map(sound => {
        const isPlaying = sound.id === currentPlayingId;
        const emoji = getEmojiForCategory(sound.category);
        return \`
          <div class="pad \${isPlaying ? 'playing' : ''}" onclick="playSound('\${sound.id}')" id="pad-\${sound.id}">
            <div class="pad-hotkey">\${sound.hotkey || 'PAD'}</div>
            <div class="pad-icon">\${emoji}</div>
            <div class="pad-playing-indicator">
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
            </div>
            <div class="pad-title">\${sound.title}</div>
          </div>
        \`;
      }).join('');
    }

    async function playSound(id) {
      vibrate(40);
      try {
        const pad = document.getElementById('pad-' + id);
        if (pad) {
          pad.classList.add('playing');
        }
        await fetch('/api/play/' + id, { method: 'POST' });
      } catch (err) {
        console.warn('Erreur lecture son:', err);
      }
    }

    async function stopAllSounds() {
      vibrate(80);
      try {
        currentPlayingId = null;
        document.querySelectorAll('.pad.playing').forEach(p => p.classList.remove('playing'));
        await fetch('/api/stop', { method: 'POST' });
      } catch (err) {
        console.warn('Erreur stop:', err);
      }
    }

    async function triggerClip(seconds) {
      vibrate([40, 40, 80]);
      try {
        await fetch('/api/clip/' + seconds, { method: 'POST' });
      } catch (err) {
        console.warn('Erreur clip:', err);
      }
    }

    document.getElementById('searchInput').addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderGrid();
    });

    // Server-Sent Events (SSE) for Real-Time PC Sync
    function initSSE() {
      const evtSource = new EventSource('/api/events');

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'sync-sounds') {
            allSounds = data.sounds || [];
            allCategories = data.categories || ['Tous les sons'];
            renderCategories();
            renderGrid();
          } else if (data.type === 'state') {
            currentPlayingId = data.isPlaying ? data.soundId : null;
            document.querySelectorAll('.pad').forEach(pad => {
              if (pad.id === 'pad-' + currentPlayingId) {
                pad.classList.add('playing');
              } else {
                pad.classList.remove('playing');
              }
            });
          }
        } catch (e) {
          console.warn('SSE parse error:', e);
        }
      };

      evtSource.onopen = () => {
        document.getElementById('statusText').innerText = 'En direct';
        document.getElementById('statusBadge').style.borderColor = 'rgba(16, 185, 129, 0.4)';
      };

      evtSource.onerror = () => {
        document.getElementById('statusText').innerText = 'Reconnexion...';
        document.getElementById('statusBadge').style.borderColor = 'rgba(239, 68, 68, 0.4)';
        evtSource.close();
        setTimeout(initSSE, 2000);
      };
    }

    // Initialize
    loadSounds();
    initSSE();
  </script>
</body>
</html>`;
}

function startRemoteServer(port = 4899, onAction = null) {
  if (server) return;
  currentPort = port;
  onActionCallback = onAction;

  server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || '/';

    // 1. Serve Mobile Web App
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getMobileHtml());
      return;
    }

    // 2. API Info
    if (url === '/api/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        active: true,
        ip: getLocalIpAddress(),
        port: currentPort,
        url: `http://${getLocalIpAddress()}:${currentPort}`,
        clientsCount: sseClients.length
      }));
      return;
    }

    // 3. API Sounds List
    if (url === '/api/sounds') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sounds: cachedSounds,
        categories: cachedCategories,
        currentPlayingId: currentPlaybackState.isPlaying ? currentPlaybackState.soundId : null
      }));
      return;
    }

    // 4. API Play Sound
    if (url.startsWith('/api/play/') && req.method === 'POST') {
      const soundId = decodeURIComponent(url.substring('/api/play/'.length));
      if (onActionCallback) {
        onActionCallback('play', { soundId });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, soundId }));
      return;
    }

    // 5. API Stop All Sounds
    if (url === '/api/stop' && req.method === 'POST') {
      if (onActionCallback) {
        onActionCallback('stop');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // 6. API Trigger Instant Replay Clip
    if (url.startsWith('/api/clip/') && req.method === 'POST') {
      const seconds = parseInt(url.substring('/api/clip/'.length), 10) || 5;
      if (onActionCallback) {
        onActionCallback('clip', { seconds });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, seconds }));
      return;
    }

    // 7. Real-Time Server-Sent Events (SSE)
    if (url === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('\n');
      sseClients.push(res);

      // Send initial state immediately
      res.write(`data: ${JSON.stringify({ type: 'sync-sounds', sounds: cachedSounds, categories: cachedCategories })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'state', ...currentPlaybackState })}\n\n`);

      req.on('close', () => {
        sseClients = sseClients.filter((c) => c !== res);
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(currentPort, '0.0.0.0', () => {
    console.log(`[FreePadRemote] Stream Deck Mobile server running on http://${getLocalIpAddress()}:${currentPort}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      currentPort++;
      console.warn(`[FreePadRemote] Port in use, trying ${currentPort}...`);
      server.listen(currentPort, '0.0.0.0');
    } else {
      console.error('[FreePadRemote] Server error:', err.message);
    }
  });
}

function stopRemoteServer() {
  if (server) {
    sseClients.forEach((res) => {
      try { res.end(); } catch (e) {}
    });
    sseClients = [];
    server.close();
    server = null;
  }
}

async function getRemoteServerInfo() {
  const ip = getLocalIpAddress();
  const url = `http://${ip}:${currentPort}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(url, {
      margin: 1.5,
      width: 256,
      color: {
        dark: '#030712',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.warn('QR Code generation error:', err);
  }

  return {
    active: !!server,
    ip,
    port: currentPort,
    url,
    qrDataUrl,
    clientsCount: sseClients.length
  };
}

function syncSounds(sounds, categories = null) {
  cachedSounds = sounds || [];
  if (categories) cachedCategories = categories;
  broadcastSSE({
    type: 'sync-sounds',
    sounds: cachedSounds,
    categories: cachedCategories
  });
}

function broadcastRemoteState(state) {
  currentPlaybackState = { ...currentPlaybackState, ...state };
  broadcastSSE({
    type: 'state',
    ...currentPlaybackState
  });
}

module.exports = {
  startRemoteServer,
  stopRemoteServer,
  getRemoteServerInfo,
  syncSounds,
  broadcastRemoteState
};
