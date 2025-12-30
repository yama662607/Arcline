/**
 * Space Theme Utilities
 * Provides color definitions and gradient generation for space themes
 */

import type { SpaceColor } from '@/shared/types';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  gradient: string;
  gradientSubtle: string;
  accent: string;
}

export const SPACE_COLORS: Record<SpaceColor, ThemeColors> = {
  grey: {
    primary: '#9CA3AF',
    primaryDark: '#4B5563',
    gradient: 'linear-gradient(135deg, #374151 0%, #1F2937 50%, #111827 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(156, 163, 175, 0.1) 0%, transparent 100%)',
    accent: '#6B7280',
  },
  blue: {
    primary: '#60A5FA',
    primaryDark: '#2563EB',
    gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #6366F1 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(96, 165, 250, 0.15) 0%, transparent 100%)',
    accent: '#3B82F6',
  },
  red: {
    primary: '#F87171',
    primaryDark: '#DC2626',
    gradient: 'linear-gradient(135deg, #991B1B 0%, #DC2626 50%, #F87171 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(248, 113, 113, 0.15) 0%, transparent 100%)',
    accent: '#EF4444',
  },
  yellow: {
    primary: '#FBBF24',
    primaryDark: '#D97706',
    gradient: 'linear-gradient(135deg, #92400E 0%, #D97706 50%, #FBBF24 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(251, 191, 36, 0.15) 0%, transparent 100%)',
    accent: '#F59E0B',
  },
  green: {
    primary: '#34D399',
    primaryDark: '#059669',
    gradient: 'linear-gradient(135deg, #065F46 0%, #059669 50%, #34D399 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(52, 211, 153, 0.15) 0%, transparent 100%)',
    accent: '#10B981',
  },
  pink: {
    primary: '#F472B6',
    primaryDark: '#DB2777',
    gradient: 'linear-gradient(135deg, #9D174D 0%, #DB2777 50%, #F472B6 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(244, 114, 182, 0.15) 0%, transparent 100%)',
    accent: '#EC4899',
  },
  purple: {
    primary: '#A78BFA',
    primaryDark: '#7C3AED',
    gradient: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #A78BFA 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(167, 139, 250, 0.15) 0%, transparent 100%)',
    accent: '#8B5CF6',
  },
  cyan: {
    primary: '#22D3EE',
    primaryDark: '#0891B2',
    gradient: 'linear-gradient(135deg, #155E75 0%, #0891B2 50%, #22D3EE 100%)',
    gradientSubtle: 'linear-gradient(180deg, rgba(34, 211, 238, 0.15) 0%, transparent 100%)',
    accent: '#06B6D4',
  },
};

export const DEFAULT_SPACE_COLOR: SpaceColor = 'blue';

export function getSpaceTheme(color?: SpaceColor): ThemeColors {
  return SPACE_COLORS[color ?? DEFAULT_SPACE_COLOR];
}

export function getSpaceGradientStyle(color?: SpaceColor): React.CSSProperties {
  const theme = getSpaceTheme(color);
  return {
    background: theme.gradient,
  };
}

export function getSpaceAccentColor(color?: SpaceColor): string {
  return getSpaceTheme(color).accent;
}

/**
 * Common space icons/emojis for quick selection
 */
export const SPACE_ICONS = [
  '🏠',
  '💼',
  '📚',
  '🎮',
  '🎵',
  '🎬',
  '📷',
  '✈️',
  '🛒',
  '💰',
  '🔬',
  '🎨',
  '📝',
  '💻',
  '🌐',
  '⚡',
  '🔥',
  '⭐',
  '❤️',
  '🚀',
];

/**
 * Get display icon for a space
 */
export function getSpaceDisplayIcon(icon?: string, name?: string): string {
  if (icon) return icon;
  // Default to first letter of name or generic icon
  if (name && name.length > 0) {
    return name.charAt(0).toUpperCase();
  }
  return '📁';
}

/**
 * Theme transition configuration for smooth animations
 */
export const THEME_TRANSITION = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

/**
 * Get animated gradient style with CSS transition
 */
export function getAnimatedGradientStyle(color?: SpaceColor): React.CSSProperties {
  const theme = getSpaceTheme(color);
  return {
    background: theme.gradient,
    transition: `background ${THEME_TRANSITION.duration}s cubic-bezier(${THEME_TRANSITION.ease.join(',')})`,
  };
}
