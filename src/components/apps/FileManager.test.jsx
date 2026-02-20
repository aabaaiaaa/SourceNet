import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FileManager from './FileManager';
import * as useGameModule from '../../contexts/useGame';
import networkRegistry from '../../systems/NetworkRegistry';

/**
 * Create a mock game state for FileManager tests.
 * Provides sensible defaults; pass overrides for test-specific values.
 */
function createMockGameState(overrides = {}) {
  return {
    activeConnections: [],
    discoveredDevices: {},
    fileClipboard: { files: [], sourceFileSystemId: '', sourceNetworkId: '' },
    setFileClipboard: vi.fn(),
    setFileManagerConnections: vi.fn(),
    setLastFileOperation: vi.fn(),
    registerBandwidthOperation: vi.fn(() => ({ operationId: 'test-op', estimatedTimeMs: 2000 })),
    completeBandwidthOperation: vi.fn(),
    ...overrides,
  };
}

/**
 * Set up a standard test network with one or more devices in the registry.
 */
function setupTestNetwork({ devices = [{ ip: '192.168.50.10', name: 'fileserver-01' }] } = {}) {
  networkRegistry.addNetwork('test-network', 'Test Network');
  for (const device of devices) {
    networkRegistry.addDevice('test-network', { ...device, accessible: true });
  }
}

describe('FileManager Component - Initial Rendering', () => {
  beforeEach(() => {
    vi.spyOn(useGameModule, 'useGame').mockReturnValue(createMockGameState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render app title', () => {
    render(<FileManager />);
    expect(screen.getByText('File Manager')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    render(<FileManager />);
    expect(screen.getByText('Remote File System Access')).toBeInTheDocument();
  });

  it('should show Local SSD in file system selector when no VPN connection', () => {
    render(<FileManager />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/Local SSD/i)).toBeInTheDocument();
  });

  it('should show file system selector with Local SSD when no VPN connected', () => {
    render(<FileManager />);
    expect(screen.getByText('Select File System')).toBeInTheDocument();
  });
});

describe('FileManager Component - Connected State', () => {
  beforeEach(() => {
    setupTestNetwork({
      devices: [
        { ip: '192.168.50.10', name: 'fileserver-01' },
        { ip: '192.168.50.20', name: 'backup-server' },
      ],
    });

    vi.spyOn(useGameModule, 'useGame').mockReturnValue(createMockGameState({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      discoveredDevices: {
        'test-network': new Set(['192.168.50.10', '192.168.50.20'])
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show file system selector when connected to network', () => {
    render(<FileManager />);
    expect(screen.getByText('Select File System')).toBeInTheDocument();
  });

  it('should not show empty state when connected', () => {
    render(<FileManager />);
    expect(screen.queryByText(/Not connected to any networks/i)).not.toBeInTheDocument();
  });

  it('should render file system options in selector', () => {
    render(<FileManager />);
    const select = screen.getByRole('combobox');
    expect(within(select).getByText('192.168.50.10 - fileserver-01')).toBeInTheDocument();
    expect(within(select).getByText('192.168.50.20 - backup-server')).toBeInTheDocument();
  });

  it('should not show file list before selecting a file system', () => {
    render(<FileManager />);
    expect(screen.queryByText('log_2024_01.txt')).not.toBeInTheDocument();
  });

  it('should show toolbar buttons when file system is selected', () => {
    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /repair/i })).toBeInTheDocument();
  });
});

describe('FileManager Component - Button States', () => {
  beforeEach(() => {
    setupTestNetwork();

    vi.spyOn(useGameModule, 'useGame').mockReturnValue(createMockGameState({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      discoveredDevices: {
        'test-network': new Set(['192.168.50.10'])
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have paste button disabled when clipboard is empty', () => {
    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    const pasteButton = screen.getByRole('button', { name: /paste/i });
    expect(pasteButton).toBeDisabled();
  });

  it('should have copy button enabled initially', () => {
    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    const copyButton = screen.getByRole('button', { name: /copy \(0\)/i });
    expect(copyButton).toBeDisabled(); // Disabled when no files selected
  });

  it('should have delete button enabled initially', () => {
    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    const deleteButton = screen.getByRole('button', { name: /delete \(0\)/i });
    expect(deleteButton).toBeDisabled(); // Disabled when no files selected
  });

  it('should clear clipboard after paste', () => {
    const mockSetFileClipboard = vi.fn();

    // Set up file in NetworkRegistry
    networkRegistry.addFileSystem('192.168.50.10', { name: 'existing.txt', size: '1 KB', corrupted: false });

    vi.spyOn(useGameModule, 'useGame').mockReturnValue(createMockGameState({
      currentTime: new Date(),
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      discoveredDevices: {
        'test-network': new Set(['192.168.50.10'])
      },
      fileClipboard: {
        files: [{ name: 'newfile.txt', size: '1 KB', corrupted: false }],
        sourceFileSystemId: 'fs-other',
        sourceNetworkId: 'test-network'
      },
      setFileClipboard: mockSetFileClipboard,
    }));

    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    const pasteButton = screen.getByRole('button', { name: /paste \(1\)/i });
    fireEvent.click(pasteButton);

    expect(mockSetFileClipboard).toHaveBeenCalledWith({
      files: [],
      sourceFileSystemId: '',
      sourceNetworkId: ''
    });
  });
});

describe('FileManager Component - Repair UI', () => {
  beforeEach(() => {
    setupTestNetwork();

    vi.spyOn(useGameModule, 'useGame').mockReturnValue(createMockGameState({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      discoveredDevices: {
        'test-network': new Set(['192.168.50.10'])
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have repair button disabled when no corrupted files exist', () => {
    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    // Repair button should be disabled (0 corrupted files selected)
    const repairButton = screen.getByRole('button', { name: /repair \(0\)/i });
    expect(repairButton).toBeDisabled();
  });
});

describe('FileManager Component - Malware Indicators', () => {
  beforeEach(() => {
    setupTestNetwork();
    networkRegistry.addFileSystem('192.168.50.10', { name: 'clean-file.txt', size: '1 KB', corrupted: false });
    networkRegistry.addFileSystem('192.168.50.10', { name: 'malware.db', size: '5 KB', corrupted: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show malware icon for files matching knownMaliciousFiles', () => {
    vi.spyOn(useGameModule, 'useGame').mockReturnValue(createMockGameState({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      discoveredDevices: { 'test-network': new Set(['192.168.50.10']) },
      knownMaliciousFiles: [{ fileName: 'malware.db', sourceFileSystemId: null }],
    }));

    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    // Should render the malware icon for the malicious file
    const malwareIcons = screen.getAllByText('☣');
    expect(malwareIcons.length).toBe(1);
  });

  it('should NOT show malware icon for clean files', () => {
    vi.spyOn(useGameModule, 'useGame').mockReturnValue(createMockGameState({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      discoveredDevices: { 'test-network': new Set(['192.168.50.10']) },
      knownMaliciousFiles: [{ fileName: 'unrelated-malware.db', sourceFileSystemId: null }],
    }));

    render(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '192.168.50.10' } });

    // Should not render any malware icons
    expect(screen.queryByText('☣')).not.toBeInTheDocument();
  });
});
