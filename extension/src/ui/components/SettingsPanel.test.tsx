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
    expect(screen.queryByText('Settings')).not.toBeInTheDocument(); // Assuming title isn't shown in loading
    // Check for pulse animation class (or structure) - Implementation detail
    // Just checking it doesn't crash and shows "something" related to loading is hard without text
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
      expect(screen.getByLabelText('Default Space Name')).toHaveValue('Home');
      expect(screen.getByLabelText('UI Mode')).toHaveValue('floating');
    });

    it('switches tabs', async () => {
      const user = userEvent.setup();
      renderComponent('standalone');

      // Switch to Appearance
      await user.click(screen.getByRole('button', { name: /Appearance/i }));

      expect(screen.getByLabelText('Theme')).toBeInTheDocument();
      expect(screen.getByLabelText(/Show website favicons/)).toBeChecked();
    });

    it('validates and submits form', async () => {
      const user = userEvent.setup();
      renderComponent('standalone');

      const input = screen.getByLabelText('Default Space Name');

      // Clear input (should trigger validation if we tried to submit, but let's change value)
      await user.clear(input);
      await user.type(input, 'New Space');

      // Click Save (appears when dirty)
      const saveBtn = await screen.findByRole('button', { name: 'Save' });
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

      expect(screen.getByText('Settings')).toBeInTheDocument(); // small header

      // Should verify inputs are present directly (not in tabs)
      expect(screen.getByLabelText(/Show favicons/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Compact mode/)).toBeInTheDocument();
      // Should NOT show tab buttons
      expect(screen.queryByText('General')).not.toBeInTheDocument();
    });

    it('updates checkbox settings immediately (via Save button)', async () => {
      const user = userEvent.setup();
      renderComponent('floating');

      // Toggle Compact Mode
      const checkbox = screen.getByLabelText(/Compact mode/);
      await user.click(checkbox); // toggles to true

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
