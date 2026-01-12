import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import NetworkScanner from '../../components/apps/NetworkScanner';
import TopBar from '../../components/ui/TopBar';
import triggerEventBus from '../../core/triggerEventBus';
import {
    createCompleteSaveState,
    createNetworkWithFileSystem,
    createNetworkWithDevices,
    setSaveInLocalStorage,
} from '../helpers/testData';
import { useEffect } from 'react';

// GameLoader helper component to load save state
const GameLoader = ({ username }) => {
    const { loadGame, setGamePhase, setSpecificTimeSpeed } = useGame();

    useEffect(() => {
        loadGame(username);
        // Set to desktop phase immediately so time advances in tests
        setGamePhase('desktop');
        // Set to fast time speed (100x) to make tests run quickly
        setSpecificTimeSpeed(100);
    }, [loadGame, setGamePhase, setSpecificTimeSpeed, username]);

    return null;
};

describe('Network Scanner Integration', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should show empty state when no networks connected', async () => {
        userEvent.setup({ delay: null });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [], // No networks
                activeConnections: [], // No active connections
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <NetworkScanner />
            </GameProvider>
        );

        // Wait for component to render
        await waitFor(() => {
            expect(screen.getByText('Network Scanner')).toBeInTheDocument();
        });

        // Should show "Select connected network" with no options
        const select = screen.getByRole('combobox', { name: /network/i });
        expect(select).toHaveTextContent('Select connected network');

        // Scan button should be disabled
        const scanButton = screen.getByRole('button', { name: /start scan/i });
        expect(scanButton).toBeDisabled();
    });

    it('should discover devices from connected network', async () => {
        const user = userEvent.setup({ delay: null });

        // Create network with file systems (devices)
        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems: [
                {
                    id: 'fs-001',
                    ip: '192.168.50.10',
                    name: 'fileserver-01',
                    files: [
                        { name: 'log_2024.txt', size: '5 KB', corrupted: false },
                    ],
                },
                {
                    id: 'fs-002',
                    ip: '192.168.50.20',
                    name: 'backup-server',
                    files: [
                        { name: 'backup.zip', size: '100 MB', corrupted: false },
                    ],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [
                    {
                        networkId: network.networkId,
                        networkName: network.networkName,
                        address: network.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        // Wait for game to load by checking TopBar
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Network Scanner should be ready
        expect(screen.getByText('Network Scanner')).toBeInTheDocument();

        // Select the network
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'corp-net-1');

        // Select deep scan
        const scanTypeSelect = screen.getByRole('combobox', { name: /scan type/i });
        await user.selectOptions(scanTypeSelect, 'deep');

        // Start scan
        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        // Should show scanning progress
        await waitFor(() => {
            expect(screen.getByText(/scanning/i)).toBeInTheDocument();
        });

        // Wait for scan to complete (Deep scan takes ~15 seconds game time)
        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Should show discovered devices (at least the 2 required ones)
        expect(screen.getByText('192.168.50.10')).toBeInTheDocument();
        expect(screen.getByText('fileserver-01')).toBeInTheDocument();
        expect(screen.getByText('192.168.50.20')).toBeInTheDocument();
        expect(screen.getByText('backup-server')).toBeInTheDocument();

        // Deep scan should also include random devices (workstations, printers, etc.)
        const machineItems = container.querySelectorAll('.machine-item');
        expect(machineItems.length).toBeGreaterThan(2); // More than just the 2 fileservers
    }, 20000);

    it('should show different devices for different networks', async () => {
        const user = userEvent.setup({ delay: null });

        // Create two different networks
        const network1 = createNetworkWithDevices({
            networkId: 'network-alpha',
            networkName: 'Alpha Corp',
            address: '192.168.10.0/24',
            devices: [
                {
                    id: 'fs-alpha-1',
                    ip: '192.168.10.10',
                    name: 'alpha-fileserver',
                    files: [],
                },
            ],
        });

        const network2 = createNetworkWithDevices({
            networkId: 'network-beta',
            networkName: 'Beta Industries',
            address: '10.0.50.0/24',
            devices: [
                {
                    id: 'fs-beta-1',
                    ip: '10.0.50.15',
                    name: 'beta-database',
                    files: [],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network1, network2],
                activeConnections: [
                    {
                        networkId: network1.networkId,
                        networkName: network1.networkName,
                        address: network1.address,
                    },
                    {
                        networkId: network2.networkId,
                        networkName: network2.networkName,
                        address: network2.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        // Wait for game to load by checking TopBar
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Scan first network
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'network-alpha');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Should show Alpha network devices
        expect(screen.getByText('192.168.10.10')).toBeInTheDocument();
        expect(screen.getByText('alpha-fileserver')).toBeInTheDocument();

        // Should NOT show Beta network devices
        expect(screen.queryByText('10.0.50.15')).not.toBeInTheDocument();
        expect(screen.queryByText('beta-database')).not.toBeInTheDocument();

        // Scan second network
        await user.selectOptions(networkSelect, 'network-beta');
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('10.0.50.15')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Should now show Beta devices
        expect(screen.getByText('beta-database')).toBeInTheDocument();

        // Should NOT show Alpha devices anymore
        expect(screen.queryByText('192.168.10.10')).not.toBeInTheDocument();
        expect(screen.queryByText('alpha-fileserver')).not.toBeInTheDocument();
    }, 20000);

    it('should show only critical devices on quick scan', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems: [
                {
                    id: 'fs-001',
                    ip: '192.168.50.10',
                    name: 'fileserver-01',
                    files: [],
                },
                {
                    id: 'fs-002',
                    ip: '192.168.50.20',
                    name: 'database-primary',
                    files: [],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [
                    {
                        networkId: network.networkId,
                        networkName: network.networkName,
                        address: network.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Select network and quick scan
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'corp-net-1');

        const scanTypeSelect = screen.getByRole('combobox', { name: /scan type/i });
        await user.selectOptions(scanTypeSelect, 'quick');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        // Wait for scan to complete (Quick scan is faster, ~5 seconds)
        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Should show the critical devices (fileserver, database)
        expect(screen.getByText('fileserver-01')).toBeInTheDocument();
        expect(screen.getByText('database-primary')).toBeInTheDocument();

        // Quick scan should only show required devices, no random ones
        const machineItems = container.querySelectorAll('.machine-item');
        expect(machineItems.length).toBe(2); // Exactly the 2 critical devices
    }, 20000);

    it('should show all devices including workstations on deep scan', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems: [
                {
                    id: 'fs-001',
                    ip: '192.168.50.10',
                    name: 'fileserver-01',
                    files: [],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [
                    {
                        networkId: network.networkId,
                        networkName: network.networkName,
                        address: network.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Select network and deep scan
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'corp-net-1');

        const scanTypeSelect = screen.getByRole('combobox', { name: /scan type/i });
        await user.selectOptions(scanTypeSelect, 'deep');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Should show required device
        expect(screen.getByText('fileserver-01')).toBeInTheDocument();

        // Deep scan should include additional random devices
        const machineItems = container.querySelectorAll('.machine-item');
        expect(machineItems.length).toBeGreaterThan(1); // More than just the fileserver
    }, 20000);

    it('should emit networkScanComplete event with results', async () => {
        const user = userEvent.setup({ delay: null });

        // Spy on event bus
        const eventHandler = vi.fn();
        triggerEventBus.on('networkScanComplete', eventHandler);

        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems: [
                {
                    id: 'fs-001',
                    ip: '192.168.50.10',
                    name: 'fileserver-01',
                    files: [],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [
                    {
                        networkId: network.networkId,
                        networkName: network.networkName,
                        address: network.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Perform scan
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'corp-net-1');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        // Wait for scan completion
        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Event should have been emitted
        await waitFor(() => {
            expect(eventHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    network: 'corp-net-1',
                    results: expect.objectContaining({
                        network: 'corp-net-1',
                        machines: expect.arrayContaining([
                            expect.objectContaining({
                                ip: '192.168.50.10',
                                hostname: 'fileserver-01',
                            }),
                        ]),
                    }),
                })
            );
        });

        // Cleanup
        triggerEventBus.off('networkScanComplete', eventHandler);
    }, 20000);

    it('should map file systems to discovered devices', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems: [
                {
                    id: 'fs-001',
                    ip: '192.168.50.10',
                    name: 'fileserver-01',
                    files: [
                        { name: 'important.txt', size: '1 KB', corrupted: false },
                    ],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [
                    {
                        networkId: network.networkId,
                        networkName: network.networkName,
                        address: network.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Perform scan
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'corp-net-1');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Device should show file systems
        expect(screen.getByText('fileserver-01')).toBeInTheDocument();
        const fileSystemsEl = container.querySelector('.machine-filesystems');
        expect(fileSystemsEl.textContent).toContain('File Systems:');
        expect(fileSystemsEl.textContent).toContain('/fileserver-01/');
    }, 20000);

    it('should always discover mission-critical file systems regardless of scan type', async () => {
        const user = userEvent.setup({ delay: null });

        // Create network with mission-critical file systems (like tutorial missions)
        const network = createNetworkWithFileSystem({
            networkId: 'clienta-corporate',
            networkName: 'ClientA-Corporate',
            address: '192.168.50.0/24',
            fileSystems: [
                {
                    id: 'fs-001',
                    ip: '192.168.50.10',
                    name: 'fileserver-01',
                    files: [
                        { name: 'log_2024_01.txt', size: '2.5 KB', corrupted: true },
                        { name: 'log_2024_02.txt', size: '3.1 KB', corrupted: true },
                    ],
                },
                {
                    id: 'fs-002',
                    ip: '192.168.50.20',
                    name: 'backup-server',
                    files: [
                        { name: 'backup_jan.zip', size: '150 MB', corrupted: false },
                    ],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [
                    {
                        networkId: network.networkId,
                        networkName: network.networkName,
                        address: network.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Test Quick Scan - should still find critical devices
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'clienta-corporate');

        const scanTypeSelect = screen.getByRole('combobox', { name: /scan type/i });
        await user.selectOptions(scanTypeSelect, 'quick');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Both mission-critical file systems MUST be discovered even on quick scan
        expect(screen.getByText('192.168.50.10')).toBeInTheDocument();
        expect(screen.getByText('fileserver-01')).toBeInTheDocument();
        expect(screen.getByText('192.168.50.20')).toBeInTheDocument();
        expect(screen.getByText('backup-server')).toBeInTheDocument();

        // Verify both devices are present (fileserver and database are always shown on quick scan)
        const machineItems = container.querySelectorAll('.machine-item');
        expect(machineItems.length).toBeGreaterThanOrEqual(2);

        // Verify file systems are mapped correctly
        const fileServerEl = Array.from(machineItems).find(item =>
            item.textContent.includes('fileserver-01')
        );
        expect(fileServerEl).toBeTruthy();
        expect(fileServerEl.textContent).toContain('/fileserver-01/');
    }, 20000);

    it('should discover devices using actual mission data from tutorial-part-1', async () => {
        const user = userEvent.setup({ delay: null });

        // Load actual tutorial mission data
        const tutorialPart1 = await import('../../missions/data/tutorial-part-1.json');
        const missionNetwork = tutorialPart1.network;

        // Create NAR entry from mission network data (as the game would do)
        const narEntry = {
            id: 'nar-tutorial-1',
            networkId: missionNetwork.networkId,
            networkName: missionNetwork.networkName,
            address: missionNetwork.address,
            status: 'active',
            addedAt: '2020-03-25T09:00:00.000Z',
            // Map mission fileSystems to NAR entry format
            fileSystems: missionNetwork.fileSystems.map(fs => ({
                id: fs.id,
                ip: fs.ip,
                name: fs.name,
                files: fs.files,
            })),
        };

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [narEntry],
                activeConnections: [
                    {
                        networkId: missionNetwork.networkId,
                        networkName: missionNetwork.networkName,
                        address: missionNetwork.address,
                    },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Select the network from mission data
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, missionNetwork.networkId);

        // Run scan
        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Verify mission file system is discovered with correct IP and name from mission data
        const missionFileSystem = missionNetwork.fileSystems[0];
        expect(screen.getByText(missionFileSystem.ip)).toBeInTheDocument();
        expect(screen.getByText(missionFileSystem.name)).toBeInTheDocument();

        // Verify file system mapping uses mission data
        const machineItems = container.querySelectorAll('.machine-item');
        const fileServerEl = Array.from(machineItems).find(item =>
            item.textContent.includes(missionFileSystem.name)
        );
        expect(fileServerEl).toBeTruthy();
        expect(fileServerEl.textContent).toContain(missionFileSystem.ip);

        // Verify file systems are correctly mapped
        const fileSystemsEl = fileServerEl.querySelector('.machine-filesystems');
        expect(fileSystemsEl).toBeTruthy();
        expect(fileSystemsEl.textContent).toContain(`/${missionFileSystem.name}/`);

        console.log('✅ Network scanner successfully discovered devices using mission data:');
        console.log(`   - Network: ${missionNetwork.networkName} (${missionNetwork.networkId})`);
        console.log(`   - File System: ${missionFileSystem.name} at ${missionFileSystem.ip}`);
        console.log(`   - Files in mission data: ${missionFileSystem.files.length}`);
    }, 20000);
});
