import { Copy, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import { useActiveTab, useReloadActiveTab } from '@/hooks/use-spaces-query';

function formatDisplayUrl(url?: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function ActiveTabHeader() {
  const { data: activeTab, isFetching, refetch } = useActiveTab();
  const { mutateAsync: reload, isPending: isReloading } = useReloadActiveTab();
  const bridge = useServiceWorkerBridge();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const urlText = useMemo(() => formatDisplayUrl(activeTab?.url), [activeTab?.url]);

  const handleCopy = useCallback(async () => {
    if (!activeTab?.url) return;

    try {
      await navigator.clipboard.writeText(activeTab.url);
      setCopied(true);
    } catch (error) {
      console.warn('[Arcline] Failed to copy URL', error);
    }
  }, [activeTab?.url]);

  const handleReload = useCallback(async () => {
    if (!activeTab?.id) return;
    try {
      await reload(activeTab.id);
      await refetch();
    } catch (error) {
      console.warn('[Arcline] Failed to reload tab', error);
    }
  }, [activeTab?.id, refetch, reload]);

  const startEditing = useCallback(() => {
    setUrlInput(activeTab?.url ?? '');
    setIsEditing(true);
  }, [activeTab?.url]);

  useEffect(() => {
    if (isEditing) return;
    setUrlInput(activeTab?.url ?? '');
  }, [activeTab?.url, isEditing]);

  const normalizeUrl = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    try {
      return new URL(trimmed).toString();
    } catch {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        return '';
      }
    }
  }, []);

  const handleNavigate = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!bridge) {
        setIsEditing(false);
        return;
      }

      const normalized = normalizeUrl(urlInput);
      if (!normalized) {
        setIsEditing(false);
        return;
      }

      try {
        await bridge.openUrlInTab(normalized);
        await refetch();
      } catch (error) {
        console.warn('[Arcline] Failed to open url', error);
      } finally {
        setIsEditing(false);
      }
    },
    [bridge, normalizeUrl, refetch, urlInput]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsEditing(false);
        setUrlInput(activeTab?.url ?? '');
      }
    },
    [activeTab?.url]
  );

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="rounded-lg border border-surface-light bg-surface-light/40 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current Tab</p>
          <p className="truncate text-sm font-semibold text-white" title={activeTab?.title ?? ''}>
            {activeTab?.title ?? 'No active tab detected'}
          </p>
          <div className="mt-1 text-xs text-slate-400">
            {isEditing ? (
              <form onSubmit={handleNavigate}>
                <input
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  onBlur={() => setIsEditing(false)}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded border border-surface-light bg-surface px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                  placeholder="https://example.com"
                  aria-label="Enter a URL to open"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="w-full truncate text-left text-xs text-slate-300 hover:text-white"
                title={urlText}
                disabled={isFetching}
              >
                {isFetching ? 'Loading URL…' : urlText || 'クリックしてURLを入力'}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            disabled={!activeTab?.id || isReloading}
            className="rounded-md border border-surface-light bg-surface p-2 text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Reload current tab"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!activeTab?.url}
            className="rounded-md border border-surface-light bg-surface p-2 text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={copied ? 'URL copied' : 'Copy current tab URL'}
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
