import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Hand, Keyboard, Palette, Settings, Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import { useSettings, useUpdateSettings } from '@/hooks/use-spaces-query';
import type { ImportedBookmark, ImportResult } from '@/lib/bookmark-import';
import { settingsFormSchema } from '@/shared/settings';
import type { Settings as SettingsType } from '@/shared/types';
import { BookmarkImport } from './BookmarkImport';
import { BookmarkImportPreview } from './BookmarkImportPreview';

type SettingsFormData = z.input<typeof settingsFormSchema>;

interface SettingsPanelProps {
  variant?: 'standalone' | 'floating';
}

type TabId = 'general' | 'archive' | 'appearance' | 'gestures' | 'shortcuts' | 'import';

const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'general', icon: Settings, label: 'General' },
  { id: 'archive', icon: Archive, label: 'Archive' },
  { id: 'appearance', icon: Palette, label: 'Appearance' },
  { id: 'gestures', icon: Hand, label: 'Gestures' },
  { id: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
  { id: 'import', icon: Upload, label: 'Import' },
];

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-blue-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  onClick?: () => void;
  testId?: string;
}

function SettingRow({ label, description, children, onClick, testId }: SettingRowProps) {
  const content = (
    <div
      data-testid={testId}
      className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-white/5 transition-colors group"
    >
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-slate-400 mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SettingsPanel layout is complex but remains readable
export function SettingsPanel({ variant = 'standalone' }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const { data: settings, isLoading, error } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: settings,
    values: settings,
  });

  const watchedSettings = watch();

  const onSubmit = async (data: SettingsFormData) => {
    try {
      const parsed = settingsFormSchema.parse(data) as SettingsType;
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
      <div className="animate-pulse space-y-4 p-6">
        <div className="h-4 bg-surface-light rounded w-1/4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-surface-light rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm p-6">
        設定の読み込みに失敗しました: {(error as Error).message}
      </div>
    );
  }

  // Floating variant (simplified)
  if (variant === 'floating') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Settings</h3>
        </div>

        <div className="px-3 py-2 space-y-3">
          <SettingRow label="UI Mode" description="Change how the extension UI appears">
            <select
              {...register('uiMode')}
              className="px-2 py-1 text-xs bg-surface-light rounded border border-surface-light focus:outline-none focus:border-blue-500 text-white"
            >
              <option value="floating">Floating</option>
              <option value="side-panel">Side Panel</option>
              <option value="popup">Popup</option>
            </select>
          </SettingRow>

          <SettingRow
            label="New tab integration"
            description="Replace browser new tab with Arcline"
          >
            <ToggleSwitch
              checked={watchedSettings.enableNewTabOverride ?? true}
              onChange={(checked) =>
                setValue('enableNewTabOverride', checked, { shouldDirty: true })
              }
            />
          </SettingRow>

          <SettingRow label="Show favicons" testId="setting-show-favicons">
            <ToggleSwitch
              checked={watchedSettings.showFavicons ?? true}
              onChange={(checked) => setValue('showFavicons', checked, { shouldDirty: true })}
            />
          </SettingRow>

          <SettingRow label="Compact mode" testId="setting-compact-mode">
            <ToggleSwitch
              checked={watchedSettings.compactMode ?? false}
              onChange={(checked) => setValue('compactMode', checked, { shouldDirty: true })}
            />
          </SettingRow>

          <SettingRow label="Animations">
            <ToggleSwitch
              checked={watchedSettings.enableAnimations ?? true}
              onChange={(checked) => setValue('enableAnimations', checked, { shouldDirty: true })}
            />
          </SettingRow>
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

  // Standalone variant (Arc/Raycast style)
  return (
    <div className="min-h-[500px] bg-[#1a1a1c] rounded-xl overflow-hidden">
      {/* Tab Navigation - Arc style */}
      <div className="border-b border-white/10">
        <div className="flex items-center justify-center gap-1 py-3 px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-6">
        {activeTab === 'general' && (
          <>
            <SettingSection title="Basics">
              <SettingRow label="Default Space Name" description="Name for new spaces">
                <input
                  type="text"
                  {...register('defaultSpaceName')}
                  className="w-40 px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                />
              </SettingRow>
              {errors.defaultSpaceName && (
                <p className="px-4 text-sm text-red-400">{errors.defaultSpaceName.message}</p>
              )}

              <SettingRow
                label="New tab integration"
                description="Replace browser new tab with Arcline"
              >
                <ToggleSwitch
                  checked={watchedSettings.enableNewTabOverride ?? true}
                  onChange={(checked) =>
                    setValue('enableNewTabOverride', checked, { shouldDirty: true })
                  }
                />
              </SettingRow>
            </SettingSection>

            <SettingSection title="UI Mode">
              <SettingRow label="Interface Mode" description="Choose how Arcline appears">
                <select
                  {...register('uiMode')}
                  className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="floating">Floating (Atlas)</option>
                  <option value="side-panel">Side Panel</option>
                  <option value="popup">Popup</option>
                </select>
              </SettingRow>
            </SettingSection>
          </>
        )}

        {activeTab === 'archive' && (
          <SettingSection title="Auto Archive">
            <SettingRow
              label="Enable automatic tab archiving"
              description="Archive inactive tabs to save memory"
            >
              <ToggleSwitch
                checked={watchedSettings.autoArchiveEnabled ?? false}
                onChange={(checked) =>
                  setValue('autoArchiveEnabled', checked, { shouldDirty: true })
                }
              />
            </SettingRow>

            {watchedSettings.autoArchiveEnabled && (
              <SettingRow
                label="Archive after (minutes)"
                description="Time before archiving inactive tabs"
              >
                <input
                  type="number"
                  {...register('autoArchiveIdleMinutes', { valueAsNumber: true })}
                  min="1"
                  max="1440"
                  className="w-20 px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 text-white text-center"
                />
              </SettingRow>
            )}
            {errors.autoArchiveIdleMinutes && (
              <p className="px-4 text-sm text-red-400">{errors.autoArchiveIdleMinutes.message}</p>
            )}
          </SettingSection>
        )}

        {activeTab === 'appearance' && (
          <>
            <SettingSection title="Theme">
              <SettingRow label="Color theme" description="Choose your preferred theme">
                <select
                  {...register('theme')}
                  className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto (System)</option>
                </select>
              </SettingRow>
            </SettingSection>

            <SettingSection title="Display">
              <SettingRow label="Show website favicons" testId="setting-show-favicons">
                <ToggleSwitch
                  checked={watchedSettings.showFavicons ?? true}
                  onChange={(checked) => setValue('showFavicons', checked, { shouldDirty: true })}
                />
              </SettingRow>

              <SettingRow
                label="Compact mode"
                description="Smaller tabs for more content"
                testId="setting-compact-mode"
              >
                <ToggleSwitch
                  checked={watchedSettings.compactMode ?? false}
                  onChange={(checked) => setValue('compactMode', checked, { shouldDirty: true })}
                />
              </SettingRow>

              <SettingRow label="Enable animations" description="Smooth transitions and effects">
                <ToggleSwitch
                  checked={watchedSettings.enableAnimations ?? true}
                  onChange={(checked) =>
                    setValue('enableAnimations', checked, { shouldDirty: true })
                  }
                />
              </SettingRow>
            </SettingSection>
          </>
        )}

        {activeTab === 'gestures' && (
          <SettingSection title="Trackpad Gestures">
            <SettingRow
              label="Enable trackpad gestures"
              description="Swipe horizontally to switch between spaces"
            >
              <ToggleSwitch
                checked={watchedSettings.gesturesEnabled ?? true}
                onChange={(checked) => setValue('gesturesEnabled', checked, { shouldDirty: true })}
              />
            </SettingRow>

            <div className="px-4 py-4">
              <label
                className="block text-sm font-medium text-white mb-3"
                htmlFor="gesture-sensitivity"
              >
                Swipe Sensitivity
              </label>
              <input
                id="gesture-sensitivity"
                type="range"
                min="10"
                max="300"
                step="10"
                {...register('gestureSensitivity', { valueAsNumber: true })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>High (10px)</span>
                <span className="text-white">{watchedSettings.gestureSensitivity ?? 100}px</span>
                <span>Low (300px)</span>
              </div>
            </div>
          </SettingSection>
        )}

        {activeTab === 'shortcuts' && (
          <SettingSection title="Keyboard Shortcuts">
            <SettingRow label="Open Command Palette">
              <div className="flex gap-1">
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  ⌘
                </kbd>
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  K
                </kbd>
              </div>
            </SettingRow>

            <SettingRow label="Switch to Next Space">
              <div className="flex gap-1">
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  ⌘
                </kbd>
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  →
                </kbd>
              </div>
            </SettingRow>

            <SettingRow label="Switch to Previous Space">
              <div className="flex gap-1">
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  ⌘
                </kbd>
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  ←
                </kbd>
              </div>
            </SettingRow>

            <SettingRow label="Toggle Sidebar">
              <div className="flex gap-1">
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  ⌘
                </kbd>
                <kbd className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-slate-300">
                  \\
                </kbd>
              </div>
            </SettingRow>

            <div className="mt-6 px-4">
              <p className="text-xs text-slate-500">
                Keyboard shortcuts cannot be customized in this version.
              </p>
            </div>
          </SettingSection>
        )}

        {activeTab === 'import' && (
          <div>
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

        {/* Save/Reset Bar */}
        {isDirty && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-surface-light/90 backdrop-blur-sm rounded-lg p-2 shadow-xl border border-white/10">
            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-sm bg-white/10 text-slate-300 rounded-lg hover:bg-white/20 transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </form>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5 text-xs text-slate-500">
        Settings are stored locally on this device.
      </div>
    </div>
  );
}
