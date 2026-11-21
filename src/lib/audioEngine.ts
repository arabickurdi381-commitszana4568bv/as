import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Decode a base64 WAV string to Int16 PCM samples + sampleRate
 */
export function parseWavBase64(base64Wav: string): {
  samples: Int16Array;
  sampleRate: number;
  channels: number;
} {
  const binaryString = atob(base64Wav);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const view = new DataView(bytes.buffer);
  const channels = view.byteLength >= 24 ? view.getUint16(22, true) : 1;
  const sampleRate = view.byteLength >= 28 ? view.getUint32(24, true) : 24000;
  const headerSize = 44;
  const pcmByteLength = Math.max(0, bytes.byteLength - headerSize);
  const sampleCount = Math.floor(pcmByteLength / 2);
  const samples = new Int16Array(bytes.buffer, headerSize, sampleCount);

  return { samples, sampleRate, channels };
}

/**
 * Convert base64 WAV (24kHz mono 16-bit) directly into a genuine MP3 Blob
 */
export function wavBase64ToMp3Blob(base64Wav: string, kbps = 192): Blob {
  const { samples, sampleRate, channels } = parseWavBase64(base64Wav);
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }
  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(endBuf));
  }

  const blobParts: BlobPart[] = mp3Chunks.map(
    (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
  );
  return new Blob(blobParts, { type: 'audio/mp3' });
}

/**
 * Convert base64 WAV to a WAV Blob
 */
export function wavBase64ToBlob(base64Wav: string): Blob {
  const binary = atob(base64Wav);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/**
 * Concatenate multiple WAV segments with exact silence pauses (in seconds) into one seamless WAV base64
 */
export function concatWavBase64WithPauses(
  segments: { base64Wav: string; pauseAfterSec: number }[]
): { base64Wav: string; durationSec: number } {
  if (segments.length === 0) {
    return { base64Wav: '', durationSec: 0 };
  }

  const firstInfo = parseWavBase64(segments[0].base64Wav);
  const sampleRate = firstInfo.sampleRate || 24000;
  const channels = firstInfo.channels || 1;
  const parts: Int16Array[] = [];
  let totalSamples = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.base64Wav) continue;
    const { samples } = parseWavBase64(seg.base64Wav);
    parts.push(samples);
    totalSamples += samples.length;

    // Add silence buffer after segment (except optional trailing pause)
    if (seg.pauseAfterSec > 0 && i < segments.length - 1) {
      const pauseSamplesCount = Math.floor(seg.pauseAfterSec * sampleRate * channels);
      const silence = new Int16Array(pauseSamplesCount);
      parts.push(silence);
      totalSamples += pauseSamplesCount;
    }
  }

  const dataByteSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataByteSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); // byte rate
  view.setUint16(32, channels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataByteSize, true);

  const outSamples = new Int16Array(buffer, 44, totalSamples);
  let offset = 0;
  for (const part of parts) {
    outSamples.set(part, offset);
    offset += part.length;
  }

  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkLen = 8192;
  for (let i = 0; i < bytes.length; i += chunkLen) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkLen));
  }

  return {
    base64Wav: btoa(binary),
    durationSec: Number((totalSamples / (sampleRate * channels)).toFixed(2)),
  };
}

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Trigger browser file download for WAV or MP3
 */
export function downloadAudioFile(
  base64Wav: string,
  filenameBase: string,
  format: 'wav' | 'mp3'
) {
  const blob =
    format === 'mp3'
      ? wavBase64ToMp3Blob(base64Wav)
      : wavBase64ToBlob(base64Wav);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Procedural Studio Ambience & SFX Generator using pure Web Audio API
 * Provides authentic background pads and sound effects with zero broken external audio links.
 */
export class StudioAmbienceEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private activeIntervals: number[] = [];

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.22;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.08);
    }
  }

  public startAmbience(musicPreset: string, sfxPreset: string, volume = 0.22) {
    this.stop();
    if (musicPreset === 'none' && sfxPreset === 'none') return;

    const ctx = this.ensureContext();
    this.setVolume(volume);

    if (musicPreset !== 'none') {
      this.spawnMusicBed(ctx, musicPreset);
    }
    if (sfxPreset !== 'none') {
      this.spawnSfxBed(ctx, sfxPreset);
    }
  }

  private spawnMusicBed(ctx: AudioContext, preset: string) {
    if (!this.masterGain) return;
    const freqs =
      preset === 'oud_calm'
        ? [146.83, 220.0, 293.66] // D minor / Kurd modal drone
        : preset === 'doc_strings'
        ? [110.0, 164.81, 220.0] // Deep A minor bed
        : preset === 'romantic_piano'
        ? [196.0, 246.94, 293.66, 392.0] // Warm Gmaj7 pad
        : [98.0, 146.83, 155.56]; // Dramatic G minor tension

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.value = f;

      filter.type = 'lowpass';
      filter.frequency.value = preset === 'tension_pulse' ? 420 : 680;

      gain.gain.value = 0.14 / freqs.length;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      this.activeNodes.push(osc, filter, gain);
    });
  }

  private spawnSfxBed(ctx: AudioContext, sfx: string) {
    if (!this.masterGain) return;

    if (sfx === 'duhok_rain' || sfx === 'mountain_wind' || sfx === 'fireplace') {
      // Filtered pink-ish noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = sfx === 'mountain_wind' ? 'bandpass' : 'lowpass';
      filter.frequency.value = sfx === 'duhok_rain' ? 1400 : sfx === 'mountain_wind' ? 460 : 950;
      filter.Q.value = sfx === 'mountain_wind' ? 3.5 : 0.8;

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = sfx === 'fireplace' ? 0.35 : 0.28;

      noise.connect(filter);
      filter.connect(sfxGain);
      sfxGain.connect(this.masterGain);
      noise.start();
      this.activeNodes.push(noise, filter, sfxGain);
    } else if (sfx === 'heartbeat') {
      const triggerBeat = () => {
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        [0, 0.24].forEach((offset, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(idx === 0 ? 64 : 52, now + offset);
          osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.18);
          gain.gain.setValueAtTime(0.001, now + offset);
          gain.gain.linearRampToValueAtTime(idx === 0 ? 0.65 : 0.42, now + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + offset);
          osc.stop(now + offset + 0.24);
        });
      };
      triggerBeat();
      const id = window.setInterval(triggerBeat, 1100);
      this.activeIntervals.push(id);
    }
  }

  public stop() {
    this.activeIntervals.forEach((id) => clearInterval(id));
    this.activeIntervals = [];
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch {
        // ignore stopped nodes
      }
    });
    this.activeNodes = [];
  }
}
