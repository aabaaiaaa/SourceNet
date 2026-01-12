import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import VPNClient from './VPNClient';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('VPNClient Component', () => {
  it('should render app title', () => {
    renderWithProvider(<VPNClient />);
    expect(screen.getByText('SourceNet VPN Client')).toBeInTheDocument();
  });

  it('should show empty state when no connections', () => {
    renderWithProvider(<VPNClient />);
    expect(screen.getByText('No active connections')).toBeInTheDocument();
  });

  it('should show network selection dropdown', () => {
    renderWithProvider(<VPNClient />);
    expect(screen.getByText('New Connection')).toBeInTheDocument();
  });

  it('should show message when no network credentials available', () => {
    renderWithProvider(<VPNClient />);
    expect(screen.getByText(/No network credentials available/i)).toBeInTheDocument();
  });
});
