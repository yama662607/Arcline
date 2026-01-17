import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Archive,
  BookmarkPlus,
  ChevronRight,
  FolderPlus,
  Palette,
  Settings,
  Smile,
  Trash2,
  Type,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useRemoveSpace, useUpdateSpace } from '@/hooks/use-spaces-query';
import { SPACE_COLORS, SPACE_ICONS } from '@/lib/space-theme';
import type { SpaceColor, SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { usePortalContainer } from '@/ui/contexts/PortalContext';

interface SpaceContextMenuProps {
  children: React.ReactNode;
  space: SpaceSnapshot;
  onOpenSettings?: () => void;
  onOpenArchive?: () => void;
  onOpenBookmarkImport?: () => void;
}

export function SpaceContextMenu({
  children,
  space,
  onOpenSettings,
  onOpenArchive,
  onOpenBookmarkImport,
}: SpaceContextMenuProps) {
  const { mutateAsync: removeSpace } = useRemoveSpace();
  const { mutate: updateSpace } = useUpdateSpace();
  const spaces = useSpacesStore((state) => state.spaces);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);
  const setIsModalOpen = useSpacesStore((state) => state.setIsModalOpen);
  const portalContainer = usePortalContainer();

  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(space.name);

  // Prevent sidebar from closing while context menu or rename dialog is open
  useEffect(() => {
    setIsModalOpen?.(isOpen || isRenaming);
    return () => setIsModalOpen?.(false);
  }, [isOpen, isRenaming, setIsModalOpen]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setIsOpen(true);
  }, []);

  const handleRemove = async () => {
    if (spaces.length <= 1) return;
    try {
      await removeSpace(space.id);
      const currentActive = useSpacesStore.getState().activeSpaceId;
      if (currentActive === space.id) {
        const remainingSpaces = spaces.filter((s) => s.id !== space.id);
        if (remainingSpaces.length > 0 && remainingSpaces[0]) {
          setActiveSpace(remainingSpaces[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsOpen(false);
  };

  const handleRename = useCallback(() => {
    if (newName.trim() && newName !== space.name) {
      updateSpace({ id: space.id, name: newName.trim() });
    }
    setIsRenaming(false);
  }, [newName, space.id, space.name, updateSpace]);

  const handleColorChange = useCallback(
    (color: SpaceColor) => {
      updateSpace({ id: space.id, themeColor: color });
      setIsOpen(false);
    },
    [space.id, updateSpace]
  );

  const handleIconChange = useCallback(
    (icon: string) => {
      updateSpace({ id: space.id, icon });
      setIsOpen(false);
    },
    [space.id, updateSpace]
  );

  const menuItemClass =
    'flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10';

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
            {/* Change Space Icon */}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={menuItemClass}>
                <Smile className="h-4 w-4 text-slate-400" />
                <span className="flex-1">Change Space Icon...</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal container={portalContainer}>
                <DropdownMenu.SubContent
                  className="min-w-[200px] rounded-xl border border-white/20 bg-slate-900/98 p-2 shadow-2xl backdrop-blur-xl"
                  style={{ zIndex: 99999 }}
                >
                  <div className="grid grid-cols-5 gap-1">
                    {SPACE_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => handleIconChange(icon)}
                        className={`flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-white/10 ${
                          space.icon === icon ? 'bg-white/20 ring-1 ring-white/30' : ''
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleIconChange('')}
                      className="w-full text-xs text-slate-400 hover:text-white py-1"
                    >
                      Remove Icon
                    </button>
                  </div>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            {/* Rename Space */}
            <DropdownMenu.Item
              className={menuItemClass}
              onSelect={() => {
                setIsRenaming(true);
                setIsOpen(false);
              }}
            >
              <Type className="h-4 w-4 text-slate-400" />
              <span>Rename Space...</span>
            </DropdownMenu.Item>

            {/* Edit Theme Color */}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={menuItemClass}>
                <Palette className="h-4 w-4 text-slate-400" />
                <span className="flex-1">Edit Theme Color...</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal container={portalContainer}>
                <DropdownMenu.SubContent
                  className="min-w-[180px] rounded-xl border border-white/20 bg-slate-900/98 p-2 shadow-2xl backdrop-blur-xl"
                  style={{ zIndex: 99999 }}
                >
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(SPACE_COLORS) as SpaceColor[]).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorChange(color)}
                        className={`h-8 w-8 rounded-full transition-all hover:scale-110 ${
                          space.themeColor === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                            : ''
                        }`}
                        style={{ backgroundColor: SPACE_COLORS[color].primary }}
                        title={color}
                      />
                    ))}
                  </div>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Separator className="my-1.5 h-px bg-white/10" />

            {/* New Folder */}
            <DropdownMenu.Item className={menuItemClass}>
              <FolderPlus className="h-4 w-4 text-slate-400" />
              <span>New Folder</span>
              <span className="ml-auto text-xs text-slate-500">⌘N</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1.5 h-px bg-white/10" />

            {/* Delete Space */}
            <DropdownMenu.Item
              className="flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-red-500/20 text-red-400 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-400 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
              disabled={spaces.length <= 1}
              onSelect={handleRemove}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Space</span>
            </DropdownMenu.Item>

            {/* App-level Actions */}
            {(onOpenSettings || onOpenArchive || onOpenBookmarkImport) && (
              <>
                <DropdownMenu.Separator className="my-1.5 h-px bg-white/10" />

                {onOpenSettings && (
                  <DropdownMenu.Item
                    className={menuItemClass}
                    onSelect={() => {
                      onOpenSettings();
                      setIsOpen(false);
                    }}
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    <span>Settings</span>
                  </DropdownMenu.Item>
                )}

                {onOpenArchive && (
                  <DropdownMenu.Item
                    className={menuItemClass}
                    onSelect={() => {
                      onOpenArchive();
                      setIsOpen(false);
                    }}
                  >
                    <Archive className="h-4 w-4 text-slate-400" />
                    <span>Archive</span>
                  </DropdownMenu.Item>
                )}

                {onOpenBookmarkImport && (
                  <DropdownMenu.Item
                    className={menuItemClass}
                    onSelect={() => {
                      onOpenBookmarkImport();
                      setIsOpen(false);
                    }}
                  >
                    <BookmarkPlus className="h-4 w-4 text-slate-400" />
                    <span>Import Bookmarks</span>
                  </DropdownMenu.Item>
                )}
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Rename Dialog */}
      {isRenaming && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50">
          <div className="rounded-lg border border-white/10 bg-slate-900 p-4 shadow-xl">
            <h3 className="mb-3 text-sm font-medium text-white">Rename Space</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              // biome-ignore lint/a11y/noAutofocus: intentional focus for UX
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="rounded px-3 py-1.5 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRename}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
