import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  LogIn,
  Mic,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  BadiniDialect,
  BaseGeminiVoice,
  VoiceProfileDoc,
} from '../../types/studio';
import {
  BADINI_DIALECTS,
  DEFAULT_BADINI_LEXICON,
} from '../../data/badiniVoices';
import voiceBoothImg from '../../assets/images/badini_voice_booth_1795280107041.jpg';

interface MyVoiceLibraryPageProps {
  isSignedIn: boolean;
  onSignIn: () => void;
  customProfiles: VoiceProfileDoc[];
  onCreateProfile: (input: {
    name: string;
    gender: 'male' | 'female';
    ageGroup: string;
    region: BadiniDialect;
    baseVoice: BaseGeminiVoice;
    pitchShift: number;
    timbrePrompt: string;
    sampleTranscription: string;
    lexiconRules: string[];
  }) => Promise<void>;
  onDeleteProfile: (profileId: string) => Promise<void>;
}

export const MyVoiceLibraryPage: React.FC<MyVoiceLibraryPageProps> = ({
  isSignedIn,
  onSignIn,
  customProfiles,
  onCreateProfile,
  onDeleteProfile,
}) => {
  const [voiceName, setVoiceName] = useState('دەنگێ من یێ بادینی');
  const [region, setRegion] = useState<BadiniDialect>('duhok');

  // Recording & Upload
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Training analysis state
  const [isTraining, setIsTraining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analyzedProfile, setAnalyzedProfile] = useState<{
    gender: 'male' | 'female';
    ageGroup: string;
    region: BadiniDialect;
    baseVoice: BaseGeminiVoice;
    pitchShift: number;
    timbrePrompt: string;
    sampleTranscription: string;
    summaryKurdish: string;
  } | null>(null);

  // Custom Badini pronunciation lexicon rules ("word => phonetic")
  const [lexiconRules, setLexiconRules] = useState<string[]>(
    DEFAULT_BADINI_LEXICON.slice(0, 3).map((x) => `${x.word} => ${x.phoneticHint}`)
  );
  const [newWord, setNewWord] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [boothImgFailed, setBoothImgFailed] = useState(false);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || '');
        const idx = res.indexOf(',');
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleToggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setErrorMsg(null);
    setAnalyzedProfile(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        setRecordedAudioUrl(URL.createObjectURL(blob));
        setAudioMimeType(mimeType);
        const b64 = await blobToBase64(blob);
        setAudioBase64(b64);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setErrorMsg('مایکرۆفۆن بەردەست نینە یان رێگەپێدان نەهاتیە دان. دشێی فایلا دەنگی ئەپڵۆد بکەی.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setAnalyzedProfile(null);
    setRecordedAudioUrl(URL.createObjectURL(file));
    setAudioMimeType(file.type || 'audio/wav');
    const b64 = await blobToBase64(file);
    setAudioBase64(b64);
  };

  const handleAnalyzeAndTrain = async () => {
    if (!audioBase64) {
      setErrorMsg('تکایە بەری شیکردنەوەی دەنگێ خۆ تۆمار بکە یان فایلەکێ ئەپڵۆد بکە.');
      return;
    }

    setIsTraining(true);
    setErrorMsg(null);
    setSavedNotice(false);

    try {
      const resp = await fetch('/api/badini/voice-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioMimeType,
          voiceName,
          region,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'شیکردنەوەی دەنگی سەرنەکەفت.');
      }
      setAnalyzedProfile(data.profile);
    } catch (err: any) {
      setErrorMsg(err?.message || 'هەڵە د ڕاهێنانا دەنگی دا.');
    } finally {
      setIsTraining(false);
    }
  };

  const handleAddLexiconRule = () => {
    if (!newWord.trim() || !newPhonetic.trim()) return;
    setLexiconRules((prev) => [...prev, `${newWord.trim()} => ${newPhonetic.trim()}`]);
    setNewWord('');
    setNewPhonetic('');
  };

  const handleSaveProfile = async () => {
    if (!isSignedIn || !analyzedProfile) return;
    setIsSaving(true);
    try {
      await onCreateProfile({
        name: voiceName.trim() || 'دەنگێ من',
        gender: analyzedProfile.gender === 'female' ? 'female' : 'male',
        ageGroup: analyzedProfile.ageGroup || '25-35',
        region: (analyzedProfile.region as BadiniDialect) || region,
        baseVoice: analyzedProfile.baseVoice || 'Puck',
        pitchShift: Number(analyzedProfile.pitchShift) || 0,
        timbrePrompt: analyzedProfile.timbrePrompt,
        sampleTranscription: analyzedProfile.sampleTranscription || '',
        lexiconRules,
      });
      setSavedNotice(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewSaved = async (vp: VoiceProfileDoc) => {
    setPreviewPlayingId(vp.id);
    try {
      const resp = await fetch('/api/badini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:
            vp.sampleTranscription ||
            'سڵاڤ و ڕێز، ئەڤە نموونەیا دەنگێ گونجاندییێ منە ب شێوەزارێ بادینی.',
          voice: vp.baseVoice,
          style: vp.timbrePrompt,
          emotion: 'calm',
          dialectRegion: vp.region,
          adaptationEnabled: true,
          lexiconRules: vp.lexiconRules || [],
        }),
      });
      const data = await resp.json();
      if (data.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
        audio.onended = () => setPreviewPlayingId(null);
        await audio.play();
      } else {
        setPreviewPlayingId(null);
      }
    } catch {
      setPreviewPlayingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro & Booth Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0d1221] border border-slate-800/80 p-6">
        {!boothImgFailed && (
          <img
            src={voiceBoothImg}
            alt="Recording booth microphone"
            onError={() => setBoothImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="relative z-10 space-y-1.5">
          <h2 className="text-lg font-bold text-white">
            پەرتووکخانا دەنگێ من و گونجاندنا بادینی (Custom Voice Training & Lexicon)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            دەنگێ خۆ تۆمار بکە یان تۆمارەکا دەنگێ بادینی ئەپڵۆد بکە. ژیرییا دەستکرد دەقێ بادینی دڤەگێڕیت (<span className="font-mono-num">gemini-3.5-transcribe</span>) و تایبەتمەندیا تۆن و هەناسەیا تە دکەتە پرۆفایلەکێ تایبەت ب گونجاندنا فەرهەنگا بادینی.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Voice Recorder & Trainer */}
        <div className="xl:col-span-7 rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300 block">ناڤێ دەنگێ تە</label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3.5 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300 block">شێوەزارێ تە</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as BadiniDialect)}
                className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-sm text-white outline-none"
              >
                {BADINI_DIALECTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameKurdish}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-[#070910] border border-slate-800 p-4 space-y-3">
            <div className="text-xs text-slate-400">
              نموونە بۆ خواندنێ: «سڵاڤ، ئەز ژ دهۆکێ دئاخڤم و دڤێت دەنگێ من ب شێوەیەکێ سروشتی د چیرۆکێن بادینی دا بهێتە بکارئینان.»
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleToggleRecord}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isRecording ? 'وەستاندنا تۆمارکرنێ' : 'تۆمارکرنا مایکرۆفۆنێ'}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-violet-400" />
                ئەپڵۆدکرنا فایلا دەنگی
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {recordedAudioUrl && (
              <audio controls src={recordedAudioUrl} className="w-full h-10 mt-2" />
            )}
          </div>

          {/* Custom Badini Pronunciation Lexicon */}
          <div className="space-y-3 pt-2 border-t border-slate-800/70">
            <div className="text-xs font-bold text-white">
              فەرهەنگا تایبەتا بێژەکرنا بادینی (Pronunciation Lexicon)
            </div>
            <div className="space-y-1.5">
              {lexiconRules.map((rule, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-[#070910] border border-slate-800 px-3 py-1.5 text-xs text-slate-200"
                >
                  <span>{rule}</span>
                  <button
                    onClick={() => setLexiconRules((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="پەیڤا بادینی (نموونە: ڤێجا)"
                className="sm:col-span-5 rounded-lg bg-[#070910] border border-slate-800 px-3 py-1.5 text-xs text-white outline-none"
              />
              <input
                type="text"
                value={newPhonetic}
                onChange={(e) => setNewPhonetic(e.target.value)}
                placeholder="فۆنەتیک (نموونە: vee-jaa)"
                className="sm:col-span-5 rounded-lg bg-[#070910] border border-slate-800 px-3 py-1.5 text-xs text-white outline-none"
              />
              <button
                onClick={handleAddLexiconRule}
                className="sm:col-span-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                زێدە
              </button>
            </div>
          </div>

          <button
            onClick={handleAnalyzeAndTrain}
            disabled={isTraining || !audioBase64}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {isTraining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                شیکردنەڤە و ڕاهێنانا دەنگی...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                شیکردنەڤە و دروستکرنا پرۆفایلا دەنگێ من
              </>
            )}
          </button>

          {errorMsg && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {analyzedProfile && (
            <div className="rounded-xl bg-[#070910] border border-emerald-500/40 p-4 space-y-3">
              <div className="text-sm font-bold text-emerald-300">
                ئەنجامێ شیکردنەڤەیا ئاکوستیک:
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {analyzedProfile.summaryKurdish}
              </p>
              {analyzedProfile.sampleTranscription && (
                <div className="text-xs text-slate-400">
                  دەقێ ناسراو: «{analyzedProfile.sampleTranscription}»
                </div>
              )}
              <div className="text-[11px] font-mono-num text-slate-400" dir="ltr">
                Anchor: {analyzedProfile.baseVoice} · Pitch: {analyzedProfile.pitchShift}st · Age: {analyzedProfile.ageGroup}
              </div>

              {isSignedIn ? (
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savedNotice ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      پرۆفایلا دەنگێ تە هاتە پاشەکەوتکرن!
                    </>
                  ) : (
                    'پاشەکەوتکرن د ناڤ پەرتووکخانا دەنگان دا'
                  )}
                </button>
              ) : (
                <button
                  onClick={onSignIn}
                  className="w-full py-2 rounded-lg bg-violet-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  چوونا ژوور بکە دا ئەڤ پرۆفایلە بهێتە پاشەکەوتکرن
                </button>
              )}
            </div>
          )}
        </div>

        {/* Saved Custom Voices Column */}
        <div className="xl:col-span-5 rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-white">
            دەنگێن من یێن تایبەت ({customProfiles.length})
          </h3>

          {!isSignedIn ? (
            <div className="rounded-xl bg-[#070910] border border-slate-800 p-6 text-center space-y-3">
              <p className="text-xs text-slate-400">
                چوونا ژوور ب Google بکە دا دەنگێن خۆ یێن پاشەکەوتکری ببینی.
              </p>
              <button
                onClick={onSignIn}
                className="px-4 py-2 rounded-lg bg-violet-600 text-xs font-semibold text-white cursor-pointer"
              >
                چوونا ژوور
              </button>
            </div>
          ) : customProfiles.length === 0 ? (
            <div className="rounded-xl bg-[#070910] border border-slate-800 p-6 text-center text-xs text-slate-400">
              هێشتا چ دەنگێن تایبەت نەهاتینە تۆمارکرن. ژ تۆمارگەها تەنیشتێ دەستپێبکە.
            </div>
          ) : (
            <div className="space-y-3">
              {customProfiles.map((vp) => (
                <div
                  key={vp.id}
                  className="rounded-xl bg-[#070910] border border-slate-800 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{vp.name}</div>
                      <div className="text-[11px] text-violet-400 font-mono-num" dir="ltr">
                        {vp.region} · {vp.baseVoice} ({vp.pitchShift}st)
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePreviewSaved(vp)}
                        className="p-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 cursor-pointer"
                        aria-label="Preview custom voice"
                      >
                        {previewPlayingId === vp.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteProfile(vp.id)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Delete custom voice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{vp.timbrePrompt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
