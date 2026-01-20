import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameContext } from '../../contexts/GameContext';
import { GameProvider } from '../../contexts/GameContext';
import NetworkAddressRegister from './NetworkAddressRegister';
import networkRegistry from '../../systems/NetworkRegistry';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

const createMockContext = (overrides = {}) => ({
  activeConnections: [],
  setActiveConnections: vi.fn(),
  initiateVpnConnection: vi.fn(),
  ...overrides,
});

const renderWithMockContext = (component, contextOverrides = {}) => {
  const mockContext = createMockContext(contextOverrides);
  return {
    ...render(
      <GameContext.Provider value={mockContext}>
        {component}
      </GameContext.Provider>
    ),
    mockContext,
  };
};

describe('NetworkAddressRegister Component', () => {
  beforeEach(() => {
    networkRegistry.reset();
  });

  afterEach(() => {
    networkRegistry.reset();
  });

  it('should render app title', () => {
    renderWithProvider(<NetworkAddressRegister />);
    expect(screen.getByText('Network Address Register')).toBeInTheDocument();
  });

  it('should show empty state when no entries', () => {
    renderWithProvider(<NetworkAddressRegister />);
    expect(screen.getByText(/No network credentials registered/i)).toBeInTheDocument();
  });

  describe('Quick Connect functionality', () => {
    const setupMockNetwork = (accessible = true, revokedReason = null) => {
      networkRegistry.registerNetwork({
        networkId: 'net-test',
        networkName: 'Test Network',
        address: '192.168.1.1',
        bandwidth: 100,
      });
      if (accessible) {
        networkRegistry.grantNetworkAccess('net-test', []);
      } else if (revokedReason) {
        // First grant then revoke to create a revoked state
        networkRegistry.grantNetworkAccess('net-test', []);
        networkRegistry.revokeNetworkAccess('net-test', revokedReason);
      }
    };

    it('should show Connect button for disconnected networks', async () => {
      setupMockNetwork(true);
      render(
        <GameContext.Provider value={createMockContext({ activeConnections: [] })}>
          <NetworkAddressRegister />
        </GameContext.Provider>
      );

      // Wait for the useEffect to run and state to update
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
      });
    });

    it('should call initiateVpnConnection when Connect is clicked', async () => {
      setupMockNetwork(true);
      const mockContext = createMockContext({ activeConnections: [] });
      render(
        <GameContext.Provider value={mockContext}>
          <NetworkAddressRegister />
        </GameContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
      expect(mockContext.initiateVpnConnection).toHaveBeenCalledWith('net-test');
    });

    it('should show connected badge and disconnect button for connected networks', async () => {
      setupMockNetwork(true);
      const mockContext = createMockContext({
        activeConnections: [{ networkId: 'net-test', networkName: 'Test Network' }],
      });
      render(
        <GameContext.Provider value={mockContext}>
          <NetworkAddressRegister />
        </GameContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('✓ Connected')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    });

    it('should call setActiveConnections when Disconnect is clicked', async () => {
      setupMockNetwork(true);
      const mockSetActiveConnections = vi.fn();
      const mockContext = createMockContext({
        activeConnections: [{ networkId: 'net-test', networkName: 'Test Network' }],
        setActiveConnections: mockSetActiveConnections,
      });
      render(
        <GameContext.Provider value={mockContext}>
          <NetworkAddressRegister />
        </GameContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      expect(mockSetActiveConnections).toHaveBeenCalled();
    });

    it('should not show Connect button for expired networks', () => {
      // Network registered but not granted access (simulates expired)
      networkRegistry.registerNetwork({
        networkId: 'net-test',
        networkName: 'Test Network',
        address: '192.168.1.1',
        bandwidth: 100,
      });
      renderWithMockContext(<NetworkAddressRegister />, {
        activeConnections: [],
      });

      expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    });

    it('should not show Connect button for revoked networks', () => {
      setupMockNetwork(false, 'Access revoked');
      renderWithMockContext(<NetworkAddressRegister />, {
        activeConnections: [],
      });

      expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    });
  });
});
