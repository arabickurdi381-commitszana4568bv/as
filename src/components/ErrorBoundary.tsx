import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
  details?: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'هەڵەیەکا نەچاڤەرێکری ڕوویدا.';
    let details: string | undefined;

    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error && parsed.operationType) {
        message = `هەڵە د پەیوەندییا بنکەیا زانیارییان دا (${parsed.operationType}): ${parsed.error}`;
        details = parsed.path ? `Path: ${parsed.path}` : undefined;
      }
    } catch {
      // plain string error
    }

    return { hasError: true, message, details };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Badini Studio ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#070910] text-slate-100 flex items-center justify-center p-6"
        >
          <div className="max-w-lg w-full rounded-2xl bg-[#0d1221] border border-rose-500/30 p-7 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  هەڵەیەک د ستۆدیۆیێ دا ڕوویدا
                </h2>
                <p className="text-xs text-slate-400">
                  Studio Runtime Recovery
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed bg-[#070910] rounded-xl p-4 border border-slate-800/80">
              {this.state.message}
            </p>

            {this.state.details && (
              <p className="text-xs font-mono-num text-slate-400" dir="ltr">
                {this.state.details}
              </p>
            )}

            <button
              onClick={() => {
                this.setState({ hasError: false, message: '', details: undefined });
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              نویکرنا ستۆدیۆیێ (Reload Studio)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
