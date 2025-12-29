import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import NetworkScanner from './NetworkScanner';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('NetworkScanner Component', () => {
  it('should render app title', () => {
    renderWithProvider(<NetworkScanner />);
    expect(screen.getByText('Network Scanner')).toBeInTheDocument();
  });

  it('should show scan controls', () => {
    renderWithProvider(<NetworkScanner />);
    expect(screen.getByText(/Network:/)).toBeInTheDocument();
    expect(screen.getByText(/Scan Type:/)).toBeInTheDocument();
  });

  it('should have scan button', () => {
    renderWithProvider(<NetworkScanner />);
    const scanBtn = screen.getByRole('button', { name: /Start Scan/i });
    expect(scanBtn).toBeInTheDocument();
    expect(scanBtn).toBeDisabled(); // No network selected
  });
});
