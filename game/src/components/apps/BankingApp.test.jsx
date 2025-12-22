import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import BankingApp from './BankingApp';

describe('BankingApp Component', () => {
  it('should render app title', () => {
    render(
      <GameProvider>
        <BankingApp />
      </GameProvider>
    );
    expect(screen.getByText('SNet Banking App')).toBeInTheDocument();
  });

  it('should display starting account', () => {
    render(
      <GameProvider>
        <BankingApp />
      </GameProvider>
    );
    expect(screen.getByText('First Bank Ltd')).toBeInTheDocument();
  });

  it('should show Your Accounts section', () => {
    render(
      <GameProvider>
        <BankingApp />
      </GameProvider>
    );
    expect(screen.getByText('Your Accounts')).toBeInTheDocument();
  });

  it('should display account balance', () => {
    render(
      <GameProvider>
        <BankingApp />
      </GameProvider>
    );
    const balances = screen.getAllByText(/0 credits/);
    expect(balances.length).toBeGreaterThan(0);
  });
});
