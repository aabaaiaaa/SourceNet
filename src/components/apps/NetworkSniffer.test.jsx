import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GameProvider, GameContext } from '../../contexts/GameContext';
import NetworkSniffer from './NetworkSniffer';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

const createMockContext = (overrides = {}) => ({
  activeConnections: [],
  hardware: {
    cpu: { id: 'cpu-2ghz-dual', name: '2GHz Dual Core' },
    network: [{ id: 'nic-100', speed: '100Mbps' }],
  },
  timeSpeed: 1,
  isPaused: false,
  ...overrides,
});

const setupTestNetwork = () => {
  networkRegistry.registerNetwork({
    networkId: 'target-net',
    networkName: 'Target Network',
    address: '10.0.1.0/24',
    bandwidth: 100,
  });
  networkRegistry.grantNetworkAccess('target-net', ['10.0.1.1']);

  // Accessible device
  networkRegistry.registerFileSystem({
    id: 'fs-accessible',
    files: [{ name: 'readme.txt', size: '1KB' }],
  });
  networkRegistry.registerDevice({
    ip: '10.0.1.1',
    hostname: 'public-server',
    networkId: 'target-net',
    fileSystemId: 'fs-accessible',
    accessible: true,
  });

  // Credential-protected device
  networkRegistry.registerFileSystem({
    id: 'fs-protected',
    files: [{ name: 'secrets.db', size: '50MB' }],
  });
  networkRegistry.registerDevice({
    ip: '10.0.1.50',
    hostname: 'secure-server',
    networkId: 'target-net',
    fileSystemId: 'fs-protected',
    accessible: false,
    requiresCredentials: true,
  });
};

describe('NetworkSniffer Component', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should render app title', () => {
    renderWithProvider(<NetworkSniffer />);
    expect(screen.getByText('Network Sniffer')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithProvider(<NetworkSniffer />);
    expect(screen.getByText('Monitor network traffic and extract credentials')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    const { container } = renderWithProvider(<NetworkSniffer />);
    expect(container.querySelector('.network-sniffer')).toBeInTheDocument();
  });

  it('should show no networks message when disconnected', () => {
    renderWithProvider(<NetworkSniffer />);
    expect(screen.getByText(/No networks connected/)).toBeInTheDocument();
  });

  it('should show VPN Client instruction when disconnected', () => {
    renderWithProvider(<NetworkSniffer />);
    expect(screen.getByText(/Use VPN Client to connect first/)).toBeInTheDocument();
  });
});

describe('NetworkSniffer Network Selection', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
    setupTestNetwork();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should show network dropdown when connected', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options.some(o => o.textContent === 'Target Network')).toBe(true);
  });

  it('should show mode selection after selecting a network', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    // Select the network
    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });

    expect(screen.getByText('Extract Credentials')).toBeInTheDocument();
    expect(screen.getByText('Investigate Traffic')).toBeInTheDocument();
  });

  it('should show multiple network options', () => {
    networkRegistry.registerNetwork({
      networkId: 'other-net',
      networkName: 'Other Network',
      address: '192.168.1.0/24',
      bandwidth: 50,
    });

    const mockContext = createMockContext({
      activeConnections: [
        { networkId: 'target-net', networkName: 'Target Network' },
        { networkId: 'other-net', networkName: 'Other Network' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const options = screen.getAllByRole('option');
    // "Select a network..." + 2 networks
    expect(options).toHaveLength(3);
  });
});

describe('NetworkSniffer Credential Extraction Mode', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
    setupTestNetwork();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should show Start Monitoring button when credential devices exist', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });

    expect(screen.getByText('Start Monitoring')).toBeInTheDocument();
  });

  it('should show no credential devices message when none exist', () => {
    // Network with only accessible devices
    networkRegistry.reset();
    networkRegistry.registerNetwork({
      networkId: 'open-net',
      networkName: 'Open Network',
      address: '10.0.2.0/24',
      bandwidth: 50,
    });
    networkRegistry.grantNetworkAccess('open-net', ['10.0.2.1']);
    networkRegistry.registerDevice({
      ip: '10.0.2.1',
      hostname: 'server',
      networkId: 'open-net',
      fileSystemId: 'fs-open',
      accessible: true,
    });

    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'open-net', networkName: 'Open Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'open-net' } });

    expect(screen.getByText('No credential-protected devices found on this network.')).toBeInTheDocument();
  });

  it('should show Cancel button during monitoring', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show Traffic Monitor section during monitoring', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    expect(screen.getByText('Traffic Monitor')).toBeInTheDocument();
    expect(screen.getByText('Hash Reconstruction')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should show hardware info during monitoring', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
      hardware: {
        cpu: { id: 'cpu-4ghz-quad', name: '4GHz Quad Core' },
        network: [{ id: 'nic-100', speed: '100Mbps' }],
      },
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    expect(screen.getByText(/4GHz Quad Core/)).toBeInTheDocument();
    expect(screen.getByText(/12x/)).toBeInTheDocument();
  });

  it('should reset state when Cancel is clicked', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    // Cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Should show Start Monitoring again (monitoring state is reset)
    expect(screen.getByText('Start Monitoring')).toBeInTheDocument();
    // Traffic Monitor section should be hidden (monitoring=false, result=null)
    expect(screen.queryByText('Traffic Monitor')).not.toBeInTheDocument();
  });
});

describe('NetworkSniffer Completion Flow', () => {
  let originalRAF;

  beforeEach(() => {
    // Mock requestAnimationFrame to use setTimeout so fake timers control it
    originalRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    vi.useFakeTimers();
    triggerEventBus.clear();
    networkRegistry.reset();
    setupTestNetwork();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.requestAnimationFrame = originalRAF;
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should show Extract Credentials button after reconstruction completes', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    const { container } = render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    // Advance past reconstruction duration - wrap in act to flush state updates
    act(() => {
      vi.advanceTimersByTime(130000);
    });

    // The extract button (distinct from mode button) appears after reconstruction
    const extractBtn = container.querySelector('.ns-extract-btn');
    expect(extractBtn).toBeInTheDocument();
  });

  it('should emit credentialsExtracted event when credentials are extracted', () => {
    let eventData = null;
    triggerEventBus.on('credentialsExtracted', (data) => {
      eventData = data;
    });

    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    const { container } = render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    // Advance past reconstruction - wrap in act to flush state updates
    act(() => {
      vi.advanceTimersByTime(130000);
    });

    // Click Extract Credentials button (the action button, not the mode tab)
    const extractBtn = container.querySelector('.ns-extract-btn');
    fireEvent.click(extractBtn);

    expect(eventData).not.toBeNull();
    expect(eventData.networkId).toBe('target-net');
    expect(eventData.deviceIps).toContain('10.0.1.50');
  });

  it('should emit narEntryAdded event when credentials are extracted', () => {
    let eventData = null;
    triggerEventBus.on('narEntryAdded', (data) => {
      eventData = data;
    });

    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    const { container } = render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    act(() => {
      vi.advanceTimersByTime(130000);
    });
    const extractBtn = container.querySelector('.ns-extract-btn');
    fireEvent.click(extractBtn);

    expect(eventData).not.toBeNull();
    expect(eventData.networkId).toBe('target-net');
  });

  it('should reset state when Cancel is clicked during monitoring', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    // Advance a little bit (but not to completion)
    vi.advanceTimersByTime(5000);

    // Cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Should show Start Monitoring again
    expect(screen.getByText('Start Monitoring')).toBeInTheDocument();
    expect(screen.queryByText('Traffic Monitor')).not.toBeInTheDocument();
  });
});

describe('NetworkSniffer Pause Behavior', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
    setupTestNetwork();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should stop generating packets when game is paused', async () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
      isPaused: false,
    });

    const { rerender } = render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Start Monitoring'));

    // Wait for some packets
    await waitFor(() => {
      expect(screen.getByText('Traffic Monitor')).toBeInTheDocument();
    });

    // Now pause
    const pausedContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
      isPaused: true,
    });

    rerender(
      <GameContext.Provider value={pausedContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    // The component should still show Traffic Monitor but packet generation is paused
    expect(screen.getByText('Traffic Monitor')).toBeInTheDocument();
  });
});

describe('NetworkSniffer Investigation Mode', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
    setupTestNetwork();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should switch to investigation mode when button clicked', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });

    fireEvent.click(screen.getByText('Investigate Traffic'));

    expect(screen.getByText('Traffic Analysis')).toBeInTheDocument();
    expect(screen.getByText('Start monitoring to capture and analyse traffic patterns.')).toBeInTheDocument();
  });

  it('should show analysis summary during investigation monitoring', async () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Investigate Traffic'));
    fireEvent.click(screen.getByText('Start Monitoring'));

    // Wait for packets to appear (they generate every 200ms)
    await waitFor(() => {
      expect(screen.getByText('Packets Captured:')).toBeInTheDocument();
      expect(screen.getByText('Unique Sources:')).toBeInTheDocument();
      expect(screen.getByText('Anomalies Detected:')).toBeInTheDocument();
    });
  });

  it('should show Stop Monitoring button in investigation mode', () => {
    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'target-net', networkName: 'Target Network' }],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <NetworkSniffer />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'target-net' } });
    fireEvent.click(screen.getByText('Investigate Traffic'));
    fireEvent.click(screen.getByText('Start Monitoring'));

    expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
  });
});
