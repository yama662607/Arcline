import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/ui/components/ui/button';

const settingsSchema = z.object({
  defaultSpaceName: z.string().min(1, 'スペース名は1文字以上で入力してください'),
  enableFloatingEntry: z.boolean(),
  autoSwitchToSidePanel: z.boolean(),
  autoArchiveEnabled: z.boolean(),
  autoArchiveIdleMinutes: z.number().min(1, 'アーカイブ時間は1分以上で設定してください'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const defaultSettings: SettingsFormValues = {
  defaultSpaceName: 'Workspace',
  enableFloatingEntry: true,
  autoSwitchToSidePanel: true,
  autoArchiveEnabled: false,
  autoArchiveIdleMinutes: 30,
};

async function readStoredSettings(): Promise<SettingsFormValues> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return defaultSettings;
  }

  return new Promise((resolve) => {
    chrome.storage.sync.get(['optionsSettings'], (items) => {
      const stored = items.optionsSettings ?? {};
      resolve({ ...defaultSettings, ...stored });
    });
  });
}

async function persistSettings(values: SettingsFormValues) {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set({ optionsSettings: values }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

export function OptionsApp() {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultSettings,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'saved' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    readStoredSettings()
      .then((values) => {
        if (mounted) {
          form.reset(values);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus('error');
          setErrorMessage('設定の読み込みに失敗しました');
        }
      });

    return () => {
      mounted = false;
    };
  }, [form]);

  const { handleSubmit, register, watch, formState } = form;
  const livePreview = watch();

  const onSubmit = handleSubmit(async (values) => {
    try {
      setStatus('loading');
      setErrorMessage(null);
      await persistSettings(values);
      setStatus('saved');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage('設定の保存に失敗しました。もう一度お試しください。');
    } finally {
      setTimeout(() => setStatus('idle'), 2000);
    }
  });

  return (
    <main className="min-h-screen bg-surface text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-1 border-b border-white/10 pb-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Arcline</p>
          <h1 className="text-2xl font-semibold">Extension Options</h1>
          <p className="text-sm text-slate-400">
            Popup / Side Panel の既定スペースや浮遊エントリーポイントの挙動をここで管理できます。
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 rounded-lg border border-white/10 bg-white/5 p-6 md:grid-cols-2">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="defaultSpaceName">
                既定スペース名
              </label>
              <input
                id="defaultSpaceName"
                type="text"
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm focus:border-white/40 focus:outline-none"
                placeholder="Workspace"
                {...register('defaultSpaceName')}
              />
              {formState.errors.defaultSpaceName && (
                <p className="mt-1 text-xs text-red-300">
                  {formState.errors.defaultSpaceName.message}
                </p>
              )}
            </div>

            <label className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div>
                <p className="text-sm font-medium">浮遊エントリーポイントを有効化</p>
                <p className="text-xs text-slate-400">
                  Floating UI を常駐させ、いつでも Spaces を開けるようにします。
                </p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-white/40 text-indigo-400 focus:ring-0"
                {...register('enableFloatingEntry')}
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Side Panel を自動表示</p>
                <p className="text-xs text-slate-400">
                  拡張のキーボードショートカットで Side Panel を自動的に開く
                </p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-white/40 text-indigo-400 focus:ring-0"
                {...register('autoSwitchToSidePanel')}
              />
            </label>

            <div className="space-y-3 rounded-md border border-white/10 bg-black/20 p-3">
              <h3 className="text-sm font-medium text-white">自動アーカイブ設定</h3>

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">自動アーカイブを有効化</p>
                  <p className="text-xs text-slate-400">
                    非アクティブなタブを自動的にアーカイブします
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-white/40 text-indigo-400 focus:ring-0"
                  {...register('autoArchiveEnabled')}
                />
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="autoArchiveIdleMinutes">
                  アーカイブまでの時間（分）
                </label>
                <input
                  id="autoArchiveIdleMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm focus:border-white/40 focus:outline-none"
                  placeholder="30"
                  {...register('autoArchiveIdleMinutes', { valueAsNumber: true })}
                />
                {formState.errors.autoArchiveIdleMinutes && (
                  <p className="mt-1 text-xs text-red-300">
                    {formState.errors.autoArchiveIdleMinutes.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  指定時間非アクティブなタブをアーカイブします（1分〜24時間）
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button disabled={status === 'loading'} type="submit">
                {status === 'loading' ? '保存中...' : '設定を保存'}
              </Button>
              {status === 'saved' && <span className="text-xs text-emerald-300">保存しました</span>}
              {status === 'error' && errorMessage && (
                <span className="text-xs text-red-300">{errorMessage}</span>
              )}
            </div>
          </form>

          <div className="space-y-4 rounded-md border border-dashed border-white/15 bg-black/10 p-4 text-sm text-slate-300">
            <h2 className="text-base font-semibold text-white">プレビュー</h2>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-slate-400">デフォルトスペース</span>:{' '}
                {livePreview.defaultSpaceName}
              </li>
              <li>
                <span className="text-slate-400">浮遊エントリー</span>:{' '}
                {livePreview.enableFloatingEntry ? '有効' : '無効'}
              </li>
              <li>
                <span className="text-slate-400">Side Panel 自動表示</span>:{' '}
                {livePreview.autoSwitchToSidePanel ? '有効' : '無効'}
              </li>
              <li>
                <span className="text-slate-400">自動アーカイブ</span>:{' '}
                {livePreview.autoArchiveEnabled
                  ? `有効 (${livePreview.autoArchiveIdleMinutes}分)`
                  : '無効'}
              </li>
            </ul>
            <p className="text-xs text-slate-500">
              ここでの変更は chrome.storage.sync に保存され、今後の設定 UI から参照できます。
            </p>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p>
            Arcline is free software licensed under{' '}
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white underline"
            >
              GPL-3.0
            </a>
          </p>
          <p className="mt-2">
            Source code available at{' '}
            <a
              href="https://github.com/anthropics/arcline"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white underline"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

export default OptionsApp;
