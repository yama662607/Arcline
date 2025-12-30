import { useState } from 'react';

import { useCreateSpace, useRemoveSpace, useSpacesSnapshot } from '@/hooks/use-spaces-query';
import type { TabGroupColor } from '@/shared/chrome-types';
import { useSpacesStore } from '@/store';
import { SpaceContextMenu } from '@/ui/components/context-menu/SpaceContextMenu';

interface SpaceManagerProps {
  variant?: 'standalone' | 'floating';
}

export function SpaceManager({ variant = 'standalone' }: SpaceManagerProps) {
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState<TabGroupColor>('blue');

  const { data: spaces = [], isLoading, error } = useSpacesSnapshot();

  const createSpaceMutation = useCreateSpace();
  const removeSpaceMutation = useRemoveSpace();
  const { setActiveSpace } = useSpacesStore();

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;

    try {
      await createSpaceMutation.mutateAsync({
        name: newSpaceName.trim(),
        color: newSpaceColor,
      });
      setNewSpaceName('');
      setIsCreatingSpace(false);
    } catch (error) {
      console.error('Failed to create space:', error);
    }
  };

  const handleRemoveSpace = async (spaceId: number) => {
    if (spaces.length <= 1) {
      // Don't allow removing the last space
      return;
    }

    try {
      await removeSpaceMutation.mutateAsync(spaceId);

      // If we removed the active space, switch to another one
      const remainingSpaces = spaces.filter((s) => s.id !== spaceId);
      if (remainingSpaces.length > 0 && remainingSpaces[0]) {
        setActiveSpace(remainingSpaces[0].id);
      }
    } catch (error) {
      console.error('Failed to remove space:', error);
    }
  };

  const handleSwitchSpace = (spaceId: number) => {
    setActiveSpace(spaceId);
  };

  const colors: TabGroupColor[] = [
    'grey',
    'blue',
    'red',
    'yellow',
    'green',
    'pink',
    'purple',
    'cyan',
  ];

  // Shared modal for creating spaces
  const createSpaceModal = isCreatingSpace && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-surface p-6 rounded-lg border border-surface-light max-w-md w-full mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-space-title"
      >
        <h3 id="create-space-title" className="text-lg font-medium text-white mb-4">
          Create New Space
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="space-name" className="block text-sm font-medium text-slate-300 mb-2">
              Space Name
            </label>
            <input
              id="space-name"
              type="text"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Space name"
              className="w-full px-3 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white"
            />
          </div>

          <div>
            <div className="block text-sm font-medium text-slate-300 mb-2">Color</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Space color">
              {colors.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setNewSpaceColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    newSpaceColor === color ? 'border-white' : 'border-transparent'
                  } hover:scale-110 transition-transform`}
                  style={{ backgroundColor: color }}
                  role="radio"
                  aria-checked={newSpaceColor === color}
                  aria-label={`Select ${color} color`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleCreateSpace}
            disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createSpaceMutation.isPending ? 'Creating...' : 'Create Space'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreatingSpace(false);
              setNewSpaceName('');
            }}
            className="flex-1 px-4 py-2 bg-surface-light text-slate-300 rounded hover:bg-surface"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  if (variant === 'floating') {
    // Floating variant: compact space management for popup
    return (
      <>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-white">
              Spaces
              {!isLoading && !error && (
                <span className="ml-2 text-xs font-normal text-slate-400">({spaces.length})</span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => setIsCreatingSpace(true)}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              + New
            </button>
          </div>

          {isLoading && (
            <div data-testid="loading-spinner">
              <div className="animate-pulse space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 bg-surface-light rounded-lg" />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
              Failed to load spaces: {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && (
            <div className="grid gap-2">
              {spaces.map((space) => (
                <SpaceContextMenu key={space.id} space={space}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="p-3 rounded-lg border border-surface-light bg-surface/50 hover:bg-surface transition-all cursor-pointer group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                    onClick={() => handleSwitchSpace(space.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSwitchSpace(space.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: space.color }}
                          aria-hidden="true"
                        />
                        <div>
                          <h3 className="text-sm font-medium text-white">{space.name}</h3>
                          <p className="text-xs text-slate-400">
                            {space.pinnedTabs?.length ?? 0} pinned,{' '}
                            {space.temporaryTabs?.length ?? 0} temporary
                          </p>
                        </div>
                      </div>

                      {spaces.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSpace(space.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          title="Remove space"
                          aria-label="Remove space"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </SpaceContextMenu>
              ))}
            </div>
          )}
        </div>
        {createSpaceModal}
      </>
    );
  }

  // Standalone variant
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-white">
          Spaces
          {!isLoading && !error && (
            <span className="ml-2 text-sm font-normal text-slate-400">({spaces.length})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setIsCreatingSpace(true)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Create Space
        </button>
      </div>

      {isLoading && (
        <div data-testid="loading-spinner">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface-light rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          スペースの読み込みに失敗しました: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-3">
          {spaces.map((space) => (
            <SpaceContextMenu key={space.id} space={space}>
              <div
                role="button"
                tabIndex={0}
                className="p-4 rounded-lg border border-surface-light bg-surface/50 hover:bg-surface transition-all cursor-pointer group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                onClick={() => handleSwitchSpace(space.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSwitchSpace(space.id);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: space.color }}
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="font-medium text-white">{space.name}</h3>
                      <p className="text-sm text-slate-400">
                        {space.pinnedTabs?.length ?? 0} pinned, {space.temporaryTabs?.length ?? 0}{' '}
                        temporary
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwitchSpace(space.id);
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Switch
                    </button>
                    {spaces.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSpace(space.id);
                        }}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        title="Remove space"
                        aria-label="Remove space"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </SpaceContextMenu>
          ))}
        </div>
      )}

      {createSpaceModal}
    </div>
  );
}
