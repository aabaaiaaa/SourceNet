import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import TopBar from '../../components/ui/TopBar';
import LogViewer from '../../components/apps/LogViewer';
import networkRegistry from '../../systems/NetworkRegistry';
import {
    populateNetworkRegistry,
    createCompleteSaveState,
    setSaveInLocalStorage,
} from '../helpers/testData';

// Helper component to load game state on mount (matches other integration tests)
const GameLoader = ({ username }) => {
    const { loadGame, setGamePhase, setSpecificTimeSpeed } = useGame();

    useEffect(() => {
        loadGame(username);
        setGamePhase('desktop');
        setSpecificTimeSpeed(100);
    }, [loadGame, setGamePhase, setSpecificTimeSpeed, username]);

    return null;
};

describe('LogViewer Integration', () => {
    beforeEach(() => {
        localStorage.clear();
        if (networkRegistry && typeof networkRegistry.reset === 'function') {
            networkRegistry.reset();
        }
        vi.clearAllMocks();
    });

    it('renders empty state when no devices discovered', async () => {
        const saveState = createCompleteSaveState({ username: 'test_user', overrides: { discoveredDevices: {}, lastScanResults: null } });
        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <LogViewer />
            </GameProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('📋 Log Viewer')).toBeInTheDocument();
        });

        const selects = screen.getAllByRole('combobox');
        const deviceSelect = selects.find(s => s.textContent.includes('-- Select a device --'));
        expect(deviceSelect).toBeDefined();

        expect(screen.getByText('Select a device to view its operation logs.')).toBeInTheDocument();
    });

    it('populates device selector from lastScanResults and discoveredDevices', async () => {
        const registrySnapshot = populateNetworkRegistry({ networkId: 'corp-net-1', networkName: 'Corporate Network', fileSystems: [] });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                lastScanResults: {
                    network: 'corp-net-1',
                    machines: [{ ip: '192.168.50.10', name: 'fileserver-01' }]
                },
                discoveredDevices: {
                    'corp-net-1': [{ ip: '192.168.50.20', hostname: 'backup-server', networkId: 'corp-net-1' }]
                },
                networkRegistry: registrySnapshot,
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <LogViewer />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('📋 Log Viewer')).toBeInTheDocument());

        const selects = screen.getAllByRole('combobox');
        const deviceSelect = selects.find(s => s.textContent.includes('-- Select a device --'));
        expect(deviceSelect).toBeDefined();
        expect(deviceSelect.textContent).toContain('fileserver-01 (192.168.50.10)');
    });

    it('loads and displays logs when device selected and supports filtering and ordering', async () => {
        const registrySnapshot = populateNetworkRegistry({ networkId: 'corp-net-1', networkName: 'Corporate Network', fileSystems: [] });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                lastScanResults: {
                    network: 'corp-net-1',
                    machines: [{ ip: '192.168.50.10', name: 'fileserver-01' }]
                },
                networkRegistry: registrySnapshot,
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        // Provide deterministic logs via getDevice spy
        const now = Date.now();
        vi.spyOn(networkRegistry, 'getDevice').mockImplementation((ip) => {
            if (ip === '192.168.50.10') {
                return {
                    ip,
                    logs: [
                        { id: 'l1', type: 'file', action: 'copy', fileName: 'readme.txt', timestamp: now - 5000, sizeBytes: 2048 },
                        { id: 'l2', type: 'remote', action: 'delete', fileName: 'secret.txt', timestamp: now, sizeBytes: 1024 },
                    ],
                };
            }
            return null;
        });

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <LogViewer />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('📋 Log Viewer')).toBeInTheDocument());

        const selects = screen.getAllByRole('combobox');
        const deviceSelect = selects.find(s => s.textContent.includes('-- Select a device --'));
        const filterSelect = selects.find(s => s.textContent.includes('All Types'));
        const user = userEvent.setup();

        // Select device
        await user.selectOptions(deviceSelect, '192.168.50.10');

        // Logs should render (newest first -> secret.txt then readme.txt)
        await waitFor(() => {
            expect(screen.getByText('secret.txt')).toBeInTheDocument();
            expect(screen.getByText('readme.txt')).toBeInTheDocument();
        });

        const fileCells = container.querySelectorAll('.log-entry .log-col-file');
        expect(fileCells[0].textContent).toContain('secret.txt');
        expect(fileCells[1].textContent).toContain('readme.txt');

        // Filtering to file-only (by log.type)
        await user.selectOptions(filterSelect, 'file');

        await waitFor(() => {
            expect(screen.queryByText('secret.txt')).not.toBeInTheDocument();
            expect(screen.getByText('readme.txt')).toBeInTheDocument();
            expect(screen.getByText(/1 log entries/i)).toBeInTheDocument();
        });
    });
});

it('shows empty message when device has no logs', async () => {
    const registrySnapshot = populateNetworkRegistry({ networkId: 'corp-net-1', networkName: 'Corporate Network', fileSystems: [] });

    const saveState = createCompleteSaveState({
        username: 'test_user',
        overrides: {
            lastScanResults: {
                network: 'corp-net-1',
                machines: [{ ip: '10.0.0.5', name: 'workstation-01' }]
            },
            networkRegistry: registrySnapshot,
        },
    });

    setSaveInLocalStorage('test_user', saveState);

    vi.spyOn(networkRegistry, 'getDevice').mockImplementation((ip) => {
        if (ip === '10.0.0.5') return { ip, logs: [] };
        return null;
    });

    render(
        <GameProvider>
            <GameLoader username="test_user" />
            <TopBar />
            <LogViewer />
        </GameProvider>
    );

    await waitFor(() => expect(screen.getByText('📋 Log Viewer')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    const deviceSelect = selects.find(s => s.textContent.includes('-- Select a device --'));
    const user = userEvent.setup();
    await user.selectOptions(deviceSelect, '10.0.0.5');

    await waitFor(() => {
        expect(screen.getByText(/No logs of the selected type found for this device/i)).toBeInTheDocument();
    });
});

it('formats timestamps and displays Unknown for missing filenames', async () => {
    const registrySnapshot = populateNetworkRegistry({ networkId: 'corp-net-1', networkName: 'Corporate Network', fileSystems: [] });

    const saveState = createCompleteSaveState({
        username: 'test_user',
        overrides: {
            lastScanResults: {
                network: 'corp-net-1',
                machines: [{ ip: '10.0.0.6', name: 'printer-01' }]
            },
            networkRegistry: registrySnapshot,
        },
    });

    setSaveInLocalStorage('test_user', saveState);

    const now = Date.now();
    vi.spyOn(networkRegistry, 'getDevice').mockImplementation((ip) => {
        if (ip === '10.0.0.6') {
            return {
                ip,
                logs: [{ id: 't1', type: 'file', action: 'paste', timestamp: now }]
            };
        }
        return null;
    });

    const { container } = render(
        <GameProvider>
            <GameLoader username="test_user" />
            <TopBar />
            <LogViewer />
        </GameProvider>
    );

    await waitFor(() => expect(screen.getByText('📋 Log Viewer')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    const deviceSelect = selects.find(s => s.textContent.includes('-- Select a device --'));
    const user = userEvent.setup();
    await user.selectOptions(deviceSelect, '10.0.0.6');

    await waitFor(() => {
        const timeCell = container.querySelector('.log-entry .log-col-time');
        expect(timeCell).toBeTruthy();
        expect(timeCell.textContent).not.toBe('Unknown');
        // File should show 'Unknown' when missing
        const fileCell = container.querySelector('.log-entry .log-col-file');
        expect(fileCell.textContent).toBe('Unknown');
    });
});

it('shows source and destination details when present', async () => {
    const registrySnapshot = populateNetworkRegistry({ networkId: 'corp-net-1', networkName: 'Corporate Network', fileSystems: [] });

    const saveState = createCompleteSaveState({
        username: 'test_user',
        overrides: {
            lastScanResults: {
                network: 'corp-net-1',
                machines: [{ ip: '10.0.0.7', name: 'fileserver-02' }]
            },
            networkRegistry: registrySnapshot,
        },
    });

    setSaveInLocalStorage('test_user', saveState);

    vi.spyOn(networkRegistry, 'getDevice').mockImplementation((ip) => {
        if (ip === '10.0.0.7') {
            return {
                ip,
                logs: [{ id: 'd1', type: 'file', action: 'download', fileName: 'data.bin', timestamp: Date.now(), sizeBytes: 4096, sourceIp: '10.0.0.8', destIp: '10.0.0.7' }]
            };
        }
        return null;
    });

    const { container } = render(
        <GameProvider>
            <GameLoader username="test_user" />
            <TopBar />
            <LogViewer />
        </GameProvider>
    );

    await waitFor(() => expect(screen.getByText('📋 Log Viewer')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    const deviceSelect = selects.find(s => s.textContent.includes('-- Select a device --'));
    const user = userEvent.setup();
    await user.selectOptions(deviceSelect, '10.0.0.7');

    await waitFor(() => {
        const details = container.querySelector('.log-entry .log-col-details').textContent;
        expect(details).toContain('4.0 KB');
        // sourceIp is different than selectedDevice so 'from' should be present
        expect(details).toContain('from 10.0.0.8');
    });
});

it('loads network logs when network scope selected and supports filtering', async () => {
    const registrySnapshot = populateNetworkRegistry({ networkId: 'corp-net-1', networkName: 'Corporate Network', fileSystems: [] });

    const saveState = createCompleteSaveState({
        username: 'test_user',
        overrides: {
            lastScanResults: {
                network: 'corp-net-1',
                machines: [{ ip: '192.168.50.10', name: 'fileserver-01' }]
            },
            networkRegistry: registrySnapshot,
        },
    });

    setSaveInLocalStorage('test_user', saveState);

    const now = Date.now();
    // Provide deterministic network logs via getNetworkLogs spy
    vi.spyOn(networkRegistry, 'getNetworkLogs').mockImplementation((nid) => {
        if (nid === 'corp-net-1') {
            return [
                { id: 'n1', type: 'remote', action: 'connect', note: 'VPN connected', timestamp: now - 2000 },
                { id: 'n2', type: 'remote', action: 'disconnect', note: 'VPN disconnected', timestamp: now },
            ];
        }
        return [];
    });

    render(
        <GameProvider>
            <GameLoader username="test_user" />
            <TopBar />
            <LogViewer />
        </GameProvider>
    );

    await waitFor(() => expect(screen.getByText('📋 Log Viewer')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    const scopeSelect = selects[0];
    const networkSelect = selects[1];
    const filterSelect = selects[2];
    const user = userEvent.setup();

    // Switch to network scope
    await user.selectOptions(scopeSelect, 'network');

    // Select the network
    await user.selectOptions(networkSelect, 'corp-net-1');

    // Logs should render
    await waitFor(() => {
        expect(screen.getByText('VPN connected')).toBeInTheDocument();
        expect(screen.getByText('VPN disconnected')).toBeInTheDocument();
    });

    // Filter to remote-only (should still show both since both are remote)
    await user.selectOptions(filterSelect, 'remote');

    await waitFor(() => {
        expect(screen.getByText(/2 log entries/i)).toBeInTheDocument();
    });
});
