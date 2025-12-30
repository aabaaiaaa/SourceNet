import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GameOverOverlay from './GameOverOverlay';

describe('GameOverOverlay Component', () => {
  it('should render bankruptcy message', () => {
    const mockOnLoadSave = vi.fn();
    const mockOnNewGame = vi.fn();

    render(
      <GameOverOverlay
        type="bankruptcy"
        onLoadSave={mockOnLoadSave}
        onNewGame={mockOnNewGame}
      />
    );

    expect(screen.getByText('BANKRUPTCY')).toBeInTheDocument();
    expect(screen.getByText(/seize your assets/i)).toBeInTheDocument();
  });

  it('should render termination message', () => {
    const mockOnLoadSave = vi.fn();
    const mockOnNewGame = vi.fn();

    render(
      <GameOverOverlay
        type="termination"
        onLoadSave={mockOnLoadSave}
        onNewGame={mockOnNewGame}
      />
    );

    expect(screen.getByText('CONTRACT TERMINATED')).toBeInTheDocument();
    expect(screen.getByText(/poor performance/i)).toBeInTheDocument();
  });

  it('should have load save and new game buttons', () => {
    const mockOnLoadSave = vi.fn();
    const mockOnNewGame = vi.fn();

    render(
      <GameOverOverlay
        type="bankruptcy"
        onLoadSave={mockOnLoadSave}
        onNewGame={mockOnNewGame}
      />
    );

    expect(screen.getByText('Load Previous Save')).toBeInTheDocument();
    expect(screen.getByText('Return to Main Menu')).toBeInTheDocument();
  });
});
