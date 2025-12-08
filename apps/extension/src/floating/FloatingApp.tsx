import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query-client';
import { useSpacesSync } from '@/lib/useSpacesSync';
import { SpacesWorkspace } from '@/ui/components/SpacesWorkspace';

interface FloatingAppProps {
  pinned: boolean;
  onTogglePinned: () => void;
  onRequestClose: () => void;
}

function FloatingAppContent({ pinned, onTogglePinned, onRequestClose }: FloatingAppProps) {
  useSpacesSync();

  return (
    <div className="flex h-full flex-col bg-surface text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Arcline</p>
          <h1 className="text-sm font-semibold text-white">Spaces</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              pinned
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
            onClick={onTogglePinned}
          >
            {pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            type="button"
            className="rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/20"
            onClick={onRequestClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <SpacesWorkspace variant="floating" />
      </div>
    </div>
  );
}

export default function FloatingApp(props: FloatingAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <FloatingAppContent {...props} />
    </QueryClientProvider>
  );
}
