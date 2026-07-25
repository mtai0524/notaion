import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

// Ensure localStorage is available in test environment
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = {};
  window.localStorage = {
    getItem(key) { return store[key] ?? null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(key => delete store[key]); },
    key(index) { return Object.keys(store)[index] ?? null; },
    get length() { return Object.keys(store).length; },
  };
  // Reset localStorage before each test to prevent cross-test contamination
  beforeEach(() => { window.localStorage.clear(); });
}
