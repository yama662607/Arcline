import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type ReactNode } from 'react';

interface SortableTabRowProps {
  id: number | string;
  children: ReactNode;
  className?: string; // Allow passing styling for the wrapper
  style?: React.CSSProperties;
}

export function SortableTabRow({ id, children, className, style: propStyle }: SortableTabRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative', // Default, but overridden by propStyle if present
    zIndex: isDragging ? 50 : 'auto',
    ...propStyle,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={className}
    >
      {children}
    </div>
  );
}
