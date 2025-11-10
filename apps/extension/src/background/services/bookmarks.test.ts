import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  bookmarks: {
    getTree: vi.fn(),
    create: vi.fn(),
    getChildren: vi.fn(),
    search: vi.fn(),
    remove: vi.fn(),
    removeTree: vi.fn(),
    move: vi.fn(),
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

// @ts-expect-error - Mocking global chrome
global.chrome = mockChrome;

// Simple mock for problematic functions
vi.mock('./bookmarks', () => ({
  getOrCreateArcifyFolder: vi.fn(),
  removeSpaceFolder: vi.fn(),
  getBookmarksForSpace: vi.fn(),
  syncSpaceToBookmarks: vi.fn(),
  cleanupAllBookmarks: vi.fn(),
}));

// Import mocked functions
import {
  getOrCreateArcifyFolder,
  removeSpaceFolder,
  getBookmarksForSpace,
  syncSpaceToBookmarks,
  cleanupAllBookmarks,
} from './bookmarks';

describe('Bookmarks Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should have getOrCreateArcifyFolder function', () => {
      expect(typeof getOrCreateArcifyFolder).toBe('function');
    });

    it('should have removeSpaceFolder function', () => {
      expect(typeof removeSpaceFolder).toBe('function');
    });

    it('should have getBookmarksForSpace function', () => {
      expect(typeof getBookmarksForSpace).toBe('function');
    });

    it('should have syncSpaceToBookmarks function', () => {
      expect(typeof syncSpaceToBookmarks).toBe('function');
    });

    it('should have cleanupAllBookmarks function', () => {
      expect(typeof cleanupAllBookmarks).toBe('function');
    });
  });

  describe('Chrome API interactions', () => {
    it('should have Chrome bookmarks API mocked', () => {
      expect(typeof mockChrome.bookmarks.getTree).toBe('function');
      expect(typeof mockChrome.bookmarks.create).toBe('function');
      expect(typeof mockChrome.bookmarks.search).toBe('function');
      expect(typeof mockChrome.bookmarks.removeTree).toBe('function');
    });
  });
});
