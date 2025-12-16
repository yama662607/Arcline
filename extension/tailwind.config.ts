import type { Config } from 'tailwindcss';

// Function to convert spacing units to px (assuming 1 unit = 4px, standard Tailwind behavior)
// We use px to ensure consistency inside Shadow DOM regardless of host page's root font-size.
const generateSpacing = () => {
  const spacing: Record<string, string> = {
    px: '1px',
    0: '0px',
  };

  // 0.5 to 3.5 (0.5 increments)
  const halves = [0.5, 1.5, 2.5, 3.5];
  halves.forEach((v) => {
    spacing[String(v)] = `${v * 4}px`;
  });

  // 1 to 12 (1 increments)
  for (let i = 1; i <= 12; i++) {
    spacing[String(i)] = `${i * 4}px`;
  }

  // 14 to 96 (standard steps)
  const steps = [14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
  steps.forEach((v) => {
    spacing[String(v)] = `${v * 4}px`;
  });

  return spacing;
};

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './*.html'],
  darkMode: 'class',
  theme: {
    // Override fontSize to use fixed px values
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['16px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['30px', { lineHeight: '36px' }],
      '4xl': ['36px', { lineHeight: '40px' }],
      '5xl': ['48px', { lineHeight: '1' }],
      '6xl': ['60px', { lineHeight: '1' }],
      '7xl': ['72px', { lineHeight: '1' }],
      '8xl': ['96px', { lineHeight: '1' }],
      '9xl': ['128px', { lineHeight: '1' }],
    },
    // Override spacing to use fixed px values
    spacing: generateSpacing(),
    // Override borderRadius to use fixed px values
    borderRadius: {
      none: '0px',
      sm: '2px',
      DEFAULT: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px',
      '2xl': '16px',
      '3xl': '24px',
      full: '9999px',
    },
    // Override maxWidth to use fixed px values (default is rem)
    maxWidth: {
      none: 'none',
      0: '0px',
      xs: '320px',
      sm: '384px',
      md: '448px',
      lg: '512px',
      xl: '576px',
      '2xl': '672px',
      '3xl': '768px',
      '4xl': '896px',
      '5xl': '1024px',
      '6xl': '1152px',
      '7xl': '1280px',
      full: '100%',
      min: 'min-content',
      max: 'max-content',
      prose: '65ch',
    },
    extend: {
      // Extend standard colors or other properties if needed
      // but keeping core layout metrics in px is key.
      colors: {
        surface: {
          DEFAULT: 'var(--theme-surface)',
          light: 'var(--theme-surface)', // Fallback or map to another var if needed
          dark: 'var(--theme-surface)',  // Fallback
        },
      },
      // Note: minWidth defaults to referencing spacing, so it's covered.
    },
  },
  plugins: [],
} satisfies Config;
