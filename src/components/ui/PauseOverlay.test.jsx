import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import PauseOverlay from './PauseOverlay';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('PauseOverlay Component', () => {
  it('should render pause overlay', () => {
    renderWithProvider(<PauseOverlay />);
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
  });

  it('should show resume instruction', () => {
    renderWithProvider(<PauseOverlay />);
    expect(screen.getByText(/Click anywhere or press ESC/i)).toBeInTheDocument();
  });
});
