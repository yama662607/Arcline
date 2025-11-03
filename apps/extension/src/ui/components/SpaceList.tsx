import { useMemo } from 'react';
import { useSpacesStore } from '@/store/spacesSlice';

const colors = [
  'from-blue-500/20 to-blue-400/10',
  'from-purple-500/20 to-purple-400/10',
  'from-emerald-500/20 to-emerald-400/10',
  'from-orange-500/20 to-orange-400/10'
];

export function SpaceList() {
  const spaces = useSpacesStore((state) => state.spaces);
  const activeId = useSpacesStore((state) => state.activeSpaceId);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);

  const items = useMemo(() => {
    if (!spaces.length) {
      return [
        {
          id: -1,
          name: 'サンプルスペース',
          color: colors[0],
          description: 'Chrome 拡張のイベントからタブ群を読み込みます。'
        }
      ];
    }

    return spaces.map((space, index) => ({
      id: space.id,
      name: space.name,
      color: colors[index % colors.length],
      description: `${space.pinnedTabs.length} pinned / ${space.temporaryTabs.length} tabs`
    }));
  }, [spaces]);

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="group flex items-center justify-between rounded-xl border border-white/5 bg-gradient-to-r p-4 text-left transition hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          style={{
            backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`
          }}
          onClick={() => setActiveSpace(item.id)}
        >
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Space</p>
            <h3 className="text-xl font-semibold text-white">{item.name}</h3>
            <p className="text-xs text-slate-300">{item.description}</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
            {item.id === activeId ? 'Active' : 'Switch'}
          </span>
        </button>
      ))}
    </div>
  );
}
