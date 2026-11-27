import type { SpaceMeta, TabGroupColor } from './types';

export interface SpaceColorPreset {
  name: string;
  hue: number;
  groupColor: TabGroupColor;
}

export const NEUTRAL_HUE = -1;

export const SPACE_PRESETS: readonly SpaceColorPreset[] = [
  { name: 'Charcoal', hue: NEUTRAL_HUE, groupColor: 'grey' },
  { name: 'Indigo', hue: 235, groupColor: 'blue' },
  { name: 'Violet', hue: 275, groupColor: 'purple' },
  { name: 'Rose', hue: 335, groupColor: 'pink' },
  { name: 'Crimson', hue: 8, groupColor: 'red' },
  { name: 'Amber', hue: 35, groupColor: 'orange' },
  { name: 'Sage', hue: 148, groupColor: 'green' },
  { name: 'Teal', hue: 192, groupColor: 'cyan' },
  { name: 'Slate', hue: 215, groupColor: 'grey' },
] as const;

export function isNeutralHue(hue: number): boolean {
  return hue < 0;
}

export function normalizeHue(hue: number): number {
  if (hue < 0) return NEUTRAL_HUE;
  return ((Math.round(hue) % 360) + 360) % 360;
}

export function groupColorForHue(hue: number): TabGroupColor {
  if (hue < 0) return 'grey';
  const h = normalizeHue(hue);
  if (h < 22 || h >= 350) return 'red';
  if (h < 45) return 'orange';
  if (h < 78) return 'yellow';
  if (h < 172) return 'green';
  if (h < 208) return 'cyan';
  if (h < 252) return 'blue';
  if (h < 305) return 'purple';
  return 'pink';
}

export const SPACE_META_ID_PREFIX = 'id:';

export function spaceMetaIdKey(spaceId: string): string {
  return `${SPACE_META_ID_PREFIX}${spaceId}`;
}

export function resolveSpaceMeta(
  spaceMeta: Record<string, SpaceMeta>,
  spaceName: string,
  spaceId?: string,
): SpaceMeta | undefined {
  if (spaceId) {
    const byId = spaceMeta[spaceMetaIdKey(spaceId)];
    if (byId) return byId;
  }
  return spaceMeta[spaceName];
}

export function spaceHue(
  spaceMeta: Record<string, SpaceMeta>,
  spaceName: string,
  index: number,
  spaceId?: string,
): number {
  const saved = resolveSpaceMeta(spaceMeta, spaceName, spaceId)?.hue;
  if (typeof saved === 'number' && Number.isFinite(saved)) {
    return normalizeHue(saved);
  }
  const preset = SPACE_PRESETS[index % SPACE_PRESETS.length];
  return preset ? preset.hue : 235;
}

export function nextHue(usedHues: number[]): number {
  for (const preset of SPACE_PRESETS) {
    const clash = usedHues.some((u) => {
      const diff = Math.abs(normalizeHue(u) - preset.hue);
      return Math.min(diff, 360 - diff) < 20;
    });
    if (!clash) return preset.hue;
  }
  const preset = SPACE_PRESETS[usedHues.length % SPACE_PRESETS.length];
  return preset ? preset.hue : 235;
}

export function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 1e-4) return NEUTRAL_HUE;
  let h = 0;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  return normalizeHue(h * 60);
}
