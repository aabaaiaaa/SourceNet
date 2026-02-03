import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import NetworkScanner from '../../components/apps/NetworkScanner';
import TopBar from '../../components/ui/TopBar';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import {
    createCompleteSaveState,
    createNetworkWithFileSystem,
    createNetworkWithDevices,
    setSaveInLocalStorage,
    populateNetworkRegistry,
} from '../helpers/testData';
import { useEffect } from 'react';
import tutorialPart1 from '../../missions/data/tutorial-part-1.json';

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
        networkRegistry.reset();
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

        // Should show no-networks message and hide scan button
        expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /start scan/i })).not.toBeInTheDocument();
    });

    it('should discover devices from connected network', async () => {
        const user = userEvent.setup({ delay: null });

        // Define file systems for the test
        const fileSystems = [
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
        ];

        // Populate NetworkRegistry with file systems
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

        // Create NAR entry (now only contains deviceAccess)
        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems,
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
                networkRegistry: registrySnapshot,
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

        // Should also include random devices (workstations, printers, etc.)
        const machineItems = container.querySelectorAll('.machine-item');
        expect(machineItems.length).toBeGreaterThan(2); // More than just the 2 fileservers
    }, 20000);

    it('should show different devices for different networks', async () => {
        const user = userEvent.setup({ delay: null });

        // Define devices for both networks
        const alphaDevices = [
            {
                id: 'fs-alpha-1',
                ip: '192.168.10.10',
                name: 'alpha-fileserver',
                files: [],
            },
        ];

        const betaDevices = [
            {
                id: 'fs-beta-1',
                ip: '10.0.50.15',
                name: 'beta-database',
                files: [],
            },
        ];

        // Populate NetworkRegistry with both networks
        populateNetworkRegistry({
            networkId: 'network-alpha',
            networkName: 'Alpha Corp',
            fileSystems: alphaDevices,
        });

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'network-beta',
            networkName: 'Beta Industries',
            fileSystems: betaDevices,
        });

        // Create NAR entries
        const network1 = createNetworkWithDevices({
            networkId: 'network-alpha',
            networkName: 'Alpha Corp',
            address: '192.168.10.0/24',
            devices: alphaDevices,
        });

        const network2 = createNetworkWithDevices({
            networkId: 'network-beta',
            networkName: 'Beta Industries',
            address: '10.0.50.0/24',
            devices: betaDevices,
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
                networkRegistry: registrySnapshot,
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

    it('should show all devices including workstations on scan', async () => {
        const user = userEvent.setup({ delay: null });

        // Define file systems for the test
        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'fileserver-01',
                files: [],
            },
        ];

        // Populate NetworkRegistry with file systems
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

        // Create NAR entry
        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems,
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
                networkRegistry: registrySnapshot,
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

        // Select network
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'corp-net-1');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Should show required device
        expect(screen.getByText('fileserver-01')).toBeInTheDocument();

        // Should include additional random devices
        const machineItems = container.querySelectorAll('.machine-item');
        expect(machineItems.length).toBeGreaterThan(1); // More than just the fileserver
    }, 20000);

    it('should emit networkScanComplete event with results', async () => {
        const user = userEvent.setup({ delay: null });

        // Spy on event bus
        const eventHandler = vi.fn();
        triggerEventBus.on('networkScanComplete', eventHandler);

        // Define file systems for the test
        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'fileserver-01',
                files: [],
            },
        ];

        // Populate NetworkRegistry with file systems
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

        // Create NAR entry
        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems,
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
                networkRegistry: registrySnapshot,
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

        // Define file systems for the test
        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'fileserver-01',
                files: [
                    { name: 'important.txt', size: '1 KB', corrupted: false },
                ],
            },
        ];

        // Populate NetworkRegistry with file systems
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

        // Create NAR entry
        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems,
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
                networkRegistry: registrySnapshot,
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

    it('should always discover mission-critical file systems', async () => {
        const user = userEvent.setup({ delay: null });

        // Define mission-critical file systems (like tutorial missions)
        const fileSystems = [
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
        ];

        // Populate NetworkRegistry with file systems
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'clienta-corporate',
            networkName: 'ClientA-Corporate',
            fileSystems,
        });

        // Create NAR entry
        const network = createNetworkWithFileSystem({
            networkId: 'clienta-corporate',
            networkName: 'ClientA-Corporate',
            address: '192.168.50.0/24',
            fileSystems,
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
                networkRegistry: registrySnapshot,
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

        // Scan the network
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        await user.selectOptions(networkSelect, 'clienta-corporate');

        const scanButton = screen.getByRole('button', { name: /start scan/i });
        await user.click(scanButton);

        await waitFor(() => {
            expect(screen.getByText('Scan Results')).toBeInTheDocument();
        }, { timeout: 6000 });

        // Both mission-critical file systems MUST be discovered
        expect(screen.getByText('192.168.50.10')).toBeInTheDocument();
        expect(screen.getByText('fileserver-01')).toBeInTheDocument();
        expect(screen.getByText('192.168.50.20')).toBeInTheDocument();
        expect(screen.getByText('backup-server')).toBeInTheDocument();

        // Verify both devices are present
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

        // Use imported tutorial mission data
        const missionNetwork = tutorialPart1.networks[0];

        // Populate NetworkRegistry with mission file systems
        const registrySnapshot = populateNetworkRegistry({
            networkId: missionNetwork.networkId,
            networkName: missionNetwork.networkName,
            fileSystems: missionNetwork.fileSystems,
        });

        // Create NAR entry from mission network data (as the game would do)
        // Now only contains deviceAccess, not fileSystems
        const narEntry = {
            id: 'nar-tutorial-1',
            networkId: missionNetwork.networkId,
            networkName: missionNetwork.networkName,
            address: missionNetwork.address,
            status: 'active',
            addedAt: '2020-03-25T09:00:00.000Z',
            deviceAccess: missionNetwork.fileSystems.map(fs => fs.ip),
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
                networkRegistry: registrySnapshot,
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

    it('should show disconnection message on disconnect and clear it on reconnect', async () => {
        const user = userEvent.setup({ delay: null });
        let gameState;

        // TestComponent to access game context
        const TestComponent = ({ onRender }) => {
            const game = useGame();
            if (onRender) onRender(game);
            return null;
        };

        // Define file systems for the test
        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'file-server',
                files: [
                    { name: 'data.txt', size: 100 },
                ],
            },
        ];

        // Populate NetworkRegistry with file systems
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

        // Create NAR entry
        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems,
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
                    }
                ],
                networkRegistry: registrySnapshot,
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TestComponent onRender={(game) => { gameState = game; }} />
                <TopBar />
                <NetworkScanner />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Verify network is available
        const networkSelect = screen.getByRole('combobox', { name: /network/i });
        expect(networkSelect).toBeInTheDocument();

        // Select the network
        await user.selectOptions(networkSelect, 'corp-net-1');

        // Verify scan controls are visible (network is connected)
        expect(screen.getByRole('button', { name: /start scan/i })).toBeInTheDocument();
        expect(screen.queryByText(/disconnected from network/i)).not.toBeInTheDocument();

        // Disconnect from network
        await act(async () => {
            gameState.setActiveConnections([]);
        });

        // Verify disconnection message appears
        await waitFor(() => {
            expect(screen.getByText(/disconnected from network/i)).toBeInTheDocument();
        });

        // Verify selection was cleared
        await waitFor(() => {
            expect(networkSelect).toHaveTextContent('Select connected network');
        });

        // Reconnect to network
        await act(async () => {
            gameState.setActiveConnections([
                {
                    networkId: network.networkId,
                    networkName: network.networkName,
                    address: network.address,
                }
            ]);
        });

        // Verify disconnection message is cleared
        await waitFor(() => {
            expect(screen.queryByText(/disconnected from network/i)).not.toBeInTheDocument();
        });

        // Verify network is available for selection again
        expect(networkSelect).toBeInTheDocument();
        await user.selectOptions(networkSelect, 'corp-net-1');
        expect(screen.getByRole('button', { name: /start scan/i })).toBeInTheDocument();
    }, 20000);
});
