import { isNeutralHue, NEUTRAL_HUE, normalizeHue, rgbToHue } from './colors';
import type { SpaceAppearance, SpaceHarmonyMode, SpaceTheme, ThemeColorNode } from './types';

export interface CuratedThemePreset {
  id: string;
  name: string;
  theme: SpaceTheme;
}

export const ARC_SWATCHES: readonly string[] = [
  '#222224', // Matte Charcoal
  '#f0ece6', // Warm Cream
  '#e79bb4', // Dusty Rose
  '#9e78b0', // Soft Plum
  '#df6861', // Warm Coral
  '#e69454', // Sunset Amber
  '#dfc158', // Active Matter Gold
  '#6ed19b', // Mint Sage
  '#6cb4dc', // Atmospheric Sky
  '#7c849c', // Cool Slate
] as const;

export const CURATED_THEME_PRESETS: readonly CuratedThemePreset[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    theme: {
      appearance: 'dark',
      nodes: [{ x: 0.5, y: 0.5, hex: '#232325' }],
      harmony: 'free',
      intensity: 15,
      grain: 12,
      angle: 175,
    },
  },
  {
    id: 'active-matter',
    name: 'Active Matter',
    theme: {
      appearance: 'light',
      nodes: [
        { x: 0.24, y: 0.14, hex: '#dfc158' },
        { x: 0.78, y: 0.42, hex: '#63aed6' },
        { x: 0.34, y: 0.86, hex: '#8663d6' },
      ],
      harmony: 'complementary',
      intensity: 58,
      grain: 52,
      angle: 165,
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    theme: {
      appearance: 'dark',
      nodes: [
        { x: 0.22, y: 0.2, hex: '#3fd4a4' },
        { x: 0.76, y: 0.48, hex: '#4a8fe7' },
        { x: 0.35, y: 0.84, hex: '#7f5af0' },
      ],
      harmony: 'analogous',
      intensity: 64,
      grain: 38,
      angle: 160,
    },
  },
  {
    id: 'sunset',
    name: 'Dusk',
    theme: {
      appearance: 'dark',
      nodes: [
        { x: 0.72, y: 0.18, hex: '#e67e6e' },
        { x: 0.28, y: 0.62, hex: '#9b59b6' },
        { x: 0.66, y: 0.86, hex: '#e5b25d' },
      ],
      harmony: 'triadic',
      intensity: 62,
      grain: 45,
      angle: 145,
    },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    theme: {
      appearance: 'light',
      nodes: [
        { x: 0.25, y: 0.22, hex: '#efb1c4' },
        { x: 0.78, y: 0.76, hex: '#a6a1e3' },
      ],
      harmony: 'analogous',
      intensity: 54,
      grain: 32,
      angle: 155,
    },
  },
  {
    id: 'nordic',
    name: 'Nordic Mist',
    theme: {
      appearance: 'light',
      nodes: [
        { x: 0.22, y: 0.18, hex: '#87b8c9' },
        { x: 0.76, y: 0.8, hex: '#95a5c6' },
      ],
      harmony: 'analogous',
      intensity: 46,
      grain: 40,
      angle: 170,
    },
  },
] as const;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function normalizeHex(input: string, fallback = '#6b7cff'): string {
  const cleaned = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const [a, b, c] = cleaned;
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHex(hex, '#222224').slice(1);
  return {
    r: Number.parseInt(norm.slice(0, 2), 16),
    g: Number.parseInt(norm.slice(2, 4), 16),
    b: Number.parseInt(norm.slice(4, 6), 16),
  };
}

export function rgbUnitToHex(r: number, g: number, b: number): string {
  const toByte = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbUnitToHex(r + m, g + m, b + m);
}

/**
 * Maps a 2D coordinate [0..1, 0..1] on Arc's circular color orbit canvas to a vivid perceptual hex color.
 * Center (0.5, 0.5) is neutral/desaturated; polar angle sweeps 360° hue; radius controls saturation.
 */
export function pointToOrbitHex(x: number, y: number): string {
  const dx = clamp(x, 0, 1) - 0.5;
  const dy = clamp(y, 0, 1) - 0.5;
  const dist = Math.min(0.5, Math.hypot(dx, dy));
  const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const sat = Math.round((dist / 0.5) * 78);
  const light = Math.round(62 - (dist / 0.5) * 6);
  return hslToHex(angleDeg, sat, light);
}

/** Converts a hex color back to an approximate (x, y) position on the 2D color orbit canvas. */
export function hexToOrbitPoint(hex: string): { x: number; y: number } {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta < 0.04) return { x: 0.5, y: 0.5 };
  const hue = rgbToHue(rn, gn, bn);
  const sat = delta / (1 - Math.abs(max + min - 1));
  const radius = clamp(sat, 0.14, 0.44);
  const rad = (hue * Math.PI) / 180;
  return {
    x: clamp(0.5 + Math.cos(rad) * radius, 0.08, 0.92),
    y: clamp(0.5 + Math.sin(rad) * radius, 0.08, 0.92),
  };
}

/** Computes harmonic companion node coordinates around the primary anchor node. */
export function applyHarmonyFromPrimary(
  nodes: ThemeColorNode[],
  harmony: SpaceHarmonyMode,
): ThemeColorNode[] {
  if (nodes.length <= 1 || harmony === 'free') return nodes;
  const primary = nodes[0];
  if (!primary) return nodes;

  const dx = primary.x - 0.5;
  const dy = primary.y - 0.5;
  const baseRadius = Math.max(0.24, Math.min(0.42, Math.hypot(dx, dy)));
  const baseAngle = Math.atan2(dy, dx);

  const offsetsDeg =
    harmony === 'analogous' ? [38, -38] : harmony === 'complementary' ? [165, 205] : [120, 240];

  return nodes.map((node, idx) => {
    if (idx === 0) return node;
    const deg = offsetsDeg[idx - 1] ?? 180;
    const rad = baseAngle + (deg * Math.PI) / 180;
    const r = idx === 2 ? Math.min(0.44, baseRadius * 0.92) : baseRadius;
    const x = clamp(0.5 + Math.cos(rad) * r, 0.08, 0.92);
    const y = clamp(0.5 + Math.sin(rad) * r, 0.08, 0.92);
    return { x, y, hex: pointToOrbitHex(x, y) };
  });
}

export function createDefaultSpaceTheme(hue: number): SpaceTheme {
  if (isNeutralHue(hue)) {
    return {
      appearance: 'dark',
      nodes: [{ x: 0.5, y: 0.5, hex: '#232325' }],
      harmony: 'free',
      intensity: 18,
      grain: 15,
      angle: 175,
    };
  }
  const h1 = normalizeHue(hue);
  const h2 = normalizeHue(hue + 48);
  const c1 = hslToHex(h1, 58, 56);
  const c2 = hslToHex(h2, 54, 58);
  const p1 = hexToOrbitPoint(c1);
  const p2 = hexToOrbitPoint(c2);
  return {
    appearance: 'auto',
    nodes: [
      { ...p1, hex: c1 },
      { ...p2, hex: c2 },
    ],
    harmony: 'analogous',
    intensity: 50,
    grain: 28,
    angle: 165,
  };
}

export function sanitizeSpaceTheme(
  theme: Partial<SpaceTheme> | undefined,
  fallbackHue: number,
): SpaceTheme {
  if (!theme || !Array.isArray(theme.nodes) || theme.nodes.length === 0) {
    return createDefaultSpaceTheme(fallbackHue);
  }
  const appearance: SpaceAppearance =
    theme.appearance === 'light' || theme.appearance === 'dark' || theme.appearance === 'auto'
      ? theme.appearance
      : 'auto';
  const harmony: SpaceHarmonyMode =
    theme.harmony === 'free' ||
    theme.harmony === 'analogous' ||
    theme.harmony === 'complementary' ||
    theme.harmony === 'triadic'
      ? theme.harmony
      : 'free';
  const nodes = theme.nodes.slice(0, 3).map((n) => ({
    x: clamp(n.x, 0.04, 0.96),
    y: clamp(n.y, 0.04, 0.96),
    hex: normalizeHex(n.hex),
  }));
  return {
    appearance,
    nodes,
    harmony,
    intensity: Math.round(clamp(theme.intensity ?? 55, 0, 100)),
    grain: Math.round(clamp(theme.grain ?? 25, 0, 100)),
    angle: Math.round((((theme.angle ?? 165) % 360) + 360) % 360),
  };
}

export function primaryHueFromTheme(theme: SpaceTheme): number {
  const first = theme.nodes[0];
  if (!first) return NEUTRAL_HUE;
  const { r, g, b } = hexToRgb(first.hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 14 || theme.intensity < 8) return NEUTRAL_HUE;
  return rgbToHue(r / 255, g / 255, b / 255);
}

/**
 * Generates rich CSS multi-layer mesh gradient + translucency for the sidebar canvas.
 * Matches Arc's organic multi-node radial + linear blending in both Light & Dark appearances.
 */
export function buildSpaceBackgroundCss(
  theme: SpaceTheme,
  resolvedScheme: 'light' | 'dark',
  isOverlay: boolean,
): string {
  const t = clamp(theme.intensity, 0, 100) / 100;
  const baseCanvas = resolvedScheme === 'dark' ? '#1f1f21' : '#b7b9c2';
  const canvasAlpha = isOverlay ? (resolvedScheme === 'dark' ? 0.92 : 0.88) : 1;

  // Guard near-black neutral colors in dark mode so Arc's "Main" stays authentic matte charcoal (#222224),
  // rather than collapsing into pure #000000 black.
  const isPureDarkNeutral =
    resolvedScheme === 'dark' &&
    theme.nodes.length === 1 &&
    (() => {
      const { r, g, b } = hexToRgb(theme.nodes[0]?.hex ?? '#222224');
      return Math.max(r, g, b) < 42 && Math.max(r, g, b) - Math.min(r, g, b) < 12;
    })();

  if (isPureDarkNeutral) {
    if (canvasAlpha < 1) {
      const pct = Math.round(canvasAlpha * 100);
      return `linear-gradient(175deg, color-mix(in oklch, #222224 ${pct}%, transparent) 0%, color-mix(in oklch, #1c1c1e ${pct}%, transparent) 100%)`;
    }
    return 'linear-gradient(175deg, #222224 0%, #1c1c1e 100%)';
  }

  // Blend each node color smoothly against the smoky dark/light canvas according to intensity
  const mixRatio =
    resolvedScheme === 'dark'
      ? Math.round(10 + t * 50) // dark mode stays atmospheric & legible (10%..60%)
      : Math.round(16 + t * 46); // light mode reproduces Arc's smoky, muted atmospheric wash (16%..62%)

  const tunedColors = theme.nodes.map(
    (n) => `color-mix(in oklch, ${n.hex} ${mixRatio}%, ${baseCanvas})`,
  );

  const layers: string[] = [];

  if (theme.nodes.length >= 2) {
    // Soft organic radial blooms positioned directly by each node's (x, y) orbit anchor
    const bloomOpacity = Math.round(
      (resolvedScheme === 'dark' ? 0.56 : 0.68) * (0.45 + t * 0.55) * 100,
    );
    theme.nodes.forEach((node, idx) => {
      const px = Math.round(node.x * 100);
      const py = Math.round(node.y * 100);
      const col = tunedColors[idx] ?? baseCanvas;
      layers.push(
        `radial-gradient(ellipse 98% 72% at ${px}% ${py}%, color-mix(in oklch, ${col} ${bloomOpacity}%, transparent) 0%, transparent 74%)`,
      );
    });
  }

  // Smooth directional base gradient underneath the radial mesh
  if (tunedColors.length === 1) {
    const c = tunedColors[0] ?? baseCanvas;
    const darker =
      resolvedScheme === 'dark'
        ? `color-mix(in oklch, ${c} 88%, #000)`
        : `color-mix(in oklch, ${c} 92%, #222)`;
    layers.push(`linear-gradient(${theme.angle}deg, ${c} 0%, ${darker} 100%)`);
  } else {
    const stops = tunedColors
      .map((c, i) => `${c} ${Math.round((i / (tunedColors.length - 1)) * 100)}%`)
      .join(', ');
    layers.push(`linear-gradient(${theme.angle}deg, ${stops})`);
  }

  if (canvasAlpha < 1) {
    const pct = Math.round(canvasAlpha * 100);
    return layers
      .map((layer, idx) =>
        idx === layers.length - 1
          ? `linear-gradient(${theme.angle}deg, ${tunedColors
              .map(
                (c, i) =>
                  `color-mix(in oklch, ${c} ${pct}%, transparent) ${Math.round(
                    (i / Math.max(1, tunedColors.length - 1)) * 100,
                  )}%`,
              )
              .join(', ')})`
          : layer,
      )
      .join(', ');
  }

  return layers.join(', ');
}

/**
 * Extracts a full Arc SpaceTheme directly from Arc's `StorableSidebar.json` `windowTheme` object.
 */
export function parseArcWindowTheme(windowTheme: unknown): SpaceTheme | undefined {
  if (!windowTheme || typeof windowTheme !== 'object') return undefined;
  const wt = windowTheme as {
    background?: {
      single?: {
        _0?: {
          contentOverBackgroundAppearance?: string;
          style?: {
            color?: {
              _0?: {
                blendedSingleColor?: {
                  _0?: {
                    color?: { red?: number; green?: number; blue?: number };
                    modifiers?: { intensityFactor?: number; noiseFactor?: number };
                  };
                };
                blendedGradient?: {
                  _0?: {
                    baseColors?: Array<{
                      red?: number;
                      green?: number;
                      blue?: number;
                      alpha?: number;
                    }>;
                    overlayColors?: Array<{
                      red?: number;
                      green?: number;
                      blue?: number;
                      alpha?: number;
                    }>;
                    modifiers?: { intensityFactor?: number; noiseFactor?: number };
                    wheel?: { analogous?: unknown; complimentary?: unknown };
                  };
                };
              };
            };
          };
        };
      };
    };
  };

  const single = wt.background?.single?._0;
  if (!single) return undefined;

  const appearance: SpaceAppearance =
    single.contentOverBackgroundAppearance === 'dark'
      ? 'dark'
      : single.contentOverBackgroundAppearance === 'light'
        ? 'light'
        : 'auto';

  const colorStyle = single.style?.color?._0;
  const grad = colorStyle?.blendedGradient?._0;
  if (grad) {
    const rawColors = [...(grad.baseColors ?? []), ...(grad.overlayColors ?? [])].filter(
      (c) => (c.alpha ?? 1) > 0.05,
    );
    if (rawColors.length > 0) {
      const anchorPositions = [
        { x: 0.24, y: 0.14 },
        { x: 0.78, y: 0.44 },
        { x: 0.34, y: 0.86 },
      ];
      const nodes: ThemeColorNode[] = rawColors.slice(0, 3).map((c, idx) => {
        const hex = rgbUnitToHex(c.red ?? 0, c.green ?? 0, c.blue ?? 0);
        const fallbackPos = anchorPositions[idx] ?? { x: 0.5, y: 0.5 };
        return { ...fallbackPos, hex };
      });
      const harmony: SpaceHarmonyMode = grad.wheel?.complimentary
        ? 'complementary'
        : grad.wheel?.analogous
          ? 'analogous'
          : 'free';
      return {
        appearance,
        nodes,
        harmony,
        intensity: Math.round(clamp((grad.modifiers?.intensityFactor ?? 0.58) * 100, 0, 100)),
        grain: Math.round(clamp((grad.modifiers?.noiseFactor ?? 0.45) * 100, 0, 100)),
        angle: 165,
      };
    }
  }

  const singleColor = colorStyle?.blendedSingleColor?._0;
  if (singleColor?.color) {
    const hex = rgbUnitToHex(
      singleColor.color.red ?? 0,
      singleColor.color.green ?? 0,
      singleColor.color.blue ?? 0,
    );
    const pos = hexToOrbitPoint(hex);
    return {
      appearance,
      nodes: [{ ...pos, hex }],
      harmony: 'free',
      intensity: Math.round(clamp((singleColor.modifiers?.intensityFactor ?? 0.5) * 100, 0, 100)),
      grain: Math.round(clamp((singleColor.modifiers?.noiseFactor ?? 0.2) * 100, 0, 100)),
      angle: 175,
    };
  }

  return undefined;
}
