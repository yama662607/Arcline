import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import { chromeMock, resetChromeMock } from './chrome-mock';

globalThis.chrome = chromeMock as unknown as typeof chrome;

beforeEach(() => {
  resetChromeMock();
});

// Mock ResizeObserver
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
