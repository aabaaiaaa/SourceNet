import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GameContext } from '../../contexts/GameContext';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import PasswordCracker from './PasswordCracker';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';

const createMockContext = (overrides = {}) => ({
  activeConnections: [],
  discoveredDevices: {},
  hardware: { cpu: { id: 'cpu-2ghz-dual', name: '2GHz Dual Core' } },
  software: [],
  timeSpeed: 1,
  currentTime: new Date('2020-03-25T09:00:00'),
  localSSDFiles: [],
  replaceFileOnLocalSSD: () => {},
  ...overrides,
});

describe('PasswordCracker Component', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should render app title', () => {
    renderWithGame(<PasswordCracker />);
    expect(screen.getByText('Password Cracker')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithGame(<PasswordCracker />);
    expect(screen.getByText('Crack password-protected files')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    const { container } = renderWithGame(<PasswordCracker />);
    expect(container.querySelector('.password-cracker')).toBeInTheDocument();
  });

  it('should show file source section', () => {
    renderWithGame(<PasswordCracker />);
    expect(screen.getByText('File Source')).toBeInTheDocument();
  });

  it('should show empty message when no sources have protected files', () => {
    renderWithGame(<PasswordCracker />);
    expect(screen.getByText('No sources with password-protected files available.')).toBeInTheDocument();
  });

  it('should show no files message when no protected files exist', () => {
    renderWithGame(<PasswordCracker />);
    expect(screen.getByText('No password-protected files found in this source.')).toBeInTheDocument();
  });
});

describe('PasswordCracker with Local Files', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should display password-protected files from local SSD', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
        { name: 'normal.txt', size: '1KB' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    expect(screen.getByText('secret.zip')).toBeInTheDocument();
    expect(screen.queryByText('normal.txt')).not.toBeInTheDocument();
  });

  it('should show Local SSD in dropdown when local protected files exist', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByText('Local SSD')).toBeInTheDocument();
  });

  it('should show hash type for password-protected files', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    expect(screen.getByText('MD5')).toBeInTheDocument();
  });

  it('should show attack methods when a file is selected', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    // Click the file to select it
    fireEvent.click(screen.getByText('secret.zip'));

    expect(screen.getByText('Attack Method')).toBeInTheDocument();
    expect(screen.getByText('Dictionary')).toBeInTheDocument();
    expect(screen.getByText('Brute Force')).toBeInTheDocument();
    expect(screen.getByText('Rainbow Table')).toBeInTheDocument();
  });

  it('should show Start Crack button when file and method selected', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));

    // Brute force is always available
    fireEvent.click(screen.getByText('Brute Force'));

    expect(screen.getByText('Start Crack')).toBeInTheDocument();
  });
});

describe('PasswordCracker Attack Method Availability', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should disable dictionary attack without dictionary packs installed', () => {
    const mockContext = createMockContext({
      software: [],
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));

    const dictionaryBtn = screen.getByText('Dictionary').closest('button');
    expect(dictionaryBtn).toBeDisabled();
  });

  it('should enable dictionary attack with common dictionary pack for MD5', () => {
    const mockContext = createMockContext({
      software: ['dictionary-pack-common'],
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));

    const dictionaryBtn = screen.getByText('Dictionary').closest('button');
    expect(dictionaryBtn).not.toBeDisabled();
  });

  it('should disable dictionary attack for non-weak hash types (SHA-256)', () => {
    const mockContext = createMockContext({
      software: ['dictionary-pack-common'],
      localSSDFiles: [
        { name: 'locked.db', size: '10MB', passwordProtected: true, hashType: 'sha256' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('locked.db'));

    const dictionaryBtn = screen.getByText('Dictionary').closest('button');
    expect(dictionaryBtn).toBeDisabled();
  });

  it('should always enable brute force attack', () => {
    const mockContext = createMockContext({
      software: [],
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'bcrypt' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));

    const bruteForceBtn = screen.getByText('Brute Force').closest('button');
    expect(bruteForceBtn).not.toBeDisabled();
  });

  it('should disable rainbow table attack without rainbow tables', () => {
    const mockContext = createMockContext({
      software: [],
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));

    const rainbowBtn = screen.getByText('Rainbow Table').closest('button');
    expect(rainbowBtn).toBeDisabled();
  });

  it('should enable rainbow table for MD5 when MD5 rainbow table installed', () => {
    const mockContext = createMockContext({
      software: ['rainbow-table-md5'],
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));

    const rainbowBtn = screen.getByText('Rainbow Table').closest('button');
    expect(rainbowBtn).not.toBeDisabled();
  });

  it('should disable rainbow table for bcrypt (brute force only)', () => {
    const mockContext = createMockContext({
      software: ['rainbow-table-md5', 'rainbow-table-sha256'],
      localSSDFiles: [
        { name: 'locked.db', size: '10MB', passwordProtected: true, hashType: 'bcrypt' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('locked.db'));

    const rainbowBtn = screen.getByText('Rainbow Table').closest('button');
    expect(rainbowBtn).toBeDisabled();
  });
});

describe('PasswordCracker with Remote Files', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should show discovered file systems with protected files as sources', () => {
    // Set up network in registry
    networkRegistry.registerNetwork({
      networkId: 'client-net',
      networkName: 'Client Network',
      address: '192.168.1.1',
      bandwidth: 100,
    });
    networkRegistry.grantNetworkAccess('client-net', ['192.168.1.10']);
    networkRegistry.registerFileSystem({
      id: 'fs-files',
      files: [
        { name: 'protected.zip', size: '10MB', passwordProtected: true, hashType: 'sha1' },
        { name: 'public.doc', size: '2MB' },
      ],
    });
    networkRegistry.registerDevice({
      ip: '192.168.1.10',
      hostname: 'file-server',
      networkId: 'client-net',
      fileSystemId: 'fs-files',
      accessible: true,
    });

    const mockContext = createMockContext({
      activeConnections: [
        { networkId: 'client-net', networkName: 'Client Network' },
      ],
      discoveredDevices: {
        'client-net': new Set(['192.168.1.10']),
      },
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();

    // Should show the file system as an option
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('file-server (192.168.1.10)');
  });

  it('should display password-protected files from remote file system', () => {
    // Set up network in registry
    networkRegistry.registerNetwork({
      networkId: 'client-net',
      networkName: 'Client Network',
      address: '192.168.1.1',
      bandwidth: 100,
    });
    networkRegistry.grantNetworkAccess('client-net', ['192.168.1.10']);
    networkRegistry.registerFileSystem({
      id: 'fs-files',
      files: [
        { name: 'protected.zip', size: '10MB', passwordProtected: true, hashType: 'sha1' },
        { name: 'public.doc', size: '2MB' },
      ],
    });
    networkRegistry.registerDevice({
      ip: '192.168.1.10',
      hostname: 'file-server',
      networkId: 'client-net',
      fileSystemId: 'fs-files',
      accessible: true,
    });

    const mockContext = createMockContext({
      activeConnections: [
        { networkId: 'client-net', networkName: 'Client Network' },
      ],
      discoveredDevices: {
        'client-net': new Set(['192.168.1.10']),
      },
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    // Switch to remote source
    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'fs-files' } });

    expect(screen.getByText('protected.zip')).toBeInTheDocument();
    expect(screen.getByText('SHA-1')).toBeInTheDocument();
    expect(screen.queryByText('public.doc')).not.toBeInTheDocument();
  });

  it('should not show file systems without password-protected files', () => {
    networkRegistry.registerNetwork({
      networkId: 'client-net',
      networkName: 'Client Network',
      address: '192.168.1.1',
      bandwidth: 100,
    });
    networkRegistry.grantNetworkAccess('client-net', ['192.168.1.10']);
    networkRegistry.registerFileSystem({
      id: 'fs-no-protected',
      files: [
        { name: 'public.doc', size: '2MB' },
      ],
    });
    networkRegistry.registerDevice({
      ip: '192.168.1.10',
      hostname: 'file-server',
      networkId: 'client-net',
      fileSystemId: 'fs-no-protected',
      accessible: true,
    });

    const mockContext = createMockContext({
      activeConnections: [
        { networkId: 'client-net', networkName: 'Client Network' },
      ],
      discoveredDevices: {
        'client-net': new Set(['192.168.1.10']),
      },
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    // No dropdown should appear (no sources with protected files)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('No sources with password-protected files available.')).toBeInTheDocument();
  });

  it('should not show undiscovered file systems', () => {
    networkRegistry.registerNetwork({
      networkId: 'client-net',
      networkName: 'Client Network',
      address: '192.168.1.1',
      bandwidth: 100,
    });
    networkRegistry.grantNetworkAccess('client-net', ['192.168.1.10']);
    networkRegistry.registerFileSystem({
      id: 'fs-hidden',
      files: [
        { name: 'protected.zip', size: '10MB', passwordProtected: true, hashType: 'md5' },
      ],
    });
    networkRegistry.registerDevice({
      ip: '192.168.1.10',
      hostname: 'file-server',
      networkId: 'client-net',
      fileSystemId: 'fs-hidden',
      accessible: true,
    });

    const mockContext = createMockContext({
      activeConnections: [
        { networkId: 'client-net', networkName: 'Client Network' },
      ],
      // No discovered devices — file system should not appear
      discoveredDevices: {},
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    // No dropdown (nothing discovered)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('PasswordCracker CPU Info', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should show CPU speed multiplier during crack', () => {
    const mockContext = createMockContext({
      hardware: { cpu: { id: 'cpu-4ghz-quad', name: '4GHz Quad Core' } },
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));
    fireEvent.click(screen.getByText('Brute Force'));
    fireEvent.click(screen.getByText('Start Crack'));

    expect(screen.getByText(/4GHz Quad Core/)).toBeInTheDocument();
    expect(screen.getByText(/12x speed/)).toBeInTheDocument();
  });
});

describe('PasswordCracker Crack Execution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  it('should enter cracking state when Start Crack is clicked', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));
    fireEvent.click(screen.getByText('Brute Force'));
    fireEvent.click(screen.getByText('Start Crack'));

    // During cracking, should show Cancel button and status
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText(/Cracking secret.zip/)).toBeInTheDocument();
  });

  it('should emit passwordCracked event when crack completes', () => {
    let eventData = null;
    triggerEventBus.on('passwordCracked', (data) => {
      eventData = data;
    });

    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));
    fireEvent.click(screen.getByText('Brute Force'));
    fireEvent.click(screen.getByText('Start Crack'));

    // Advance past the maximum possible crack time
    // md5 base=5000, bruteforce x2, /1 (cpu-2ghz-dual=3) => ~3333ms, min 2000
    vi.advanceTimersByTime(150000);

    expect(eventData).not.toBeNull();
    expect(eventData.fileName).toBe('secret.zip');
    expect(eventData.hashType).toBe('md5');
    expect(eventData.method).toBe('bruteforce');
    expect(eventData.source).toBe('local');
  });

  it('should show success message after crack completes', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));
    fireEvent.click(screen.getByText('Brute Force'));
    fireEvent.click(screen.getByText('Start Crack'));

    // Complete the crack (runOnlyPendingTimers fires crack but not the auto-clear)
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText(/Password cracked!/)).toBeInTheDocument();
  });

  it('should reset state when Cancel is clicked during crack', () => {
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));
    fireEvent.click(screen.getByText('Brute Force'));
    fireEvent.click(screen.getByText('Start Crack'));

    // Cancel immediately
    fireEvent.click(screen.getByText('Cancel'));

    // After cancel: cracking=false, result=null → shows Start Crack (since file still selected)
    expect(screen.getByText('Start Crack')).toBeInTheDocument();
    // The progress/status section is hidden (cracking=false, result=null), so no status text visible
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should call replaceFileOnLocalSSD on successful local crack', () => {
    const mockReplace = vi.fn();
    const mockContext = createMockContext({
      localSSDFiles: [
        { name: 'secret.zip', size: '5MB', passwordProtected: true, hashType: 'md5' },
      ],
      replaceFileOnLocalSSD: mockReplace,
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    fireEvent.click(screen.getByText('secret.zip'));
    fireEvent.click(screen.getByText('Brute Force'));
    fireEvent.click(screen.getByText('Start Crack'));

    vi.advanceTimersByTime(150000);

    expect(mockReplace).toHaveBeenCalledWith(
      'secret.zip',
      expect.objectContaining({ name: 'secret.zip', passwordProtected: false })
    );
  });

  it('should update remote file system on successful remote crack', () => {
    // Set up remote file system
    networkRegistry.registerNetwork({
      networkId: 'client-net',
      networkName: 'Client Network',
      address: '192.168.1.1',
      bandwidth: 100,
    });
    networkRegistry.grantNetworkAccess('client-net', ['192.168.1.10']);
    networkRegistry.registerFileSystem({
      id: 'fs-remote',
      files: [
        { name: 'locked.db', size: '10MB', passwordProtected: true, hashType: 'md5' },
      ],
    });
    networkRegistry.registerDevice({
      ip: '192.168.1.10',
      hostname: 'server',
      networkId: 'client-net',
      fileSystemId: 'fs-remote',
      accessible: true,
    });

    const mockContext = createMockContext({
      activeConnections: [{ networkId: 'client-net', networkName: 'Client Network' }],
      discoveredDevices: { 'client-net': new Set(['192.168.1.10']) },
    });

    render(
      <GameContext.Provider value={mockContext}>
        <PasswordCracker />
      </GameContext.Provider>
    );

    // Select remote source
    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'fs-remote' } });

    fireEvent.click(screen.getByText('locked.db'));
    fireEvent.click(screen.getByText('Brute Force'));
    fireEvent.click(screen.getByText('Start Crack'));

    vi.advanceTimersByTime(150000);

    // Verify file was updated in registry
    const fsData = networkRegistry.getFileSystem('fs-remote');
    const unlockedFile = fsData.files.find(f => f.name === 'locked.db');
    expect(unlockedFile.passwordProtected).toBe(false);
  });
});
