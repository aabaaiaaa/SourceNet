import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import Desktop from '../../components/ui/Desktop';
import {
  createCompleteSaveState,
  setSaveInLocalStorage,
} from '../helpers/testData';

// Helper component to load game state on mount
const GameLoader = ({ username }) => {
  const { loadGame, setGamePhase } = useGame();

  useEffect(() => {
    loadGame(username);
    setGamePhase('desktop');
  }, [loadGame, setGamePhase, username]);

  return null;
};

describe('Window Management Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });
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

    // Verify window moved to minimized bar (window is now hidden via CSS, not removed)
    await waitFor(() => {
      expect(container.querySelector('.minimized-window')).toBeInTheDocument();
      // Window should be hidden (display: none) but still in DOM
      const windowWrapper = container.querySelector('.desktop-content > div');
      expect(windowWrapper.style.display).toBe('none');
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

  it('should allow multiple instances of File Manager to be opened', async () => {
    // Create save state with file-manager installed
    const saveState = createCompleteSaveState({
      username: 'test_user',
      overrides: {
        software: ['mail', 'banking', 'portal', 'file-manager'],
      },
    });

    setSaveInLocalStorage('test_user', saveState);

    const { container } = render(
      <GameProvider>
        <GameLoader username="test_user" />
        <Desktop />
      </GameProvider>
    );

    await waitFor(() => expect(screen.getByText('☰')).toBeInTheDocument(), { timeout: 10000 });

    const appLauncher = screen.getByText('☰');

    // Open first File Manager instance
    fireEvent.mouseEnter(appLauncher.parentElement);
    await waitFor(() => {
      const menuButtons = screen.getAllByText('File Manager');
      const menuButton = menuButtons.find(el => el.tagName === 'BUTTON');
      expect(menuButton).toBeInTheDocument();
    });
    const menuButtons1 = screen.getAllByText('File Manager');
    const fileManagerBtn1 = menuButtons1.find(el => el.tagName === 'BUTTON');
    fireEvent.click(fileManagerBtn1);

    // Wait for first window to appear
    await waitFor(() => {
      const windows = container.querySelectorAll('.window');
      expect(windows).toHaveLength(1);
    });

    // Open second File Manager instance
    fireEvent.mouseEnter(appLauncher.parentElement);
    await waitFor(() => {
      const menuButtons = screen.getAllByText('File Manager');
      const menuButton = menuButtons.find(el => el.tagName === 'BUTTON');
      expect(menuButton).toBeInTheDocument();
    });
    const menuButtons2 = screen.getAllByText('File Manager');
    const fileManagerBtn2 = menuButtons2.find(el => el.tagName === 'BUTTON');
    fireEvent.click(fileManagerBtn2);

    // Should now have 2 File Manager windows
    await waitFor(() => {
      const windows = container.querySelectorAll('.window');
      expect(windows).toHaveLength(2);
    });

    // Both should have File Manager content
    const windowTitles = container.querySelectorAll('.window-title');
    expect(windowTitles).toHaveLength(2);
    expect(windowTitles[0].textContent).toBe('File Manager');
    expect(windowTitles[1].textContent).toBe('File Manager');

    // They should have different positions (cascaded)
    const windows = container.querySelectorAll('.window');
    expect(windows[0].style.left).not.toEqual(windows[1].style.left);
    expect(windows[0].style.top).not.toEqual(windows[1].style.top);
  });

  it('should preserve app state (dropdown selections) across minimize/restore', async () => {
    // Create save state with file-manager installed and a connected network
    const saveState = createCompleteSaveState({
      username: 'test_user',
      overrides: {
        software: ['mail', 'banking', 'portal', 'file-manager'],
        narEntries: [
          {
            networkId: 'test-network-1',
            networkName: 'Test Network',
            dateAdded: Date.now(),
            accessLevel: 'user',
            credentials: { username: 'user', password: 'pass' },
            hasAccess: true,
          },
        ],
        activeConnections: [
          {
            networkId: 'test-network-1',
            accessLevel: 'user',
            connectedAt: Date.now(),
          },
        ],
      },
    });

    setSaveInLocalStorage('test_user', saveState);

    const { container } = render(
      <GameProvider>
        <GameLoader username="test_user" />
        <Desktop />
      </GameProvider>
    );

    await waitFor(() => expect(screen.getByText('☰')).toBeInTheDocument(), { timeout: 10000 });

    // Open File Manager
    const appLauncher = screen.getByText('☰');
    fireEvent.mouseEnter(appLauncher.parentElement);
    await waitFor(() => {
      const menuButtons = screen.getAllByText('File Manager');
      const menuButton = menuButtons.find(el => el.tagName === 'BUTTON');
      expect(menuButton).toBeInTheDocument();
    });
    const menuButtons = screen.getAllByText('File Manager');
    const fileManagerBtn = menuButtons.find(el => el.tagName === 'BUTTON');
    fireEvent.click(fileManagerBtn);

    // Wait for File Manager window to appear
    await waitFor(() => {
      const windows = container.querySelectorAll('.window');
      expect(windows).toHaveLength(1);
    });

    // Find and interact with the file system dropdown
    const fileSystemDropdown = container.querySelector('.file-manager select');
    expect(fileSystemDropdown).toBeInTheDocument();

    // Select a network from the dropdown (if available) or local storage
    const options = fileSystemDropdown.querySelectorAll('option');
    const selectableOption = Array.from(options).find(opt => opt.value !== '');

    if (selectableOption) {
      fireEvent.change(fileSystemDropdown, { target: { value: selectableOption.value } });

      // Verify selection was made
      expect(fileSystemDropdown.value).toBe(selectableOption.value);
      const selectedValue = selectableOption.value;

      // Minimize the window
      const minimizeBtn = screen.getByTitle('Minimize');
      fireEvent.click(minimizeBtn);

      // Verify window is minimized (appears in minimized bar)
      await waitFor(() => {
        expect(container.querySelector('.minimized-window')).toBeInTheDocument();
      });

      // Restore the window
      const minimizedWindow = container.querySelector('.minimized-window');
      fireEvent.click(minimizedWindow);

      // Verify window is restored
      await waitFor(() => {
        const windows = container.querySelectorAll('.window');
        expect(windows).toHaveLength(1);
      });

      // Verify dropdown selection is preserved
      const restoredDropdown = container.querySelector('.file-manager select');
      expect(restoredDropdown).toBeInTheDocument();
      expect(restoredDropdown.value).toBe(selectedValue);
    }
  });
});
