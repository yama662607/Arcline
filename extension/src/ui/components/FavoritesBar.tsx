import { useDroppable } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useRemoveFromFavorites } from '@/hooks/use-spaces-query';
import { ServiceWorkerBridge } from '@/lib/service-worker-bridge';
import type { TabEntry } from '@/shared/types';
import { TabContextMenu } from '@/ui/components/context-menu/TabContextMenu';
import { setDragData } from '@/ui/hooks/use-tab-drag-drop';

/**
 * Calculate optimal icon size based on number of favorites
 * Max grid: 4 columns × 3 rows = 12 items
 */

interface FavoritesBarProps {
  pinnedTabs: TabEntry[];
}

const FaviconItem = React.forwardRef<
  HTMLDivElement,
  {
    tab: TabEntry;
    size: number;
    onTabSelect: (tab: TabEntry) => void;
    onRemove: (tab: TabEntry, event: React.MouseEvent<HTMLButtonElement>) => void;
  } & Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragStart' | 'onDragEnd'>
>(({ tab, size, onTabSelect, onRemove, ...props }, ref) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      console.log('[FavoritesBar] DragStart from favorite:', tab.title);
      setIsDragging(true);
      setDragData(e, tab, 'favorite');
    },
    [tab]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTabSelect(tab);
      }
    },
    [onTabSelect, tab]
  );

  const iconSize = 15; // Slightly smaller icons like Arc

  return (
    <div
      {...props}
      ref={ref}
      className={`group relative flex flex-shrink-0 cursor-pointer items-center justify-center transition-all duration-200 ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-[1.02] hover:brightness-110'} bg-[rgba(45,55,80,0.2)] border border-white/10 active:scale-95`}
      style={{
        aspectRatio: '1.35',
        borderRadius: '11px',
        ...props.style,
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onTabSelect(tab)}
      onKeyDown={handleKeyDown}
      title={`${tab.title}\n${tab.url}`}
      role="button"
      tabIndex={0}
    >
      {tab.favIconUrl ? (
        <div className="relative flex items-center justify-center w-full h-full pointer-events-none">
          <img
            src={tab.favIconUrl}
            alt=""
            className="rounded-sm object-contain"
            style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      ) : (
        <Star
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          className="text-white/60 group-hover:text-white"
        />
      )}

      {/* Remove button (visible on hover) */}
      <button
        type="button"
        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-slate-400 shadow opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100 z-10 border border-white/10"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(tab, e);
        }}
        title="Remove from favorites"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
});

function Placeholder({ onClose: _onClose }: { onClose?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="col-span-4 py-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 text-center"
    >
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <Star className="h-5 w-5 text-white/40" />
      </div>
      <div className="text-xs font-medium text-white/80">Favorites</div>
      <div className="text-[10px] text-white/40 mt-1 max-w-[150px]">
        Drag frequently used tabs here
      </div>
    </motion.div>
  );
}

export function FavoritesBar({ pinnedTabs }: FavoritesBarProps) {
  const queryClient = useQueryClient();
  const bridge = useMemo(() => new ServiceWorkerBridge(queryClient), [queryClient]);
  const { mutate: removeFromFavorites } = useRemoveFromFavorites();
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // useDroppable hook from dnd-kit
  const { isOver, setNodeRef } = useDroppable({
    id: 'favorites-zone',
  });

  const handleSelectTab = useCallback(
    async (tab: TabEntry) => {
      try {
        await bridge.openUrlInTab(tab.url);
      } catch (error) {
        console.error('[FavoritesBar] Failed to open favorite:', error);
      }
    },
    [bridge]
  );

  const handleRemoveTab = useCallback(
    (tab: TabEntry, event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      removeFromFavorites(tab.url);
    },
    [removeFromFavorites]
  );

  const handleClosePlaceholder = useCallback(() => {
    setShowPlaceholder(false);
  }, []);

  const showPlaceholderUI = pinnedTabs.length === 0 && showPlaceholder;

  return (
    <div className="px-2 py-4 backdrop-blur-sm">
      {/* Content */}
      <div
        ref={setNodeRef}
        className={`rounded-2xl transition-all duration-300 ${
          isOver ? 'bg-blue-500/10 ring-2 ring-blue-500/30' : ''
        }`}
        role="region"
        aria-label="Favorites drop zone"
      >
        <AnimatePresence mode="popLayout">
          {showPlaceholderUI ? (
            <div className="grid grid-cols-4 gap-1.5">
              <Placeholder key="placeholder" onClose={handleClosePlaceholder} />
            </div>
          ) : pinnedTabs.length === 0 ? (
            <motion.div className="flex h-12 items-center justify-center text-xs text-white/30 italic">
              Drop to favorite
            </motion.div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              <AnimatePresence mode="popLayout">
                {pinnedTabs.map((tab) => (
                  <TabContextMenu key={tab.url} tab={tab}>
                    <FaviconItem
                      tab={tab}
                      size={0} // Size controlled by grid now
                      onTabSelect={handleSelectTab}
                      onRemove={handleRemoveTab}
                    />
                  </TabContextMenu>
                ))}
              </AnimatePresence>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      {pinnedTabs.length > 0 && <div className="mt-4 h-px bg-white/5 w-full mx-auto" />}
    </div>
  );
}
