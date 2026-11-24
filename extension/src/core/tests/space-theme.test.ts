import { describe, expect, it } from 'vitest';
import {
  applyHarmonyFromPrimary,
  buildSpaceBackgroundCss,
  createDefaultSpaceTheme,
  parseArcWindowTheme,
  pointToOrbitHex,
  primaryHueFromTheme,
} from '../space-theme';

describe('space-theme', () => {
  it('generates multi-anchor radial + linear CSS gradients for multi-node themes', () => {
    const css = buildSpaceBackgroundCss(
      {
        appearance: 'light',
        nodes: [
          { x: 0.2, y: 0.15, hex: '#dfc158' },
          { x: 0.8, y: 0.45, hex: '#63aed6' },
          { x: 0.35, y: 0.85, hex: '#8663d6' },
        ],
        harmony: 'complementary',
        intensity: 60,
        grain: 50,
        angle: 165,
      },
      'light',
      false,
    );
    expect(css).toContain('radial-gradient');
    expect(css).toContain('linear-gradient(165deg');
    expect(css).toContain('#dfc158');
    expect(css).toContain('#63aed6');
    expect(css).toContain('#8663d6');
  });

  it('keeps neutral dark charcoal themes neutral (-1 hue)', () => {
    const theme = createDefaultSpaceTheme(-1);
    expect(theme.appearance).toBe('dark');
    expect(primaryHueFromTheme(theme)).toBe(-1);
  });

  it('computes harmonic companion nodes around primary anchor', () => {
    const start = [
      { x: 0.8, y: 0.5, hex: pointToOrbitHex(0.8, 0.5) },
      { x: 0.5, y: 0.5, hex: '#ffffff' },
      { x: 0.5, y: 0.5, hex: '#ffffff' },
    ];
    const triadic = applyHarmonyFromPrimary(start, 'triadic');
    expect(triadic).toHaveLength(3);
    expect(triadic[1]?.hex).not.toBe('#ffffff');
    expect(triadic[2]?.hex).not.toBe(triadic[1]?.hex);
  });

  it('extracts multi-color blendedGradient and grain/intensity from real Arc StorableSidebar windowTheme', () => {
    const parsed = parseArcWindowTheme({
      background: {
        single: {
          _0: {
            contentOverBackgroundAppearance: 'light',
            style: {
              color: {
                _0: {
                  blendedGradient: {
                    _0: {
                      baseColors: [
                        { red: 0.89, green: 0.76, blue: 0.25, alpha: 1 },
                        { red: 0.13, green: 0.72, blue: 0.89, alpha: 1 },
                      ],
                      overlayColors: [
                        { red: 0, green: 0, blue: 0, alpha: 0 },
                        { red: 0.53, green: 0.34, blue: 0.9, alpha: 1 },
                      ],
                      modifiers: { intensityFactor: 0.56, noiseFactor: 0.65 },
                      wheel: { complimentary: {} },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(parsed).toBeDefined();
    expect(parsed?.appearance).toBe('light');
    expect(parsed?.nodes).toHaveLength(3);
    expect(parsed?.harmony).toBe('complementary');
    expect(parsed?.intensity).toBe(56);
    expect(parsed?.grain).toBe(65);
  });
});
