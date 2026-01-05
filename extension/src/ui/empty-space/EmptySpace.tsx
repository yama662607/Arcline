import { useEffect, useState } from 'react';
import { getSpaceTheme } from '@/lib/space-theme';
import type { TabGroupColor } from '@/shared/chrome-types';

export function EmptySpace() {
  const [themeColor, setThemeColor] = useState<TabGroupColor>('grey');

  useEffect(() => {
    // Parse query params
    const params = new URLSearchParams(window.location.search);
    const color = params.get('color') as TabGroupColor;
    if (color) {
      setThemeColor(color);
    }

    // Listen for theme updates if needed (optional optimization)
  }, []);

  const theme = getSpaceTheme(themeColor);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: theme.gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: '14px',
        userSelect: 'none',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ fontSize: '48px', opacity: 0.2 }}>
        {/* Optional: Add an icon or illustration here */}
      </div>
    </div>
  );
}
