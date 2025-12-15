import { z } from 'zod';

import type { Settings } from './types';

export const SETTINGS_STORAGE_KEY = 'arcline.settings';
export const SETTINGS_MIGRATED_TO_LOCAL_KEY = 'arclineSettingsMigratedToLocal';
export const SETTINGS_MIGRATED_TO_NAMESPACED_KEY = 'arcline.settings.migratedToNamespaced';

export const settingsFormSchema = z.object({
  defaultSpaceName: z.string().min(1, 'Default space name is required'),
  autoArchiveEnabled: z.boolean(),
  autoArchiveIdleMinutes: z.number().int().min(1).max(1440),
  uiMode: z.enum(['side-panel', 'popup', 'floating']),
  showFavicons: z.boolean(),
  compactMode: z.boolean(),
  enableAnimations: z.boolean(),
  theme: z.enum(['dark', 'light', 'auto']),
});

export const settingsSchema: z.ZodType<Settings> = z.object({
  defaultSpaceName: z.string().min(1).default('Home').catch('Home'),
  autoArchiveEnabled: z.boolean().default(false).catch(false),
  autoArchiveIdleMinutes: z.number().int().min(1).max(1440).default(30).catch(30),
  uiMode: z.enum(['side-panel', 'popup', 'floating']).default('floating').catch('floating'),
  showFavicons: z.boolean().default(true).catch(true),
  compactMode: z.boolean().default(false).catch(false),
  enableAnimations: z.boolean().default(true).catch(true),
  theme: z.enum(['dark', 'light', 'auto']).default('auto').catch('auto'),
});

export const defaultSettings: Settings = settingsSchema.parse({});
