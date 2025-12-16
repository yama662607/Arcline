import * as ContextMenu from '@radix-ui/react-context-menu';
import type React from 'react';

import { useRemoveSpace } from '@/hooks/use-spaces-query';
import type { SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store';

interface SpaceContextMenuProps {
  children: React.ReactNode;
  space: SpaceSnapshot;
}

export function SpaceContextMenu({ children, space }: SpaceContextMenuProps) {
  const { mutateAsync: removeSpace } = useRemoveSpace();
  const spaces = useSpacesStore((state) => state.spaces);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);

  const handleRemove = async () => {
    if (spaces.length <= 1) return;
    try {
      await removeSpace(space.id);
      // If we removed the active space, switch to another one
      // Note: This logic assumes store updates after mutation syncs.
      // But we can trigger switch proactively if current active space is being removed.
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

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[220px] rounded-lg border border-white/10 bg-slate-900/95 p-1.5 text-sm text-slate-200 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <ContextMenu.Item
            className="flex cursor-pointer select-none items-center rounded py-1.5 px-2 outline-none hover:bg-red-500/20 text-red-400 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-400"
            disabled={spaces.length <= 1}
            onSelect={handleRemove}
          >
            Remove Space
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
