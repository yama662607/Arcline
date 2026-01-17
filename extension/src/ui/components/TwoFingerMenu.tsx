import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight, FolderPlus, Link, Palette, Smile, Trash2, Type } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useCreatePinnedFolder, useRemoveSpace, useUpdateSpace } from '@/hooks/use-spaces-query';
import { SPACE_COLORS, SPACE_ICONS } from '@/lib/space-theme';
import type { SpaceColor, SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { usePortalContainer } from '@/ui/contexts/PortalContext';

interface TwoFingerMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: { x: number; y: number };
  context: TwoFingerMenuContext;
}

export type TwoFingerMenuContext =
  | { type: 'space'; space: SpaceSnapshot }
  | { type: 'tab'; tab: { id: number; title: string; url: string } }
  | { type: 'empty'; space: SpaceSnapshot };

export function TwoFingerMenu({ open, onOpenChange, position, context }: TwoFingerMenuProps) {
  const portalContainer = usePortalContainer();

  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <div
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
            zIndex: 99999,
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
          {context.type === 'space' || context.type === 'empty' ? (
            <SpaceMenuItems space={context.space} onClose={() => onOpenChange(false)} />
          ) : (
            <TabMenuItems tab={context.tab} onClose={() => onOpenChange(false)} />
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// Space menu items
interface SpaceMenuItemsProps {
  space: SpaceSnapshot;
  onClose: () => void;
}

function SpaceMenuItems({ space, onClose }: SpaceMenuItemsProps) {
  const { mutateAsync: removeSpace } = useRemoveSpace();
  const { mutate: updateSpace } = useUpdateSpace();
  const { mutate: createFolder } = useCreatePinnedFolder();
  const spaces = useSpacesStore((state) => state.spaces);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);
  const portalContainer = usePortalContainer();

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(space.name);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('New Folder');

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
    onClose();
  };

  const handleRename = useCallback(() => {
    if (newName.trim() && newName !== space.name) {
      updateSpace({ id: space.id, name: newName.trim() });
    }
    setIsRenaming(false);
    onClose();
  }, [newName, space.id, space.name, updateSpace, onClose]);

  const handleColorChange = useCallback(
    (color: SpaceColor) => {
      updateSpace({ id: space.id, themeColor: color });
      onClose();
    },
    [space.id, updateSpace, onClose]
  );

  const handleIconChange = useCallback(
    (icon: string) => {
      updateSpace({ id: space.id, icon });
      onClose();
    },
    [space.id, updateSpace, onClose]
  );

  const handleNewFolder = useCallback(() => {
    if (newFolderName.trim()) {
      createFolder({ spaceName: space.name, title: newFolderName.trim() });
    }
    setIsCreatingFolder(false);
    setNewFolderName('New Folder');
    onClose();
  }, [space.name, newFolderName, createFolder, onClose]);

  const menuItemClass =
    'flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10';

  if (isCreatingFolder) {
    return (
      <div className="p-2">
        <h3 className="mb-2 text-xs font-medium text-slate-400">New Folder</h3>
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNewFolder();
            if (e.key === 'Escape') {
              setIsCreatingFolder(false);
              onClose();
            }
          }}
          className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          // biome-ignore lint/a11y/noAutofocus: intentional focus for UX
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setIsCreatingFolder(false);
              onClose();
            }}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleNewFolder}
            className="rounded bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary/90"
          >
            Create
          </button>
        </div>
      </div>
    );
  }

  if (isRenaming) {
    return (
      <div className="p-2">
        <h3 className="mb-2 text-xs font-medium text-slate-400">Rename Space</h3>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') {
              setIsRenaming(false);
              onClose();
            }
          }}
          className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          // biome-ignore lint/a11y/noAutofocus: intentional focus for UX
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setIsRenaming(false);
              onClose();
            }}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRename}
            className="rounded bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary/90"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
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
      <DropdownMenu.Item className={menuItemClass} onSelect={() => setIsRenaming(true)}>
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
      <DropdownMenu.Item className={menuItemClass} onSelect={() => setIsCreatingFolder(true)}>
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
    </>
  );
}

// Tab menu items
interface TabMenuItemsProps {
  tab: { id: number; title: string; url: string };
  onClose: () => void;
}

function TabMenuItems({ tab, onClose }: TabMenuItemsProps) {
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tab.url);
      console.log('Copied link:', tab.url);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
    onClose();
  }, [tab.url, onClose]);

  const menuItemClass =
    'flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10';

  return (
    <>
      {/* Copy Link */}
      <DropdownMenu.Item className={menuItemClass} onSelect={handleCopyLink}>
        <Link className="h-4 w-4 text-slate-400" />
        <span>Copy Link</span>
      </DropdownMenu.Item>
    </>
  );
}
