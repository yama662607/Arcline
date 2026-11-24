import { describe, expect, it } from 'vitest';
import { groupColorForHue, nextHue, normalizeHue, rgbToHue, spaceHue } from '../colors';

describe('colors', () => {
  it('normalizes negative (neutral) and >360 hues', () => {
    expect(normalizeHue(-1)).toBe(-1);
    expect(normalizeHue(390)).toBe(30);
    expect(normalizeHue(0)).toBe(0);
  });

  it('maps hues to nearest Chrome TabGroupColor', () => {
    expect(groupColorForHue(-1)).toBe('grey');
    expect(groupColorForHue(5)).toBe('red');
    expect(groupColorForHue(35)).toBe('orange');
    expect(groupColorForHue(60)).toBe('yellow');
    expect(groupColorForHue(150)).toBe('green');
    expect(groupColorForHue(195)).toBe('cyan');
    expect(groupColorForHue(235)).toBe('blue');
    expect(groupColorForHue(280)).toBe('purple');
    expect(groupColorForHue(330)).toBe('pink');
  });

  it('picks a non-clashing nextHue', () => {
    const picked = nextHue([-1, 235, 275]);
    expect(Math.abs(picked - 235)).toBeGreaterThanOrEqual(20);
    expect(Math.abs(picked - 275)).toBeGreaterThanOrEqual(20);
  });

  it('resolves saved spaceMeta hue or falls back to preset', () => {
    expect(spaceHue({ Main: { hue: 152 } }, 'Main', 0)).toBe(152);
    expect(spaceHue({}, 'Other', 1)).toBe(235);
  });

  it('converts RGB midTone to hue', () => {
    expect(rgbToHue(1, 0, 0)).toBe(0);
    expect(rgbToHue(0, 1, 0)).toBe(120);
    expect(rgbToHue(0, 0, 1)).toBe(240);
    expect(rgbToHue(0, 0, 0)).toBe(-1);
  });
});
