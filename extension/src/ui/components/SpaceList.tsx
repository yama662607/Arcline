import { useMemo } from 'react';

import { useSpacesStore } from '@/store';

type SpaceListVariant = 'standalone' | 'floating';

interface SpaceListProps {
  variant?: SpaceListVariant;
}

export function SpaceList({ variant = 'standalone' }: SpaceListProps) {
  const spaces = useSpacesStore((state) => state.spaces);
  const activeId = useSpacesStore((state) => state.activeSpaceId);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);

  const items = useMemo(() => {
    if (!spaces.length) {
      return [
        {
          id: -1,
          name: 'サンプルスペース',
          color: '#3b82f6',
          description: 'Chrome 拡張のイベントからタブ群を読み込みます。',
        },
      ];
    }

    return spaces.map((space, _index) => ({
      id: space.id,
      name: space.name,
      color: space.color,
      description: `${space.pinnedTabs.length} pinned / ${space.temporaryTabs.length} tabs`,
    }));
  }, [spaces]);

  if (variant === 'floating') {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition focus:outline-none focus:ring-1 focus:ring-white/60 ${
                item.id === activeId
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
              onClick={() => setActiveSpace(item.id)}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate" title={item.name}>
                {item.name}
              </span>
            </button>
            {item.id === activeId && (
              <p
                className="mt-1 text-[10px] text-slate-400"
                data-testid="arcline-floating-space-meta"
              >
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="group flex items-center justify-between rounded-xl border border-white/5 p-4 text-left transition hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          style={{
            background: `linear-gradient(135deg, ${item.color}40 0%, rgba(15,23,42,0.75) 100%)`,
          }}
          onClick={() => setActiveSpace(item.id)}
        >
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Space</p>
            <h3 className="text-xl font-semibold text-white">{item.name}</h3>
            <p className="text-xs text-slate-300">{item.description}</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs transition ${
              item.id === activeId
                ? 'border-white/40 bg-white/20 text-white'
                : 'border-white/10 bg-black/30 text-slate-200'
            }`}
          >
            {item.id === activeId ? 'Active' : 'Switch'}
          </span>
        </button>
      ))}
    </div>
  );
}
