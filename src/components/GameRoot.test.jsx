import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GameProvider } from '../contexts/GameContext';
import GameRoot from './GameRoot';

describe('GameRoot Component', () => {
  it('should render without errors', () => {
    expect(() => render(
      <GameProvider>
        <GameRoot />
      </GameProvider>
    )).not.toThrow();
  });
});
