import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import triggerEventBus from '../core/triggerEventBus';

// Setup before each test
beforeEach(() => {
  // Clear event bus to prevent cross-test pollution
  triggerEventBus.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Clear localStorage
  localStorage.clear();
  // Clear event bus subscriptions
  triggerEventBus.clear();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
