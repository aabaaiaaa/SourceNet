import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import TopBar from '../../components/ui/TopBar';

// Integration test for bandwidth info popup reflecting hardware upgrades
// Helper component to access context
const TestComponent = ({ onRender }) => {
  const game = useGame();
  if (onRender) onRender(game);
  return null;
};

const renderWithProvider = (onRender) => {
  return render(
    <GameProvider>
      <TopBar />
      <TestComponent onRender={onRender} />
    </GameProvider>
  );
};

describe('Bandwidth Info Integration', () => {
  it('should update bandwidth info popup when network adapter is upgraded', async () => {
    let setHardware;
    renderWithProvider((game) => {
      setHardware = game.setHardware;
    });

    // Hover to show bandwidth preview (initial: 250Mbps)
    const indicator = document.querySelector('.topbar-bandwidth');
    fireEvent.mouseEnter(indicator);
    await waitFor(() => {
      expect(screen.getByText(/Max: 31.3 MB\/s/)).toBeInTheDocument();
      expect(screen.getByText(/Current: 31.3 MB\/s/)).toBeInTheDocument();
    });

    // Upgrade to 500Mbps
    setHardware(prev => ({
      ...prev,
      networkAdapter: {
        id: 'net-500mb',
        name: '500Mb Network Card',
        speed: 500,
        price: 200,
        power: 6,
      },
    }));
    // Hover again to update
    fireEvent.mouseEnter(indicator);
    await waitFor(() => {
      expect(screen.getByText(/Max: 62.5 MB\/s/)).toBeInTheDocument();
      expect(screen.getByText(/Current: 62.5 MB\/s/)).toBeInTheDocument();
    });
  });
});
