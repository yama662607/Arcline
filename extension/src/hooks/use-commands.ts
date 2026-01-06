import { useMemo } from 'react';
import type { SpaceSnapshot } from '@/shared/types';

/**
 * Type for executable command actions in the command palette
 */
export type CommandAction = {
  id: string;
  title: string;
  description?: string;
  icon:
    | 'plus'
    | 'folder'
    | 'pin'
    | 'close'
    | 'refresh'
    | 'settings'
    | 'archive'
    | 'copy'
    | 'terminal';
  category: 'space' | 'tab' | 'navigation' | 'clipboard';
  keywords: string[];
  execute: () => Promise<void>;
};

/**
 * Hook to provide available command actions for the command palette
 * Commands are filtered by query and prioritized by relevance
 */
export function useCommands(
  query: string,
  spaces: SpaceSnapshot[],
  actions: {
    createSpace: () => Promise<void>;
    activateSpace: (spaceUuidOrId: string | number) => Promise<void>;
    pinCurrentTab: () => Promise<void>;
    closeCurrentTab: () => Promise<void>;
    reloadCurrentTab: () => Promise<void>;
    openSettings: () => void;
    openArchive: () => void;
    copyCurrentUrl: () => Promise<void>;
  }
): CommandAction[] {
  const commands = useMemo<CommandAction[]>(() => {
    const baseCommands: CommandAction[] = [
      {
        id: 'create-space',
        title: 'Create new space',
        description: 'Create a new tab group space',
        icon: 'plus',
        category: 'space',
        keywords: ['create', 'new', 'space', 'group', 'add'],
        execute: actions.createSpace,
      },
      {
        id: 'pin-current-tab',
        title: 'Pin current tab',
        description: 'Pin the currently active tab to the space',
        icon: 'pin',
        category: 'tab',
        keywords: ['pin', 'tab', 'save', 'favorite'],
        execute: actions.pinCurrentTab,
      },
      {
        id: 'close-current-tab',
        title: 'Close current tab',
        description: 'Close the currently active tab',
        icon: 'close',
        category: 'tab',
        keywords: ['close', 'tab', 'remove', 'delete'],
        execute: actions.closeCurrentTab,
      },
      {
        id: 'reload-current-tab',
        title: 'Reload page',
        description: 'Reload the current page',
        icon: 'refresh',
        category: 'tab',
        keywords: ['reload', 'refresh', 'page'],
        execute: actions.reloadCurrentTab,
      },
      {
        id: 'open-settings',
        title: 'Open Settings',
        description: 'Open Arcline settings panel',
        icon: 'settings',
        category: 'navigation',
        keywords: ['settings', 'preferences', 'options', 'config'],
        execute: async () => actions.openSettings(),
      },
      {
        id: 'open-archive',
        title: 'Open Archive',
        description: 'View archived tabs',
        icon: 'archive',
        category: 'navigation',
        keywords: ['archive', 'archived', 'tabs', 'history'],
        execute: async () => actions.openArchive(),
      },
      {
        id: 'copy-current-url',
        title: 'Copy current URL',
        description: 'Copy the current page URL to clipboard',
        icon: 'copy',
        category: 'clipboard',
        keywords: ['copy', 'url', 'link', 'clipboard', 'share'],
        execute: actions.copyCurrentUrl,
      },
    ];

    // Add "Switch to [Space Name]" commands for each space
    const spaceCommands: CommandAction[] = spaces.map((space) => ({
      id: `switch-to-space-${space.uuid}`,
      title: `Switch to ${space.name}`,
      description: `Navigate to space "${space.name}"`,
      icon: 'folder' as const,
      category: 'space' as const,
      keywords: ['switch', 'go', 'navigate', 'space', space.name.toLowerCase()],
      execute: async () => actions.activateSpace(space.uuid ?? space.id),
    }));

    return [...baseCommands, ...spaceCommands];
  }, [spaces, actions]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show base commands (not space-specific) when no query
      return commands.filter((cmd) => !cmd.id.startsWith('switch-to-space-'));
    }

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      // Match against title
      if (cmd.title.toLowerCase().includes(lowerQuery)) return true;
      // Match against description
      if (cmd.description?.toLowerCase().includes(lowerQuery)) return true;
      // Match against keywords
      if (cmd.keywords.some((kw) => kw.includes(lowerQuery))) return true;
      return false;
    });
  }, [commands, query]);

  return filteredCommands;
}
