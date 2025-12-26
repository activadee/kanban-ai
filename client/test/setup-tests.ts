import { vi } from 'vitest';

// Mock localStorage for jsdom environment
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  get length(): number {
    return 0;
  },
  key(_index: number): string | null {
    return null;
  },
};

// Mock sessionStorage as well
global.sessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  get length(): number {
    return 0;
  },
  key(_index: number): string | null {
    return null;
  },
};
