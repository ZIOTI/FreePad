import React, { useState, useEffect } from 'react';
import { Sparkles, Download, CheckCircle2, AlertCircle, X, RefreshCw, ArrowUpRight } from 'lucide-react';

export default function UpdateModal({ isOpen, onClose, updateInfo }) {
  const [status, setStatus] = useState('available'); // 'available' | 'downloading' | 'downloaded' | 'error'
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [transferred, setTransferred] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentVersion, setCurrentVersion] = useState('1.0.0');

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(v => {
        if (v) setCurrentVersion(v);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unregProgress = window.electronAPI.onUpdateProgress?.((prog) => {
      setStatus('downloading');
      setProgress(Math.round(prog.percent || 0));
      if (prog.bytesPerSecond) {
        const mbps = (prog.bytesPerSecond / (1024 * 1024)).toFixed(1);
        setDownloadSpeed(`${mbps} Mo/s`);
      }
      if (prog.transferred && prog.total) {
        const transMb = (prog.transferred / (1024 * 1024)).toFixed(1);
        const totalMb = (prog.total / (1024 * 1024)).toFixed(1);
        setTransferred(`${transMb} / ${totalMb} Mo`);
      }
    });

    const unregDownloaded = window.electronAPI.onUpdateDownloaded?.(() => {
      setStatus('downloaded');
      setProgress(100);
    });

    const unregError = window.electronAPI.onUpdateError?.((err) => {
      setStatus('error');
      setErrorMessage(typeof err === 'string' ? err : 'Impossible de télécharger la mise à jour.');
    });

    return () => {
      if (unregProgress) unregProgress();
      if (unregDownloaded) unregDownloaded();
      if (unregError) unregError();
    };
  }, []);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    setStatus('downloading');
    setProgress(0);
    if (window.electronAPI?.startDownloadUpdate) {
      const res = await window.electronAPI.startDownloadUpdate();
      if (!res?.success && res?.error) {
        setStatus('error');
        setErrorMessage(res.error);
      }
    }
  };

  const handleQuitAndInstall = () => {
    if (window.electronAPI?.quitAndInstallUpdate) {
      window.electronAPI.quitAndInstallUpdate();
    }
  };

  const newVersion = updateInfo?.version || 'Nouvelle version';
  const releaseNotes = updateInfo?.releaseNotes || updateInfo?.releaseName || 'Améliorations de performances, nouveaux sons et correctifs audio.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md p-6 bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Mise à jour disponible
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono border border-cyan-500/30">
                  v{newVersion}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Version actuelle : <span className="font-mono text-slate-300">v{currentVersion}</span>
              </p>
            </div>
          </div>
          {status !== 'downloading' && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Release Notes / Description */}
        <div className="my-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 max-h-36 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
            Nouveautés dans cette version :
          </p>
          <div
            className="text-xs text-slate-400 leading-relaxed space-y-1"
            dangerouslySetInnerHTML={{ __html: typeof releaseNotes === 'string' ? releaseNotes : 'Mise à jour officielle de FreePad.' }}
          />
        </div>

        {/* Progress or Status */}
        {status === 'downloading' && (
          <div className="my-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Téléchargement en cours...
              </span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>{transferred}</span>
              <span>{downloadSpeed}</span>
            </div>
          </div>
        )}

        {status === 'downloaded' && (
          <div className="my-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>La mise à jour est prête ! Elle sera appliquée au redémarrage de FreePad.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="my-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-red-400 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="truncate">{errorMessage || 'Erreur lors du téléchargement.'}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          {status !== 'downloading' && status !== 'downloaded' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Plus tard
            </button>
          )}

          {status === 'available' && (
            <button
              onClick={handleStartDownload}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Download className="w-4 h-4" />
              Télécharger la mise à jour
            </button>
          )}

          {status === 'downloading' && (
            <div className="text-xs text-slate-400 italic">
              Veuillez patienter...
            </div>
          )}

          {status === 'downloaded' && (
            <button
              onClick={handleQuitAndInstall}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-500/25 transition-all animate-bounce"
            >
              <RefreshCw className="w-4 h-4" />
              Redémarrer et Installer
            </button>
          )}

          {status === 'error' && (
            <button
              onClick={handleStartDownload}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Réessayer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
