import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameContext } from '../../contexts/GameContext';
import { GameProvider } from '../../contexts/GameContext';
import NetworkAddressRegister from './NetworkAddressRegister';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

const createMockContext = (overrides = {}) => ({
  narEntries: [],
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
  it('should render app title', () => {
    renderWithProvider(<NetworkAddressRegister />);
    expect(screen.getByText('Network Address Register')).toBeInTheDocument();
  });

  it('should show empty state when no entries', () => {
    renderWithProvider(<NetworkAddressRegister />);
    expect(screen.getByText(/No network credentials registered/i)).toBeInTheDocument();
  });

  describe('Quick Connect functionality', () => {
    const mockNarEntry = {
      id: 'nar-1',
      networkId: 'net-test',
      networkName: 'Test Network',
      address: '192.168.1.1',
      status: 'active',
      authorized: true,
    };

    it('should show Connect button for disconnected networks', () => {
      renderWithMockContext(<NetworkAddressRegister />, {
        narEntries: [mockNarEntry],
        activeConnections: [],
      });

      expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    });

    it('should call initiateVpnConnection when Connect is clicked', () => {
      const { mockContext } = renderWithMockContext(<NetworkAddressRegister />, {
        narEntries: [mockNarEntry],
        activeConnections: [],
      });

      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
      expect(mockContext.initiateVpnConnection).toHaveBeenCalledWith('net-test');
    });

    it('should show connected badge and disconnect button for connected networks', () => {
      renderWithMockContext(<NetworkAddressRegister />, {
        narEntries: [mockNarEntry],
        activeConnections: [{ networkId: 'net-test', networkName: 'Test Network' }],
      });

      expect(screen.getByText('✓ Connected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    });

    it('should call setActiveConnections when Disconnect is clicked', () => {
      const mockSetActiveConnections = vi.fn();
      renderWithMockContext(<NetworkAddressRegister />, {
        narEntries: [mockNarEntry],
        activeConnections: [{ networkId: 'net-test', networkName: 'Test Network' }],
        setActiveConnections: mockSetActiveConnections,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      expect(mockSetActiveConnections).toHaveBeenCalled();
    });

    it('should not show Connect button for expired networks', () => {
      renderWithMockContext(<NetworkAddressRegister />, {
        narEntries: [{ ...mockNarEntry, status: 'expired' }],
        activeConnections: [],
      });

      expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    });

    it('should not show Connect button for revoked networks', () => {
      renderWithMockContext(<NetworkAddressRegister />, {
        narEntries: [{ ...mockNarEntry, authorized: false }],
        activeConnections: [],
      });

      expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    });
  });
});
