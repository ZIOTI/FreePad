import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Radio,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Power
} from 'lucide-react';

export default function RemoteControlModal({ isOpen, onClose }) {
  const [remoteInfo, setRemoteInfo] = useState({
    active: false,
    url: '',
    ip: '',
    port: 4899,
    qrDataUrl: '',
    clientsCount: 0
  });
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInfo = async () => {
    if (window.electronAPI?.getRemoteInfo) {
      try {
        const info = await window.electronAPI.getRemoteInfo();
        setRemoteInfo(info);
      } catch (err) {
        console.warn('Failed to get remote info:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInfo();
      const interval = setInterval(fetchInfo, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (remoteInfo.url) {
      navigator.clipboard.writeText(remoteInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggle = async () => {
    if (window.electronAPI?.toggleRemoteServer) {
      setIsLoading(true);
      try {
        const info = await window.electronAPI.toggleRemoteServer(!remoteInfo.active);
        setRemoteInfo(info);
      } catch (err) {
        console.warn('Failed to toggle remote server:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-950/60 p-6 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Stream Deck Mobile</h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300">
                  👑 Fait par zioti
                </span>
              </div>
              <p className="text-xs text-slate-400">Contrôle tes sons en direct depuis ton smartphone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status bar */}
        <div className="mt-5 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${remoteInfo.active ? 'bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse' : 'bg-slate-600'}`} />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{remoteInfo.active ? 'Serveur Wi-Fi Actif' : 'Serveur Désactivé'}</span>
                {remoteInfo.clientsCount > 0 && (
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    📱 {remoteInfo.clientsCount} connecté{remoteInfo.clientsCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Port local : {remoteInfo.port}</p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              remoteInfo.active
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{remoteInfo.active ? 'Arrêter' : 'Démarrer'}</span>
          </button>
        </div>

        {/* QR Code and Connection Section */}
        {remoteInfo.active ? (
          <div className="mt-5 flex flex-col items-center text-center relative z-10">
            {/* QR Card */}
            <div className="p-3 bg-white rounded-2xl shadow-xl shadow-cyan-500/10 border-4 border-cyan-400/30 mb-4 inline-block">
              {remoteInfo.qrDataUrl ? (
                <img
                  src={remoteInfo.qrDataUrl}
                  alt="QR Code Stream Deck Mobile"
                  className="w-48 h-48 block rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-lg">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              )}
            </div>

            {/* URL Display */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 mb-4">
              <span className="font-mono text-xs text-cyan-300 pl-2 truncate select-all font-bold">
                {remoteInfo.url}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                  title="Copier le lien"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié !' : 'Copier'}</span>
                </button>
                <a
                  href={remoteInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Tester dans un nouvel onglet"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* How to use */}
            <div className="w-full text-left bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3.5 text-xs text-slate-300 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-cyan-400">
                <Wifi className="w-4 h-4" />
                <span>Comment ça marche ?</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 pl-1 leading-relaxed">
                <li>Vérifie que ton smartphone est sur le <strong className="text-white">même Wi-Fi</strong> que ton PC.</li>
                <li>Ouvre l'appareil photo de ton téléphone et scanne le QR code ci-dessus.</li>
                <li>Ton téléphone se transforme instantanément en <strong className="text-cyan-300">Stream Deck tactile</strong> !</li>
              </ol>

              <div className="mt-1 pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-[10px] text-amber-300/90 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Astuce Plein Écran :</strong> Sur Safari (iPhone) ou Chrome (Android), clique sur <em>"Partager &gt; Sur l'écran d'accueil"</em> pour l'avoir en vraie appli sans barre d'adresse !
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="my-8 text-center py-6 text-slate-400">
            <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-300 mb-1">Le serveur est actuellement en pause</p>
            <p className="text-xs text-slate-500">Clique sur "Démarrer" pour générer ton QR code Stream Deck</p>
          </div>
        )}
      </div>
    </div>
  );
}
