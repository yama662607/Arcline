export type SwipeDirection = 'left' | 'right';

export type GestureSensitivity = 'low' | 'medium' | 'high';

export interface GestureSettings {
  enabled: boolean;
  sensitivity: GestureSensitivity;
  distanceThreshold: number;
  velocityThreshold: number;
  visualFeedback: boolean;
}
