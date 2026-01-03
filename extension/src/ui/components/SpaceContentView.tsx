import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';

import { useSpacesStore } from '@/store/spacesSlice';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction === 0 ? 0 : direction > 0 ? '100%' : '-100%',
    opacity: direction === 0 ? 1 : 1,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction === 0 ? 0 : direction > 0 ? '-100%' : '100%',
    opacity: direction === 0 ? 1 : 1,
  }),
};

interface SpaceContentViewProps {
  activeSpaceId: number | null;
  children: React.ReactNode;
}

export function SpaceContentView({ activeSpaceId, children }: SpaceContentViewProps) {
  const spaces = useSpacesStore((state) => state.spaces);
  const previousSpaceId = useSpacesStore((state) => state.previousSpaceId);
  const lastSwipeDirectionRef = useRef(0);
  const lastSwipeAtRef = useRef(0);

  useEffect(() => {
    const handleSwipeProgress = (event: Event) => {
      const customEvent = event as CustomEvent<{ progress: number }>;
      const progress = customEvent.detail?.progress ?? 0;
      if (progress === 0) return;
      lastSwipeDirectionRef.current = progress > 0 ? 1 : -1;
      lastSwipeAtRef.current = performance.now();
    };

    const handleSpaceBarSwitch = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: 'left' | 'right' }>;
      const direction = customEvent.detail?.direction;
      if (!direction) return;
      lastSwipeDirectionRef.current = direction === 'right' ? 1 : -1;
      lastSwipeAtRef.current = performance.now();
    };

    window.addEventListener('arcline-swipe-progress', handleSwipeProgress);
    window.addEventListener('arcline-space-bar-switch', handleSpaceBarSwitch);
    return () => {
      window.removeEventListener('arcline-swipe-progress', handleSwipeProgress);
      window.removeEventListener('arcline-space-bar-switch', handleSpaceBarSwitch);
    };
  }, []);

  const direction = useMemo(() => {
    if (previousSpaceId === null || activeSpaceId === null) return 0;
    const previousIndex = spaces.findIndex((space) => space.id === previousSpaceId);
    const currentIndex = spaces.findIndex((space) => space.id === activeSpaceId);
    if (previousIndex === -1 || currentIndex === -1 || previousIndex === currentIndex) {
      return 0;
    }
    const indexDirection = currentIndex > previousIndex ? 1 : -1;
    const recentSwipe = performance.now() - lastSwipeAtRef.current < 600;
    if (recentSwipe && lastSwipeDirectionRef.current !== 0) {
      return lastSwipeDirectionRef.current;
    }
    return indexDirection;
  }, [previousSpaceId, activeSpaceId, spaces]);

  return (
    <div className="grid h-full w-full overflow-hidden">
      <AnimatePresence mode="sync" custom={direction}>
        <motion.div
          key={activeSpaceId}
          custom={direction}
          variants={slideVariants}
          initial={direction === 0 ? false : 'enter'}
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 520, damping: 38 },
            opacity: { duration: 0.12 },
          }}
          className="col-start-1 row-start-1 h-full w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
