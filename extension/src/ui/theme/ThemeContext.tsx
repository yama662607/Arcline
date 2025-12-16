import React, { createContext, useContext, useEffect, useState } from 'react';

// Define available theme colors based on Arc's palette
export const THEME_COLORS = {
  grey: { base: '#cccccc', active: '#9e9e9e' },
  blue: { base: '#8bb3f3', active: '#5c86c6' },
  red: { base: '#ff9e97', active: '#e16b63' },
  yellow: { base: '#ffe29f', active: '#dcb050' },
  green: { base: '#8bda99', active: '#5fa96d' },
  pink: { base: '#fbaad7', active: '#c46fa0' },
  purple: { base: '#d6a6ff', active: '#9f6ed0' },
  cyan: { base: '#a5e2ea', active: '#69b0b9' },
} as const;

export type ThemeColorKey = keyof typeof THEME_COLORS;

interface ThemeSettings {
  mode: 'light' | 'dark';
  accentColor: ThemeColorKey;
}

interface ThemeContextType {
  theme: ThemeSettings;
  setTheme: (settings: Partial<ThemeSettings>) => void;
  availableColors: typeof THEME_COLORS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'arcline_theme_settings';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeSettings>({
    mode: 'dark', // Default to dark for Arc-like feel
    accentColor: 'purple',
  });

  // Load from storage on mount
  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (result[STORAGE_KEY]) {
        setThemeState(result[STORAGE_KEY]);
      }
    });
  }, []);

  // Update DOM and Storage when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEME_COLORS[theme.accentColor];

    // Apply CSS variables for the accent color
    root.style.setProperty('--theme-accent', colors.base);

    // Apply Mode (Light/Dark) - for now simpler logic, could expand for full light mode
    if (theme.mode === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--theme-bg', '#1e1e24');
      root.style.setProperty('--theme-surface', 'rgba(40, 40, 45, 0.9)');
      root.style.setProperty('--theme-text', '#ffffff');
      root.style.setProperty('--theme-text-muted', 'rgba(255, 255, 255, 0.6)');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--theme-bg', '#ffffff');
      root.style.setProperty('--theme-surface', '#f3f4f6');
      root.style.setProperty('--theme-text', '#0f172a');
      root.style.setProperty('--theme-text-muted', '#64748b');
    }

    // Persist
    chrome.storage.local.set({ [STORAGE_KEY]: theme });

  }, [theme]);

  const setTheme = (settings: Partial<ThemeSettings>) => {
    setThemeState((prev) => ({ ...prev, ...settings }));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableColors: THEME_COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
