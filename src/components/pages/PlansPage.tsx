import React, { useState } from 'react';
import { Check, CheckCircle2, Sparkles } from 'lucide-react';
import { UserProfileDoc } from '../../types/studio';

interface PlansPageProps {
  isSignedIn: boolean;
  onSignIn: () => void;
  userProfile: UserProfileDoc | null;
  onSelectPlan: (plan: 'free' | 'creator' | 'studio') => Promise<void>;
}

const PLANS: {
  id: 'free' | 'creator' | 'studio';
  nameKurdish: string;
  nameEnglish: string;
  priceLabel: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    id: 'free',
    nameKurdish: 'بەلاڤۆکا دەستپێکی (Free)',
    nameEnglish: 'Starter Studio',
    priceLabel: '$0 / مانگانە',
    description: 'بۆ تاقیکرنا دەنگێن بادینی و چیرۆکێن کورت.',
    features: [
      'دەستگەهشتن ب هەمی ١١ دەنگێن بادینی',
      'هەتا ١٠,٠٠٠ پیت د مانگێ دا',
      'هەناردەکرن ب فۆرماتێ WAV و MP3',
      'پاشەکەوتکرنا هەتا ٥ پڕۆژەیان ل هەوری',
    ],
  },
  {
    id: 'creator',
    nameKurdish: 'داهێنەرێ چیرۆکان (Creator Pro)',
    nameEnglish: 'Creator Pro',
    priceLabel: '$19 / مانگانە',
    description: 'بۆ چێکەرێن چیرۆک، یوتیوب، پۆدکاست و سیمیناران.',
    highlighted: true,
    features: [
      'هەتا ١٥٠,٠٠٠ پیت د مانگێ دا',
      'ستۆدیۆیا فرە-کەسایەتی بێ سنوورێ کەسایەتیان',
      'ڕاهێنان و تۆمارکرنا هەتا ٥ دەنگێن تایبەت',
      'مێکسەرێ مۆسیقا و کاریگەریێن دەنگی ب فایلا یەکپارچە',
    ],
  },
  {
    id: 'studio',
    nameKurdish: 'ستۆدیۆیا پیشەیی (Broadcast)',
    nameEnglish: 'Studio Broadcast',
    priceLabel: '$49 / مانگانە',
    description: 'بۆ دەزگەهێن راگەیاندن، بەڵگەنامەیی و بەرهەمئینانا درامایان.',
    features: [
      'پیتێن بێ سنوور بۆ پڕۆژەیێن درێژ (١٠٠+ دیمەن)',
      'گونجاندنا فەرهەنگا تایبەت ب شێوەزارێن دهۆک، زاخۆ، ئامێدی و ئاکرێ',
      'پشتگیرییا بەرهەمئینانا فایلا جودا بۆ هەر دیمەنەکی',
      'پڕۆژە و پەرتووکخانا دەنگێن تایبەت بێ سنوور',
    ],
  },
];

export const PlansPage: React.FC<PlansPageProps> = ({
  isSignedIn,
  onSignIn,
  userProfile,
  onSelectPlan,
}) => {
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const currentPlan = userProfile?.plan || 'free';

  const handleChoose = async (planId: 'free' | 'creator' | 'studio') => {
    if (!isSignedIn) {
      onSignIn();
      return;
    }
    setBusyPlan(planId);
    try {
      await onSelectPlan(planId);
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">پلانێن بەشداریێ (Subscription Plans)</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            پلانێ گونجای بۆ قەبارەیێ پڕۆژە و بەرهەمئینانا دەنگێ بادینی هەلبژێرە
          </p>
        </div>
        {userProfile && (
          <div className="text-xs font-mono-num text-slate-300 bg-[#070910] border border-slate-800 px-3.5 py-2 rounded-xl">
            Usage: {userProfile.charactersUsed.toLocaleString()} chars · Plan: {currentPlan.toUpperCase()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 flex flex-col justify-between gap-6 border ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-violet-950/40 to-[#0d1221] border-violet-500/50'
                  : 'bg-[#0d1221] border-slate-800/80'
              }`}
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs text-violet-400 font-semibold" dir="ltr">
                    {plan.nameEnglish}
                  </div>
                  <h3 className="text-lg font-bold text-white">{plan.nameKurdish}</h3>
                  <div className="text-2xl font-extrabold text-white font-mono-num pt-1">
                    {plan.priceLabel}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pt-1">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-2.5 pt-2 border-t border-slate-800/70">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleChoose(plan.id)}
                disabled={isCurrent || busyPlan === plan.id}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300'
                    : plan.highlighted
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {isCurrent ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    پلانێ تە یێ نها
                  </>
                ) : busyPlan === plan.id ? (
                  'چاڤەڕێ بە...'
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    چالاککرنا پلانێ
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
