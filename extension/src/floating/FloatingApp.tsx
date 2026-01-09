import * as Dialog from '@radix-ui/react-dialog';
import { QueryClientProvider } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useCallback, useMemo, useRef, useState } from 'react';
import { queryClient } from '@/lib/query-client';
import { getSpaceTheme } from '@/lib/space-theme';
import { useSpacesSync } from '@/lib/useSpacesSync';
import { useSpacesStore } from '@/store';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { HeaderMenu } from '@/ui/components/HeaderMenu';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpacesWorkspace } from '@/ui/components/SpacesWorkspace';
import { TwoFingerMenu, type TwoFingerMenuContext } from '@/ui/components/TwoFingerMenu';
import { usePortalContainer } from '@/ui/contexts/PortalContext';
import { useTwoFingerTap, type TwoFingerTapEvent } from '@/hooks/use-two-finger-tap';

interface FloatingAppProps {
  pinned: boolean;
  onTogglePinned: () => void;
  onRequestClose: () => void;
}

function FloatingAppContent({ pinned, onTogglePinned, onRequestClose: _ }: FloatingAppProps) {
  useSpacesSync();

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const setIsModalOpen = useSpacesStore((state) => state.setIsModalOpen);
  const portalContainer = usePortalContainer();

  // Two-finger tap menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuContext, setMenuContext] = useState<TwoFingerMenuContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useMemo(() => {
    // Sync modal state to store
    setIsModalOpen(showSettings || showArchive);
  }, [showSettings, showArchive, setIsModalOpen]);

  const spaceTheme = getSpaceTheme(activeSpace?.themeColor);

  // Determine context from tap target
  const determineContext = useCallback(
    (target: Element | null): TwoFingerMenuContext | null => {
      if (!target || !activeSpace) return null;

      // Check if tapped on a tab row
      const tabRow = target.closest('[data-tab-id]');
      if (tabRow) {
        const tabId = Number(tabRow.getAttribute('data-tab-id'));
        const tabTitle = tabRow.getAttribute('data-tab-title') || 'Tab';
        const tabUrl = tabRow.getAttribute('data-tab-url') || '';
        return {
          type: 'tab',
          tab: { id: tabId, title: tabTitle, url: tabUrl },
        };
      }

      // Check if tapped on a pinned item
      const pinnedItem = target.closest('[data-pinned-item-id]');
      if (pinnedItem) {
        const itemUrl = pinnedItem.getAttribute('data-pinned-item-url') || '';
        const itemTitle = pinnedItem.getAttribute('data-pinned-item-title') || 'Item';
        return {
          type: 'tab',
          tab: { id: 0, title: itemTitle, url: itemUrl },
        };
      }

      // Check if tapped on a space dot
      const spaceDot = target.closest('[data-space-id]');
      if (spaceDot) {
        const spaceId = Number(spaceDot.getAttribute('data-space-id'));
        const tappedSpace = spaces.find((s) => s.id === spaceId);
        if (tappedSpace) {
          return { type: 'space', space: tappedSpace };
        }
      }

      // Default: empty area - show space menu for current space
      return { type: 'empty', space: activeSpace };
    },
    [activeSpace, spaces]
  );

  // Handle two-finger tap
  const handleTwoFingerTap = useCallback(
    (event: TwoFingerTapEvent) => {
      const context = determineContext(event.target);
      if (!context) return;

      setMenuPosition({ x: event.x, y: event.y });
      setMenuContext(context);
      setMenuOpen(true);
    },
    [determineContext]
  );

  // Set up two-finger tap detection on container
  const twoFingerTapRef = useTwoFingerTap<HTMLDivElement>({
    onTap: handleTwoFingerTap,
    disabled: showSettings || showArchive,
  });

  // Merge refs
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      (twoFingerTapRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [twoFingerTapRef]
  );

  return (
    <motion.div
      ref={setRefs}
      id="arcline-floating-ui-container"
      // Use a constant dark background with the theme gradient as a subtle overlay or blend
      // Arc's sidebar is usually a solid-ish blurred material.
      // We'll use the theme gradient but maybe tint it.
      animate={{ background: spaceTheme.gradient }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="flex h-full flex-col text-slate-100 backdrop-blur-3xl bg-opacity-90 rounded-[20px] overflow-hidden shadow-2xl border border-white/10"
      style={{
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.5)',
      }}
    >
      {/* Minimal header with actions only */}
      <header className="flex-shrink-0 flex items-center justify-end px-4 pt-3 pb-1">
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          id="header-actions"
        >
          <HeaderMenu
            onOpenSettings={() => setShowSettings(true)}
            onOpenArchive={() => setShowArchive(true)}
          />
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
              pinned ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
            onClick={onTogglePinned}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
          >
            {pinned ? 'PINNED' : 'PIN'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <SpacesWorkspace variant="floating" />
      </div>

      {/* Two-Finger Tap Menu */}
      {menuContext && (
        <TwoFingerMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          position={menuPosition}
          context={menuContext}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-0">
              <SettingsPanel variant="floating" />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Archive Modal */}
      {showArchive && (
        <Dialog.Root open={showArchive} onOpenChange={setShowArchive}>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-0">
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
