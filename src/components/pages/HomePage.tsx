import React, { useState } from 'react';
import {
  ArrowLeft,
  AudioLines,
  BookOpenText,
  ExternalLink,
  FolderKanban,
  Info,
  Instagram,
  MessageCircle,
  Mic2,
  Play,
  Sparkles,
  Theater,
  UserCheck,
  Volume2,
} from 'lucide-react';
import {
  AudioProjectDoc,
  BadiniDialect,
  NavPage,
  VoicePersona,
} from '../../types/studio';
import { BADINI_VOICE_LIBRARY, STORY_CATEGORIES } from '../../data/badiniVoices';
import heroStudioImg from '../../assets/images/badini_studio_hero_1795280107604.jpg';
import voiceBoothImg from '../../assets/images/badini_voice_booth_1795280107041.jpg';
import { GammaIcon } from './PresentationPage';

interface HomePageProps {
  onNavigate: (page: NavPage) => void;
  onQuickLaunchTTS: (text: string, voiceId: string, dialect: BadiniDialect) => void;
  onSelectStoryCategory: (catId: string) => void;
  recentProjects: AudioProjectDoc[];
  allVoices: VoicePersona[];
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onQuickLaunchTTS,
  onSelectStoryCategory,
  recentProjects,
  allVoices,
}) => {
  const [quickText, setQuickText] = useState(
    'شەڤەکا سار بوو ل باژێڕێ دهۆکێ، لێ دەنگێ بادینی هێشتا گەرمە و چیرۆکێن مە ب رەسەنی دڤەگێڕیت.'
  );
  const [quickVoiceId, setQuickVoiceId] = useState(allVoices[0]?.id || 'zhirevan_young_male');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [boothImgFailed, setBoothImgFailed] = useState(false);

  return (
    <div className="space-y-8">
      {/* Studio Hero Showcase */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0d1221]">
        {!heroImgFailed && (
          <img
            src={heroStudioImg}
            alt="سایتی Zana Rajab Studio"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-l from-[#070910] via-[#070910]/85 to-indigo-950/60" />

        <div className="relative z-10 p-6 sm:p-8 lg:p-10 grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-violet-400">
              سایتی Zana Rajab · Badini AI Voice & Presentation Studio
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              سایتی Zana Rajab — ستۆدیۆیا دەنگێ بادینی و دروستکرنا پرێزنتەیشن
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              دەقێن خۆ یێن ب زمانێ کوردی بادینی بگوهۆڕە بۆ دەنگێن سروشتی و هەستیار، درامایێن فرە-کەسایەتی چێکە، یان پرێزنتەیشنێن پیشەیی ب هاریکاریا <span dir="ltr" className="text-violet-300 font-semibold">Gamma</span> دروست بکە.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => onNavigate('tts')}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-violet-950/40 transition-all cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                نڤێسین بۆ دەنگ (TTS)
              </button>
              <button
                onClick={() => onNavigate('presentation')}
                className="px-5 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-violet-500/40 text-slate-100 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <GammaIcon className="w-4 h-4" />
                دروستکرنا پرێزنتەیشن (Gamma)
              </button>
              <button
                onClick={() => onNavigate('studio')}
                className="px-4 py-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Theater className="w-4 h-4 text-emerald-400" />
                ستۆدیۆیا درامایێ
              </button>
            </div>
          </div>

          {/* Quick Badini Launcher */}
          <div className="lg:col-span-5 rounded-2xl bg-[#070910]/90 backdrop-blur-md border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                تاقیکرنا ب لەز یا دەنگێ بادینی
              </span>
              <span className="text-[11px] text-slate-400 font-mono-num">24kHz WAV/MP3</span>
            </div>

            <textarea
              rows={3}
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="دەقەکێ بادینی ل ڤێرە بنڤیسە..."
              className="w-full rounded-xl bg-[#0d1221] border border-slate-800 focus:border-violet-500 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none resize-none leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row gap-2.5">
              <select
                value={quickVoiceId}
                onChange={(e) => setQuickVoiceId(e.target.value)}
                className="flex-1 rounded-xl bg-[#0d1221] border border-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500"
              >
                {allVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nameKurdish} — {v.categoryKurdish}
                  </option>
                ))}
              </select>

              <button
                onClick={() => onQuickLaunchTTS(quickText, quickVoiceId, 'duhok')}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                چێکرن د ستۆدیۆیێ دا
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Zana Rajab Owner Info & Gamma Showcase Strip */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">زانیاری و پەیوەندی — Zana Rajab</h3>
              <p className="text-xs text-slate-400">
                بۆ پەیوەندیا راستەوخۆ، پڕۆژەیێن تایبەت و هاوکاری ل سەر واتساپ یان ئینستاگرامێ پەیوەندیێ بکە
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://wa.me/9647515043506"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition-colors"
              dir="ltr"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp: 07515043506
            </a>

            <a
              href="https://www.instagram.com/eng.zana_?dmpr=eWp4OWtiY3JzcXZr&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-fuchsia-600/20 hover:bg-fuchsia-600/30 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Instagram className="w-4 h-4" />
              Instagram (@eng.zana_)
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-[#0d1221] border border-violet-500/35 p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#070910] border border-slate-800 flex items-center justify-center shrink-0">
              <GammaIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">بەشێ پرێزنتەیشن و Gamma</h3>
              <p className="text-xs text-slate-400">
                دروستکرنا سلایدان و کۆنترۆڵکرنا سایتی Gamma د ناڤ سایتەکی دا
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('presentation')}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shrink-0 transition-colors cursor-pointer"
          >
            ڤەکرنا بەشی
          </button>
        </div>
      </section>

      {/* Transparent AI Architecture & Badini Authenticity Notice */}
      <section className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 text-indigo-400">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-white">
              شەفافییەت ل دۆر تەکنۆلۆژیا دەنگێ بادینی (Badini Engine Architecture)
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-4xl">
              ئەڤ ستۆدیۆیە پشت ب مۆدێلێ <span className="font-mono-num text-violet-300">gemini-3.8-flash-tts</span> دبەستیت کو ئاستەکێ بلند یێ دەنگێ مرۆڤی ددەت، لێ چ دابینکەرێن بازرگانی یێن جیهانی مۆدێلەکێ جودایێ سەربەخۆ ب ناڤێ «Kurdish Badini» نینە. ژ بۆ کو ئەم ب دزی ڤە عەرەبی یان سۆرانی ل شوونا بادینی دانەنین، مە سیستەمێ گونجاندنا فۆنەتیکا بادینی (پیتێن ڤ، ژ، چ، پ، ێ، ۆ)، فەرهەنگا تایبەتا بێژەکرنێ و ڕاهێنانا دەنگێ کەسی د ناڤ ئەڤێ پلاتفۆرمێ دا چێکریە.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('my-voices')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white shrink-0 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Mic2 className="w-3.5 h-3.5 text-violet-400" />
          ڕاهێنانا دەنگێ خۆ
        </button>
      </section>

      {/* Core Studio Modules */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('voices')}
          className="text-right rounded-2xl bg-[#0d1221] hover:bg-[#12192e] border border-slate-800/80 hover:border-violet-500/40 p-5 space-y-3 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
            <AudioLines className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white group-hover:text-violet-300 transition-colors">
              ١١ کەسایەتیێن دەنگێ بادینی
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              دەنگێن گەنج، پێگەهشتی، قووڵ، هەستیار، بەڵگەنامەیی و چیرۆکبێژی ب زاراوەیێن بادینان.
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('story')}
          className="text-right rounded-2xl bg-[#0d1221] hover:bg-[#12192e] border border-slate-800/80 hover:border-violet-500/40 p-5 space-y-3 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
            <BookOpenText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white group-hover:text-blue-300 transition-colors">
              ئافرێنەرێ چیرۆکان (١٠ جۆر)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              دروستکرنا چیرۆکێن هەستیار، عاشقانە، مێژوویی، ئایینی، سیمینار و زارۆکان ب بادینیا ڕەسەن.
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('studio')}
          className="text-right rounded-2xl bg-[#0d1221] hover:bg-[#12192e] border border-slate-800/80 hover:border-violet-500/40 p-5 space-y-3 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
            <Theater className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white group-hover:text-emerald-300 transition-colors">
              دراما فرە-کەسایەتی و مێکسەر
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              دیاریکرنا دەنگان، وەستانا ناڤبەرا ڕستەیان، مۆسیقا و کاریگەریێن دەنگی ب فایلا یەکپارچە.
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('my-voices')}
          className="text-right rounded-2xl bg-[#0d1221] hover:bg-[#12192e] border border-slate-800/80 hover:border-violet-500/40 p-5 space-y-3 transition-all cursor-pointer group overflow-hidden relative"
        >
          {!boothImgFailed && (
            <img
              src={voiceBoothImg}
              alt="Voice booth"
              onError={() => setBoothImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover opacity-15"
            />
          )}
          <div className="relative z-10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Mic2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="font-bold text-white group-hover:text-amber-300 transition-colors">
                ڕاهێنانا دەنگێ تایبەت
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                تۆمارکرنا دەنگێ خۆ ب مایکرۆفۆنێ یان ئەپڵۆدکرنا فایلێ ژ بۆ شیکردنەوەی ئاکوستیک و فەرهەنگ.
              </p>
            </div>
          </div>
        </button>
      </section>

      {/* Featured Badini Voices & Story Categories */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">دەنگێن سەرەکی یێن بادینی</h3>
              <p className="text-xs text-slate-400">Featured Badini Voice Personas</p>
            </div>
            <button
              onClick={() => onNavigate('voices')}
              className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              هەمی دەنگان ببینە
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BADINI_VOICE_LIBRARY.slice(0, 4).map((v) => (
              <div
                key={v.id}
                className="rounded-xl bg-[#070910] border border-slate-800/80 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{v.nameKurdish}</span>
                    <span className="text-[11px] text-violet-400">{v.regionLabel}</span>
                  </div>
                  <div className="text-xs text-slate-400">{v.categoryKurdish} · {v.ageLabel}</div>
                  <p className="text-xs text-slate-400 line-clamp-2 pt-1">{v.descriptionKurdish}</p>
                </div>
                <button
                  onClick={() => onQuickLaunchTTS(v.sampleBadiniText, v.id, v.region)}
                  className="w-full py-1.5 rounded-lg bg-slate-800/80 hover:bg-violet-600 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  بکارئینان د TTS دا
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Cloud Projects or Story Quick Start */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                {recentProjects.length > 0 ? 'دوماهی پڕۆژەیێن تە' : 'جۆرێن چیرۆکێن بادینی'}
              </h3>
              <p className="text-xs text-slate-400">
                {recentProjects.length > 0 ? 'Recent Cloud Projects' : 'AI Story Categories'}
              </p>
            </div>
            <button
              onClick={() => onNavigate(recentProjects.length > 0 ? 'projects' : 'story')}
              className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              زێدەتر
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentProjects.length > 0 ? (
            <div className="space-y-2.5">
              {recentProjects.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onNavigate('projects')}
                  className="w-full text-right rounded-xl bg-[#070910] border border-slate-800/80 hover:border-violet-500/40 p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.title}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {p.category} · {p.linesCount} دیمەن
                    </div>
                  </div>
                  <FolderKanban className="w-4 h-4 text-violet-400 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {STORY_CATEGORIES.slice(0, 6).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onSelectStoryCategory(cat.id)}
                  className="text-right rounded-xl bg-[#070910] border border-slate-800/80 hover:border-violet-500/40 p-3 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">{cat.titleKurdish}</div>
                  <div className="text-[11px] text-slate-400 truncate">{cat.titleEnglish}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
