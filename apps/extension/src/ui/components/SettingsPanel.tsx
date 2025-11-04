import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// TODO: Implement actual settings hooks
const useSettings = () => ({
  data: {
    defaultSpaceName: 'Default Space',
    autoArchiveEnabled: true,
    autoArchiveIdleMinutes: 30,
    uiMode: 'side-panel' as const,
    showFavicons: true,
    compactMode: false,
    enableAnimations: true,
    theme: 'dark' as const,
  },
  isLoading: false,
  error: null,
});

const useUpdateSettings = () => ({
  mutateAsync: async (_data: unknown) => {},
  isPending: false,
});

const settingsSchema = z.object({
  defaultSpaceName: z.string().min(1, 'Default space name is required'),
  autoArchiveEnabled: z.boolean(),
  autoArchiveIdleMinutes: z.number().min(1).max(1440),
  uiMode: z.enum(['side-panel', 'popup', 'floating']),
  showFavicons: z.boolean(),
  compactMode: z.boolean(),
  enableAnimations: z.boolean(),
  theme: z.enum(['dark', 'light', 'auto']),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface SettingsPanelProps {
  variant?: 'standalone' | 'floating';
}

export function SettingsPanel({ variant = 'standalone' }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'archive' | 'appearance'>('general');
  const { data: settings, isLoading, error } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
    values: settings,
  });

  const onSubmit = async (data: SettingsFormData) => {
    try {
      await updateSettingsMutation.mutateAsync(data);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const handleReset = () => {
    reset(settings);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-surface-light rounded w-1/4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-surface-light rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        設定の読み込みに失敗しました: {(error as Error).message}
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Settings</h3>
        </div>

        <div className="px-3 py-2 space-y-3">
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                {...register('showFavicons')}
                className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500"
              />
              Show favicons
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                {...register('compactMode')}
                className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500"
              />
              Compact mode
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                {...register('enableAnimations')}
                className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500"
              />
              Animations
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                {...register('autoArchiveEnabled')}
                className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500"
              />
              Auto-archive tabs
            </label>
          </div>

          {settings?.autoArchiveEnabled && (
            <div className="pl-6">
              <label className="block text-sm text-slate-300 mb-1">Archive after (minutes)</label>
              <input
                type="number"
                {...register('autoArchiveIdleMinutes', { valueAsNumber: true })}
                min="1"
                max="1440"
                className="w-full px-2 py-1 text-sm bg-surface-light rounded border border-surface-light focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {isDirty && (
          <div className="px-3 py-2 border-t border-surface-light flex gap-2">
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={updateSettingsMutation.isPending}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-2 py-1 text-xs bg-surface-light text-slate-300 rounded hover:bg-surface"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-white">Settings</h2>
        {isDirty && (
          <div className="flex gap-2">
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={updateSettingsMutation.isPending}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1 text-sm bg-surface-light text-slate-300 rounded hover:bg-surface"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      <div className="border border-surface-light rounded-lg">
        <div className="flex border-b border-surface-light">
          {(['general', 'archive', 'appearance'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-white bg-surface-light'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {activeTab === 'general' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Default Space Name
                </label>
                <input
                  type="text"
                  {...register('defaultSpaceName')}
                  className="w-full px-3 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white"
                />
                {errors.defaultSpaceName && (
                  <p className="mt-1 text-sm text-red-400">{errors.defaultSpaceName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">UI Mode</label>
                <select
                  {...register('uiMode')}
                  className="w-full px-3 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="side-panel">Side Panel</option>
                  <option value="popup">Popup</option>
                  <option value="floating">Floating (Atlas)</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'archive' && (
            <>
              <div>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    {...register('autoArchiveEnabled')}
                    className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Enable automatic tab archiving
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Automatically archive inactive tabs to save memory and reduce clutter
                </p>
              </div>

              {settings?.autoArchiveEnabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Archive inactive tabs after (minutes)
                  </label>
                  <input
                    type="number"
                    {...register('autoArchiveIdleMinutes', { valueAsNumber: true })}
                    min="1"
                    max="1440"
                    className="w-full px-3 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white"
                  />
                  {errors.autoArchiveIdleMinutes && (
                    <p className="mt-1 text-sm text-red-400">
                      {errors.autoArchiveIdleMinutes.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Tabs that haven't been accessed for this duration will be automatically archived
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === 'appearance' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                <select
                  {...register('theme')}
                  className="w-full px-3 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto (system)</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    {...register('showFavicons')}
                    className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Show website favicons
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    {...register('compactMode')}
                    className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Compact mode (smaller tabs)
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    {...register('enableAnimations')}
                    className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Enable animations and transitions
                </label>
              </div>
            </>
          )}
        </form>
      </div>

      <div className="text-xs text-slate-500">
        <p>Settings are automatically synced across your Chrome browsers.</p>
      </div>
    </div>
  );
}
