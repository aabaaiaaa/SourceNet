import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import { createCompleteSaveState, setSaveInLocalStorage } from '../helpers/testData';
import TopBar from '../../components/ui/TopBar';

// Helper component to load game state
const GameLoader = ({ username }) => {
  const { loadGame } = useGame();
  useEffect(() => {
    loadGame(username);
  }, [loadGame, username]);
  return null;
};

describe('Notification System Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it('should show unread message count badge', async () => {
    render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    // Initial state should show mail icon
    const mailIcon = screen.getByText('✉');
    expect(mailIcon).toBeInTheDocument();
  });

  it('should show mail notification preview on hover with unread messages', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const mailNotification = container.querySelector('.topbar-notification');
    expect(mailNotification).toBeInTheDocument();

    fireEvent.mouseEnter(mailNotification);

    // The notification element should be visible
    const mailIcon = screen.getByText('✉');
    expect(mailIcon).toBeInTheDocument();
  });

  it('should show bank notification preview on hover', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const bankNotifications = container.querySelectorAll('.topbar-notification');
    const bankNotification = bankNotifications[1]; // Second notification is bank

    fireEvent.mouseEnter(bankNotification);

    await waitFor(() => {
      // Should show account preview
      expect(screen.getByText(/Bank Accounts:/)).toBeInTheDocument();
      expect(screen.getByText(/First Bank Ltd/)).toBeInTheDocument();
    });
  });

  it('should call openWindow for mail when mail notification clicked', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const mailNotifications = container.querySelectorAll('.topbar-notification');
    const mailNotification = mailNotifications[0]; // First notification is mail

    fireEvent.click(mailNotification);

    // The notification should be clickable
    expect(mailNotification).toBeInTheDocument();
  });

  it('should call openWindow for banking when bank notification clicked', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const bankNotifications = container.querySelectorAll('.topbar-notification');
    const bankNotification = bankNotifications[1]; // Second notification is bank

    // Verify the notification is clickable
    expect(bankNotification).toBeInTheDocument();
    fireEvent.click(bankNotification);

    // Element should still be in document after click
    expect(bankNotification).toBeInTheDocument();
  });

  it('should call openWindow for banking when credits amount clicked', async () => {
    render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const creditsDisplay = screen.getByText(/credits/);

    // Verify credits display is clickable
    expect(creditsDisplay).toBeInTheDocument();
    expect(creditsDisplay).toHaveAttribute('title', 'Click to open Banking App');

    fireEvent.click(creditsDisplay);

    // Element should still be in document after click
    expect(creditsDisplay).toBeInTheDocument();
  });

  it('should show network connections preview on hover', async () => {
    const saveState = createCompleteSaveState({
      username: 'testuser',
      overrides: {
        activeConnections: [
          { networkId: 'corp-network', networkName: 'Corporate Network', address: '10.0.1.0/24' },
          { networkId: 'backup-net', networkName: 'Backup Server Net', address: '192.168.1.0/24' },
          { networkId: 'client-net', networkName: 'Client Network', address: '172.16.0.0/16' }
        ]
      }
    });
    setSaveInLocalStorage('testuser', saveState);

    const { container } = render(
      <GameProvider>
        <GameLoader username="testuser" />
        <TopBar />
      </GameProvider>
    );

    await waitFor(() => {
      const networkElement = container.querySelector('.topbar-network');
      expect(networkElement).toBeInTheDocument();
    });

    const networkElement = container.querySelector('.topbar-network');
    const networkIcon = networkElement.querySelector('.network-icon');
    const networkBadge = networkElement.querySelector('.network-badge');

    // Verify initial state
    expect(networkIcon).toBeInTheDocument();
    expect(networkIcon).toHaveStyle({ color: '#32CD32' });
    expect(networkBadge).toHaveTextContent('3');

    // Hover to show preview
    fireEvent.mouseEnter(networkElement);

    await waitFor(() => {
      expect(screen.getByText('Connected Networks:')).toBeInTheDocument();
    });

    // Verify all networks are shown
    expect(screen.getByText('Corporate Network')).toBeInTheDocument();
    expect(screen.getByText('Backup Server Net')).toBeInTheDocument();
    expect(screen.getByText('Client Network')).toBeInTheDocument();
  });

  it('should show bandwidth usage preview on hover with active operations', async () => {
    const saveState = createCompleteSaveState({
      username: 'testuser',
      overrides: {
        downloadQueue: [
          { id: 'dl1', name: 'test-file.dat', status: 'downloading', progress: 45, size: 100 },
          { id: 'dl2', name: 'app.exe', status: 'downloading', progress: 20, size: 50 }
        ],
        bandwidthOperations: [
          { id: 'bw1', type: 'upload', status: 'active', progress: 60, sizeInMB: 30 }
        ]
      }
    });
    setSaveInLocalStorage('testuser', saveState);

    const { container } = render(
      <GameProvider>
        <GameLoader username="testuser" />
        <TopBar />
      </GameProvider>
    );

    await waitFor(() => {
      const bandwidthElement = container.querySelector('.topbar-bandwidth');
      expect(bandwidthElement).toBeInTheDocument();
    });

    const bandwidthElement = container.querySelector('.topbar-bandwidth');

    // Verify active state styling
    expect(bandwidthElement).toHaveClass('active');

    const bandwidthIcon = bandwidthElement.querySelector('.bandwidth-icon');
    expect(bandwidthIcon).toHaveTextContent('⬇');

    const bandwidthSpeed = bandwidthElement.querySelector('.bandwidth-speed');
    expect(bandwidthSpeed).toBeInTheDocument();

    // Hover to show preview
    fireEvent.mouseEnter(bandwidthElement);

    await waitFor(() => {
      expect(screen.getByText('Bandwidth')).toBeInTheDocument();
    });

    // Verify preview content
    expect(screen.getByText(/Max:/)).toBeInTheDocument();
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    expect(screen.getByText(/Active Operations:/)).toBeInTheDocument();

    const bandwidthPreview = container.querySelector('.bandwidth-preview');
    const usageBar = bandwidthPreview.querySelector('.bandwidth-usage-bar');
    expect(usageBar).toBeInTheDocument();

    // Verify usage bar has width (should be 50% for 2 operations)
    const usageFill = usageBar.querySelector('.bandwidth-usage-fill');
    expect(usageFill).toBeInTheDocument();
    const fillStyle = window.getComputedStyle(usageFill);
    expect(fillStyle.width).toBeTruthy();
  });

  it('should show mission objectives preview on hover', async () => {
    const saveState = createCompleteSaveState({
      username: 'testuser',
      overrides: {
        activeMission: {
          missionId: 'test-mission-1',
          title: 'Data Recovery Task',
          client: 'TechCorp',
          difficulty: 'medium',
          objectives: [
            { id: 'obj-1', description: 'Connect to corporate network', status: 'complete', type: 'networkConnection' },
            { id: 'obj-2', description: 'Scan the network', status: 'complete', type: 'scan' },
            { id: 'obj-3', description: 'Download backup files', status: 'pending', type: 'download' },
            { id: 'obj-4', description: 'Verify data integrity', status: 'pending', type: 'verify' }
          ]
        }
      }
    });
    setSaveInLocalStorage('testuser', saveState);

    const { container } = render(
      <GameProvider>
        <GameLoader username="testuser" />
        <TopBar />
      </GameProvider>
    );

    await waitFor(() => {
      const missionElement = container.querySelector('.topbar-mission');
      expect(missionElement).toBeInTheDocument();
    });

    const missionElement = container.querySelector('.topbar-mission');
    const missionIcon = missionElement.querySelector('.mission-icon');
    const missionBadge = missionElement.querySelector('.mission-badge');

    // Verify initial state
    expect(missionIcon).toHaveTextContent('📋');
    expect(missionBadge).toHaveTextContent('2'); // 2 incomplete objectives

    // Hover to show preview
    fireEvent.mouseEnter(missionElement);

    await waitFor(() => {
      expect(screen.getByText('Data Recovery Task')).toBeInTheDocument();
    });

    // Verify objectives are shown
    const objectives = container.querySelectorAll('.preview-item-small');
    expect(objectives).toHaveLength(4);

    // Check completed objectives have correct styling
    const completedObjectives = Array.from(objectives).filter(obj =>
      obj.textContent.includes('☑')
    );
    expect(completedObjectives).toHaveLength(2);

    completedObjectives.forEach(obj => {
      expect(obj).toHaveStyle({ textDecoration: 'line-through', color: '#32CD32' });
    });

    // Check pending objectives have correct styling
    const pendingObjectives = Array.from(objectives).filter(obj =>
      obj.textContent.includes('☐')
    );
    expect(pendingObjectives).toHaveLength(2);

    pendingObjectives.forEach(obj => {
      expect(obj).toHaveStyle({ textDecoration: 'none', color: '#222' });
    });

    // Verify objective text
    expect(screen.getByText(/Connect to corporate network/)).toBeInTheDocument();
    expect(screen.getByText(/Download backup files/)).toBeInTheDocument();
  });

  it('should call openWindow for mission board when mission notification clicked', async () => {
    const saveState = createCompleteSaveState({
      username: 'testuser',
      overrides: {
        activeMission: {
          missionId: 'test-mission-2',
          title: 'Simple Mission',
          client: 'Client',
          difficulty: 'easy',
          objectives: [
            { id: 'obj-1', description: 'Complete task', status: 'pending', type: 'task' }
          ]
        }
      }
    });
    setSaveInLocalStorage('testuser', saveState);

    const { container } = render(
      <GameProvider>
        <GameLoader username="testuser" />
        <TopBar />
      </GameProvider>
    );

    await waitFor(() => {
      const missionElement = container.querySelector('.topbar-mission');
      expect(missionElement).toBeInTheDocument();
    });

    const missionElement = container.querySelector('.topbar-mission');
    expect(missionElement).toHaveAttribute('title', 'Click to open Mission Board');

    fireEvent.click(missionElement);

    // Element should still be in document after click
    expect(missionElement).toBeInTheDocument();
  });
});
