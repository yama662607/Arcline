import { useEffect } from 'react';

import type { ActiveSpaceChangedMessage, SpaceSnapshot } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { requestSpacesSnapshot } from './spaces';
import { hasChromeRuntime } from './utils';

function isSpacesSnapshotResponse(message: unknown): message is {
  command: 'spacesSnapshot';
  spaces?: SpaceSnapshot[];
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'command' in message &&
    (message as { command?: string }).command === 'spacesSnapshot'
  );
}

function isActiveSpaceMessage(message: unknown): message is ActiveSpaceChangedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'command' in message &&
    (message as { command?: string }).command === 'activeSpaceChanged'
  );
}

export function useSpacesSync() {
  const setSpaces = useSpacesStore((state) => state.setSpaces);
  const setActiveSpace = useSpacesStore((state) => state.setActiveSpace);

  useEffect(() => {
    let active = true;

    requestSpacesSnapshot()
      .then((spaces) => {
        if (!active) return;
        setSpaces(spaces);
      })
      .catch((error) => {
        console.warn('Failed to load spaces snapshot', error);
      });

    return () => {
      active = false;
    };
  }, [setSpaces]);

  useEffect(() => {
    if (!hasChromeRuntime()) return undefined;

    const listener = (message: unknown) => {
      if (isActiveSpaceMessage(message)) {
        const { spaceId } = message as ActiveSpaceChangedMessage;
        if (typeof spaceId === 'number') {
          setActiveSpace(spaceId);
        }
        return;
      }

      if (!isSpacesSnapshotResponse(message)) return;
      const spaces = Array.isArray(message.spaces) ? (message.spaces as SpaceSnapshot[]) : [];
      setSpaces(spaces);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [setActiveSpace, setSpaces]);
}
