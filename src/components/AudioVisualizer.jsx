import React, { useEffect, useRef } from 'react';
import soundEngine from '../audio/SoundEngine';

export default function AudioVisualizer({ isPlaying }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const freqData = soundEngine.getVisualizerData();
      const numBars = 48;
      const barWidth = (width / numBars) - 2;

      // Draw subtle background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let y = 10; y < height; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (isPlaying && freqData.length > 0) {
        // Draw frequency bars
        for (let i = 0; i < numBars; i++) {
          const index = Math.floor((i / numBars) * freqData.length * 0.7);
          const rawValue = freqData[index] || 0;
          const barHeight = Math.max(3, (rawValue / 255) * height * 0.85);

          const x = i * (barWidth + 2);
          const y = height - barHeight;

          // Gradient color
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
          grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.8)');
          grad.addColorStop(1, 'rgba(236, 72, 153, 0.95)');

          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(99, 102, 241, 0.6)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
          ctx.fill();

          // Cap on top of bar
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.fillRect(x, Math.max(0, y - 3), barWidth, 2);
        }
      } else {
        // Idle gentle waveform
        const time = Date.now() * 0.002;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let x = 0; x < width; x += 4) {
          const y = height / 2 + Math.sin(x * 0.03 + time) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  return (
    <div className="relative w-full h-16 rounded-xl overflow-hidden glass-panel flex items-center justify-center p-1 border border-indigo-500/20 shadow-inner">
      <canvas
        ref={canvasRef}
        width={600}
        height={64}
        className="w-full h-full block"
      />
      <div className="absolute top-1.5 left-3 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1.5 text-indigo-400/80">
        <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`}></span>
        {isPlaying ? 'AUDIO SPECTRUM (LIVE)' : 'STANDBY'}
      </div>
    </div>
  );
}
