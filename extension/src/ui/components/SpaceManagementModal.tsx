import * as Dialog from '@radix-ui/react-dialog';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

import { useCreateSpace, useRemoveSpace, useUpdateSpace } from '@/hooks/use-spaces-query';
import { SPACE_ICONS, getSpaceDisplayIcon, getSpaceTheme } from '@/lib/space-theme';
import type { SpaceColor, SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store/spacesSlice';

interface SpaceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SpaceRowProps {
  space: SpaceSnapshot;
  onToggleFavorite: (spaceId: number) => void;
  onEdit: (space: SpaceSnapshot) => void;
  onDelete: (spaceId: number) => void;
  canDelete: boolean;
  isFavorite: boolean;
}

function SpaceRow({
  space,
  onToggleFavorite,
  onEdit,
  onDelete,
  canDelete,
  isFavorite,
}: SpaceRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: space.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const theme = getSpaceTheme(space.themeColor);
  const icon = getSpaceDisplayIcon(space.icon, space.name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3 transition-colors hover:bg-black/30"
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab text-slate-400 hover:text-white active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {/* Space icon and info */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg"
        style={{ background: theme.gradientSubtle }}
      >
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="truncate text-sm font-medium text-white">{space.name}</h4>
        <p className="text-xs text-slate-400">
          {space.pinnedTabs?.length ?? 0} pinned, {space.temporaryTabs?.length ?? 0} temporary
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Favorite toggle */}
        <button
          type="button"
          onClick={() => onToggleFavorite(space.id)}
          className={`rounded p-1.5 transition-colors ${
            isFavorite
              ? 'text-yellow-400 hover:text-yellow-300'
              : 'text-slate-500 hover:text-yellow-400'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg
            className="h-5 w-5"
            fill={isFavorite ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>

        {/* Edit */}
        <button
          type="button"
          onClick={() => onEdit(space)}
          className="rounded p-1.5 text-slate-400 transition-colors hover:text-white"
          title="Edit space"
          aria-label="Edit space"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(space.id)}
          disabled={!canDelete}
          className="rounded p-1.5 text-slate-400 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-400"
          title={canDelete ? 'Delete space' : 'Cannot delete last space'}
          aria-label="Delete space"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface EditSpaceDialogProps {
  space: SpaceSnapshot;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, name: string, themeColor: SpaceColor, icon: string) => void;
}

function EditSpaceDialog({ space, isOpen, onClose, onSave }: EditSpaceDialogProps) {
  const [name, setName] = useState(space.name);
  const [themeColor, setThemeColor] = useState<SpaceColor>(space.themeColor ?? 'blue');
  const [icon, setIcon] = useState(space.icon ?? '');

  const handleSave = () => {
    if (name.trim()) {
      onSave(space.id, name.trim(), themeColor, icon);
      onClose();
    }
  };

  const colors: SpaceColor[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-slate-900 p-6 shadow-xl">
          <Dialog.Title className="mb-4 text-lg font-medium text-white">Edit Space</Dialog.Title>

          <div className="space-y-4">
            <div>
              <label htmlFor="space-name" className="mb-2 block text-sm font-medium text-slate-300">
                Space Name
              </label>
              <input
                id="space-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="Enter space name"
              />
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium text-slate-300">Theme Color</div>
              <div className="flex gap-2">
                {colors.map((color) => {
                  const theme = getSpaceTheme(color);
                  return (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setThemeColor(color)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        themeColor === color ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ background: theme.gradient }}
                      title={color}
                      aria-label={`Select ${color} color`}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium text-slate-300">Icon (optional)</div>
              <div className="grid grid-cols-10 gap-2">
                {SPACE_ICONS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setIcon(emoji)}
                    className={`flex h-8 w-8 items-center justify-center rounded text-lg transition-colors ${
                      icon === emoji ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded bg-white/10 px-4 py-2 text-slate-300 transition-colors hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SpaceManagementModal({ isOpen, onClose }: SpaceManagementModalProps) {
  const spaces = useSpacesStore((state) => state.spaces);
  const favoriteSpaceIds = useSpacesStore((state) => state.favoriteSpaceIds);
  const toggleFavoriteSpace = useSpacesStore((state) => state.toggleFavoriteSpace);

  const [orderedSpaces, setOrderedSpaces] = useState<SpaceSnapshot[]>(spaces);
  const [editingSpace, setEditingSpace] = useState<SpaceSnapshot | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState<SpaceColor>('blue');
  const [newSpaceIcon, setNewSpaceIcon] = useState('');

  const createSpaceMutation = useCreateSpace();
  const removeSpaceMutation = useRemoveSpace();
  const updateSpaceMutation = useUpdateSpace();

  // Update ordered spaces when spaces change
  if (spaces !== orderedSpaces && !isOpen) {
    setOrderedSpaces(spaces);
  }

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedSpaces((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;

    try {
      await createSpaceMutation.mutateAsync({
        name: newSpaceName.trim(),
        themeColor: newSpaceColor,
        icon: newSpaceIcon || undefined,
      });
      setNewSpaceName('');
      setNewSpaceColor('blue');
      setNewSpaceIcon('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create space:', error);
    }
  };

  const handleUpdateSpace = async (
    id: number,
    name: string,
    themeColor: SpaceColor,
    icon: string
  ) => {
    try {
      await updateSpaceMutation.mutateAsync({
        id,
        name,
        themeColor,
        icon: icon || undefined,
      });
    } catch (error) {
      console.error('Failed to update space:', error);
    }
  };

  const handleDeleteSpace = async (spaceId: number) => {
    if (spaces.length <= 1) return;

    try {
      await removeSpaceMutation.mutateAsync(spaceId);
    } catch (error) {
      console.error('Failed to delete space:', error);
    }
  };

  const colors: SpaceColor[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <Dialog.Title className="text-xl font-medium text-white">Manage Spaces</Dialog.Title>
              <Dialog.Close className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Dialog.Close>
            </div>

            <div className="max-h-[calc(80vh-140px)] overflow-y-auto p-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedSpaces.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {orderedSpaces.map((space) => (
                      <SpaceRow
                        key={space.id}
                        space={space}
                        onToggleFavorite={toggleFavoriteSpace}
                        onEdit={setEditingSpace}
                        onDelete={handleDeleteSpace}
                        canDelete={spaces.length > 1}
                        isFavorite={favoriteSpaceIds.includes(space.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Create new space section */}
              <div className="mt-6 border-t border-white/10 pt-6">
                {isCreating ? (
                  <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <div>
                      <input
                        type="text"
                        value={newSpaceName}
                        onChange={(e) => setNewSpaceName(e.target.value)}
                        placeholder="Space name"
                        className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="mb-2 text-sm text-slate-400">Theme Color</div>
                      <div className="flex gap-2">
                        {colors.map((color) => {
                          const theme = getSpaceTheme(color);
                          return (
                            <button
                              type="button"
                              key={color}
                              onClick={() => setNewSpaceColor(color)}
                              className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                newSpaceColor === color ? 'border-white' : 'border-transparent'
                              }`}
                              style={{ background: theme.gradient }}
                              title={color}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm text-slate-400">Icon (optional)</div>
                      <div className="grid grid-cols-10 gap-2">
                        {SPACE_ICONS.map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            onClick={() => setNewSpaceIcon(emoji)}
                            className={`flex h-8 w-8 items-center justify-center rounded text-lg transition-colors ${
                              newSpaceIcon === emoji ? 'bg-white/20' : 'hover:bg-white/10'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleCreateSpace}
                        disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
                        className="flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {createSpaceMutation.isPending ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreating(false);
                          setNewSpaceName('');
                          setNewSpaceColor('blue');
                          setNewSpaceIcon('');
                        }}
                        className="flex-1 rounded bg-white/10 px-4 py-2 text-slate-300 transition-colors hover:bg-white/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 py-3 text-slate-400 transition-colors hover:border-white/40 hover:text-white"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Create New Space
                  </button>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit space dialog */}
      {editingSpace && (
        <EditSpaceDialog
          space={editingSpace}
          isOpen={!!editingSpace}
          onClose={() => setEditingSpace(null)}
          onSave={handleUpdateSpace}
        />
      )}
    </>
  );
}
