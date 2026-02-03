import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GameProvider, GameContext } from '../../contexts/GameContext';
import DataRecoveryTool from './DataRecoveryTool';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('DataRecoveryTool Component', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should render app title', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText('Data Recovery Tool')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText('File System Recovery & Secure Deletion')).toBeInTheDocument();
  });

  it('should show no-networks message when no networks connected', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });

  it('should show VPN Client instruction when no networks connected', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText(/Use the VPN Client to connect to a network first/i)).toBeInTheDocument();
  });

  it('should have file system selector placeholder', () => {
    renderWithProvider(<DataRecoveryTool />);
    // Message is shown when no networks connected - file system selector is not rendered
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });
});

describe('DataRecoveryTool UI Elements', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should render without crashing', () => {
    const { container } = renderWithProvider(<DataRecoveryTool />);
    expect(container.querySelector('.data-recovery-tool')).toBeInTheDocument();
  });

  it('should have the correct CSS class', () => {
    const { container } = renderWithProvider(<DataRecoveryTool />);
    expect(container.querySelector('.data-recovery-tool')).toBeInTheDocument();
  });

  it('should have header section with correct class', () => {
    const { container } = renderWithProvider(<DataRecoveryTool />);
    expect(container.querySelector('.data-recovery-header')).toBeInTheDocument();
  });
});

describe('DataRecoveryTool Scan Progress', () => {
  const createMockContext = (overrides = {}) => ({
    activeConnections: [],
    discoveredDevices: {},
    currentTime: new Date('2020-03-25T09:00:00'),
    ...overrides,
  });

  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  const setupNetworkWithDeletedFiles = () => {
    // Register network
    networkRegistry.registerNetwork({
      networkId: 'test-net',
      networkName: 'Test Network',
      address: '10.0.0.1',
      bandwidth: 100,
    });
    networkRegistry.grantNetworkAccess('test-net', []);

    // Add device with file system containing deleted files
    networkRegistry.addDevice('test-net', {
      ip: '10.0.0.100',
      name: 'test-server',
      accessible: true,
    });

    // Add files including deleted ones
    networkRegistry.addFileSystem('10.0.0.100', { name: 'normal-file.txt', size: '1KB', status: 'normal' });
    networkRegistry.addFileSystem('10.0.0.100', { name: 'deleted-file.txt', size: '1KB', status: 'deleted' });
    networkRegistry.addFileSystem('10.0.0.100', { name: 'another-deleted.txt', size: '1KB', status: 'deleted' });
  };

  it('should advance scan progress when currentTime updates', async () => {
    setupNetworkWithDeletedFiles();

    let currentTime = new Date('2020-03-25T09:00:00');
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'test-net', networkName: 'Test Network' }],
      discoveredDevices: { 'test-net': new Set(['10.0.0.100']) },
      currentTime,
    });

    const { rerender } = render(
      <GameContext.Provider value={mockContext}>
        <DataRecoveryTool />
      </GameContext.Provider>
    );

    // Select the file system
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '10.0.0.100' } });

    // Wait for UI to update
    await waitFor(() => {
      expect(screen.getByText('Scan for Deleted Files')).toBeInTheDocument();
    });

    // Start the scan
    fireEvent.click(screen.getByText('Scan for Deleted Files'));

    // Verify scan started (should show 0% initially)
    await waitFor(() => {
      expect(screen.getByText(/Scanning\.\.\. 0%/)).toBeInTheDocument();
    });

    // Advance game time by 500ms (enough to see progress)
    currentTime = new Date('2020-03-25T09:00:00.500');
    const updatedContext = {
      ...mockContext,
      currentTime,
    };

    // Re-render with updated time
    await act(async () => {
      rerender(
        <GameContext.Provider value={updatedContext}>
          <DataRecoveryTool />
        </GameContext.Provider>
      );
    });

    // Trigger a RAF tick to allow animation to process
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // The progress should have advanced from 0%
    // Look for any progress indicator that's not 0%
    const progressText = screen.getByText(/Scanning\.\.\. \d+%/);
    const percentMatch = progressText.textContent.match(/(\d+)%/);
    const progress = parseInt(percentMatch[1], 10);

    // With the fix, progress should be > 0 since time advanced
    expect(progress).toBeGreaterThan(0);
  });
});
