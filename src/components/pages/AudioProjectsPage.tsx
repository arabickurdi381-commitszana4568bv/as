import React, { useMemo, useState } from 'react';
import {
  Clock,
  FolderKanban,
  Loader2,
  LogIn,
  Search,
  Theater,
  Trash2,
} from 'lucide-react';
import { AudioProjectDoc, NavPage } from '../../types/studio';

interface AudioProjectsPageProps {
  isSignedIn: boolean;
  onSignIn: () => void;
  projects: AudioProjectDoc[];
  onLoadProject: (project: AudioProjectDoc) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onNavigate: (page: NavPage) => void;
}

export const AudioProjectsPage: React.FC<AudioProjectsPageProps> = ({
  isSignedIn,
  onSignIn,
  projects,
  onLoadProject,
  onDeleteProject,
  onNavigate,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'tts' | 'story' | 'dialogue'>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (typeFilter !== 'all' && p.projectType !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.scriptText.toLowerCase().includes(q)
      );
    });
  }, [projects, search, typeFilter]);

  if (!isSignedIn) {
    return (
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-10 text-center max-w-xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-400 flex items-center justify-center mx-auto">
          <FolderKanban className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">پڕۆژەیێن تە یێن دەنگی ل هەوری</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          ژ بۆ پاشەکەوتکرن و ڤەکرنا پڕۆژەیێن چیرۆک و TTS یێن خۆ ژ هەر ئامێرەکێ، ب هەژمارا Google بچۆ ژوور.
        </p>
        <button
          onClick={onSignIn}
          className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          چوونا ژوور ب Google
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'هەمی' },
            { id: 'tts', label: 'نڤێسین بۆ دەنگ' },
            { id: 'dialogue', label: 'فرە-کەسایەتی' },
            { id: 'story', label: 'چیرۆک' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-violet-600 text-white font-semibold'
                  : 'bg-[#070910] text-slate-400 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="گەڕیان د پڕۆژەیان دا..."
            className="w-full rounded-xl bg-[#070910] border border-slate-800 pr-9 pl-3 py-2 text-xs text-white outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-10 text-center space-y-3">
          <p className="text-sm text-slate-300">هێشتا چ پڕۆژە نەهاتینە پاشەکەوتکرن.</p>
          <button
            onClick={() => onNavigate('studio')}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white cursor-pointer"
          >
            دروستکرنا پڕۆژەیێ ئێکێ
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((proj) => {
            const busy = loadingId === proj.id;
            return (
              <div
                key={proj.id}
                className="rounded-2xl bg-[#0d1221] border border-slate-800/80 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-white line-clamp-1">{proj.title}</h3>
                    <span className="text-[11px] font-mono-num text-violet-400 uppercase shrink-0">
                      {proj.projectType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-num">
                    <span>{proj.category}</span>
                    <span>·</span>
                    <span>{proj.linesCount} دیمەن</span>
                    {proj.totalDurationSec > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {proj.totalDurationSec}s
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed bg-[#070910] rounded-xl p-3 border border-slate-800/70">
                    {proj.scriptText}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setLoadingId(proj.id);
                      try {
                        await onLoadProject(proj);
                      } finally {
                        setLoadingId(null);
                      }
                    }}
                    disabled={busy}
                    className="flex-1 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Theater className="w-3.5 h-3.5" />
                    )}
                    ڤەکرن د ستۆدیۆیێ دا
                  </button>

                  <button
                    onClick={() => onDeleteProject(proj.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    aria-label="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
