import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import Desktop from '../../components/ui/Desktop';

describe('Window Management Integration', () => {
  it('should handle complete window lifecycle: open → minimize → restore → close', async () => {
    const { container } = render(
      <GameProvider>
        <Desktop />
      </GameProvider>
    );

    // Open Mail app via app launcher
    const appLauncher = screen.getByText('☰');
    fireEvent.mouseEnter(appLauncher.parentElement);

    await waitFor(() => {
      expect(screen.getByText('SNet Mail')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('SNet Mail'));

    // Verify window opened
    await waitFor(() => {
      const mailWindow = container.querySelector('.window');
      expect(mailWindow).toBeInTheDocument();
    });

    // Minimize window
    const minimizeBtn = screen.getByTitle('Minimize');
    fireEvent.click(minimizeBtn);

    // Verify window moved to minimized bar
    await waitFor(() => {
      expect(screen.getByText('SNet Mail')).toBeInTheDocument();
      expect(container.querySelector('.minimized-window')).toBeInTheDocument();
    });

    // Restore window
    const minimizedWindow = container.querySelector('.minimized-window');
    fireEvent.click(minimizedWindow);

    // Verify window restored
    await waitFor(() => {
      expect(container.querySelector('.window')).toBeInTheDocument();
    });

    // Close window
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);

    // Verify window closed
    await waitFor(() => {
      expect(container.querySelector('.window')).not.toBeInTheDocument();
    });
  });

  it('should cascade multiple windows correctly', async () => {
    const { container } = render(
      <GameProvider>
        <Desktop />
      </GameProvider>
    );

    // Open 3 apps
    const appLauncher = screen.getByText('☰');

    // Open Mail
    fireEvent.mouseEnter(appLauncher.parentElement);
    await waitFor(() => expect(screen.getByText('SNet Mail')).toBeInTheDocument());
    fireEvent.click(screen.getByText('SNet Mail'));

    // Open Banking
    fireEvent.mouseEnter(appLauncher.parentElement);
    await waitFor(() => expect(screen.getByText('SNet Banking App')).toBeInTheDocument());
    fireEvent.click(screen.getByText('SNet Banking App'));

    // Open Portal
    fireEvent.mouseEnter(appLauncher.parentElement);
    await waitFor(() => expect(screen.getByText('OSNet Portal')).toBeInTheDocument());
    fireEvent.click(screen.getByText('OSNet Portal'));

    // Verify 3 windows exist
    await waitFor(() => {
      const windows = container.querySelectorAll('.window');
      expect(windows).toHaveLength(3);
    });

    // Verify windows have different positions (cascaded)
    const windows = container.querySelectorAll('.window');
    const positions = Array.from(windows).map((w) => ({
      left: w.style.left,
      top: w.style.top,
    }));

    // Each window should have different position
    expect(positions[0]).not.toEqual(positions[1]);
    expect(positions[1]).not.toEqual(positions[2]);
  });
});
