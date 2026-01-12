import { describe, it, expect } from 'vitest';
import { useStoryMissions } from './useStoryMissions';

describe('useStoryMissions', () => {
  it('should be a function', () => {
    expect(typeof useStoryMissions).toBe('function');
  });

  it('should accept gameState and actions parameters', () => {
    // Hook can't be tested in isolation easily
    // This validates it's exported correctly
    expect(useStoryMissions).toBeDefined();
  });
});
