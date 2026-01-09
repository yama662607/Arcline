import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { usePortalContainer } from '@/ui/contexts/PortalContext';

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
  const setIsModalOpen = useSpacesStore((state) => state.setIsModalOpen);
  const portalContainer = usePortalContainer();

  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // Prevent sidebar from closing while context menu is open
  useEffect(() => {
    setIsModalOpen?.(isOpen);
    return () => setIsModalOpen?.(false);
  }, [isOpen, setIsModalOpen]);

  const isFavorite = useMemo(
    () => favorites?.some((fav) => fav.url === tab.url),
    [favorites, tab.url]
  );

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setIsOpen(true);
  }, []);

  const handleMoveToSpace = async (spaceId: number) => {
    await moveTab({ tabId: tab.id, spaceId });
    setIsOpen(false);
  };

  const menuItemClass =
    'flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10';

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper for context menu */}
      <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
        {children}
      </div>

      <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenu.Trigger asChild>
          <div
            style={{
              position: 'fixed',
              left: menuPosition.x,
              top: menuPosition.y,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal container={portalContainer}>
          <DropdownMenu.Content
            className="min-w-[220px] rounded-xl border border-white/20 bg-slate-900/98 p-1.5 text-sm text-slate-100 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
            style={{ zIndex: 99999 }}
            sideOffset={5}
            align="start"
          >
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                activate(tab.id);
                setIsOpen(false);
              }}
            >
              Activate Tab
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                toggleFavorite(tab);
                setIsOpen(false);
              }}
            >
              {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                togglePinned({ tabId: tab.id, pinned: !tab.pinned });
                setIsOpen(false);
              }}
            >
              {tab.pinned ? 'Unpin Tab' : 'Pin Tab'}
            </DropdownMenu.Item>

            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="flex cursor-pointer select-none items-center justify-between rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[state=open]:bg-white/10 data-[highlighted]:bg-white/10">
                Move to Space
                <ChevronRight className="ml-auto h-4 w-4" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal container={portalContainer}>
                <DropdownMenu.SubContent
                  className="min-w-[180px] rounded-xl border border-white/20 bg-slate-900/98 p-1.5 text-sm text-slate-100 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left-1 duration-150"
                  style={{ zIndex: 99999 }}
                >
                  {spaces.map((space) => (
                    <DropdownMenu.Item
                      key={space.id}
                      className={menuItemClass}
                      onSelect={() => handleMoveToSpace(space.id)}
                    >
                      <span
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: space.color }}
                      />
                      {space.name}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

            <DropdownMenu.Item
              className="flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-red-500/20 text-red-400 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-400"
              onSelect={() => {
                close(tab.id);
                setIsOpen(false);
              }}
            >
              Close Tab
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
