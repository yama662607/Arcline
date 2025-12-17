import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight, FolderPlus, Palette, Smile, Trash2, Type } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';

import { useRemoveSpace, useUpdateSpace } from '@/hooks/use-spaces-query';
import { SPACE_COLORS, SPACE_ICONS } from '@/lib/space-theme';
import type { SpaceColor, SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store';

interface SpaceContextMenuProps {
  children: React.ReactNode;
  space: SpaceSnapshot;
}

export function SpaceContextMenu({ children, space }: SpaceContextMenuProps) {
  const { mutateAsync: removeSpace } = useRemoveSpace();
  const { mutate: updateSpace } = useUpdateSpace();
  const spaces = useSpacesStore((state) => state.spaces);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(space.name);

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
    },
    [space.id, updateSpace]
  );

  const handleIconChange = useCallback(
    (icon: string) => {
      updateSpace({ id: space.id, icon });
    },
    [space.id, updateSpace]
  );

  const menuItemClass =
    'flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[220px] rounded-lg border border-white/10 bg-slate-900/95 p-1.5 text-sm text-slate-200 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          {/* Change Space Icon */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className={menuItemClass}>
              <Smile className="h-4 w-4 text-slate-400" />
              <span className="flex-1">Change Space Icon...</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="min-w-[200px] rounded-lg border border-white/10 bg-slate-900/95 p-2 shadow-xl backdrop-blur-md">
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
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          {/* Rename Space */}
          <ContextMenu.Item className={menuItemClass} onSelect={() => setIsRenaming(true)}>
            <Type className="h-4 w-4 text-slate-400" />
            <span>Rename Space...</span>
          </ContextMenu.Item>

          {/* Edit Theme Color */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className={menuItemClass}>
              <Palette className="h-4 w-4 text-slate-400" />
              <span className="flex-1">Edit Theme Color...</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="min-w-[180px] rounded-lg border border-white/10 bg-slate-900/95 p-2 shadow-xl backdrop-blur-md">
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
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className="my-1.5 h-px bg-white/10" />

          {/* New Folder */}
          <ContextMenu.Item className={menuItemClass}>
            <FolderPlus className="h-4 w-4 text-slate-400" />
            <span>New Folder</span>
            <span className="ml-auto text-xs text-slate-500">⌘N</span>
          </ContextMenu.Item>

          <ContextMenu.Separator className="my-1.5 h-px bg-white/10" />

          {/* Delete Space */}
          <ContextMenu.Item
            className="flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-red-500/20 text-red-400 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-400 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
            disabled={spaces.length <= 1}
            onSelect={handleRemove}
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Space</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>

      {/* Rename Dialog (simple inline for now) */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
    </ContextMenu.Root>
  );
}
