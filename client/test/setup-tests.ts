import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Create actual storage maps for mocking localStorage/sessionStorage
const localStorageMap = new Map<string, string>();
const sessionStorageMap = new Map<string, string>();

// Mock localStorage for jsdom environment using plain functions
// (vi.fn() can cause issues with mock restoration)
const localStorageMock = {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  clear: () => localStorageMap.clear(),
  removeItem: (key: string) => localStorageMap.delete(key),
  get length() { return localStorageMap.size; },
  key: (index: number) => {
    const keys = Array.from(localStorageMap.keys());
    return keys[index] ?? null;
  },
};

const sessionStorageMock = {
  getItem: (key: string) => sessionStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => sessionStorageMap.set(key, value),
  clear: () => sessionStorageMap.clear(),
  removeItem: (key: string) => sessionStorageMap.delete(key),
  get length() { return sessionStorageMap.size; },
  key: (index: number) => {
    const keys = Array.from(sessionStorageMap.keys());
    return keys[index] ?? null;
  },
};

// Assign mocks to global
global.localStorage = localStorageMock as unknown as Storage;
global.sessionStorage = sessionStorageMock as unknown as Storage;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
