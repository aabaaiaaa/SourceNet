import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import NetworkAddressRegister from './NetworkAddressRegister';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('NetworkAddressRegister Component', () => {
  it('should render app title', () => {
    renderWithProvider(<NetworkAddressRegister />);
    expect(screen.getByText('Network Address Register')).toBeInTheDocument();
  });

  it('should show empty state when no entries', () => {
    renderWithProvider(<NetworkAddressRegister />);
    expect(screen.getByText(/No network credentials registered/i)).toBeInTheDocument();
  });
});
