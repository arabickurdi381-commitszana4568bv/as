import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpenText,
  Loader2,
  Sparkles,
  Theater,
  Users,
} from 'lucide-react';
import {
  BadiniDialect,
  EmotionId,
  StoryCategoryId,
  StoryCharacter,
  StoryLine,
  VoicePersona,
} from '../../types/studio';
import {
  BADINI_DIALECTS,
  EMOTION_PRESETS,
  STORY_CATEGORIES,
} from '../../data/badiniVoices';
import storyCoverImg from '../../assets/images/badini_story_cover_1795280107552.jpg';

interface StoryCreatorPageProps {
  allVoices: VoicePersona[];
  initialCategoryId?: StoryCategoryId;
  onLoadStoryIntoStudio: (payload: {
    title: string;
    category: string;
    dialect: BadiniDialect;
    bgMusicPreset: string;
    sfxPreset: string;
    characters: StoryCharacter[];
    lines: StoryLine[];
  }) => void;
}

export const StoryCreatorPage: React.FC<StoryCreatorPageProps> = ({
  allVoices,
  initialCategoryId = 'emotional',
  onLoadStoryIntoStudio,
}) => {
  const [selectedCat, setSelectedCat] = useState<StoryCategoryId>(initialCategoryId);
  const currentCategory =
    STORY_CATEGORIES.find((c) => c.id === selectedCat) || STORY_CATEGORIES[0];

  const [premise, setPremise] = useState(currentCategory.samplePremise);
  const [dialect, setDialect] = useState<BadiniDialect>('duhok');
  const [lengthMode, setLengthMode] = useState<'short' | 'medium' | 'long'>('medium');
  const [charactersCount, setCharactersCount] = useState(3);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);

  const [generatedStory, setGeneratedStory] = useState<{
    title: string;
    summaryKurdish: string;
    bgMusicPreset: string;
    sfxPreset: string;
    characters: StoryCharacter[];
    lines: StoryLine[];
  } | null>(null);

  const handleCategoryChange = (catId: StoryCategoryId) => {
    setSelectedCat(catId);
    const meta = STORY_CATEGORIES.find((c) => c.id === catId);
    if (meta) setPremise(meta.samplePremise);
  };

  const mapSuggestedVoice = (suggestedCategory: string, gender: string, index: number): string => {
    const exact = allVoices.find((v) => v.category === suggestedCategory);
    if (exact) return exact.id;
    const sameGender = allVoices.filter(
      (v) => v.gender === (gender === 'female' ? 'female' : 'male')
    );
    if (sameGender.length > 0) {
      return sameGender[index % sameGender.length].id;
    }
    return allVoices[index % allVoices.length]?.id || 'zhirevan_young_male';
  };

  const handleGenerateStory = async () => {
    if (!premise.trim()) {
      setErrorMsg('تکایە بیرۆکەیا چیرۆکێ بنڤیسە.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const resp = await fetch('/api/badini/story-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premise: premise.trim(),
          categoryId: selectedCat,
          categoryTitle: `${currentCategory.titleKurdish} (${currentCategory.titleEnglish})`,
          dialectRegion: dialect,
          lengthMode,
          charactersCount,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'دروستکرنا چیرۆکێ سەرنەکەفت.');
      }

      const raw = data.story;
      const mappedCharacters: StoryCharacter[] = (raw.characters || []).map(
        (c: any, idx: number) => ({
          id: c.id || `char_${idx}`,
          name: c.name || `کەسایەتی ${idx + 1}`,
          roleLabel: c.roleLabel || 'کەسایەتی',
          voiceId: mapSuggestedVoice(c.suggestedCategory, c.gender, idx),
          defaultEmotion: (c.defaultEmotion as EmotionId) || currentCategory.defaultEmotion,
        })
      );

      const charVoiceLookup = new Map(mappedCharacters.map((c) => [c.id, c.voiceId]));

      const mappedLines: StoryLine[] = (raw.lines || []).map((l: any, idx: number) => ({
        id: `line_${Date.now()}_${idx}`,
        characterId: l.characterId || mappedCharacters[0]?.id || 'narrator',
        characterName: l.characterName || 'ڤەگێڕ',
        voiceId:
          charVoiceLookup.get(l.characterId) ||
          mappedCharacters[0]?.voiceId ||
          allVoices[0].id,
        emotion: (l.emotion as EmotionId) || 'calm',
        pauseAfterSec: typeof l.pauseAfterSec === 'number' ? l.pauseAfterSec : 0.9,
        isNarration: Boolean(l.isNarration),
        text: l.text || '',
      }));

      setGeneratedStory({
        title: raw.title || currentCategory.titleKurdish,
        summaryKurdish: raw.summaryKurdish || '',
        bgMusicPreset: raw.bgMusicPreset || 'oud_calm',
        sfxPreset: raw.sfxPreset || 'none',
        characters: mappedCharacters,
        lines: mappedLines,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'هەڵەیەک د دروستکرنا چیرۆکا بادینی دا ڕوویدا.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0d1221] p-6">
        {!coverFailed && (
          <img
            src={storyCoverImg}
            alt="Kurdish Badini storytelling atmosphere"
            onError={() => setCoverFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpenText className="w-5 h-5 text-violet-400" />
              ئافرێنەرێ چیرۆکێن بادینی ب ژیرییا دەستکرد (AI Story Creator)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              ژ ناڤ ١٠ جۆرێن چیرۆک و بەڵگەنامە و سیمیناران هەلبژێرە؛ ژیرییا دەستکرد سیناریۆیا فرە-کەسایەتی ب زمانێ بادینیا ڕەسەن و هەستێن گونجای بۆ هەر ڕستەیەک دروست دکەت.
            </p>
          </div>
        </div>
      </div>

      {/* 10 Story Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STORY_CATEGORIES.map((cat) => {
          const active = selectedCat === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`text-right rounded-xl p-3.5 border transition-all cursor-pointer ${
                active
                  ? 'bg-violet-600/20 border-violet-500 text-white'
                  : 'bg-[#0d1221] border-slate-800/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold">{cat.titleKurdish}</div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{cat.titleEnglish}</div>
            </button>
          );
        })}
      </div>

      {/* Story Builder Form */}
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 block">
            بیرۆکە یان مژارا چیرۆکێ ({currentCategory.titleKurdish})
          </label>
          <textarea
            rows={4}
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="بیرۆکەیا چیرۆکا خۆ بنڤیسە..."
            className="w-full rounded-xl bg-[#070910] border border-slate-800 focus:border-violet-500 p-4 text-sm text-white leading-relaxed outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">شێوەزارێ چیرۆکێ</label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value as BadiniDialect)}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2.5 text-xs text-white outline-none"
            >
              {BADINI_DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameKurdish}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">درێژیا چیرۆکێ</label>
            <select
              value={lengthMode}
              onChange={(e) => setLengthMode(e.target.value as any)}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2.5 text-xs text-white outline-none"
            >
              <option value="short">کورت (~٥ دیمەن)</option>
              <option value="medium">ناوەند (~٨ دیمەن)</option>
              <option value="long">درێژ (~١٢ دیمەن)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">ژمارا کەسایەتییان</label>
            <select
              value={charactersCount}
              onChange={(e) => setCharactersCount(Number(e.target.value))}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2.5 text-xs text-white outline-none"
            >
              <option value={2}>٢ کەسایەتی</option>
              <option value={3}>٣ کەسایەتی</option>
              <option value={4}>٤ کەسایەتی</option>
              <option value={5}>٥ کەسایەتی</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGenerateStory}
            disabled={isGenerating}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                چیرۆک دهێتە نڤێسین...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                ئافراندنا سیناریۆیا بادینی
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

      {/* Generated Story Preview + Send to Studio */}
      {generatedStory && (
        <div className="rounded-2xl bg-[#0d1221] border border-violet-500/40 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{generatedStory.title}</h3>
              <p className="text-xs text-slate-300 mt-1">{generatedStory.summaryKurdish}</p>
            </div>
            <button
              onClick={() =>
                onLoadStoryIntoStudio({
                  title: generatedStory.title,
                  category: currentCategory.titleKurdish,
                  dialect,
                  bgMusicPreset: generatedStory.bgMusicPreset,
                  sfxPreset: generatedStory.sfxPreset,
                  characters: generatedStory.characters,
                  lines: generatedStory.lines,
                })
              }
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
            >
              <Theater className="w-4 h-4" />
              ڤەکرن د ستۆدیۆیا فرە-کەسایەتی دا
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Cast Summary */}
          <div className="flex flex-wrap gap-2.5 items-center">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-violet-400" />
              کەسایەتی:
            </span>
            {generatedStory.characters.map((c) => {
              const voice = allVoices.find((v) => v.id === c.voiceId);
              return (
                <div
                  key={c.id}
                  className="px-3 py-1.5 rounded-lg bg-[#070910] border border-slate-800 text-xs text-slate-200"
                >
                  <span className="font-bold text-white">{c.name}</span>
                  <span className="text-slate-400"> · {voice?.nameKurdish || 'دەنگ'}</span>
                </div>
              );
            })}
          </div>

          {/* Lines Preview */}
          <div className="space-y-2.5">
            {generatedStory.lines.map((line) => {
              const emLabel =
                EMOTION_PRESETS.find((e) => e.id === line.emotion)?.labelKurdish || line.emotion;
              return (
                <div
                  key={line.id}
                  className="rounded-xl bg-[#070910] border border-slate-800/80 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-violet-300">
                      {line.characterName} {line.isNarration ? '(ڤەگێڕان)' : ''}
                    </span>
                    <span className="text-slate-400 font-mono-num">
                      {emLabel} · {line.pauseAfterSec}s pause
                    </span>
                  </div>
                  <p className="text-sm text-slate-100 leading-relaxed">{line.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
