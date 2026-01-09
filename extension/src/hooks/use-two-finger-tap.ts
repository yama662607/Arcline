import { useCallback, useEffect, useRef } from 'react';

export interface TwoFingerTapEvent {
  x: number;
  y: number;
  target: Element | null;
}

interface UseTwoFingerTapOptions {
  onTap: (event: TwoFingerTapEvent) => void;
  disabled?: boolean;
  maxTapDuration?: number;
  maxMovement?: number;
}

/**
 * Hook to detect two-finger taps (like two-finger click on trackpad)
 * Returns a ref to attach to the element that should receive two-finger taps
 */
export function useTwoFingerTap<T extends HTMLElement>({
  onTap,
  disabled = false,
  maxTapDuration = 300,
  maxMovement = 10,
}: UseTwoFingerTapOptions) {
  const elementRef = useRef<T>(null);
  const touchStartRef = useRef<{
    time: number;
    x: number;
    y: number;
    target: Element | null;
  } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      // Check for exactly 2 fingers
      if (e.touches.length === 2) {
        // Calculate center point of two fingers
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        if (!touch1 || !touch2) return;

        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;

        touchStartRef.current = {
          time: Date.now(),
          x: centerX,
          y: centerY,
          target: document.elementFromPoint(centerX, centerY),
        };
      }
    },
    [disabled]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const startData = touchStartRef.current;
      if (!startData) return;

      // Reset touch start data
      touchStartRef.current = null;

      // Check if this is a quick tap (not a drag)
      const duration = Date.now() - startData.time;
      if (duration > maxTapDuration) return;

      // For touchend, we need to check remaining touches
      // If all fingers are lifted (touches.length === 0), it's a valid tap end
      if (e.touches.length !== 0) return;

      // Check if fingers moved too much (changedTouches contains the released fingers)
      if (e.changedTouches.length >= 2) {
        const touch1 = e.changedTouches[0];
        const touch2 = e.changedTouches[1];
        if (touch1 && touch2) {
          const endCenterX = (touch1.clientX + touch2.clientX) / 2;
          const endCenterY = (touch1.clientY + touch2.clientY) / 2;
          const dx = endCenterX - startData.x;
          const dy = endCenterY - startData.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > maxMovement) return;
        }
      }

      // Prevent default context menu
      e.preventDefault();

      // Fire the two-finger tap event
      onTap({
        x: startData.x,
        y: startData.y,
        target: startData.target,
      });
    },
    [disabled, maxTapDuration, maxMovement, onTap]
  );

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || disabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [disabled, handleTouchStart, handleTouchEnd, handleTouchCancel]);

  return elementRef;
}
