import { useEffect } from 'react';

import { useSpacesSnapshot } from '@/hooks/use-spaces-query';
import type { ActiveSpaceChangedMessage } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { hasChromeRuntime } from './utils';

function isActiveSpaceMessage(message: unknown): message is ActiveSpaceChangedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'command' in message &&
    (message as { command?: string }).command === 'activeSpaceChanged'
  );
}

export function useSpacesSync() {
  const { data: spaces } = useSpacesSnapshot();
  const setSpaces = useSpacesStore((state) => state.setSpaces);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);

  useEffect(() => {
    if (!spaces) return;
    setSpaces(spaces);
  }, [spaces, setSpaces]);

  useEffect(() => {
    if (!hasChromeRuntime()) return undefined;

    const listener = (message: unknown) => {
      if (!isActiveSpaceMessage(message)) return;
      const { spaceId } = message as ActiveSpaceChangedMessage;
      if (typeof spaceId === 'number') {
        setActiveSpace(spaceId);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [setActiveSpace]);
}
