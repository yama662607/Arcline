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
function calculateIconSize(count: number): { size: number; cols: number; rows: number } {
  if (count === 0) return { size: 40, cols: 0, rows: 0 };
  if (count <= 4) return { size: 48, cols: count, rows: 1 }; // 1 row
  if (count <= 8) return { size: 44, cols: 4, rows: 2 }; // 2 rows
  return { size: 40, cols: 4, rows: 3 }; // 3 rows (max 12 items)
}

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

  const iconSize = Math.floor(size * 0.5); // Icon is 50% of container

  return (
    // @ts-expect-error
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      ref={ref}
      className={`group relative flex flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/5 bg-white/5 shadow-sm transition-all hover:bg-white/10 hover:shadow-md hover:ring-1 hover:ring-white/20 ${
        isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''
      }`}
      style={{ width: `${size}px`, height: `${size}px` }}
      draggable
      onDragStart={handleDragStart as any}
      onDragEnd={handleDragEnd as any}
      onClick={() => onTabSelect(tab)}
      onKeyDown={handleKeyDown}
      title={`${tab.title}\n${tab.url}`}
      role="button"
      tabIndex={0}
      {...props}
    >
      {/* Favicon */}
      {tab.favIconUrl ? (
        <img
          src={tab.favIconUrl}
          alt=""
          className="rounded-sm transition-transform group-hover:scale-110"
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : (
        <Star
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          className="text-muted-foreground group-hover:text-primary"
        />
      )}

      {/* Remove button (visible on hover) */}
      <button
        type="button"
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 scale-90 items-center justify-center rounded-full bg-background shadow-md opacity-0 transition-all hover:bg-destructive hover:text-white group-hover:scale-100 group-hover:opacity-100 ring-1 ring-border"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(tab, e);
        }}
        title="Remove from favorites"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
});

function Placeholder({ onClose }: { onClose?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-center backdrop-blur-sm"
    >
      {onClose && (
        <button
          type="button"
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <Star className="mb-2 h-6 w-6 text-muted-foreground/50" />
      <div className="text-sm font-medium text-foreground">Drag to add Favorites</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Keep your top sites handy across spaces
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

  // Calculate optimal icon size based on number of favorites
  const {
    size: iconSize,
    cols,
    rows,
  } = useMemo(() => calculateIconSize(pinnedTabs.length), [pinnedTabs.length]);

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
    <div className="border-b border-border bg-card/50 px-3 py-3 backdrop-blur-md transition-colors hover:bg-card/80">
      {/* Content */}
      <div
        ref={setNodeRef}
        className={`min-h-[3rem] rounded-xl transition-all duration-300 ${
          isOver
            ? 'bg-primary/10 ring-2 ring-primary/50 shadow-[0_0_15px_rgba(var(--color-primary),0.3)]'
            : ''
        }`}
        role="region"
        aria-label="Favorites drop zone"
      >
        <AnimatePresence mode="popLayout">
          {showPlaceholderUI ? (
            <Placeholder key="placeholder" onClose={handleClosePlaceholder} />
          ) : pinnedTabs.length === 0 ? (
            <motion.div className="flex h-12 items-center justify-center text-xs text-muted-foreground/50 italic">
              Start dragging here...
            </motion.div>
          ) : (
            <div
              className="grid gap-2 mx-auto justify-center"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${iconSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${iconSize}px)`,
              }}
            >
              <AnimatePresence mode="popLayout">
                {pinnedTabs.map((tab) => (
                  <TabContextMenu key={tab.url} tab={tab}>
                    <FaviconItem
                      tab={tab}
                      size={iconSize}
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
    </div>
  );
}
