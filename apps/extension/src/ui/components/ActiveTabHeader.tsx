import { Copy, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [copied, setCopied] = useState(false);

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
    await reload(activeTab.id);
    await refetch();
  }, [activeTab?.id, refetch, reload]);

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
          <p className="truncate text-xs text-slate-400" title={urlText}>
            {isFetching ? 'Loading URL…' : urlText || '—'}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-surface-light bg-surface px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleReload}
            disabled={!activeTab?.id || isReloading}
            className="flex items-center gap-1 rounded-md border border-surface-light bg-surface px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Reload current tab"
          >
            <RefreshCw className="h-3 w-3" />
            Reload
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!activeTab?.url}
            className="flex items-center gap-1 rounded-md border border-surface-light bg-surface px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Copy current tab URL"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy URL'}
          </button>
        </div>
      </div>
    </div>
  );
}
