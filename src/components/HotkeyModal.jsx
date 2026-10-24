import React, { useState, useEffect } from 'react';
import { Keyboard, X, Check, Trash2 } from 'lucide-react';

export default function HotkeyModal({ sound, isOpen, onClose, onSave }) {
  const [currentKey, setCurrentKey] = useState('');
  const [isListening, setIsListening] = useState(true);

  useEffect(() => {
    if (sound) {
      setCurrentKey(sound.hotkey || '');
    }
  }, [sound]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't capture sole modifiers
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
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
      const combo = parts.join(' + ');
      setCurrentKey(combo);
      setIsListening(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  if (!isOpen || !sound) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-indigo-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Assigner un Raccourci</h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{sound.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hotkey Capture Box */}
        <div
          onClick={() => setIsListening(true)}
          className={`py-8 px-4 rounded-xl border-2 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isListening
              ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-500/20 animate-pulse'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          {currentKey ? (
            <div className="flex items-center gap-1.5 flex-wrap justify-center mb-2">
              {currentKey.split(' + ').map((k, i) => (
                <span
                  key={i}
                  className="font-mono text-lg font-bold px-3 py-1.5 rounded-lg bg-indigo-600 text-white shadow-md border border-indigo-400/50"
                >
                  {k}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm font-medium text-slate-400 mb-2">
              Appuyez sur n'importe quelle touche ou combinaison...
            </span>
          )}
          <span className="text-[11px] text-slate-500">
            {isListening ? "Écoute active... tapez votre raccourci" : "Cliquez ici pour changer le raccourci"}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 mt-6">
          <button
            onClick={() => {
              setCurrentKey('');
              onSave(sound.id, '');
              onClose();
            }}
            className="px-3 py-2 rounded-xl border border-slate-800 hover:bg-rose-950/30 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Effacer
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onSave(sound.id, currentKey);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
