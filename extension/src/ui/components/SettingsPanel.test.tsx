import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings, useUpdateSettings } from '@/hooks/use-spaces-query';
import { SettingsPanel } from './SettingsPanel';

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
}));

const mockSettings = {
  defaultSpaceName: 'Home',
  autoArchiveEnabled: false,
  autoArchiveIdleMinutes: 30,
  enableNewTabOverride: true,
  uiMode: 'floating',
  showFavicons: true,
  compactMode: false,
  enableAnimations: true,
  theme: 'dark',
  gesturesEnabled: true,
  gestureSensitivity: 100,
};

describe('SettingsPanel', () => {
  let queryClient: QueryClient;
  const mutateAsyncMock = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();

    vi.mocked(useSettings).mockReturnValue({
      data: mockSettings,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettings>);

    vi.mocked(useUpdateSettings).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateSettings>);
  });

  const renderComponent = (variant: 'standalone' | 'floating' = 'standalone') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SettingsPanel variant={variant} />
      </QueryClientProvider>
    );
  };

  it('renders loading state', () => {
    vi.mocked(useSettings).mockReturnValue({
      isLoading: true,
    } as unknown as ReturnType<typeof useSettings>);
    renderComponent();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    const loader = document.querySelector('.animate-pulse');
    expect(loader).toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useSettings).mockReturnValue({
      error: new Error('Failed load'),
    } as unknown as ReturnType<typeof useSettings>);
    renderComponent();
    expect(screen.getByText(/設定の読み込みに失敗しました/)).toBeInTheDocument();
  });

  describe('Standalone Variant', () => {
    it('renders general settings by default', () => {
      renderComponent('standalone');

      // Should show tabs
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();

      // Should show General tab content
      expect(screen.getByText('Default Space Name')).toBeInTheDocument();
      expect(screen.getByText('Interface Mode')).toBeInTheDocument();
    });

    it('switches tabs', async () => {
      const user = userEvent.setup();
      renderComponent('standalone');

      // Switch to Appearance
      await user.click(screen.getByRole('button', { name: /Appearance/i }));

      // Check for appearance content
      expect(screen.getByText('Color theme')).toBeInTheDocument();
      expect(screen.getByText('Show website favicons')).toBeInTheDocument();
    });

    it('validates and submits form', async () => {
      const user = userEvent.setup();
      renderComponent('standalone');

      // Get input by role
      const inputs = screen.getAllByRole('textbox');
      const input = inputs[0]; // First textbox is Default Space Name
      if (!input) throw new Error('Expected at least one textbox');

      // Clear input and type new value
      await user.clear(input);
      await user.type(input, 'New Space');

      // Click Save (appears when dirty)
      const saveBtn = await screen.findByRole('button', { name: /Save/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(mutateAsyncMock).toHaveBeenCalledWith(
          expect.objectContaining({
            defaultSpaceName: 'New Space',
          })
        );
      });
    });
  });

  describe('Floating Variant', () => {
    it('renders compact settings list', () => {
      renderComponent('floating');

      expect(screen.getByText('Settings')).toBeInTheDocument();

      // Should verify text labels are present
      expect(screen.getByText('Show favicons')).toBeInTheDocument();
      expect(screen.getByText('Compact mode')).toBeInTheDocument();
      // Should NOT show General tab button
      expect(screen.queryByRole('button', { name: /^General$/i })).not.toBeInTheDocument();
    });

    it('updates toggle settings immediately (via Save button)', async () => {
      const user = userEvent.setup();
      renderComponent('floating');

      // Find all toggle switches (role="switch")
      const toggleSwitches = screen.getAllByRole('switch');
      // Compact mode is the 3rd toggle (after New tab integration, Show favicons)
      const compactModeToggle = toggleSwitches[2];
      if (!compactModeToggle) throw new Error('Expected at least 3 toggle switches');

      // Verify initial state (unchecked)
      expect(compactModeToggle).toHaveAttribute('aria-checked', 'false');

      // Click to toggle
      await user.click(compactModeToggle);

      // Verify it changed
      expect(compactModeToggle).toHaveAttribute('aria-checked', 'true');

      // Click Save
      const saveBtn = await screen.findByRole('button', { name: 'Save' });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(mutateAsyncMock).toHaveBeenCalledWith(
          expect.objectContaining({
            compactMode: true,
          })
        );
      });
    });
  });
});
