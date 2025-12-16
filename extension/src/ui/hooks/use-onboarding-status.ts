import { useEffect, useState } from 'react';

const STORAGE_KEY = 'arcline.hasSeenOnboarding';

export function useOnboardingStatus() {
  const [hasSeenOnboarding, setHasSeenOnboardingState] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      setHasSeenOnboardingState(Boolean(result[STORAGE_KEY]));
    });
  }, []);

  const setHasSeenOnboarding = async (value: boolean) => {
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
    setHasSeenOnboardingState(value);
  };

  return {
    hasSeenOnboarding,
    setHasSeenOnboarding,
    isLoading: hasSeenOnboarding === null,
  };
}
