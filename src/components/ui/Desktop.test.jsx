import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import Desktop from './Desktop';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('Desktop Component', () => {
  it('should render desktop', () => {
    renderWithProvider(<Desktop />);
    expect(screen.getByRole('button', { name: /⏻/ })).toBeInTheDocument();
  });

  it('should render TopBar', () => {
    renderWithProvider(<Desktop />);
    // TopBar elements should be visible
    expect(screen.getByText(/credits/i)).toBeInTheDocument();
  });

  it('should render MinimizedWindowBar area', () => {
    renderWithProvider(<Desktop />);
    // Component should render without errors
    const desktop = document.querySelector('.desktop');
    expect(desktop).toBeInTheDocument();
  });
});
