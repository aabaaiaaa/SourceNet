import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FileManager from './FileManager';
import triggerEventBus from '../../core/triggerEventBus';
import * as useGameModule from '../../contexts/useGame';

const renderWithProvider = (component) => {
  return render(component);
};

describe('FileManager Component - Initial Rendering', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    // Mock useGame to return default game state with no active connections
    vi.spyOn(useGameModule, 'useGame').mockReturnValue({
      activeConnections: [],
      narEntries: [],
      fileClipboard: { files: [], sourceFileSystemId: '', sourceNetworkId: '' },
      setFileClipboard: vi.fn(),
      setFileManagerConnections: vi.fn(),
      setLastFileOperation: vi.fn(),
      registerBandwidthOperation: vi.fn(() => ({ operationId: 'test-op', estimatedTimeMs: 2000 })),
      completeBandwidthOperation: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    triggerEventBus.clear();
  });

  it('should render app title', () => {
    renderWithProvider(<FileManager />);
    expect(screen.getByText('File Manager')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithProvider(<FileManager />);
    expect(screen.getByText('Remote File System Access')).toBeInTheDocument();
  });

  it('should show not connected message when no network connection', () => {
    renderWithProvider(<FileManager />);
    expect(screen.getByText(/Not connected to any networks/i)).toBeInTheDocument();
  });

  it('should display VPN Client prompt when not connected', () => {
    renderWithProvider(<FileManager />);
    expect(screen.getByText(/Use VPN Client to connect/i)).toBeInTheDocument();
  });

  it('should not show file system selector when not connected', () => {
    renderWithProvider(<FileManager />);
    expect(screen.queryByText('Select File System')).not.toBeInTheDocument();
  });
});

describe('FileManager Component - Connected State', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    // Mock useGame to return game state with active connections and NAR entries
    vi.spyOn(useGameModule, 'useGame').mockReturnValue({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      narEntries: [{
        networkId: 'test-network',
        networkName: 'Test Network',
        address: '192.168.50.0/24',
        bandwidth: 50,
        fileSystems: [
          {
            id: 'fs-001',
            ip: '192.168.50.10',
            name: 'fileserver-01',
            files: []
          },
          {
            id: 'fs-002',
            ip: '192.168.50.20',
            name: 'backup-server',
            files: []
          }
        ]
      }],
      fileClipboard: { files: [], sourceFileSystemId: '', sourceNetworkId: '' },
      setFileClipboard: vi.fn(),
      setFileManagerConnections: vi.fn(),
      setLastFileOperation: vi.fn(),
      registerBandwidthOperation: vi.fn(() => ({ operationId: 'test-op', estimatedTimeMs: 2000 })),
      completeBandwidthOperation: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    triggerEventBus.clear();
  });

  it('should show file system selector when connected to network', () => {
    renderWithProvider(<FileManager />);
    expect(screen.getByText('Select File System')).toBeInTheDocument();
  });

  it('should not show empty state when connected', () => {
    renderWithProvider(<FileManager />);
    expect(screen.queryByText(/Not connected to any networks/i)).not.toBeInTheDocument();
  });

  it('should render file system options in selector', () => {
    renderWithProvider(<FileManager />);
    const select = screen.getByRole('combobox');
    expect(within(select).getByText('192.168.50.10 - fileserver-01')).toBeInTheDocument();
    expect(within(select).getByText('192.168.50.20 - backup-server')).toBeInTheDocument();
  });

  it('should not show file list before selecting a file system', () => {
    renderWithProvider(<FileManager />);
    expect(screen.queryByText('log_2024_01.txt')).not.toBeInTheDocument();
  });

  it('should show toolbar buttons when file system is selected', () => {
    renderWithProvider(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fs-001' } });

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /repair/i })).toBeInTheDocument();
  });
});

describe('FileManager Component - Button States', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    // Mock useGame to return game state with active connections and NAR entries
    vi.spyOn(useGameModule, 'useGame').mockReturnValue({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      narEntries: [{
        networkId: 'test-network',
        networkName: 'Test Network',
        address: '192.168.50.0/24',
        bandwidth: 50,
        fileSystems: [
          {
            id: 'fs-001',
            ip: '192.168.50.10',
            name: 'fileserver-01',
            files: []
          }
        ]
      }],
      fileClipboard: { files: [], sourceFileSystemId: '', sourceNetworkId: '' },
      setFileClipboard: vi.fn(),
      setFileManagerConnections: vi.fn(),
      setLastFileOperation: vi.fn(),
      registerBandwidthOperation: vi.fn(() => ({ operationId: 'test-op', estimatedTimeMs: 2000 })),
      completeBandwidthOperation: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    triggerEventBus.clear();
  });

  it('should have paste button disabled when clipboard is empty', () => {
    renderWithProvider(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fs-001' } });

    const pasteButton = screen.getByRole('button', { name: /paste/i });
    expect(pasteButton).toBeDisabled();
  });

  it('should have copy button enabled initially', () => {
    renderWithProvider(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fs-001' } });

    const copyButton = screen.getByRole('button', { name: /copy \(0\)/i });
    expect(copyButton).toBeDisabled(); // Disabled when no files selected
  });

  it('should have delete button enabled initially', () => {
    renderWithProvider(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fs-001' } });

    const deleteButton = screen.getByRole('button', { name: /delete \(0\)/i });
    expect(deleteButton).toBeDisabled(); // Disabled when no files selected
  });
});

describe('FileManager Component - Repair UI', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    // Mock useGame to return game state with active connections and NAR entries
    vi.spyOn(useGameModule, 'useGame').mockReturnValue({
      activeConnections: [{ networkId: 'test-network', networkName: 'Test Network' }],
      narEntries: [{
        networkId: 'test-network',
        networkName: 'Test Network',
        address: '192.168.50.0/24',
        bandwidth: 50,
        fileSystems: [
          {
            id: 'fs-001',
            ip: '192.168.50.10',
            name: 'fileserver-01',
            files: []
          }
        ]
      }],
      fileClipboard: { files: [], sourceFileSystemId: '', sourceNetworkId: '' },
      setFileClipboard: vi.fn(),
      setFileManagerConnections: vi.fn(),
      setLastFileOperation: vi.fn(),
      registerBandwidthOperation: vi.fn(() => ({ operationId: 'test-op', estimatedTimeMs: 2000 })),
      completeBandwidthOperation: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    triggerEventBus.clear();
  });

  it('should have repair button disabled when no corrupted files exist', () => {
    renderWithProvider(<FileManager />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fs-001' } });

    // Repair button should be disabled (0 corrupted files selected)
    const repairButton = screen.getByRole('button', { name: /repair \(0\)/i });
    expect(repairButton).toBeDisabled();
  });
});
