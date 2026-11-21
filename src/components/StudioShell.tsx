import React, { useState } from 'react';
import {
  AudioLines,
  BookOpenText,
  CreditCard,
  FolderKanban,
  Home,
  Instagram,
  Library,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Mic2,
  Settings,
  Theater,
  UserCircle2,
  Volume2,
  X,
} from 'lucide-react';
import { NavPage, UserProfileDoc } from '../types/studio';
import { User } from 'firebase/auth';
import { GammaIcon } from './pages/PresentationPage';

interface StudioShellProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  user: User | null;
  userProfile: UserProfileDoc | null;
  customVoicesCount: number;
  projectsCount: number;
  onSignIn: () => void;
  onSignOut: () => void;
  authBusy: boolean;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: NavPage;
  labelKurdish: string;
  labelEnglish: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'home', labelKurdish: 'سەرەکی', labelEnglish: 'Home', icon: Home },
  { id: 'tts', labelKurdish: 'نڤێسین بۆ دەنگ', labelEnglish: 'Text to Speech', icon: Volume2 },
  { id: 'voices', labelKurdish: 'پەرتووکخانا دەنگان', labelEnglish: 'Voice Library', icon: Library },
  { id: 'story', labelKurdish: 'ئافرێنەرێ چیرۆکان', labelEnglish: 'AI Story Creator', icon: BookOpenText },
  { id: 'studio', labelKurdish: 'ستۆدیۆیا فرە-کەسایەتی', labelEnglish: 'Multi-Character Studio', icon: Theater },
  { id: 'presentation', labelKurdish: 'پرێزنتەیشن و Gamma', labelEnglish: 'Gamma Presentations', icon: GammaIcon },
  { id: 'projects', labelKurdish: 'پڕۆژەیێن دەنگی', labelEnglish: 'Audio Projects', icon: FolderKanban },
  { id: 'my-voices', labelKurdish: 'دەنگێن من یێن تایبەت', labelEnglish: 'My Voice Library', icon: Mic2 },
  { id: 'settings', labelKurdish: 'ڕێکخستن', labelEnglish: 'Settings', icon: Settings },
  { id: 'plans', labelKurdish: 'پلانێن بەشداریێ', labelEnglish: 'Subscription Plans', icon: CreditCard },
];

export const StudioShell: React.FC<StudioShellProps> = ({
  activePage,
  onNavigate,
  user,
  userProfile,
  customVoicesCount,
  projectsCount,
  onSignIn,
  onSignOut,
  authBusy,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentItem = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  const handleSelectPage = (page: NavPage) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#070910] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 bg-[#0b0f1d] border-l border-slate-800/70 z-30">
        {/* Brand */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/70">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-950/50 shrink-0">
            <AudioLines className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-white truncate">
              سایتی Zana Rajab
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Badini Voice & Gamma Studio
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const countHint =
              item.id === 'projects' && projectsCount > 0
                ? projectsCount
                : item.id === 'my-voices' && customVoicesCount > 0
                ? customVoicesCount
                : null;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectPage(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-l from-violet-600/25 to-indigo-600/10 text-white border border-violet-500/35 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-violet-400' : 'text-slate-500'
                    }`}
                  />
                  <div className="text-right min-w-0">
                    <div className="font-medium truncate leading-tight">
                      {item.labelKurdish}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate" dir="ltr">
                      {item.labelEnglish}
                    </div>
                  </div>
                </div>
                {countHint !== null && (
                  <span className="text-[11px] font-mono-num text-slate-400">
                    {countHint}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Owner Quick Contact + Auth Footer */}
        <div className="p-3.5 border-t border-slate-800/70 bg-[#080c18] space-y-3">
          <div className="rounded-xl bg-[#0d1221] border border-slate-800/80 p-2.5 space-y-1.5">
            <div className="text-[11px] font-bold text-white">Zana Rajab — پەیوەندی</div>
            <div className="flex items-center gap-2">
              <a
                href="https://wa.me/9647515043506"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 text-[11px] font-mono-num flex items-center justify-center gap-1.5 transition-colors"
                dir="ltr"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                07515043506
              </a>
              <a
                href="https://www.instagram.com/eng.zana_?dmpr=eWp4OWtiY3JzcXZr&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-2.5 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/25 text-fuchsia-300 text-[11px] flex items-center justify-center gap-1 transition-colors"
                title="Instagram @eng.zana_"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>انستا</span>
              </a>
            </div>
          </div>

          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-9 h-9 rounded-lg object-cover border border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-violet-400">
                    <UserCircle2 className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {userProfile?.displayName || user.displayName || 'Creator'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate" dir="ltr">
                    Plan: {userProfile?.plan?.toUpperCase() || 'FREE'}
                  </div>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="w-full py-2 px-3 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                دەرکەفتن (Sign Out)
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              disabled={authBusy}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              {authBusy ? 'چوونا ژوور...' : 'چوونا ژوور ب Google'}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0b0f1d] border-l border-slate-800 flex flex-col h-full z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <AudioLines className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm text-white">سایتی Zana Rajab</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectPage(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-violet-600/20 text-white border border-violet-500/35'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-violet-400' : 'text-slate-500'}`} />
                    <span className="font-medium">{item.labelKurdish}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <a
                  href="https://wa.me/9647515043506"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-mono-num flex items-center justify-center gap-1"
                  dir="ltr"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  07515043506
                </a>
                <a
                  href="https://www.instagram.com/eng.zana_?dmpr=eWp4OWtiY3JzcXZr&utm_source=qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-300 text-[11px] flex items-center gap-1"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  انستا
                </a>
              </div>
              {user ? (
                <button
                  onClick={onSignOut}
                  className="w-full py-2 rounded-lg bg-slate-800 text-slate-200 text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  دەرکەفتن (Sign Out)
                </button>
              ) : (
                <button
                  onClick={onSignIn}
                  disabled={authBusy}
                  className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  چوونا ژوور ب Google
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pr-72 flex flex-col min-w-0 min-h-screen">
        {/* Clean 3-Zone Top Bar */}
        <header className="h-16 sticky top-0 z-20 bg-[#070910]/85 backdrop-blur-md border-b border-slate-800/70 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white truncate">
                {currentItem.labelKurdish}
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate" dir="ltr">
                {currentItem.labelEnglish} — Duhok · Zakho · Amedi · Akre
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleSelectPage('studio')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <Theater className="w-3.5 h-3.5 text-violet-400" />
              ستۆدیۆیا درامایێ
            </button>
            {!user && (
              <button
                onClick={onSignIn}
                disabled={authBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                چوونا ژوور
              </button>
            )}
          </div>
        </header>

        {/* Page Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
