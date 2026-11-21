import React, { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  CheckCircle2,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  BadiniDialect,
  EmotionId,
  VoicePersona,
} from '../../types/studio';
import {
  BADINI_DIALECTS,
  EMOTION_PRESETS,
} from '../../data/badiniVoices';
import {
  downloadAudioFile,
  parseWavBase64,
} from '../../lib/audioEngine';
import { WaveformVisualizer } from '../WaveformVisualizer';

interface TTSPageProps {
  allVoices: VoicePersona[];
  initialText?: string;
  initialVoiceId?: string;
  initialDialect?: BadiniDialect;
  defaultFormat: 'wav' | 'mp3';
  defaultSpeed: number;
  adaptationEnabled: boolean;
  onSaveProject: (payload: {
    title: string;
    dialect: BadiniDialect;
    emotion: EmotionId;
    voice: VoicePersona;
    text: string;
    durationSec: number;
  }) => Promise<void>;
  onCharactersConsumed: (chars: number) => void;
  isSignedIn: boolean;
}

const SAMPLE_BADINI_SCRIPTS = [
  {
    label: 'شەڤا دهۆکێ (درامی)',
    text: 'شەڤەکا سار بوو ل باژێڕێ دهۆکێ. هەمی کۆڵان د بێدەنگ بوون، تنێ دەنگێ بارانێ ل سەر بانان دهاتە گوهلێبوون. ل وێ دەمێ دا، دەرگەهێ ماڵا کەڤن هێدی هێدی هاتە ڤەکرن.',
    emotion: 'dramatic' as EmotionId,
  },
  {
    label: 'گفتوگۆیا گەرم (دڵخۆش)',
    text: 'سپێدە باش هەڤاڵێ من! ئەڤرۆ هەوایێ زاخۆ گەلەک خۆشە و ڕۆژا مە پڕی هیڤی یە. وەرە دا پێکڤە چایەکا گەرم ل سەر پرا دەلال ڤەخۆین.',
    emotion: 'happy' as EmotionId,
  },
  {
    label: 'خەمگینی و حەسرەت',
    text: 'ئەز نوزانم بۆچی چووی و بێ خاترخواستن ئەڤ باژێڕە هێلا. هەر ڕۆژ چاڤێن من ل ڕێکا ئامێدیێ نە، بەلکو جارەکا دی دەنگێ تە ل دەرگەهی بدەت.',
    emotion: 'sad' as EmotionId,
  },
];

export const TTSPage: React.FC<TTSPageProps> = ({
  allVoices,
  initialText,
  initialVoiceId,
  initialDialect,
  defaultFormat,
  defaultSpeed,
  adaptationEnabled,
  onSaveProject,
  onCharactersConsumed,
  isSignedIn,
}) => {
  const [text, setText] = useState(
    initialText || SAMPLE_BADINI_SCRIPTS[0].text
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState(
    initialVoiceId || allVoices[0]?.id || 'zhirevan_young_male'
  );
  const [dialect, setDialect] = useState<BadiniDialect>(initialDialect || 'duhok');
  const [emotion, setEmotion] = useState<EmotionId>('dramatic');

  // Acoustic mixer controls (real-time Web Audio DSP)
  const [speed, setSpeed] = useState(defaultSpeed || 1.0);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [toneWarmth, setToneWarmth] = useState(0); // -6dB crisp to +6dB warm
  const [volume, setVolume] = useState(0.9);
  const [useAdaptation, setUseAdaptation] = useState(adaptationEnabled);

  // Generation & playback state
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [chunksCount, setChunksCount] = useState(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');

  // Web Audio playback nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const playbackAnchorTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  const activeVoice =
    allVoices.find((v) => v.id === selectedVoiceId) || allVoices[0];

  useEffect(() => {
    if (initialText) setText(initialText);
    if (initialVoiceId) setSelectedVoiceId(initialVoiceId);
    if (initialDialect) setDialect(initialDialect);
  }, [initialText, initialVoiceId, initialDialect]);

  useEffect(() => {
    if (activeVoice) {
      setPitchSemitones(activeVoice.pitchShift || 0);
    }
  }, [selectedVoiceId]);

  useEffect(() => {
    return () => {
      stopPlayback(false);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Update live parameters while playing
  useEffect(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.value = speed;
      sourceNodeRef.current.detune.value = pitchSemitones * 100;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
    if (filterNodeRef.current) {
      filterNodeRef.current.gain.value = toneWarmth;
    }
  }, [speed, pitchSemitones, toneWarmth, volume]);

  const stopPlayback = (resetOffset = true) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    if (resetOffset) {
      playbackOffsetRef.current = 0;
      setCurrentTime(0);
    }
  };

  const prepareAudioBuffer = async (b64: string) => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    const { samples, sampleRate, channels } = parseWavBase64(b64);
    const audioBuf = ctx.createBuffer(channels, samples.length / channels, sampleRate);
    const channelData = audioBuf.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = samples[i] / 32768;
    }
    audioBufferRef.current = audioBuf;
    setDurationSec(audioBuf.duration);
    return audioBuf;
  };

  const startPlaybackFromOffset = async (offsetSec: number) => {
    if (!audioBufferRef.current) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    stopPlayback(false);

    const src = ctx.createBufferSource();
    src.buffer = audioBufferRef.current;
    src.playbackRate.value = speed;
    src.detune.value = pitchSemitones * 100;

    const eq = ctx.createBiquadFilter();
    eq.type = 'lowshelf';
    eq.frequency.value = 340;
    eq.gain.value = toneWarmth;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    src.connect(eq);
    eq.connect(gain);
    gain.connect(ctx.destination);

    sourceNodeRef.current = src;
    filterNodeRef.current = eq;
    gainNodeRef.current = gain;

    const safeOffset = Math.max(0, Math.min(audioBufferRef.current.duration - 0.05, offsetSec));
    playbackOffsetRef.current = safeOffset;
    playbackAnchorTimeRef.current = ctx.currentTime;

    src.onended = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
      playbackOffsetRef.current = 0;
      setCurrentTime(0);
    };

    src.start(0, safeOffset);
    setIsPlaying(true);

    const updateProgress = () => {
      if (!audioCtxRef.current || !audioBufferRef.current) return;
      const elapsed =
        (audioCtxRef.current.currentTime - playbackAnchorTimeRef.current) * speed;
      const pos = Math.min(
        audioBufferRef.current.duration,
        playbackOffsetRef.current + elapsed
      );
      setCurrentTime(pos);
      if (pos < audioBufferRef.current.duration) {
        rafRef.current = requestAnimationFrame(updateProgress);
      }
    };
    rafRef.current = requestAnimationFrame(updateProgress);
  };

  const handleTogglePlayPause = async () => {
    if (!audioBufferRef.current) return;
    if (isPlaying) {
      if (audioCtxRef.current) {
        const elapsed =
          (audioCtxRef.current.currentTime - playbackAnchorTimeRef.current) * speed;
        playbackOffsetRef.current = Math.min(
          audioBufferRef.current.duration,
          playbackOffsetRef.current + elapsed
        );
      }
      stopPlayback(false);
    } else {
      await startPlaybackFromOffset(playbackOffsetRef.current);
    }
  };

  const handleSeekRatio = async (ratio: number) => {
    if (!audioBufferRef.current) return;
    const target = ratio * audioBufferRef.current.duration;
    playbackOffsetRef.current = target;
    setCurrentTime(target);
    if (isPlaying) {
      await startPlaybackFromOffset(target);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setErrorMsg('تکایە دەقەکێ ب زمانێ کوردی بادینی بنڤیسە.');
      return;
    }

    stopPlayback(true);
    setIsGenerating(true);
    setErrorMsg(null);
    setSavedNotice(false);

    const emotionMeta = EMOTION_PRESETS.find((e) => e.id === emotion);
    const combinedStyle = [
      activeVoice.timbrePrompt,
      emotionMeta?.stylePrompt || '',
    ]
      .filter(Boolean)
      .join('. ');

    try {
      const resp = await fetch('/api/badini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: activeVoice.baseVoice,
          style: combinedStyle,
          emotion,
          dialectRegion: dialect,
          adaptationEnabled: useAdaptation,
          lexiconRules: activeVoice.lexiconRules || [],
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'چێکرنا دەنگی سەرنەکەفت.');
      }

      setAudioBase64(data.audioBase64);
      setChunksCount(data.chunksCount || 1);
      await prepareAudioBuffer(data.audioBase64);
      onCharactersConsumed(text.trim().length);
      await startPlaybackFromOffset(0);
    } catch (err: any) {
      setErrorMsg(err?.message || 'هەڵەیەک د بەرهەمئینانا دەنگی دا ڕوویدا.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!isSignedIn || !audioBase64) return;
    setIsSaving(true);
    try {
      const finalTitle =
        projectTitle.trim() || `${activeVoice.nameKurdish} — ${text.trim().slice(0, 36)}`;
      await onSaveProject({
        title: finalTitle,
        dialect,
        emotion,
        voice: activeVoice,
        text: text.trim(),
        durationSec,
      });
      setSavedNotice(true);
      setProjectTitle('');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left/Main Column: Script Editor + Waveform Player */}
      <div className="xl:col-span-8 space-y-6">
        <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">دەقنڤێسا ستۆدیۆیا بادینی</h2>
              <p className="text-xs text-slate-400">
                دەقێن درێژ ب شێوەیەکێ خۆکار دێ ب پێلێن ڕستەیان هێنە دابەشکرن و پێکڤە گرێدان
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_BADINI_SCRIPTS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setText(s.text);
                    setEmotion(s.emotion);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="دەقێ خۆ ب کوردی بادینی ل ڤێرە بنڤیسە..."
            className="w-full rounded-xl bg-[#070910] border border-slate-800 focus:border-violet-500 p-4 text-base text-slate-100 leading-loose outline-none resize-y"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-4 font-mono-num">
              <span>{text.length} پیت (Chars)</span>
              <span>{text.trim() ? text.trim().split(/\s+/).length : 0} پەیڤ (Words)</span>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-violet-950/50 transition-all cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  دەنگ دهێتە دروستکرن...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  دروستکرنا دەنگی (Generate Badini Speech)
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Waveform Player & Export Studio */}
        <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {audioBase64
                    ? `${activeVoice.nameKurdish} — ئامادەیە بۆ گوهداریکرن و داگرتن`
                    : 'نیشاندانا پێلا دەنگی (Waveform Monitor)'}
                </h3>
                <p className="text-xs text-slate-400 font-mono-num" dir="ltr">
                  {audioBase64
                    ? `${formatTime(currentTime)} / ${formatTime(durationSec)} · ${chunksCount} segment(s)`
                    : 'Generate Badini audio to preview & export'}
                </p>
              </div>
            </div>

            {audioBase64 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadAudioFile(audioBase64, `badini-${activeVoice.id}`, 'wav')}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-violet-400" />
                  WAV
                </button>
                <button
                  onClick={() => downloadAudioFile(audioBase64, `badini-${activeVoice.id}`, 'mp3')}
                  className="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  MP3 (192kbps)
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#070910] border border-slate-800/90 p-4">
            <WaveformVisualizer
              audioBase64={audioBase64}
              progress={durationSec > 0 ? currentTime / durationSec : 0}
              isPlaying={isPlaying}
              onSeek={handleSeekRatio}
            />
          </div>

          {/* Transport Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleTogglePlayPause}
                disabled={!audioBase64}
                className="px-4 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-35 font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'وەستان (Pause)' : currentTime > 0 ? 'بەردەوامبوون (Resume)' : 'پەخشکرن (Play)'}
              </button>

              <button
                onClick={() => stopPlayback(true)}
                disabled={!audioBase64}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
                aria-label="Restart playback"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {audioBase64 && (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="ناڤێ پڕۆژەیێ (بۆ پاشەکەوتکرن)..."
                  className="flex-1 rounded-lg bg-[#070910] border border-slate-800 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleSave}
                  disabled={!isSignedIn || isSaving}
                  title={isSignedIn ? 'پاشەکەوتکرن د هەوری دا' : 'بۆ پاشەکەوتکرنێ چوونا ژوور بکە'}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {savedNotice ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      پاشەکەوت بوو
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5 text-violet-400" />
                      پاشەکەوتکرن
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Voice, Dialect, Emotion, & Acoustic Controls */}
      <div className="xl:col-span-4 space-y-5">
        <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <SlidersHorizontal className="w-4 h-4 text-violet-400" />
            ڕێکخستنا دەنگ و هەستێن بادینی
          </div>

          {/* Voice Persona Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">
              کەسایەتییا دەنگی (Voice Persona)
            </label>
            <select
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            >
              {allVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.isCustom ? '★ ' : ''}
                  {v.nameKurdish} — {v.categoryKurdish} ({v.regionLabel})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              {activeVoice.descriptionKurdish}
            </p>
          </div>

          {/* Badini Region */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">
              شێوەزارێ بادینی (Badini Dialect Region)
            </label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value as BadiniDialect)}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            >
              {BADINI_DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameKurdish}
                </option>
              ))}
            </select>
          </div>

          {/* 12 Emotion Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">
              هەستا دەنگی (12 Emotional Styles)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {EMOTION_PRESETS.map((em) => {
                const active = emotion === em.id;
                return (
                  <button
                    key={em.id}
                    onClick={() => setEmotion(em.id)}
                    className={`px-2.5 py-2 rounded-lg text-right text-xs transition-all cursor-pointer border ${
                      active
                        ? 'bg-violet-600/25 border-violet-500/50 text-white font-semibold'
                        : 'bg-[#070910] border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="truncate">{em.labelKurdish}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Acoustic DSP Sliders */}
          <div className="space-y-4 pt-2 border-t border-slate-800/70">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">لەزاتییا ئاخڤتنێ (Speed)</span>
                <span className="font-mono-num text-violet-300">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.65}
                max={1.45}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">تۆن و بەرزییا دەنگی (Pitch)</span>
                <span className="font-mono-num text-violet-300">
                  {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st
                </span>
              </div>
              <input
                type="range"
                min={-6}
                max={6}
                step={0.5}
                value={pitchSemitones}
                onChange={(e) => setPitchSemitones(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">گەرمییا تۆنێ (Tone EQ)</span>
                <span className="font-mono-num text-violet-300">
                  {toneWarmth > 0 ? `+${toneWarmth}` : toneWarmth} dB
                </span>
              </div>
              <input
                type="range"
                min={-6}
                max={6}
                step={1}
                value={toneWarmth}
                onChange={(e) => setToneWarmth(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">هێزا دەنگی (Volume)</span>
                <span className="font-mono-num text-violet-300">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.5}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <label className="flex items-center justify-between gap-3 pt-1 cursor-pointer">
              <span className="text-xs text-slate-300">
                فلتەرێ بێژەکرنا ڕەسەنا بادینی (ڤ، ژ، چ، ێ)
              </span>
              <input
                type="checkbox"
                checked={useAdaptation}
                onChange={(e) => setUseAdaptation(e.target.checked)}
                className="w-4 h-4 rounded accent-violet-600"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
