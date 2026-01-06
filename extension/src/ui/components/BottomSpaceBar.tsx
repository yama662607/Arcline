import { AnimatePresence, motion } from 'framer-motion';
import { Check, MoreVertical, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getSpaceDisplayIcon, getSpaceTheme } from '@/lib/space-theme';
import type { SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store/spacesSlice';

interface BottomSpaceBarProps {
  variant?: 'standalone' | 'floating';
  onManageSpaces?: () => void;
}

interface SpaceBadgeProps {
  space: SpaceSnapshot;
  isActive: boolean;
  onClick: () => void;
}

function SpaceBadge({ space, isActive, onClick }: SpaceBadgeProps) {
  const theme = getSpaceTheme(space.themeColor);
  const icon = getSpaceDisplayIcon(space.icon, space.name);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
        isActive
          ? 'scale-110 ring-2 ring-white/50'
          : 'hover:scale-105 hover:ring-2 hover:ring-white/30'
      }`}
      style={{
        background: isActive ? theme.gradient : theme.gradientSubtle,
      }}
      title={space.name}
      aria-label={`Switch to ${space.name}`}
    >
      <span className="text-xs">{icon}</span>
      {isActive && (
        <motion.div
          layoutId="activeSpaceIndicator"
          className="absolute -bottom-1 h-0.5 w-5 rounded-full bg-white"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}

interface AllSpacesPopupProps {
  spaces: SpaceSnapshot[];
  activeSpaceId: number | null;
  onSelectSpace: (spaceId: number) => void;
  onManageSpaces: () => void;
}

function AllSpacesPopup({
  spaces,
  activeSpaceId,
  onSelectSpace,
  onManageSpaces,
}: AllSpacesPopupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 mb-2 rounded-lg border border-white/10 bg-black/40 p-2 shadow-xl backdrop-blur-md"
      style={{ minWidth: '200px' }}
    >
      <div className="mb-2 max-h-64 space-y-1 overflow-y-auto">
        {spaces.map((space) => {
          const theme = getSpaceTheme(space.themeColor);
          const icon = getSpaceDisplayIcon(space.icon, space.name);
          const isActive = space.id === activeSpaceId;

          return (
            <button
              type="button"
              key={space.uuid || space.id}
              onClick={() => onSelectSpace(space.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs"
                style={{ background: theme.gradientSubtle }}
              >
                {icon}
              </div>
              <span className="truncate">{space.name}</span>
              {isActive && <Check className="ml-auto h-4 w-4 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className="border-t border-white/10 pt-2">
        <button
          type="button"
          onClick={onManageSpaces}
          className="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Settings className="h-4 w-4" />
          Manage Spaces
        </button>
      </div>
    </motion.div>
  );
}

export function BottomSpaceBar({ onManageSpaces, variant = 'standalone' }: BottomSpaceBarProps) {
  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const favoriteSpaceIds = useSpacesStore((state) => state.favoriteSpaceIds);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const isFloatingVariant = variant === 'floating';

  // Listen for swipe progress events
  useEffect(() => {
    const handleSwipeProgress = (e: Event) => {
      const customEvent = e as CustomEvent<{ progress: number }>;
      setSwipeProgress(customEvent.detail.progress);
    };

    window.addEventListener('arcline-swipe-progress', handleSwipeProgress);
    return () => {
      window.removeEventListener('arcline-swipe-progress', handleSwipeProgress);
    };
  }, []);

  // Get favorite spaces (max 6) or first 6 if no favorites set
  const displaySpaces = useMemo(() => {
    if (favoriteSpaceIds.length > 0) {
      return spaces
        .filter((s) => favoriteSpaceIds.includes(s.id))
        .slice(0, 6)
        .sort((a, b) => {
          const aIndex = favoriteSpaceIds.indexOf(a.id);
          const bIndex = favoriteSpaceIds.indexOf(b.id);
          return aIndex - bIndex;
        });
    }
    // Default: show first 6 spaces
    return spaces.slice(0, 6);
  }, [spaces, favoriteSpaceIds]);

  const handleManageSpaces = () => {
    setIsPopupOpen(false);
    onManageSpaces?.();
  };

  const currentSpaceIndex = useMemo(() => {
    return spaces.findIndex((s) => s.id === activeSpaceId);
  }, [spaces, activeSpaceId]);

  const targetSpaceIndex = useMemo(() => {
    if (swipeProgress === 0) return null;
    const nextIndex = swipeProgress > 0 ? currentSpaceIndex + 1 : currentSpaceIndex - 1;
    if (nextIndex < 0 || nextIndex >= spaces.length) return null;
    return nextIndex;
  }, [swipeProgress, currentSpaceIndex, spaces.length]);

  return (
    <div className="relative flex items-center gap-1.5" role="group" aria-label="Space navigation">
      {/* Favorite space badges */}
      <div className="flex items-center gap-1">
        {displaySpaces.map((space, _index) => {
          const isActive = space.id === activeSpaceId;
          const spaceIndex = spaces.findIndex((s) => s.id === space.id);
          const isTarget = targetSpaceIndex === spaceIndex;
          const shouldShowProgress = Math.abs(swipeProgress) > 0.1 && (isActive || isTarget);

          return (
            <div key={space.uuid || space.id} className="relative">
              <SpaceBadge
                space={space}
                isActive={isActive}
                onClick={() => {
                  if (space.id === activeSpaceId) return;
                  const targetIndex = spaces.findIndex((s) => s.id === space.id);
                  const direction =
                    targetIndex >= 0 && targetIndex > currentSpaceIndex ? 'left' : 'right';

                  if (isFloatingVariant) {
                    window.dispatchEvent(
                      new CustomEvent('arcline-space-bar-switch', {
                        detail: {
                          spaceId: space.id,
                          spaceUuid: space.uuid,
                          direction,
                        },
                      })
                    );
                    return;
                  }

                  setActiveSpace(space.id);
                }}
              />
              {/* Progress indicator on target space */}
              {isTarget && shouldShowProgress && (
                <div
                  className="absolute inset-0 rounded-lg ring-2 ring-white/30 transition-opacity"
                  style={{
                    opacity: Math.abs(swipeProgress),
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* "..." button to show all spaces */}
      <button
        type="button"
        onClick={() => setIsPopupOpen(!isPopupOpen)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
        aria-label="Show all spaces"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* Popup with all spaces */}
      <AnimatePresence>
        {isPopupOpen && (
          <AllSpacesPopup
            spaces={spaces}
            activeSpaceId={activeSpaceId}
            onSelectSpace={(spaceId) => {
              if (spaceId !== activeSpaceId) {
                const targetSpace = spaces.find((s) => s.id === spaceId);
                const targetUuid = targetSpace?.uuid;
                const targetIndex = spaces.findIndex((s) => s.id === spaceId);
                const direction =
                  targetIndex >= 0 && targetIndex > currentSpaceIndex ? 'left' : 'right';

                if (isFloatingVariant) {
                  window.dispatchEvent(
                    new CustomEvent('arcline-space-bar-switch', {
                      detail: {
                        spaceId,
                        spaceUuid: targetUuid,
                        direction,
                      },
                    })
                  );
                } else {
                  setActiveSpace(spaceId);
                }
              }
              setIsPopupOpen(false);
            }}
            onManageSpaces={handleManageSpaces}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
