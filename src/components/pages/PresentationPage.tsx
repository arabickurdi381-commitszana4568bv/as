import React, { useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { BadiniDialect, PresentationDeck } from '../../types/studio';

interface PresentationPageProps {
  onSendNotesToTTS: (text: string, dialect: BadiniDialect) => void;
}

/** Crisp custom Gamma geometric brand icon */
export const GammaIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="gammaGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="50%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#gammaGrad)" fillOpacity="0.18" stroke="url(#gammaGrad)" strokeWidth="1.6" />
    <path
      d="M7.5 8.2C9.2 8.2 10.6 9.8 11.7 13.3C12.7 10.4 14.3 8.2 16.5 8.2M11.7 13.3L10.3 17.6"
      stroke="url(#gammaGrad)"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SLIDE_THEMES = [
  { id: 'obsidian', label: 'Obsidian Purple', bg: 'bg-gradient-to-br from-[#0d1221] via-[#131836] to-[#1e1133]', text: 'text-white', accent: 'text-violet-300' },
  { id: 'cobalt', label: 'Deep Cobalt', bg: 'bg-gradient-to-br from-[#091224] via-[#0f2247] to-[#081730]', text: 'text-slate-50', accent: 'text-sky-300' },
  { id: 'ivory', label: 'Academic Light', bg: 'bg-gradient-to-br from-slate-50 to-slate-200', text: 'text-slate-900', accent: 'text-indigo-600' },
] as const;

export const PresentationPage: React.FC<PresentationPageProps> = ({
  onSendNotesToTTS,
}) => {
  const [activeTab, setActiveTab] = useState<'studio' | 'gamma-control'>('studio');

  // Builder form state
  const [topic, setTopic] = useState(
    'ئەندازیارییا ژیرییا دەستکرد و تەکنۆلۆژیا دەنگێ کوردی ل کوردستانێ'
  );
  const [slidesCount, setSlidesCount] = useState(7);
  const [language, setLanguage] = useState('Kurdish Badini (کوردی بادینی)');
  const [audience, setAudience] = useState('University Seminar & Research');
  const [tone, setTone] = useState('Modern, Clear & Persuasive');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deck, setDeck] = useState<PresentationDeck | null>(null);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [slideTheme, setSlideTheme] = useState<'obsidian' | 'cobalt' | 'ivory'>('obsidian');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Gamma embedded workspace state
  const [gammaTargetUrl, setGammaTargetUrl] = useState('https://gamma.app/create');
  const [iframeKey, setIframeKey] = useState(0);

  const handleGeneratePresentation = async () => {
    if (!topic.trim()) {
      setErrorMsg('تکایە بابەتێ پرێزنتەیشنێ بنڤیسە.');
      return;
    }
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const resp = await fetch('/api/badini/presentation-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          slidesCount,
          language,
          audience,
          tone,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'دروستکرنا پرێزنتەیشنێ سەرنەکەفت.');
      }
      setDeck(data.deck);
      setCurrentSlideIdx(0);
    } catch (err: any) {
      setErrorMsg(err?.message || 'هەڵەیەک د ئافراندنا سلایدان دا ڕوویدا.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyGammaPrompt = async () => {
    const content =
      deck?.gammaReadyPrompt ||
      `Create a ${slidesCount}-slide presentation in ${language} about: ${topic}\nAudience: ${audience}\nStyle: ${tone}`;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // clipboard blocked fallback
    }
  };

  const handleExportHtmlDeck = () => {
    if (!deck) return;
    const slidesHtml = deck.slides
      .map(
        (s) => `
      <section class="slide">
        <div class="num">Slide ${s.slideNumber}</div>
        <h2>${escapeHtml(s.title)}</h2>
        <ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        <div class="notes"><strong>Speaker Notes:</strong> ${escapeHtml(s.speakerNotes)}</div>
      </section>`
      )
      .join('\n');

    const html = `<!doctype html>
<html lang="ku" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(deck.title)} — Zana Rajab Studio</title>
<style>
  body { font-family: system-ui, sans-serif; background: #070910; color: #f1f5f9; margin: 0; padding: 32px; }
  header { max-width: 900px; margin: 0 auto 32px; border-bottom: 1px solid #1e293b; padding-bottom: 16px; }
  h1 { margin: 0 0 8px; font-size: 28px; }
  .sub { color: #94a3b8; font-size: 14px; }
  .slide { max-width: 900px; margin: 0 auto 24px; background: #0d1221; border: 1px solid #1e293b; border-radius: 16px; padding: 28px; }
  .num { color: #a78bfa; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
  h2 { margin: 0 0 16px; font-size: 22px; }
  ul { line-height: 1.9; font-size: 16px; }
  .notes { margin-top: 18px; padding-top: 12px; border-top: 1px dashed #334155; font-size: 13px; color: #cbd5e1; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(deck.title)}</h1>
    <div class="sub">${escapeHtml(deck.subtitle)} · Prepared in سایتی Zana Rajab</div>
  </header>
  ${slidesHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zana-rajab-presentation.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const escapeHtml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const activeSlide = deck?.slides?.[currentSlideIdx];
  const themeStyle = SLIDE_THEMES.find((t) => t.id === slideTheme) || SLIDE_THEMES[0];

  return (
    <div className="space-y-6">
      {/* Header Banner with Gamma Icon & Direct Gamma Links */}
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#070910] border border-violet-500/30 flex items-center justify-center shrink-0">
            <GammaIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              ستۆدیۆیا دروستکرنا پرێزنتەیشن و کۆنترۆڵکرنا Gamma
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              پرێزنتەیشنێن ئەکادیمی و کارسازی ب ژیرییا دەستکرد ل ڤێرە دروست بکە، سلایدان ببینە و ب HTML داگرە، یان راستەوخۆ کۆنترۆڵا سایتی <span dir="ltr" className="text-violet-300 font-semibold">gamma.app</span> بکە و دەقی ب ئێک کلیک ڤەگوهێزە ناڤ Gamma.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="https://gamma.app/create"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <GammaIcon className="w-4 h-4" />
            ڤەکرنا Gamma Create
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href="https://gamma.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-violet-400" />
            Gamma.app
          </a>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('studio')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'studio'
              ? 'bg-violet-600 text-white'
              : 'bg-[#0d1221] border border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Presentation className="w-4 h-4" />
          ١. ئافرێنەرێ سلایدان و پڕۆمپتێن Gamma
        </button>

        <button
          onClick={() => setActiveTab('gamma-control')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'gamma-control'
              ? 'bg-violet-600 text-white'
              : 'bg-[#0d1221] border border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <GammaIcon className="w-4 h-4" />
          ٢. پەنجەرەیا کۆنترۆڵکرنا سایتی Gamma د ناڤ سایتەکی دا
        </button>
      </div>

      {activeTab === 'studio' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="xl:col-span-5 rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-400" />
              زانیاریێن پرێزنتەیشنێ (Presentation Architect)
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 block">بابەت یان دەقێ پرێزنتەیشنێ</label>
              <textarea
                rows={4}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مژارا سەرەکی یا پرێزنتەیشنێ بنڤیسە..."
                className="w-full rounded-xl bg-[#070910] border border-slate-800 focus:border-violet-500 p-3 text-sm text-white leading-relaxed outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 block">زمانێ سلایدان</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="Kurdish Badini (کوردی بادینی)">کوردی بادینی</option>
                  <option value="Kurdish Sorani (کوردی سۆرانی)">کوردی سۆرانی</option>
                  <option value="English">English</option>
                  <option value="Arabic (العربية)">العربية</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 block">ژمارا سلایدان</label>
                <select
                  value={slidesCount}
                  onChange={(e) => setSlidesCount(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-xs text-white outline-none"
                >
                  {[5, 7, 10, 12, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} سلاید
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 block">جۆرێ ئامادەبووان</label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-xs text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300 block">ستایل و تۆن</label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleGeneratePresentation}
              disabled={isGenerating}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  سلاید دهێنە دروستکرن...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  دروستکرنا پرێزنتەیشنێ ب AI
                </>
              )}
            </button>

            {errorMsg && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Quick Gamma Bridge Actions */}
            <div className="rounded-xl bg-[#070910] border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <GammaIcon className="w-4 h-4" />
                  ئامادەکرنا دەقی بۆ سایتی Gamma
                </span>
                <button
                  onClick={handleCopyGammaPrompt}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      کۆپی بوو
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-violet-400" />
                      کۆپی بۆ Gamma
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ل سەر کۆپی کلیک بکە و د ناڤ <span dir="ltr" className="text-slate-300">Gamma → Paste in text</span> دا پەیست بکە دا دیزاینێ ئۆتۆماتیکی ب گەل وێنەیان بۆ تە چێکەت.
              </p>
            </div>
          </div>

          {/* Interactive Slide Viewer Column */}
          <div className="xl:col-span-7 space-y-4">
            {deck ? (
              <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{deck.title}</h3>
                    <p className="text-xs text-slate-400">{deck.subtitle}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={slideTheme}
                      onChange={(e) => setSlideTheme(e.target.value as any)}
                      className="rounded-lg bg-[#070910] border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                    >
                      {SLIDE_THEMES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleExportHtmlDeck}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-violet-400" />
                      داگرتنا HTML
                    </button>

                    <button
                      onClick={() => {
                        const fullNotes = deck.slides
                          .map((s) => `${s.title}. ${s.speakerNotes}`)
                          .join('\n\n');
                        onSendNotesToTTS(fullNotes, 'duhok');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      خواندن ب دەنگێ بادینی
                    </button>
                  </div>
                </div>

                {/* Active 16:9 Slide Canvas */}
                {activeSlide && (
                  <div
                    className={`rounded-2xl border border-slate-700/60 p-6 sm:p-8 min-h-[320px] flex flex-col justify-between gap-6 ${themeStyle.bg} ${themeStyle.text}`}
                  >
                    <div className="space-y-4">
                      <div className={`text-xs font-mono-num font-bold ${themeStyle.accent}`}>
                        SLIDE {activeSlide.slideNumber} / {deck.slides.length}
                      </div>
                      <h4 className="text-xl sm:text-2xl font-extrabold leading-snug">
                        {activeSlide.title}
                      </h4>
                      <ul className="space-y-2.5 text-sm sm:text-base leading-relaxed list-disc pr-5">
                        {activeSlide.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 border-t border-current/15 text-xs opacity-80 space-y-1">
                      <div>
                        <strong>Visual Idea:</strong> {activeSlide.visualIdea}
                      </div>
                      <div>
                        <strong>Speaker Notes:</strong> {activeSlide.speakerNotes}
                      </div>
                    </div>
                  </div>
                )}

                {/* Slide Controls */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentSlideIdx((i) => Math.max(0, i - 1))}
                    disabled={currentSlideIdx === 0}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    سلایدا بەرێ
                  </button>

                  <span className="text-xs font-mono-num text-slate-400">
                    {currentSlideIdx + 1} / {deck.slides.length}
                  </span>

                  <button
                    onClick={() =>
                      setCurrentSlideIdx((i) => Math.min(deck.slides.length - 1, i + 1))
                    }
                    disabled={currentSlideIdx === deck.slides.length - 1}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                  >
                    سلایدا پاشتر
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-10 text-center space-y-4 min-h-[380px] flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-[#070910] border border-violet-500/30 flex items-center justify-center">
                  <GammaIcon className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-white">
                    پێشاندانا سلایدان ل ڤێرە دێ دیار بیت
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    مژارا خۆ بنڤیسە و کلیک ل سەر «دروستکرنا پرێزنتەیشنێ ب AI» بکە دا هەمی سلاید، پەیڤێن پێشکێشکار و پڕۆمپتێ ئامادە یێ سایتی Gamma بۆ تە دروست بکەت.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Dedicated Gamma Live Control Workspace */
        <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setGammaTargetUrl('https://gamma.app/create');
                  setIframeKey((k) => k + 1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  gammaTargetUrl === 'https://gamma.app/create'
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#070910] border border-slate-800 text-slate-300'
                }`}
              >
                Gamma Create
              </button>
              <button
                onClick={() => {
                  setGammaTargetUrl('https://gamma.app/');
                  setIframeKey((k) => k + 1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  gammaTargetUrl === 'https://gamma.app/'
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#070910] border border-slate-800 text-slate-300'
                }`}
              >
                Gamma Home
              </button>
              <button
                onClick={() => {
                  setGammaTargetUrl('https://gamma.app/templates');
                  setIframeKey((k) => k + 1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  gammaTargetUrl === 'https://gamma.app/templates'
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#070910] border border-slate-800 text-slate-300'
                }`}
              >
                Gamma Templates
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyGammaPrompt}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-violet-400" />}
                کۆپیکرنا پرێزنتەیشنێ
              </button>
              <button
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                aria-label="Reload Gamma frame"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <a
                href={gammaTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1.5"
              >
                ڤەکرن د پەنجەرەیا سەرەکی دا
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="rounded-xl bg-[#070910] border border-slate-800 p-3 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>
              تێبینی: ئەگەر براوسەرێ تە پەنجەرەیا دەرەکی د ناڤ ئایفرەیمێ دا رێگری لێ کر (X-Frame security)، ب ئێک کلیک ل سەر «ڤەکرن د پەنجەرەیا سەرەکی دا» سایتی Gamma د تابەکێ نوی دا ڤەدبیت و پرێزنتەیشنا تە کۆپی کرییە.
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#070910] h-[620px]">
            <iframe
              key={iframeKey}
              src={gammaTargetUrl}
              title="Gamma Presentation Control"
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      )}
    </div>
  );
};
