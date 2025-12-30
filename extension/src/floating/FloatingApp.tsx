import * as Dialog from '@radix-ui/react-dialog';
import { QueryClientProvider } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

import { getSpaceTheme } from '@/lib/space-theme';
import { queryClient } from '@/lib/query-client';
import { useSpacesSync } from '@/lib/useSpacesSync';
import { useSpacesStore } from '@/store';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { HeaderMenu } from '@/ui/components/HeaderMenu';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpacesWorkspace } from '@/ui/components/SpacesWorkspace';

interface FloatingAppProps {
  pinned: boolean;
  onTogglePinned: () => void;
  onRequestClose: () => void;
}

function FloatingAppContent({ pinned, onTogglePinned, onRequestClose }: FloatingAppProps) {
  useSpacesSync();

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const spaceTheme = getSpaceTheme(activeSpace?.themeColor);

  return (
    <motion.div
      id="arcline-floating-ui-container"
      animate={{ background: spaceTheme.gradient }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="flex h-full flex-col text-slate-100"
    >
      {/* Header with glass effect for readability */}
      <header className="flex items-center justify-between bg-black/30 backdrop-blur-md border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {activeSpace?.icon && <span className="text-lg">{activeSpace.icon}</span>}
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/50 font-medium">
              Arcline
            </p>
            <h1 className="text-sm font-semibold text-white drop-shadow-sm">
              {activeSpace?.name || 'Spaces'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium transition backdrop-blur-sm ${
              pinned
                ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/30'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
            }`}
            onClick={onTogglePinned}
          >
            {pinned ? '📌' : 'Pin'}
          </button>
          <HeaderMenu
            onOpenSettings={() => setShowSettings(true)}
            onOpenArchive={() => setShowArchive(true)}
          />
          <button
            type="button"
            className="rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-xs text-white/80 transition border border-white/10 backdrop-blur-sm"
            onClick={onRequestClose}
          >
            ×
          </button>
        </div>
      </header>

      {/* Main content - SpacesWorkspace handles its own gradient */}
      <div className="flex-1 overflow-hidden">
        <SpacesWorkspace variant="floating" />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl">
              <SettingsPanel variant="floating" />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Archive Modal */}
      {showArchive && (
        <Dialog.Root open={showArchive} onOpenChange={setShowArchive}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl">
              <ArchiveManager variant="floating" />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </motion.div>
  );
}

export default function FloatingApp(props: FloatingAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <FloatingAppContent {...props} />
    </QueryClientProvider>
  );
}
