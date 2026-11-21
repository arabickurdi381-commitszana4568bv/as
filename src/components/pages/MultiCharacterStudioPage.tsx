import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  Music2,
  Pause,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  UserPlus,
  Wand2,
} from 'lucide-react';
import {
  BadiniDialect,
  EmotionId,
  StoryCharacter,
  StoryLine,
  VoicePersona,
} from '../../types/studio';
import {
  BADINI_DIALECTS,
  BG_MUSIC_PRESETS,
  EMOTION_PRESETS,
  SFX_PRESETS,
} from '../../data/badiniVoices';
import {
  concatWavBase64WithPauses,
  downloadAudioFile,
  StudioAmbienceEngine,
} from '../../lib/audioEngine';
import { WaveformVisualizer } from '../WaveformVisualizer';

interface MultiCharacterStudioPageProps {
  allVoices: VoicePersona[];
  initialData?: {
    title: string;
    category: string;
    dialect: BadiniDialect;
    bgMusicPreset: string;
    sfxPreset: string;
    characters: StoryCharacter[];
    lines: StoryLine[];
  } | null;
  defaultFormat: 'wav' | 'mp3';
  adaptationEnabled: boolean;
  isSignedIn: boolean;
  onSaveProject: (payload: {
    title: string;
    category: string;
    dialect: BadiniDialect;
    bgMusicPreset: string;
    sfxPreset: string;
    totalDurationSec: number;
    lines: StoryLine[];
  }) => Promise<void>;
  onCharactersConsumed: (chars: number) => void;
}

const DEFAULT_CHARACTERS: StoryCharacter[] = [
  {
    id: 'narrator',
    name: 'ڤەگێڕ (Narrator)',
    roleLabel: 'گێڕەرەوێ سەرەکی',
    voiceId: 'serdar_deep_narrator',
    defaultEmotion: 'serious',
  },
  {
    id: 'man',
    name: 'ئاراز (Young Man)',
    roleLabel: 'گەنجێ نێر',
    voiceId: 'araz_emotional_male',
    defaultEmotion: 'sad',
  },
  {
    id: 'woman',
    name: 'نارین (Young Woman)',
    roleLabel: 'کچا گەنج',
    voiceId: 'narin_emotional_female',
    defaultEmotion: 'crying',
  },
];

const DEFAULT_LINES: StoryLine[] = [
  {
    id: 'demo_1',
    characterId: 'narrator',
    characterName: 'ڤەگێڕ (Narrator)',
    voiceId: 'serdar_deep_narrator',
    emotion: 'dramatic',
    pauseAfterSec: 1.0,
    isNarration: true,
    text: 'شەڤەکا سار و بارانبارین بوو ل باژێڕێ دهۆکێ...',
  },
  {
    id: 'demo_2',
    characterId: 'man',
    characterName: 'ئاراز (Young Man)',
    voiceId: 'araz_emotional_male',
    emotion: 'sad',
    pauseAfterSec: 0.9,
    isNarration: false,
    text: 'ل کیڤە بووی؟ ئەز ژ سپێدێ وەرە ل هیڤیا تە بووم.',
  },
  {
    id: 'demo_3',
    characterId: 'woman',
    characterName: 'نارین (Young Woman)',
    voiceId: 'narin_emotional_female',
    emotion: 'crying',
    pauseAfterSec: 1.2,
    isNarration: false,
    text: 'ببورە... من نەدزانی دێ چاوا بۆ تە بێژم.',
  },
];

export const MultiCharacterStudioPage: React.FC<MultiCharacterStudioPageProps> = ({
  allVoices,
  initialData,
  adaptationEnabled,
  isSignedIn,
  onSaveProject,
  onCharactersConsumed,
}) => {
  const [projectTitle, setProjectTitle] = useState(
    initialData?.title || 'شەڤا دهۆکێ — دراما فرە-کەسایەتی'
  );
  const [category, setCategory] = useState(initialData?.category || 'دراما و دیالۆگ');
  const [dialect, setDialect] = useState<BadiniDialect>(initialData?.dialect || 'duhok');
  const [characters, setCharacters] = useState<StoryCharacter[]>(
    initialData?.characters?.length ? initialData.characters : DEFAULT_CHARACTERS
  );
  const [lines, setLines] = useState<StoryLine[]>(
    initialData?.lines?.length ? initialData.lines : DEFAULT_LINES
  );

  // Add character inputs
  const [newCharName, setNewCharName] = useState('');
  const [newCharVoiceId, setNewCharVoiceId] = useState(allVoices[0]?.id || 'zhirevan_young_male');

  // Auto-Parse Script panel
  const [showParser, setShowParser] = useState(false);
  const [rawScript, setRawScript] = useState(
    `Narrator: It was a cold night in Duhok...\nMan: Where have you been? I have been waiting for you.\nWoman: I am sorry... I did not know how to tell you.`
  );
  const [isParsing, setIsParsing] = useState(false);

  // Ambience Mixer
  const [bgMusicPreset, setBgMusicPreset] = useState(
    initialData?.bgMusicPreset || 'oud_calm'
  );
  const [sfxPreset, setSfxPreset] = useState(initialData?.sfxPreset || 'duhok_rain');
  const [ambienceVol, setAmbienceVol] = useState(0.18);
  const ambienceRef = useRef<StudioAmbienceEngine | null>(null);

  // Synthesis & Master Audio state
  const [synthesizingLineId, setSynthesizingLineId] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [masterAudioBase64, setMasterAudioBase64] = useState<string | null>(null);
  const [masterDurationSec, setMasterDurationSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Transport state
  const [playingLineId, setPlayingLineId] = useState<string | null>(null);
  const [isMasterPlaying, setIsMasterPlaying] = useState(false);
  const [masterProgress, setMasterProgress] = useState(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const masterTimerRef = useRef<number | null>(null);

  // Optional live mic recording override per line
  const [recordingLineId, setRecordingLineId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    if (initialData) {
      setProjectTitle(initialData.title);
      setCategory(initialData.category || 'چیرۆکا بادینی');
      setDialect(initialData.dialect || 'duhok');
      setBgMusicPreset(initialData.bgMusicPreset || 'oud_calm');
      setSfxPreset(initialData.sfxPreset || 'none');
      if (initialData.characters.length > 0) setCharacters(initialData.characters);
      if (initialData.lines.length > 0) setLines(initialData.lines);
      setMasterAudioBase64(null);
      setMasterDurationSec(0);
      setSavedOk(false);
    }
  }, [initialData]);

  useEffect(() => {
    ambienceRef.current = new StudioAmbienceEngine();
    return () => {
      stopAllAudio();
      ambienceRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    ambienceRef.current?.setVolume(ambienceVol);
  }, [ambienceVol]);

  const stopAllAudio = () => {
    if (masterTimerRef.current) {
      clearInterval(masterTimerRef.current);
      masterTimerRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
    ambienceRef.current?.stop();
    setPlayingLineId(null);
    setIsMasterPlaying(false);
    setMasterProgress(0);
  };

  const getVoiceForLine = (line: StoryLine): VoicePersona => {
    return (
      allVoices.find((v) => v.id === line.voiceId) ||
      allVoices[0]
    );
  };

  const synthesizeLine = async (line: StoryLine): Promise<{ audioBase64: string; durationSec: number }> => {
    const voice = getVoiceForLine(line);
    const emotionMeta = EMOTION_PRESETS.find((e) => e.id === line.emotion);
    const style = [
      voice.timbrePrompt,
      line.isNarration ? 'Narrator storytelling projection' : 'Natural conversational drama dialogue',
      emotionMeta?.stylePrompt || '',
    ]
      .filter(Boolean)
      .join('. ');

    const resp = await fetch('/api/badini/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: line.text.trim(),
        voice: voice.baseVoice,
        style,
        emotion: line.emotion,
        dialectRegion: dialect,
        adaptationEnabled,
        lexiconRules: voice.lexiconRules || [],
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'دروستکرنا دەنگێ دیمەنی سەرنەکەفت.');
    }
    onCharactersConsumed(line.text.trim().length);
    return { audioBase64: data.audioBase64, durationSec: data.durationSec || 2 };
  };

  const handlePreviewLine = async (line: StoryLine) => {
    if (playingLineId === line.id) {
      stopAllAudio();
      return;
    }
    stopAllAudio();
    setErrorMsg(null);

    try {
      let b64 = line.audioBase64;
      if (!b64 && !line.recordedBlobUrl) {
        setSynthesizingLineId(line.id);
        const res = await synthesizeLine(line);
        b64 = res.audioBase64;
        setLines((prev) =>
          prev.map((l) =>
            l.id === line.id
              ? { ...l, audioBase64: res.audioBase64, durationSec: res.durationSec }
              : l
          )
        );
      }

      const src = line.recordedBlobUrl || `data:audio/wav;base64,${b64}`;
      const audio = new Audio(src);
      audioElRef.current = audio;
      audio.onended = () => setPlayingLineId(null);
      await audio.play();
      setPlayingLineId(line.id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'نەشیا دیمەنی پەخش بکەت.');
    } finally {
      setSynthesizingLineId(null);
    }
  };

  const handleGenerateAllStory = async () => {
    const validLines = lines.filter((l) => l.text.trim().length > 0);
    if (validLines.length === 0) {
      setErrorMsg('چ دیمەنێن نڤێسای نینن.');
      return;
    }
    stopAllAudio();
    setErrorMsg(null);
    setIsGeneratingAll(true);
    setGenProgress({ done: 0, total: validLines.length });

    try {
      const updated = [...lines];
      for (let i = 0; i < updated.length; i++) {
        const line = updated[i];
        if (!line.text.trim()) continue;
        if (!line.audioBase64) {
          const res = await synthesizeLine(line);
          updated[i] = {
            ...line,
            audioBase64: res.audioBase64,
            durationSec: res.durationSec,
          };
          setLines([...updated]);
        }
        setGenProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      const segments = updated
        .filter((l) => Boolean(l.audioBase64))
        .map((l) => ({
          base64Wav: l.audioBase64!,
          pauseAfterSec: l.pauseAfterSec,
        }));

      const stitched = concatWavBase64WithPauses(segments);
      setMasterAudioBase64(stitched.base64Wav);
      setMasterDurationSec(stitched.durationSec);
    } catch (err: any) {
      setErrorMsg(err?.message || 'دروستکرنا تەماما چیرۆکێ ڕاوستیا.');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handlePlayMaster = async () => {
    if (!masterAudioBase64) return;
    if (isMasterPlaying) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    const audio = new Audio(`data:audio/wav;base64,${masterAudioBase64}`);
    audioElRef.current = audio;

    ambienceRef.current?.startAmbience(bgMusicPreset, sfxPreset, ambienceVol);

    audio.onended = () => {
      stopAllAudio();
    };

    await audio.play();
    setIsMasterPlaying(true);

    masterTimerRef.current = window.setInterval(() => {
      if (!audioElRef.current || !audioElRef.current.duration) return;
      setMasterProgress(audioElRef.current.currentTime / audioElRef.current.duration);
    }, 80);
  };

  const handleAutoParseScript = async () => {
    if (!rawScript.trim()) return;
    setIsParsing(true);
    setErrorMsg(null);

    try {
      const resp = await fetch('/api/badini/parse-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText: rawScript.trim(), dialectRegion: dialect }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'شیکردنەڤە سەرنەکەفت.');
      }

      const parsedChars: StoryCharacter[] = (data.parsed.characters || []).map(
        (c: any, idx: number) => {
          const matchedVoice =
            allVoices.find((v) => v.category === c.suggestedCategory) ||
            allVoices.find((v) => v.gender === (c.gender === 'female' ? 'female' : 'male')) ||
            allVoices[idx % allVoices.length];
          return {
            id: c.id || `char_${idx}`,
            name: c.name || `کەسایەتی ${idx + 1}`,
            roleLabel: c.roleLabel || 'کەسایەتی',
            voiceId: matchedVoice.id,
            defaultEmotion: (c.defaultEmotion as EmotionId) || 'calm',
          };
        }
      );

      const voiceMap = new Map(parsedChars.map((c) => [c.id, c.voiceId]));
      const parsedLines: StoryLine[] = (data.parsed.lines || []).map((l: any, idx: number) => ({
        id: `parsed_${Date.now()}_${idx}`,
        characterId: l.characterId || parsedChars[0]?.id || 'narrator',
        characterName: l.characterName || 'ڤەگێڕ',
        voiceId: voiceMap.get(l.characterId) || parsedChars[0]?.voiceId || allVoices[0].id,
        emotion: (l.emotion as EmotionId) || 'calm',
        pauseAfterSec: typeof l.pauseAfterSec === 'number' ? l.pauseAfterSec : 0.8,
        isNarration: Boolean(l.isNarration),
        text: l.text || '',
      }));

      if (parsedChars.length > 0) setCharacters(parsedChars);
      if (parsedLines.length > 0) setLines(parsedLines);
      setMasterAudioBase64(null);
      setShowParser(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'شیکردنەڤەیا سیناریۆیێ سەرنەکەفت.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddCharacter = () => {
    if (!newCharName.trim()) return;
    const id = `char_${Date.now()}`;
    setCharacters((prev) => [
      ...prev,
      {
        id,
        name: newCharName.trim(),
        roleLabel: 'کەسایەتیێ نوو',
        voiceId: newCharVoiceId,
        defaultEmotion: 'calm',
      },
    ]);
    setNewCharName('');
  };

  const handleCharacterVoiceChange = (charId: string, voiceId: string) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === charId ? { ...c, voiceId } : c))
    );
    // Sync voice across lines belonging to this character & invalidate cached audio
    setLines((prev) =>
      prev.map((l) =>
        l.characterId === charId ? { ...l, voiceId, audioBase64: undefined } : l
      )
    );
    setMasterAudioBase64(null);
  };

  const handleAddLine = (isNarration = false) => {
    const targetChar = isNarration
      ? characters[0]
      : characters[1] || characters[0];
    setLines((prev) => [
      ...prev,
      {
        id: `line_${Date.now()}`,
        characterId: targetChar.id,
        characterName: targetChar.name,
        voiceId: targetChar.voiceId,
        emotion: targetChar.defaultEmotion,
        pauseAfterSec: 0.8,
        isNarration,
        text: '',
      },
    ]);
    setMasterAudioBase64(null);
  };

  const updateLine = (id: string, patch: Partial<StoryLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        if (
          patch.text !== undefined ||
          patch.voiceId !== undefined ||
          patch.emotion !== undefined ||
          patch.isNarration !== undefined
        ) {
          next.audioBase64 = undefined;
        }
        return next;
      })
    );
    setMasterAudioBase64(null);
  };

  const moveLine = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= lines.length) return;
    const copy = [...lines];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setLines(copy);
    setMasterAudioBase64(null);
  };

  const toggleRecordLine = async (lineId: string) => {
    if (recordingLineId === lineId) {
      mediaRecorderRef.current?.stop();
      setRecordingLineId(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setLines((prev) =>
          prev.map((l) => (l.id === lineId ? { ...l, recordedBlobUrl: url } : l))
        );
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecordingLineId(lineId);
    } catch {
      setErrorMsg('دەستگەهشتن ب مایکرۆفۆنێ نەهاتە دانان.');
    }
  };

  const handleSaveCloud = async () => {
    if (!isSignedIn) return;
    setIsSaving(true);
    try {
      await onSaveProject({
        title: projectTitle.trim() || 'پڕۆژەیێ فرە-کەسایەتی',
        category,
        dialect,
        bgMusicPreset,
        sfxPreset,
        totalDurationSec: masterDurationSec,
        lines,
      });
      setSavedOk(true);
    } finally {
      setIsSaving(false);
    }
  };

  const readinessCount = useMemo(
    () => lines.filter((l) => Boolean(l.audioBase64)).length,
    [lines]
  );

  return (
    <div className="space-y-6">
      {/* Studio Top Bar & Script Parser Toggle */}
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="ناڤێ پڕۆژەیێ..."
              className="sm:col-span-2 rounded-xl bg-[#070910] border border-slate-800 focus:border-violet-500 px-3.5 py-2 text-sm font-semibold text-white outline-none"
            />
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value as BadiniDialect)}
              className="rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-xs text-white outline-none"
            >
              {BADINI_DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameKurdish}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowParser((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-violet-400" />
              شیکردنەڤەیا خۆکارا دیالۆگێ (AI Auto-Parse)
            </button>

            <button
              onClick={handleSaveCloud}
              disabled={!isSignedIn || isSaving}
              title={isSignedIn ? 'پاشەکەوتکرن' : 'چوونا ژوور بکە'}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              {savedOk ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5 text-violet-400" />
              )}
              {savedOk ? 'پاشەکەوت بوو' : 'پاشەکەوتکرنا پڕۆژەیێ'}
            </button>
          </div>
        </div>

        {/* Auto-Parser Drawer */}
        {showParser && (
          <div className="rounded-xl bg-[#070910] border border-violet-500/35 p-4 space-y-3">
            <div className="text-xs font-semibold text-violet-300">
              سیناریۆیا خۆ ب شێوەیێ (Narrator: ... / Man: ... / Woman: ...) ل ڤێرە دابنێ دا ژیرییا دەستکرد کەسایەتی و هەستان جودا بکەت:
            </div>
            <textarea
              rows={4}
              value={rawScript}
              onChange={(e) => setRawScript(e.target.value)}
              className="w-full rounded-lg bg-[#0d1221] border border-slate-800 p-3 text-xs text-slate-200 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowParser(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
              >
                داخستن
              </button>
              <button
                onClick={handleAutoParseScript}
                disabled={isParsing}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                دابەشکرن ب سەر کەسایەتییان دا
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Characters & Ambience Mixer Column */}
        <div className="xl:col-span-4 space-y-5">
          {/* Cast / Characters Manager */}
          <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-violet-400" />
                کەسایەتیێن درامایێ ({characters.length})
              </h3>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pl-1">
              {characters.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl bg-[#070910] border border-slate-800/80 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{c.name}</span>
                    {characters.length > 1 && (
                      <button
                        onClick={() =>
                          setCharacters((prev) => prev.filter((item) => item.id !== c.id))
                        }
                        className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        aria-label="Remove character"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    value={c.voiceId}
                    onChange={(e) => handleCharacterVoiceChange(c.id, e.target.value)}
                    className="w-full rounded-lg bg-[#0d1221] border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  >
                    {allVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.isCustom ? '★ ' : ''}
                        {v.nameKurdish} ({v.categoryKurdish})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Add Unlimited Character */}
            <div className="pt-2 border-t border-slate-800/70 space-y-2">
              <div className="text-[11px] text-slate-400">زێدەکرنا کەسایەتیێ نوو (بێ سنوور)</div>
              <input
                type="text"
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                placeholder="ناڤێ کەسایەتی (نموونە: باڤێ پیر)..."
                className="w-full rounded-lg bg-[#070910] border border-slate-800 px-3 py-1.5 text-xs text-white outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={newCharVoiceId}
                  onChange={(e) => setNewCharVoiceId(e.target.value)}
                  className="flex-1 rounded-lg bg-[#070910] border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                >
                  {allVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nameKurdish}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddCharacter}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  زێدەکرن
                </button>
              </div>
            </div>
          </div>

          {/* Background Music & SFX Studio Mixer */}
          <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Music2 className="w-4 h-4 text-emerald-400" />
              مۆسیقا و کاریگەریێن دەنگی (Audio Mixer)
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 block">مۆسیقایا پاشخانێ (Background Music)</label>
              <select
                value={bgMusicPreset}
                onChange={(e) => setBgMusicPreset(e.target.value)}
                className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-xs text-white outline-none"
              >
                {BG_MUSIC_PRESETS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.labelKurdish}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 block">کاریگەرییا کەشوهەوا و دەنگی (SFX)</label>
              <select
                value={sfxPreset}
                onChange={(e) => setSfxPreset(e.target.value)}
                className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-xs text-white outline-none"
              >
                {SFX_PRESETS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.labelKurdish}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">ئاستێ دەنگێ پاشخانێ (Ambience Level)</span>
                <span className="font-mono-num text-emerald-300">{Math.round(ambienceVol * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.02}
                value={ambienceVol}
                onChange={(e) => setAmbienceVol(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Story Timeline & Continuous Audio Builder Column */}
        <div className="xl:col-span-8 space-y-5">
          {/* Continuous Master Export & Waveform Bar */}
          <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  تایملاینی سەرەکی و بەرهەمئینانا یەکپارچە
                </h3>
                <p className="text-xs text-slate-400 font-mono-num">
                  {readinessCount}/{lines.length} دیمەن ئامادەنە
                  {masterDurationSec > 0 ? ` · ماوەیێ تەمام: ${masterDurationSec}s` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleGenerateAllStory}
                  disabled={isGeneratingAll}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      بەرهەمئینان ({genProgress.done}/{genProgress.total})
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      دروستکرنا هەمی چیرۆکێ وەک ئێک فایل
                    </>
                  )}
                </button>

                {masterAudioBase64 && (
                  <>
                    <button
                      onClick={() => downloadAudioFile(masterAudioBase64, 'badini-drama-master', 'wav')}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-violet-400" />
                      WAV
                    </button>
                    <button
                      onClick={() => downloadAudioFile(masterAudioBase64, 'badini-drama-master', 'mp3')}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      MP3
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-[#070910] border border-slate-800 p-3 flex items-center gap-4">
              <button
                onClick={handlePlayMaster}
                disabled={!masterAudioBase64}
                className="w-10 h-10 rounded-xl bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-35 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Play full story"
              >
                {isMasterPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <WaveformVisualizer
                  audioBase64={masterAudioBase64}
                  progress={masterProgress}
                  isPlaying={isMasterPlaying}
                  height={56}
                />
              </div>
            </div>
          </div>

          {/* Dialogue & Narration Lines List */}
          <div className="space-y-3">
            {lines.map((line, index) => {
              const isBusy = synthesizingLineId === line.id;
              const isPlaying = playingLineId === line.id;
              const isRecording = recordingLineId === line.id;

              return (
                <div
                  key={line.id}
                  className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono-num text-slate-500">#{index + 1}</span>

                      {/* Character selector */}
                      <select
                        value={line.characterId}
                        onChange={(e) => {
                          const c = characters.find((ch) => ch.id === e.target.value);
                          if (c) {
                            updateLine(line.id, {
                              characterId: c.id,
                              characterName: c.name,
                              voiceId: c.voiceId,
                            });
                          }
                        }}
                        className="rounded-lg bg-[#070910] border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-violet-300 outline-none"
                      >
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      {/* Override voice directly */}
                      <select
                        value={line.voiceId}
                        onChange={(e) => updateLine(line.id, { voiceId: e.target.value })}
                        className="rounded-lg bg-[#070910] border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 outline-none"
                      >
                        {allVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.nameKurdish}
                          </option>
                        ))}
                      </select>

                      {/* Emotion selector */}
                      <select
                        value={line.emotion}
                        onChange={(e) =>
                          updateLine(line.id, { emotion: e.target.value as EmotionId })
                        }
                        className="rounded-lg bg-[#070910] border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                      >
                        {EMOTION_PRESETS.map((em) => (
                          <option key={em.id} value={em.id}>
                            {em.labelKurdish}
                          </option>
                        ))}
                      </select>

                      {/* Pause after line */}
                      <div className="flex items-center gap-1 rounded-lg bg-[#070910] border border-slate-800 px-2 py-1 text-xs">
                        <span className="text-slate-400">وەستان:</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.2}
                          value={line.pauseAfterSec}
                          onChange={(e) =>
                            updateLine(line.id, { pauseAfterSec: Number(e.target.value) })
                          }
                          className="w-11 bg-transparent text-center font-mono-num text-white outline-none"
                        />
                        <span className="text-slate-500">s</span>
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={line.isNarration}
                          onChange={(e) =>
                            updateLine(line.id, { isNarration: e.target.checked })
                          }
                          className="accent-violet-600"
                        />
                        ڤەگێڕان
                      </label>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveLine(index, -1)}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-25 cursor-pointer"
                        aria-label="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveLine(index, 1)}
                        disabled={index === lines.length - 1}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-25 cursor-pointer"
                        aria-label="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setLines((prev) => prev.filter((item) => item.id !== line.id))
                        }
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                        aria-label="Delete scene"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={line.text}
                    onChange={(e) => updateLine(line.id, { text: e.target.value })}
                    placeholder="ڕستەیا دیمەنی ب کوردی بادینی بنڤیسە..."
                    className="w-full rounded-xl bg-[#070910] border border-slate-800 focus:border-violet-500 p-3 text-sm text-white leading-relaxed outline-none resize-y"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreviewLine(line)}
                        disabled={isBusy || !line.text.trim()}
                        className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/35 text-xs font-semibold text-violet-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isPlaying ? (
                          <Square className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        {isPlaying ? 'وەستان' : 'گوهداریکرن'}
                      </button>

                      <button
                        onClick={() => toggleRecordLine(line.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border cursor-pointer ${
                          isRecording
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-[#070910] border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        {isRecording ? 'وەستانا تۆمارێ' : line.recordedBlobUrl ? 'دەنگێ تۆمارکری' : 'تۆمارکرنا مایک'}
                      </button>
                    </div>

                    {/* Separate Audio Export Per Scene */}
                    {line.audioBase64 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            downloadAudioFile(line.audioBase64!, `scene-${index + 1}`, 'wav')
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          WAV
                        </button>
                        <button
                          onClick={() =>
                            downloadAudioFile(line.audioBase64!, `scene-${index + 1}`, 'mp3')
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          MP3
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => handleAddLine(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#0d1221] hover:bg-slate-800/80 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-violet-400" />
                زێدەکرنا ڕستەیا دیالۆگێ
              </button>
              <button
                onClick={() => handleAddLine(true)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#0d1221] hover:bg-slate-800/80 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                زێدەکرنا ڤەگێڕانێ (Narration)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
