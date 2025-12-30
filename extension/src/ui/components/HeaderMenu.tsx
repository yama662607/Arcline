import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface HeaderMenuProps {
  onOpenSettings: () => void;
  onOpenArchive: () => void;
}

export function HeaderMenu({ onOpenSettings, onOpenArchive }: HeaderMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex h-6 w-6 items-center justify-center rounded text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Menu"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="8" cy="3" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="glass-menu min-w-[160px] rounded-lg border border-white/10 bg-black/30 p-1 shadow-lg backdrop-blur-md"
          sideOffset={5}
          align="end"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center rounded px-3 py-2 text-sm text-slate-100 outline-none transition-colors hover:bg-white/10 focus:bg-white/10"
            onSelect={onOpenSettings}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2"
              aria-hidden="true"
            >
              <path
                d="M8 10a2 2 0 100-4 2 2 0 000 4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.45 10a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V16a2 2 0 11-4 0v-.09A1.65 1.65 0 003 14.09a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H-3a2 2 0 110-4h.09A1.65 1.65 0 00-1.09 3a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H3a1.65 1.65 0 001-1.51V-3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V3a1.65 1.65 0 001.51 1H16a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1v0z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center rounded px-3 py-2 text-sm text-slate-100 outline-none transition-colors hover:bg-white/10 focus:bg-white/10"
            onSelect={onOpenArchive}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2"
              aria-hidden="true"
            >
              <path
                d="M14 5H2M14 5v9a1 1 0 01-1 1H3a1 1 0 01-1-1V5M14 5l-1-3H3L2 5M6 8h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Archive
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
