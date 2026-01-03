import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSpacesStore } from '@/store/spacesSlice';

interface SpaceContentViewProps {
  activeSpaceId: number | null;
  renderContent: (spaceId: number | null, options: { isActive: boolean }) => React.ReactNode;
}

type PaneOrder = [number | null, number | null];

export function SpaceContentView({ activeSpaceId, renderContent }: SpaceContentViewProps) {
  const spaces = useSpacesStore((state) => state.spaces);
  const previousSpaceId = useSpacesStore((state) => state.previousSpaceId);
  const lastSwipeDirectionRef = useRef(0);
  const lastSwipeAtRef = useRef(0);
  const [previewSpaceId, setPreviewSpaceId] = useState<number | null>(null);

  useEffect(() => {
    const handleSwipeProgress = (event: Event) => {
      const customEvent = event as CustomEvent<{ progress: number }>;
      const progress = customEvent.detail?.progress ?? 0;
      if (progress === 0) {
        setPreviewSpaceId(null);
        return;
      }
      // progress > 0 (Swipe LEFT) => Forward (Index + 1)
      // progress < 0 (Swipe RIGHT) => Backward (Index - 1)
      const navDirection = progress > 0 ? 1 : -1;
      lastSwipeDirectionRef.current = navDirection;
      lastSwipeAtRef.current = performance.now();

      const currentIndex = spaces.findIndex((space) => space.id === activeSpaceId);
      if (currentIndex === -1 || spaces.length < 2) {
        setPreviewSpaceId(null);
        return;
      }
      const nextIndex = (currentIndex + navDirection + spaces.length) % spaces.length;
      const nextSpace = spaces[nextIndex];
      setPreviewSpaceId(nextSpace?.id ?? null);
    };

    const handleSpaceBarSwitch = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: 'left' | 'right' }>;
      const direction = customEvent.detail?.direction;
      if (!direction) return;
      lastSwipeDirectionRef.current = direction === 'left' ? 1 : -1;
      lastSwipeAtRef.current = performance.now();
    };

    window.addEventListener('arcline-swipe-progress', handleSwipeProgress);
    window.addEventListener('arcline-space-bar-switch', handleSpaceBarSwitch);
    return () => {
      window.removeEventListener('arcline-swipe-progress', handleSwipeProgress);
      window.removeEventListener('arcline-space-bar-switch', handleSpaceBarSwitch);
    };
  }, [spaces, activeSpaceId]);

  const transitionDirection = useMemo(() => {
    if (previousSpaceId === null || activeSpaceId === null) return 0;
    const previousIndex = spaces.findIndex((space) => space.id === previousSpaceId);
    const currentIndex = spaces.findIndex((space) => space.id === activeSpaceId);
    if (previousIndex === -1 || currentIndex === -1 || previousIndex === currentIndex) {
      return 0;
    }
    const indexDirection = currentIndex > previousIndex ? 1 : -1;
    const recentSwipe = performance.now() - lastSwipeAtRef.current < 800;
    if (recentSwipe && lastSwipeDirectionRef.current !== 0) {
      return lastSwipeDirectionRef.current;
    }
    return indexDirection;
  }, [previousSpaceId, activeSpaceId, spaces]);

  const renderPanel = (spaceId: number | null, isActive: boolean, xOffset: number) => (
    <div
      key={`pane-${spaceId}`}
      className={`h-full w-full min-w-0 col-start-1 row-start-1 ${isActive ? 'z-10' : 'z-0 pointer-events-none'}`}
      style={{ transform: `translateX(${xOffset}%)` }}
      aria-hidden={!isActive}
    >
      {renderContent(spaceId, { isActive })}
    </div>
  );

  const renderPreviewTrack = () => {
    const isForward = lastSwipeDirectionRef.current > 0;
    // Active is at 0. Preview is at +/- 100%.
    const previewOffset = isForward ? 100 : -100;

    return (
      <div data-arcline-space-transition className="grid grid-cols-1 h-full w-full overflow-visible">
        {renderPanel(activeSpaceId, true, 0)}
        {renderPanel(previewSpaceId, false, previewOffset)}
      </div>
    );
  };

  const renderNormalTrack = () => (
    <div data-arcline-space-transition className="grid grid-cols-1 h-full w-full">
      {renderPanel(activeSpaceId, true, 0)}
    </div>
  );

  const renderTransitionTrack = () => {
    const isForward = transitionDirection > 0;
    // Animate from:
    // Forward: Active starts at 100% (entering), Prev starts at 0 (exiting to -100%)
    // Backward: Active starts at -100% (entering), Prev starts at 0 (exiting to 100%)

    // WAIT. Standard Transition (Tab Click) vs Swipe Commit Transition.
    // If this is a Swipe Commit, we want to match the *end* state of the swipe.
    // Swipe Forward End State: Container at -100%. Active at 0. Preview (Next) at 100%.
    // Visual: We see Preview.
    // Then we switch to Active = Next.
    // So New Active is displayed.

    // Let's stick to the "Transition Track" logic which is mostly for "Tab Switch" animation.
    // For "connected" swipe, we might rely on the DOM handoff.
    // But assuming standard spring:

    return (
      <motion.div
        key={`transition-${previousSpaceId}-${activeSpaceId}`}
        data-arcline-space-transition
        className="grid grid-cols-1 h-full w-full overflow-visible"
        initial={{ x: isForward ? '100%' : '-100%' }}
        animate={{ x: 0 }}
        transition={{ x: { type: 'spring', stiffness: 550, damping: 42 } }}
      >
        {/* In the LOCAL coordinate system of this motion div: */}
        {/* Previous space is moving OUT. Active space is moving IN. */}
        {/* If we slide the container: */}
        {/* Forward: Slide from 100% (Right) to 0. */}
        {/* We want Prev to be at Left (-100%) relative to Active? */}
        {/* If container is at 100%: Active (0) is at 100%. Prev (-100%) is at 0. */}
        {/* So Prev is visible. Container slides to 0. Active (0) becomes visible. Prev (-100%) exits Left. */}
        {/* Correct. */}

        {renderPanel(activeSpaceId, true, 0)}
        {renderPanel(previousSpaceId, false, isForward ? -100 : 100)}
      </motion.div>
    );
  };

  const showTransition = previousSpaceId !== null &&
                       activeSpaceId !== null &&
                       previousSpaceId !== activeSpaceId &&
                       transitionDirection !== 0;

  return (
    <div id="arcline-space-content-viewport" className="h-full w-full overflow-hidden">
      {previewSpaceId
        ? renderPreviewTrack()
        : showTransition
          ? renderTransitionTrack()
          : renderNormalTrack()}
    </div>
  );
}
