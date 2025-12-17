import { useCallback, useEffect, useRef } from 'react';

import { useUiStore } from '@/store';

type ScrollKey = 'pinnedList' | 'temporaryList' | 'archiveList' | 'commandPalette';

interface UseScrollPersistenceOptions {
  key: ScrollKey;
  debounceMs?: number;
}

export function useScrollPersistence({ key, debounceMs = 100 }: UseScrollPersistenceOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  const setScrollPosition = useUiStore((state) => state.setScrollPosition);
  const getScrollPosition = useUiStore((state) => state.getScrollPosition);

  const saveScrollPosition = useCallback(() => {
    if (scrollRef.current) {
      const position = scrollRef.current.scrollTop;
      setScrollPosition(key, position);
    }
  }, [key, setScrollPosition]);

  const restoreScrollPosition = useCallback(() => {
    if (scrollRef.current && !hasRestoredRef.current) {
      const savedPosition = getScrollPosition(key);
      if (savedPosition > 0) {
        scrollRef.current.scrollTop = savedPosition;
      }
      hasRestoredRef.current = true;
    }
  }, [key, getScrollPosition]);

  const handleScroll = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(saveScrollPosition, debounceMs);
  }, [saveScrollPosition, debounceMs]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleScroll]);

  useEffect(() => {
    requestAnimationFrame(() => {
      restoreScrollPosition();
    });
  }, [restoreScrollPosition]);

  return { scrollRef, saveScrollPosition, restoreScrollPosition };
}
