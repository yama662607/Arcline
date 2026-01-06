import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeSearch, searchLocal } from './search';

// Mock dependencies
vi.mock('./browser', () => ({
  getSpacesSnapshot: vi.fn(),
}));

import { getSpacesSnapshot } from './browser';

describe('Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSpaces = [
    {
      id: 1,
      name: 'Work Space',
      tabs: [
        { id: 101, title: 'GitHub', url: 'https://github.com', favIconUrl: 'github.ico' },
        { id: 102, title: 'Jira', url: 'https://jira.atlassian.com', favIconUrl: 'jira.ico' },
      ],
      pinnedItems: [
        {
          id: 201,
          type: 'tab',
          tabId: 201,
          title: 'Pinned Gmail',
          url: 'https://mail.google.com',
          favIconUrl: 'gmail.ico',
        },
      ],
      temporaryTabs: [],
    },
    {
      id: 2,
      name: 'Personal Space',
      tabs: [{ id: 301, title: 'YouTube', url: 'https://youtube.com', favIconUrl: 'yt.ico' }],
      pinnedItems: [],
      temporaryTabs: [],
    },
  ];

  it('should initialize index and return results', async () => {
    vi.mocked(getSpacesSnapshot).mockResolvedValue(mockSpaces as any);

    await initializeSearch();

    const results = await searchLocal('GitHub');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('GitHub');
    expect(results[0]?.url).toBe('https://github.com');
  });

  it('should find pinned items', async () => {
    vi.mocked(getSpacesSnapshot).mockResolvedValue(mockSpaces as any);

    await initializeSearch();

    const results = await searchLocal('Gmail');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Pinned Gmail');
  });

  it('should find items by URL', async () => {
    vi.mocked(getSpacesSnapshot).mockResolvedValue(mockSpaces as any);
    await initializeSearch();

    const results = await searchLocal('atlassian');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Jira');
  });

  it('should find spaces by name', async () => {
    vi.mocked(getSpacesSnapshot).mockResolvedValue(mockSpaces as any);
    await initializeSearch();

    // "Personal" matches "Personal Space" (the space) AND "YouTube" (tab described as "Personal Space")
    const results = await searchLocal('Personal');
    expect(results).toHaveLength(2);

    const spaceResult = results.find((r) => r.type === 'space');
    expect(spaceResult).toBeDefined();
    expect(spaceResult?.title).toBe('Personal Space');
  });

  it('should return empty array when no matches', async () => {
    vi.mocked(getSpacesSnapshot).mockResolvedValue(mockSpaces as any);
    await initializeSearch();

    const results = await searchLocal('NonExistentTerm');
    expect(results).toHaveLength(0);
  });

  it('should auto-initialize if search called before init', async () => {
    vi.mocked(getSpacesSnapshot).mockResolvedValue(mockSpaces as any);
    // Note: we don't call initializeSearch explicitely

    const results = await searchLocal('YouTube');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('YouTube');
  });
});
