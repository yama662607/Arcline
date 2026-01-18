import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSpacesStore } from '@/store/spacesSlice';

interface SpaceContentViewProps {
  activeSpaceId: number | null;
  renderContent: (spaceId: number | null, options: { isActive: boolean }) => React.ReactNode;
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    zIndex: 1,
    opacity: 0,
  }),
  center: {
    x: 0,
    zIndex: 2,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    zIndex: 0,
    opacity: 0,
  }),
};

// Optimized transition for snappier, more responsive space switching
const transition = {
  x: { type: 'spring' as const, stiffness: 400, damping: 35, mass: 0.8 },
  opacity: { duration: 0.15 },
};

export function SpaceContentView({ activeSpaceId, renderContent }: SpaceContentViewProps) {
  const spaces = useSpacesStore((state) => state.spaces);
  const previousSpaceId = useSpacesStore((state) => state.previousSpaceId);
  const lastSwipeDirectionRef = useRef(0);
  const lastSwipeAtRef = useRef(0);
  const isGestureRef = useRef(false);
  const [previewSpaceId, setPreviewSpaceId] = useState<number | null>(null);

  const spacesRef = useRef(spaces);
  const activeSpaceIdRef = useRef(activeSpaceId);

  // Keep refs updated
  useEffect(() => {
    spacesRef.current = spaces;
    activeSpaceIdRef.current = activeSpaceId;
  }, [spaces, activeSpaceId]);

  useEffect(() => {
    const handleSwipeProgress = (event: Event) => {
      const customEvent = event as CustomEvent<{ progress: number }>;
      const progress = customEvent.detail?.progress ?? 0;
      if (progress === 0) {
        setPreviewSpaceId(null);
        return;
      }
      const navDirection = progress > 0 ? 1 : -1;
      lastSwipeDirectionRef.current = navDirection;
      lastSwipeAtRef.current = performance.now();
      isGestureRef.current = true;

      const currentSpaces = spacesRef.current;
      const currentActiveId = activeSpaceIdRef.current;

      const currentIndex = currentSpaces.findIndex((space) => space.id === currentActiveId);
      if (currentIndex === -1 || currentSpaces.length < 2) {
        setPreviewSpaceId(null);
        return;
      }
      const nextIndex = (currentIndex + navDirection + currentSpaces.length) % currentSpaces.length;
      const nextSpace = currentSpaces[nextIndex];
      setPreviewSpaceId(nextSpace?.id ?? null);
    };

    const handleSpaceBarSwitch = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: 'left' | 'right' }>;
      const direction = customEvent.detail?.direction;
      if (!direction) return;
      lastSwipeDirectionRef.current = direction === 'left' ? 1 : -1;
      lastSwipeAtRef.current = performance.now();
      isGestureRef.current = false;
    };

    window.addEventListener('arcline-swipe-progress', handleSwipeProgress);
    window.addEventListener('arcline-space-bar-switch', handleSpaceBarSwitch);
    return () => {
      window.removeEventListener('arcline-swipe-progress', handleSwipeProgress);
      window.removeEventListener('arcline-space-bar-switch', handleSpaceBarSwitch);
    };
  }, []);

  const transitionDirection = useMemo(() => {
    if (previousSpaceId === null || activeSpaceId === null) return 0;
    const previousIndex = spaces.findIndex((space) => space.id === previousSpaceId);
    const currentIndex = spaces.findIndex((space) => space.id === activeSpaceId);
    if (previousIndex === -1 || currentIndex === -1 || previousIndex === currentIndex) {
      return 0;
    }
    const recentlySwiped = performance.now() - lastSwipeAtRef.current < 1000;
    if (recentlySwiped && lastSwipeDirectionRef.current !== 0) {
      return lastSwipeDirectionRef.current;
    }
    return currentIndex > previousIndex ? 1 : -1;
  }, [previousSpaceId, activeSpaceId, spaces]);

  const activeTransition = useMemo(() => {
    // If we just finished a swipe gesture, the viewport is already at the target position.
    // We set duration to 0 to prevent a second "corrective" animation from Framer Motion.
    const recentlySwiped = performance.now() - lastSwipeAtRef.current < 800;
    if (recentlySwiped && isGestureRef.current) {
      return {
        x: { duration: 0 },
        opacity: { duration: 0 },
      };
    }
    return transition;
  }, [activeSpaceId]); // Re-calculate when space changes

  const renderPanel = (spaceId: number | null, isActive: boolean, xOffset: number) => (
    <div
      key={`pane-${spaceId}`}
      className={`h-full w-full ${isActive ? 'z-10' : 'z-0 pointer-events-none'}`}
      style={{ transform: xOffset ? `translateX(${xOffset}%)` : undefined }}
      aria-hidden={!isActive}
    >
      {renderContent(spaceId, { isActive })}
    </div>
  );

  const renderPreviewTrack = () => {
    const isForward = lastSwipeDirectionRef.current > 0;
    const previewOffset = isForward ? 100 : -100;
    return (
      <div className="absolute inset-0 h-full w-full">
        <div className="absolute inset-0">{renderPanel(activeSpaceId, true, 0)}</div>
        <div className="absolute inset-0" style={{ transform: `translateX(${previewOffset}%)` }}>
          {renderPanel(previewSpaceId, false, 0)}
        </div>
      </div>
    );
  };

  return (
    <div
      id="arcline-space-content-viewport"
      data-arcline-space-transition="true"
      className="min-h-full w-full overflow-visible relative"
    >
      {previewSpaceId ? (
        renderPreviewTrack()
      ) : (
        <AnimatePresence initial={false} custom={transitionDirection} mode="popLayout">
          <motion.div
            key={activeSpaceId}
            custom={transitionDirection}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={activeTransition}
            className="absolute inset-0 min-h-full w-full"
          >
            {renderContent(activeSpaceId, { isActive: true })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
