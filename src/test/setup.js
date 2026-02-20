import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import triggerEventBus from '../core/triggerEventBus';

// Setup before each test
beforeEach(async () => {
  // Clear event bus to prevent cross-test pollution
  triggerEventBus.clear();
  // Reset network registry to prevent cross-test pollution
  // Dynamic import avoids loading NetworkRegistry.js before vi.mock can replace its dependencies
  // Optional chaining handles test files that mock NetworkRegistry itself
  const { default: networkRegistry } = await import('../systems/NetworkRegistry');
  networkRegistry?.reset?.();
});

// Cleanup after each test
afterEach(async () => {
  cleanup();
  // Clear localStorage
  localStorage.clear();
  // Clear event bus subscriptions
  triggerEventBus.clear();
  // Reset network registry
  const { default: networkRegistry } = await import('../systems/NetworkRegistry');
  networkRegistry?.reset?.();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
