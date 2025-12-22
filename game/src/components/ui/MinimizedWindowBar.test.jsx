import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import MinimizedWindowBar from './MinimizedWindowBar';

// Mock window component
vi.mock('./Window', () => ({
  default: () => <div>Mock Window</div>,
}));

describe('MinimizedWindowBar Component', () => {
  it('should not render when no minimized windows', () => {
    const { container } = render(
      <GameProvider>
        <MinimizedWindowBar />
      </GameProvider>
    );

    expect(container.querySelector('.minimized-bar')).not.toBeInTheDocument();
  });

  // Note: Testing with minimized windows would require setting up game state
  // with minimized windows, which is better done in integration tests
});
