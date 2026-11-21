import React, { useEffect, useMemo, useRef } from 'react';
import { parseWavBase64 } from '../lib/audioEngine';

interface WaveformVisualizerProps {
  audioBase64: string | null;
  progress: number; // 0..1
  isPlaying: boolean;
  onSeek?: (ratio: number) => void;
  height?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  audioBase64,
  progress,
  isPlaying,
  onSeek,
  height = 84,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Extract normalized bar peaks from real PCM samples
  const peaks = useMemo(() => {
    const barCount = 72;
    if (!audioBase64) {
      return Array.from({ length: barCount }, (_, i) =>
        0.12 + 0.08 * Math.abs(Math.sin(i * 0.45))
      );
    }
    try {
      const { samples } = parseWavBase64(audioBase64);
      if (samples.length === 0) {
        return Array.from({ length: barCount }, () => 0.15);
      }
      const step = Math.max(1, Math.floor(samples.length / barCount));
      const result: number[] = [];
      for (let b = 0; b < barCount; b++) {
        let maxAbs = 0;
        const start = b * step;
        const end = Math.min(samples.length, start + step);
        // Sample strided inside block for speed
        const stride = Math.max(1, Math.floor((end - start) / 30));
        for (let i = start; i < end; i += stride) {
          const val = Math.abs(samples[i]) / 32768;
          if (val > maxAbs) maxAbs = val;
        }
        result.push(Math.max(0.08, Math.min(1, maxAbs * 1.35)));
      }
      return result;
    } catch {
      return Array.from({ length: barCount }, () => 0.25);
    }
  }, [audioBase64]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const count = peaks.length;
    const gap = 3;
    const barW = Math.max(2, (width - (count - 1) * gap) / count);
    const midY = height / 2;

    peaks.forEach((amp, i) => {
      const x = i * (barW + gap);
      const ratio = i / count;
      const barH = Math.max(4, amp * (height - 12));
      const y = midY - barH / 2;

      const isPassed = ratio <= progress;
      if (audioBase64) {
        if (isPassed) {
          const grad = ctx.createLinearGradient(0, y, 0, y + barH);
          grad.addColorStop(0, '#a78bfa');
          grad.addColorStop(1, '#3b82f6');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = isPlaying
            ? 'rgba(139, 92, 246, 0.28)'
            : 'rgba(148, 163, 184, 0.22)';
        }
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, Math.min(3, barW / 2));
      ctx.fill();
    });
  }, [peaks, progress, isPlaying, audioBase64, height]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !audioBase64) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio);
  };

  return (
    <div dir="ltr" className="w-full relative select-none">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ height: `${height}px` }}
        className={`w-full block ${audioBase64 && onSeek ? 'cursor-pointer' : 'cursor-default'}`}
      />
    </div>
  );
};
