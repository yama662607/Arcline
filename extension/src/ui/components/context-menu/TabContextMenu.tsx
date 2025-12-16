import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';

import {
  useActivateTab,
  useCloseTab,
  useFavorites,
  useMoveTabToSpace,
  useToggleFavorite,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';

interface TabContextMenuProps {
  children: React.ReactNode;
  tab: TabEntry;
}

export function TabContextMenu({ children, tab }: TabContextMenuProps) {
  const { data: favorites } = useFavorites();
  const { mutateAsync: togglePinned } = useToggleTabPinned();
  const { mutateAsync: toggleFavorite } = useToggleFavorite();
  const { mutateAsync: activate } = useActivateTab();
  const { mutateAsync: close } = useCloseTab();
  const { mutateAsync: moveTab } = useMoveTabToSpace();

  const spaces = useSpacesStore((state) => state.spaces);

  const isFavorite = useMemo(
    () => favorites?.some((fav) => fav.url === tab.url),
    [favorites, tab.url]
  );

  const handleMoveToSpace = async (spaceId: number) => {
    await moveTab({ tabId: tab.id, spaceId });
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[220px] rounded-lg border border-white/10 bg-slate-900/95 p-1.5 text-sm text-slate-200 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <ContextMenu.Item
            className="flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10"
            onSelect={() => activate(tab.id)}
          >
            Activate Tab
          </ContextMenu.Item>

          <ContextMenu.Item
            className="flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10"
            onSelect={() => toggleFavorite(tab)}
          >
            {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </ContextMenu.Item>

          <ContextMenu.Item
            className="flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10"
            onSelect={() => togglePinned({ tabId: tab.id, pinned: !tab.pinned })}
          >
            {tab.pinned ? 'Unpin Tab' : 'Pin Tab'}
          </ContextMenu.Item>

          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="flex cursor-pointer select-none items-center justify-between rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[state=open]:bg-white/10 data-[highlighted]:bg-white/10">
              Move to Space
              <ChevronRight className="ml-auto h-4 w-4" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="min-w-[180px] rounded-lg border border-white/10 bg-slate-900/95 p-1.5 text-sm text-slate-200 shadow-xl backdrop-blur-md animate-in slide-in-from-left-1 duration-100">
                {spaces.map((space) => (
                  <ContextMenu.Item
                    key={space.id}
                    className="flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10"
                    onSelect={() => handleMoveToSpace(space.id)}
                  >
                    <span
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: space.color }}
                    />
                    {space.name}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className="my-1 h-px bg-white/10" />

          <ContextMenu.Item
            className="flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-red-500/20 text-red-400 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-400"
            onSelect={() => close(tab.id)}
          >
            Close Tab
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
