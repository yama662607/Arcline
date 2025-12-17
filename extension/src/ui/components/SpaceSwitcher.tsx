/**
 * SpaceSwitcher Component
 * Arc-style dot indicator for switching between spaces
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useCreateSpace, useSetActiveSpace } from '@/hooks/use-spaces-query';
import { getSpaceAccentColor, SPACE_COLORS } from '@/lib/space-theme';
import type { SpaceColor, SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store';

interface SpaceSwitcherProps {
  variant?: 'standalone' | 'floating';
}

export function SpaceSwitcher({ variant = 'standalone' }: SpaceSwitcherProps) {
  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const { mutate: setActiveSpace } = useSetActiveSpace();
  const { mutate: createSpace } = useCreateSpace();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [selectedColor, setSelectedColor] = useState<SpaceColor>('blue');

  const handleSpaceClick = useCallback(
    (space: SpaceSnapshot) => {
      if (space.id !== activeSpaceId) {
        setActiveSpace(space.id);
      }
    },
    [activeSpaceId, setActiveSpace]
  );

  const handleCreateSpace = useCallback(() => {
    if (newSpaceName.trim()) {
      createSpace({ name: newSpaceName.trim(), themeColor: selectedColor });
      setNewSpaceName('');
      setShowCreateForm(false);
      setSelectedColor('blue');
    }
  }, [newSpaceName, selectedColor, createSpace]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreateSpace();
      } else if (e.key === 'Escape') {
        setShowCreateForm(false);
        setNewSpaceName('');
      }
    },
    [handleCreateSpace]
  );

  const isFloating = variant === 'floating';

  return (
    <div className="relative">
      <div
        className={`flex items-center justify-center gap-2 rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 ${isFloating ? 'py-2 px-3' : 'py-3 px-4'}`}
      >
        {/* Space dots */}
        <div className="flex items-center gap-1.5">
          {spaces.map((space) => {
            const isActive = space.id === activeSpaceId;
            const themeColor = space.themeColor ?? 'blue';
            const accentColor = getSpaceAccentColor(themeColor);

            return (
              <motion.button
                key={space.id}
                type="button"
                onClick={() => handleSpaceClick(space)}
                className={`relative rounded-full transition-all duration-200 ${
                  isActive
                    ? 'ring-2 ring-white/30 ring-offset-1 ring-offset-transparent'
                    : 'hover:scale-110'
                }`}
                style={{
                  width: isActive ? '24px' : '10px',
                  height: '10px',
                  backgroundColor: isActive ? accentColor : `${accentColor}60`,
                }}
                whileHover={{ scale: isActive ? 1 : 1.2 }}
                whileTap={{ scale: 0.9 }}
                title={space.name}
                aria-label={`Switch to ${space.name}`}
                aria-current={isActive ? 'true' : undefined}
                layout
              >
                {isActive && space.icon && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px]">
                    {space.icon}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Add space button */}
        <motion.button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`flex items-center justify-center rounded-full transition-colors ${
            showCreateForm
              ? 'bg-primary text-white'
              : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
          }`}
          style={{
            width: isFloating ? '20px' : '24px',
            height: isFloating ? '20px' : '24px',
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Create new space"
          aria-label="Create new space"
        >
          <Plus className={isFloating ? 'h-3 w-3' : 'h-4 w-4'} />
        </motion.button>
      </div>

      {/* Create space form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden"
          >
            <div className="rounded-lg border border-white/10 bg-surface-dark p-3 shadow-xl">
              <div className="space-y-3">
                {/* Color picker */}
                <div className="flex flex-wrap justify-center gap-1.5">
                  {(Object.keys(SPACE_COLORS) as SpaceColor[]).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`h-6 w-6 rounded-full transition-all ${
                        selectedColor === color
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-dark scale-110'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: SPACE_COLORS[color].primary }}
                      title={color}
                      aria-label={`Select ${color} color`}
                    />
                  ))}
                </div>

                {/* Name input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Space name"
                    className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    // biome-ignore lint/a11y/noAutofocus: intentional focus for UX
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateSpace}
                    disabled={!newSpaceName.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
