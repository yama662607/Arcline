import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import { useSettings, useUpdateSettings } from '@/hooks/use-spaces-query';
import type { ImportedBookmark, ImportResult } from '@/lib/bookmark-import';
import { settingsFormSchema } from '@/shared/settings';
import type { Settings } from '@/shared/types';
import { BookmarkImport } from './BookmarkImport';
import { BookmarkImportPreview } from './BookmarkImportPreview';

type SettingsFormData = z.input<typeof settingsFormSchema>;

interface SettingsPanelProps {
  variant?: 'standalone' | 'floating';
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SettingsPanel layout is complex but remains readable
export function SettingsPanel({ variant = 'standalone' }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<
    'general' | 'archive' | 'appearance' | 'gestures' | 'import'
  >('general');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const { data: settings, isLoading, error } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: settings,
    values: settings,
  });

  const onSubmit = async (data: SettingsFormData) => {
    try {
      const parsed = settingsFormSchema.parse(data) as Settings;
      await updateSettingsMutation.mutateAsync(parsed);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const handleReset = () => {
    reset(settings);
  };

  const bridge = useServiceWorkerBridge();

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive import logic
  const handleImportConfirm = async (selectedBookmarks: ImportedBookmark[]) => {
    if (!bridge) return;

    try {
      let importedCount = 0;

      const importBookmark = async (
        bookmark: ImportedBookmark,
        spaceName: string,
        parentId?: string
      ) => {
        if (bookmark.isFolder) {
          const folder = await bridge.createPinnedFolder(spaceName, bookmark.title, parentId);
          if (bookmark.children) {
            for (const child of bookmark.children) {
              await importBookmark(child, spaceName, folder.id);
            }
          }
        } else if (bookmark.url) {
          await bridge.createPinnedTab(
            spaceName,
            bookmark.title,
            bookmark.url,
            undefined,
            parentId
          );
          importedCount++;
        }
      };

      const defaultSpaceName = settings?.defaultSpaceName || 'Home';

      for (const bookmark of selectedBookmarks) {
        if (bookmark.isFolder) {
          const spaceName = bookmark.title || defaultSpaceName;
          if (bookmark.children) {
            for (const child of bookmark.children) {
              await importBookmark(child, spaceName);
            }
          }
        } else if (bookmark.url) {
          await bridge.createPinnedTab(defaultSpaceName, bookmark.title, bookmark.url);
          importedCount++;
        }
      }

      setImportResult(null);
      setImportSuccess(`Successfully imported ${importedCount} bookmarks into spaces!`);
    } catch (error) {
      console.error('Failed to import bookmarks:', error);
      setImportSuccess(null);
    }
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
            <label
              className="block text-xs font-medium text-slate-400 mb-1"
              htmlFor="floating-ui-mode"
            >
              UI Mode
            </label>
            <select
              id="floating-ui-mode"
              {...register('uiMode')}
              className="w-full px-2 py-1 text-xs bg-surface-light rounded border border-surface-light focus:outline-none focus:border-blue-500 text-white"
            >
              <option value="floating">Floating (Default)</option>
              <option value="side-panel">Side Panel</option>
              <option value="popup">Popup</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Change how the extension UI appears</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                {...register('enableNewTabOverride')}
                className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500"
              />
              New tab integration
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Replace the browser new tab with Arcline (restart may be required)
            </p>
          </div>

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
              <label htmlFor="auto-archive-minutes" className="block text-sm text-slate-300 mb-1">
                Archive after (minutes)
              </label>
              <input
                id="auto-archive-minutes"
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
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={updateSettingsMutation.isPending}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
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
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={updateSettingsMutation.isPending}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? 'Save Changes' : 'Save'}
            </button>
            <button
              type="button"
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
          {(['general', 'archive', 'appearance', 'gestures', 'import'] as const).map((tab) => (
            <button
              type="button"
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
                <label
                  className="block text-sm font-medium text-slate-300 mb-2"
                  htmlFor="settings-default-space-name"
                >
                  Default Space Name
                </label>
                <input
                  type="text"
                  id="settings-default-space-name"
                  {...register('defaultSpaceName')}
                  className="w-full px-3 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white"
                />
                {errors.defaultSpaceName && (
                  <p className="mt-1 text-sm text-red-400">{errors.defaultSpaceName.message}</p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    {...register('enableNewTabOverride')}
                    className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500"
                  />
                  New tab integration
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Replace the browser new tab with Arcline (restart may be required)
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-slate-300 mb-2"
                  htmlFor="settings-ui-mode"
                >
                  UI Mode
                </label>
                <select
                  id="settings-ui-mode"
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
                  <label
                    className="block text-sm font-medium text-slate-300 mb-2"
                    htmlFor="settings-auto-archive-minutes"
                  >
                    Archive inactive tabs after (minutes)
                  </label>
                  <input
                    type="number"
                    id="settings-auto-archive-minutes"
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
                <label
                  htmlFor="theme-select"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Theme
                </label>
                <select
                  id="theme-select"
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

          {activeTab === 'gestures' && (
            <>
              <div>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    {...register('gesturesEnabled')}
                    className="rounded border-surface-light bg-surface-light text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Enable trackpad gestures
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Swipe horizontally with two fingers to switch between spaces.
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-slate-300 mb-2"
                  htmlFor="gesture-sensitivity"
                >
                  Swipe Threshold (Sensitivity)
                </label>
                <input
                  id="gesture-sensitivity"
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  {...register('gestureSensitivity', { valueAsNumber: true })}
                  className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>High Sensitivity (10px)</span>
                  <span>Low Sensitivity (300px)</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Requires a swipe of at least this many pixels to trigger navigation.
                </p>
              </div>
            </>
          )}
        </form>

        {activeTab === 'import' && (
          <div className="p-6">
            {importSuccess && (
              <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
                {importSuccess}
              </div>
            )}
            {importResult ? (
              <BookmarkImportPreview
                result={importResult}
                onConfirm={handleImportConfirm}
                onCancel={() => setImportResult(null)}
              />
            ) : (
              <BookmarkImport
                onImport={(result) => {
                  setImportResult(result);
                  setImportSuccess(null);
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        <p>Settings are stored locally on this device.</p>
      </div>
    </div>
  );
}
