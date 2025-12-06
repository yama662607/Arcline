import type { DragEvent as ReactDragEvent } from 'react';
import { useCallback, useState } from 'react';

import type { TabEntry } from '@/shared/types';

/**
 * タブの移動元を表す型
 */
export type TabSource = 'temporary' | 'pinned' | 'favorite';

/**
 * ドラッグデータの型
 */
export interface DragData {
  tab: TabEntry;
  source: TabSource;
}

/**
 * ドラッグデータのMIMEタイプ
 */
export const DRAG_MIME_TYPE = 'application/x-arcline-tab';

/**
 * ドラッグデータを設定する
 */
export function setDragData(e: ReactDragEvent, tab: TabEntry, source: TabSource): void {
  const data: DragData = { tab, source };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', tab.id.toString());
  e.dataTransfer.setData(DRAG_MIME_TYPE, JSON.stringify(data));
}

/**
 * ドラッグデータを取得する
 */
export function getDragData(e: ReactDragEvent): DragData | null {
  try {
    const rawData = e.dataTransfer.getData(DRAG_MIME_TYPE);
    if (!rawData) return null;

    const parsed = JSON.parse(rawData);

    // 後方互換性: sourceがない場合はtemporaryとして扱う
    if (!parsed.source && parsed.id !== undefined) {
      return {
        tab: parsed as TabEntry,
        source: parsed.pinned ? 'pinned' : 'temporary',
      };
    }

    return parsed as DragData;
  } catch {
    return null;
  }
}

/**
 * ドラッグ&ドロップのカスタムフック
 */
export function useTabDragDrop(source: TabSource) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = useCallback(
    (e: ReactDragEvent, tab: TabEntry) => {
      console.log(`[useTabDragDrop] DragStart from ${source}:`, tab.title);
      setIsDragging(true);
      setDragData(e, tab, source);
    },
    [source]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: ReactDragEvent): DragData | null => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const data = getDragData(e);
      if (data) {
        console.log(`[useTabDragDrop] Drop on ${source}:`, data);
      }
      return data;
    },
    [source]
  );

  return {
    isDragging,
    isDragOver,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
