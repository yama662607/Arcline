import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, BookmarkPlus, MoreHorizontal, Settings } from 'lucide-react';
import { usePortalContainer } from '@/ui/contexts/PortalContext';

interface MoreMenuProps {
  onOpenSettings: () => void;
  onOpenArchive: () => void;
  onOpenBookmarkImport: () => void;
  variant?: 'standalone' | 'floating';
}

export function MoreMenu({
  onOpenSettings,
  onOpenArchive,
  onOpenBookmarkImport,
  variant = 'standalone',
}: MoreMenuProps) {
  const isFloating = variant === 'floating';

  const menuItemClass =
    'flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`flex items-center justify-center rounded-md transition-colors hover:bg-white/10 text-slate-400 hover:text-white ${
            isFloating ? 'h-6 w-6' : 'h-7 w-7'
          }`}
          title="More options"
        >
          <MoreHorizontal className={isFloating ? 'h-4 w-4' : 'h-5 w-5'} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={usePortalContainer()}>
        <DropdownMenu.Content
          className="min-w-[200px] rounded-lg border border-white/10 bg-slate-900/95 p-1.5 text-sm text-slate-200 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          style={{ zIndex: 99999 }}
          sideOffset={5}
        >
          <DropdownMenu.Item className={menuItemClass} onSelect={onOpenSettings}>
            <Settings className="h-4 w-4 text-slate-400" />
            <span>Settings</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item className={menuItemClass} onSelect={onOpenArchive}>
            <Archive className="h-4 w-4 text-slate-400" />
            <span>Archive</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item className={menuItemClass} onSelect={onOpenBookmarkImport}>
            <BookmarkPlus className="h-4 w-4 text-slate-400" />
            <span>Import Bookmarks</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
