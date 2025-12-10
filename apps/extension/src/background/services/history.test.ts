import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchHistory } from './history';

const mockChrome = {
    history: {
        search: vi.fn(),
    },
};

global.chrome = mockChrome as any;

describe('searchHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls chrome.history.search with correct params', async () => {
        mockChrome.history.search.mockResolvedValue([]);
        await searchHistory('test', 10);
        expect(mockChrome.history.search).toHaveBeenCalledWith({ text: 'test', maxResults: 10 });
    });

    it('maps history items to SearchResults', async () => {
        const historyItems = [
            { id: '1', title: 'Google', url: 'https://google.com', lastVisitTime: 123456 },
            { id: '2', title: '', url: 'https://example.com', lastVisitTime: 789012 },
        ];
        mockChrome.history.search.mockResolvedValue(historyItems);

        const results = await searchHistory('foo');

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({
            type: 'history',
            id: '1',
            title: 'Google',
            url: 'https://google.com',
            lastVisitTime: 123456,
        });
        // Fallback title
        expect(results[1]!.title).toBe('https://example.com');
    });
});
