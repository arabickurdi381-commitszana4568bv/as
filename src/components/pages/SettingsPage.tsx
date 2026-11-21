import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cpu, LogIn, Save, ShieldCheck } from 'lucide-react';
import { BadiniDialect, UserProfileDoc } from '../../types/studio';
import { BADINI_DIALECTS } from '../../data/badiniVoices';

interface SettingsPageProps {
  isSignedIn: boolean;
  onSignIn: () => void;
  userProfile: UserProfileDoc | null;
  onSaveSettings: (updates: {
    displayName: string;
    defaultDialect: BadiniDialect;
    defaultFormat: 'wav' | 'mp3';
    defaultSpeed: number;
    adaptationEnabled: boolean;
  }) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  isSignedIn,
  onSignIn,
  userProfile,
  onSaveSettings,
}) => {
  const [displayName, setDisplayName] = useState(userProfile?.displayName || 'Badini Creator');
  const [defaultDialect, setDefaultDialect] = useState<BadiniDialect>(
    userProfile?.defaultDialect || 'duhok'
  );
  const [defaultFormat, setDefaultFormat] = useState<'wav' | 'mp3'>(
    userProfile?.defaultFormat || 'mp3'
  );
  const [defaultSpeed, setDefaultSpeed] = useState(userProfile?.defaultSpeed || 1.0);
  const [adaptationEnabled, setAdaptationEnabled] = useState(
    userProfile?.adaptationEnabled ?? true
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || 'Badini Creator');
      setDefaultDialect(userProfile.defaultDialect || 'duhok');
      setDefaultFormat(userProfile.defaultFormat || 'mp3');
      setDefaultSpeed(userProfile.defaultSpeed || 1.0);
      setAdaptationEnabled(userProfile.adaptationEnabled ?? true);
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) return;
    setSaving(true);
    try {
      await onSaveSettings({
        displayName,
        defaultDialect,
        defaultFormat,
        defaultSpeed,
        adaptationEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">ڕێکخستنێن ستۆدیۆیێ (Settings)</h2>
            <p className="text-xs text-slate-400">پەسندێن بنەڕەتی یێن دەنگ و هەناردەکرنێ</p>
          </div>
          {!isSignedIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 rounded-xl bg-violet-600 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              چوونا ژوور
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">ناڤێ بەکارهێنەری</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3.5 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">شێوەزارێ بنەڕەتی یێ بادینی</label>
            <select
              value={defaultDialect}
              onChange={(e) => setDefaultDialect(e.target.value as BadiniDialect)}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3.5 py-2.5 text-sm text-white outline-none"
            >
              {BADINI_DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameKurdish}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">فۆرماتێ هەناردەکرنێ</label>
            <select
              value={defaultFormat}
              onChange={(e) => setDefaultFormat(e.target.value as 'wav' | 'mp3')}
              className="w-full rounded-xl bg-[#070910] border border-slate-800 px-3.5 py-2.5 text-sm text-white outline-none"
            >
              <option value="mp3">MP3 (192kbps — گەلەک گونجای)</option>
              <option value="wav">WAV (24kHz PCM — کوالێتییا ستۆدیۆ)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">لەزاتییا بنەڕەتی (Default Speed)</span>
              <span className="font-mono-num text-violet-300">{defaultSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.4}
              step={0.05}
              value={defaultSpeed}
              onChange={(e) => setDefaultSpeed(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl bg-[#070910] border border-slate-800 p-4 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-white">
              سیستەمێ گونجاندنا فۆنەتیکا بادینی (Badini Phonetic Adaptation)
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              پیتێن بادینی وەک ڤ، ژ، چ، پ، ێ و فەرهەنگا تایبەتا بێژەکرنێ چالاک دکەت دا عەرەبی یان سۆرانی نەئێتە تێکەلکرن.
            </div>
          </div>
          <input
            type="checkbox"
            checked={adaptationEnabled}
            onChange={(e) => setAdaptationEnabled(e.target.checked)}
            className="w-5 h-5 accent-violet-600 shrink-0"
          />
        </label>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              گوهۆڕین هاتنە پاشەکەوتکرن
            </span>
          )}
          <button
            type="submit"
            disabled={!isSignedIn || saving}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-45 text-sm font-semibold text-white flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'پاشەکەوتکرن...' : 'پاشەکەوتکرنا ڕێکخستنان'}
          </button>
        </div>
      </form>

      {/* Transparent Provider Architecture Box */}
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-white font-bold text-base">
          <Cpu className="w-5 h-5 text-indigo-400" />
          تەلارسازییا تەکنیکی و شەفافییەتا دابینکەری (Backend AI Provider Transparency)
        </div>
        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2.5">
          <p>
            • <strong className="text-white">مۆدێلێ دەنگی:</strong>{' '}
            <span className="font-mono-num text-violet-300">gemini-3.8-flash-tts</span> (د گەل{' '}
            <span className="font-mono-num text-violet-300">gemini-3.8-flash-lite-tts</span> وەک پشتگیری) ل سەر ڕاژەکارێ پاراستی دهێتە بکارئینان ب رێکا کلیلێن ژینگەها سێرڤەری بێ دەرخستنا کلیلی بۆ بەکارهێنەران.
          </p>
          <p>
            • <strong className="text-white">سنوورداری و چارەسەری:</strong> هەتا نهو چ مۆدێلەکێ جیهانی یێ TTS یێ تایبەت ب «کوردیا بادینی» نینە. ل شوونا وێ کو ب بێدەنگی عەرەبی یان سۆرانی ل شوونا بادینی بهێتە نیشاندان، ئەڤ پلاتفۆرمە ب ڕاشکاوی ئەوێ سنوورداریێ ڕوون دکەت و چارەسەرییا فەرهەنگا بێژەکرنێ + ڕاهێنانا دەنگێ کەسی دابین دکەت.
          </p>
          <div className="flex items-center gap-2 text-emerald-400 text-xs pt-1">
            <ShieldCheck className="w-4 h-4" />
            هەمی کلیلێن API ل سەر سێرڤەری دهێنە پاراستن و پڕۆژە ل سەر Firebase Firestore دهێنە هەڵگرتن.
          </div>
        </div>
      </div>
    </div>
  );
};
