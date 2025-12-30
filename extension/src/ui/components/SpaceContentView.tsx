import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';

import { useSpacesStore } from '@/store/spacesSlice';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

function getSlideDirection(previousId: number | null, currentId: number | null): number {
  // If no previous space, no animation
  if (previousId === null || currentId === null) return 0;

  // Determine direction: positive = left to right, negative = right to left
  return currentId > previousId ? 1 : -1;
}

interface SpaceContentViewProps {
  activeSpaceId: number | null;
  children: React.ReactNode;
}

export function SpaceContentView({ activeSpaceId, children }: SpaceContentViewProps) {
  const previousSpaceId = useSpacesStore((state) => state.previousSpaceId);

  const direction = useMemo(
    () => getSlideDirection(previousSpaceId, activeSpaceId),
    [previousSpaceId, activeSpaceId]
  );

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={activeSpaceId}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
        }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
