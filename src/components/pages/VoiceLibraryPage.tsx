import React, { useMemo, useRef, useState } from 'react';
import { Loader2, Play, Search, Square, Theater, Volume2 } from 'lucide-react';
import { BadiniDialect, VoiceCategory, VoicePersona } from '../../types/studio';

interface VoiceLibraryPageProps {
  allVoices: VoicePersona[];
  onUseInTTS: (text: string, voiceId: string, dialect: BadiniDialect) => void;
  onUseInStudio: (voiceId: string) => void;
}

const CATEGORY_FILTERS: { id: 'all' | 'custom' | VoiceCategory; label: string }[] = [
  { id: 'all', label: 'هەمی دەنگ (All)' },
  { id: 'young_male', label: 'گەنجێ نێر' },
  { id: 'mature_male', label: 'پیاوێ پێگەهشتی' },
  { id: 'deep_narrator', label: 'گێڕەرەوێ قووڵ' },
  { id: 'young_female', label: 'کچا گەنج' },
  { id: 'mature_female', label: 'ئافرەتا پێگەهشتی' },
  { id: 'emotional_male', label: 'هەستیارێ نێر' },
  { id: 'emotional_female', label: 'هەستیارێ مێ' },
  { id: 'documentary_narrator', label: 'بەڵگەنامەیی' },
  { id: 'storytelling', label: 'چیرۆکبێژ' },
  { id: 'news_presenter', label: 'هەواڵنێر' },
  { id: 'seminar_presenter', label: 'سیمینار' },
  { id: 'custom', label: 'دەنگێن من (Custom)' },
];

export const VoiceLibraryPage: React.FC<VoiceLibraryPageProps> = ({
  allVoices,
  onUseInTTS,
  onUseInStudio,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'custom' | VoiceCategory>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filteredVoices = useMemo(() => {
    return allVoices.filter((v) => {
      if (categoryFilter === 'custom' && !v.isCustom) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'custom' && v.category !== categoryFilter) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        v.nameKurdish.toLowerCase().includes(q) ||
        v.nameEnglish.toLowerCase().includes(q) ||
        v.categoryKurdish.toLowerCase().includes(q) ||
        v.descriptionKurdish.toLowerCase().includes(q) ||
        v.regionLabel.toLowerCase().includes(q)
      );
    });
  }, [allVoices, search, categoryFilter]);

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const handlePreview = async (voice: VoicePersona) => {
    if (playingId === voice.id) {
      stopCurrentAudio();
      return;
    }
    stopCurrentAudio();
    setLoadingId(voice.id);
    setErrorMsg(null);

    try {
      const resp = await fetch('/api/badini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voice.sampleBadiniText,
          voice: voice.baseVoice,
          style: voice.timbrePrompt,
          emotion: 'calm',
          dialectRegion: voice.region,
          adaptationEnabled: true,
          lexiconRules: voice.lexiconRules || [],
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'نەشیا نموونەیا دەنگی چێکەت.');
      }

      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      await audio.play();
      setPlayingId(voice.id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'هەڵە د گوهداریکرنا نموونەی دا.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">پەرتووکخانا دەنگێن بادینی</h2>
            <p className="text-xs text-slate-400">
              ١١ پۆلێن جیاواز ژ دەنگێن نێر و مێ ب زاراوەیێن دهۆک، زاخۆ، ئامێدی و ئاکرێ
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="گەڕیان ل دەنگی یان شێوەزاری..."
              className="w-full rounded-xl bg-[#070910] border border-slate-800 focus:border-violet-500 pr-9 pl-3 py-2 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white font-semibold'
                    : 'bg-[#070910] text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Voices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredVoices.map((voice) => {
          const isLoading = loadingId === voice.id;
          const isPlaying = playingId === voice.id;
          return (
            <div
              key={voice.id}
              className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 flex flex-col justify-between gap-4 hover:border-violet-500/35 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{voice.nameKurdish}</h3>
                      <span className="text-xs text-slate-400" dir="ltr">
                        ({voice.nameEnglish})
                      </span>
                    </div>
                    <div className="text-xs text-violet-400 font-medium mt-0.5">
                      {voice.categoryKurdish}
                    </div>
                  </div>
                  <div className="text-left text-[11px] text-slate-400 shrink-0">
                    <div>{voice.regionLabel}</div>
                    <div>{voice.ageLabel} · {voice.gender === 'male' ? 'نێر' : 'مێ'}</div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {voice.descriptionKurdish}
                </p>

                <div className="rounded-xl bg-[#070910] border border-slate-800/80 p-3 text-xs text-slate-400 leading-relaxed">
                  «{voice.sampleBadiniText}»
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handlePreview(voice)}
                  disabled={isLoading}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isPlaying
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isPlaying ? (
                    <Square className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {isLoading ? 'بارکرن...' : isPlaying ? 'وەستان' : 'گوهداریکرن'}
                </button>

                <button
                  onClick={() => onUseInTTS(voice.sampleBadiniText, voice.id, voice.region)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                  نڤێسین بۆ دەنگ
                </button>

                <button
                  onClick={() => onUseInStudio(voice.id)}
                  title="ناردن بۆ ستۆدیۆیا فرە-کەسایەتی"
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Theater className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
