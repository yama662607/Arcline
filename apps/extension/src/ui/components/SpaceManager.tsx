import { useState } from 'react';
import { useSpacesSnapshot, useCreateSpace, useRemoveSpace } from '@/hooks/use-spaces-query';
import { useSpacesStore } from '@/store';
import type { SpaceSnapshot } from '@/shared/types';

interface SpaceManagerProps {
  variant?: 'standalone' | 'floating';
}

export function SpaceManager({ variant = 'standalone' }: SpaceManagerProps) {
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState<chrome.tabGroups.ColorEnum>('blue');
  
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
      const remainingSpaces = spaces.filter(s => s.id !== spaceId);
      if (remainingSpaces.length > 0) {
        setActiveSpace(remainingSpaces[0].id);
      }
    } catch (error) {
      console.error('Failed to remove space:', error);
    }
  };

  const handleSwitchSpace = (spaceId: number) => {
    setActiveSpace(spaceId);
  };

  const colors: chrome.tabGroups.ColorEnum[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-surface-light rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-surface-light rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        スペースの読み込みに失敗しました: {(error as Error).message}
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Spaces</h3>
          <button
            onClick={() => setIsCreatingSpace(true)}
            className="text-xs text-slate-400 hover:text-white transition-colors"
            title="Create new space"
          >
            + New
          </button>
        </div>
        
        <div className="space-y-1">
          {spaces.map((space) => (
            <div
              key={space.id}
              onClick={() => handleSwitchSpace(space.id)}
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-surface-light cursor-pointer transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: space.color }}
              />
              <span className="text-sm text-slate-200 truncate">{space.name}</span>
              {spaces.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSpace(space.id);
                  }}
                  className="ml-auto text-xs text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove space"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {isCreatingSpace && (
          <div className="px-3 py-2 border-t border-surface-light">
            <input
              type="text"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Space name"
              className="w-full px-2 py-1 text-sm bg-surface-light rounded border border-surface-light focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-1 mt-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewSpaceColor(color)}
                  className={`w-4 h-4 rounded-full border-2 ${
                    newSpaceColor === color ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreateSpace}
                disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createSpaceMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setIsCreatingSpace(false);
                  setNewSpaceName('');
                }}
                className="flex-1 px-2 py-1 text-xs bg-surface-light text-slate-300 rounded hover:bg-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-white">Spaces</h2>
        <button
          onClick={() => setIsCreatingSpace(true)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + New Space
        </button>
      </div>

      <div className="grid gap-3">
        {spaces.map((space) => (
          <div
            key={space.id}
            className="p-4 rounded-lg border border-surface-light bg-surface/50 hover:bg-surface transition-all cursor-pointer group"
            onClick={() => handleSwitchSpace(space.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: space.color }}
                />
                <div>
                  <h3 className="font-medium text-white">{space.name}</h3>
                  <p className="text-sm text-slate-400">
                    {space.pinnedTabs.length} pinned, {space.temporaryTabs.length} temporary
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSpace(space.id);
                    }}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isCreatingSpace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-lg border border-surface-light max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-white mb-4">Create New Space</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Space Name
                </label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Enter space name"
                  className="w-full px-3 py-2 bg-surface-light border border-surface-light rounded focus:outline-none focus:border-blue-500 text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewSpaceColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newSpaceColor === color ? 'border-white' : 'border-transparent'
                      } hover:scale-110 transition-transform`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateSpace}
                disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createSpaceMutation.isPending ? 'Creating...' : 'Create Space'}
              </button>
              <button
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
      )}
    </div>
  );
}
