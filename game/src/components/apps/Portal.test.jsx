import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import Portal from './Portal';

describe('Portal Component', () => {
  it('should render portal title', () => {
    render(
      <GameProvider>
        <Portal />
      </GameProvider>
    );
    expect(screen.getByText('OSNet Software/Hardware Portal')).toBeInTheDocument();
  });

  it('should have Hardware and Software sections', () => {
    render(
      <GameProvider>
        <Portal />
      </GameProvider>
    );
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('should display hardware items with prices', () => {
    render(
      <GameProvider>
        <Portal />
      </GameProvider>
    );

    // Should show starting CPU as installed
    expect(screen.getByText('1GHz Single Core')).toBeInTheDocument();
    expect(screen.getByText('✓ Installed')).toBeInTheDocument();

    // Should show other CPUs with prices
    expect(screen.getByText('2GHz Dual Core')).toBeInTheDocument();
    expect(screen.getByText('$800')).toBeInTheDocument();
  });

  it('should switch between hardware categories', () => {
    render(
      <GameProvider>
        <Portal />
      </GameProvider>
    );

    // Switch to Memory category
    fireEvent.click(screen.getByText('Memory'));
    expect(screen.getByText('2GB RAM')).toBeInTheDocument();
    expect(screen.getByText('4GB RAM')).toBeInTheDocument();

    // Switch to Storage category
    fireEvent.click(screen.getByText('Storage'));
    expect(screen.getByText('90GB SSD')).toBeInTheDocument();
    expect(screen.getByText('250GB SSD')).toBeInTheDocument();
  });

  it('should show software section with available apps', () => {
    render(
      <GameProvider>
        <Portal />
      </GameProvider>
    );

    fireEvent.click(screen.getByText('Software'));
    expect(screen.getByText('SourceNet VPN Client')).toBeInTheDocument();
    expect(screen.getByText('SourceNet Mission Board')).toBeInTheDocument();
    // Software is now available for purchase (multiple purchase buttons exist)
    const purchaseButtons = screen.getAllByRole('button', { name: /Purchase/i });
    expect(purchaseButtons.length).toBeGreaterThan(0);
  });
});
