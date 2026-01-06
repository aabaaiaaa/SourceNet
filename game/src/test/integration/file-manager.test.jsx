import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameProvider, useGame } from '../../contexts/GameContext';
import FileManager from '../../components/apps/FileManager';
import VPNClient from '../../components/apps/VPNClient';
import TopBar from '../../components/ui/TopBar';
import triggerEventBus from '../../core/triggerEventBus';
import {
    createCompleteSaveState,
    setSaveInLocalStorage,
    createNetworkWithFileSystem,
} from '../helpers/testData';

// Helper component to load game state on mount
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

describe('File Manager Integration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should show "not connected" message when no active network connections', () => {
        render(
            <GameProvider>
                <FileManager />
            </GameProvider>
        );

        // Should show not connected message
        expect(screen.getByText(/Not connected to any networks/i)).toBeInTheDocument();
        expect(screen.getByText(/Use VPN Client to connect/i)).toBeInTheDocument();

        // Should not show file system selector
        expect(screen.queryByText('Select File System')).not.toBeInTheDocument();
    });

    it('should display file systems from connected network', async () => {
        const user = userEvent.setup();

        // Create network with two file systems
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
                        { name: 'log_2024_01.txt', size: '2.5 KB', corrupted: false },
                        { name: 'log_2024_02.txt', size: '3.1 KB', corrupted: false },
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

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <FileManager />
            </GameProvider>
        );

        // Wait for game to load by checking TopBar renders (like software-license test does)
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // Now check for specific file system option
        const select = screen.getByRole('combobox');
        expect(select).toHaveTextContent(/192\.168\.50\.10/);

        // Should not show empty state
        expect(screen.queryByText(/Not connected to any networks/i)).not.toBeInTheDocument();

        // Select first file system
        await user.selectOptions(select, 'fs-001');

        // Files from that file system should be displayed
        await waitFor(() => {
            expect(screen.getByText('log_2024_01.txt')).toBeInTheDocument();
            expect(screen.getByText('log_2024_02.txt')).toBeInTheDocument();
            expect(screen.getByText('2.5 KB')).toBeInTheDocument();
        });
    }, 15000);

    it('should show corrupted file indicators', async () => {
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
                        { name: 'corrupted_file.txt', size: '10 KB', corrupted: true },
                        { name: 'clean_file.txt', size: '5 KB', corrupted: false },
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

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            expect(screen.getByRole('combobox')).toBeInTheDocument();
        }, { timeout: 10000 });

        // Select file system
        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'fs-001');

        // Wait for files to load
        await waitFor(() => {
            expect(screen.getByText('corrupted_file.txt')).toBeInTheDocument();
        });

        // Corrupted file should have warning icon
        const corruptionIcons = screen.getAllByText('⚠');
        expect(corruptionIcons.length).toBe(1);

        // Corrupted file should have corrupted class
        const corruptedFileItem = screen.getByText('corrupted_file.txt').closest('.file-item');
        expect(corruptedFileItem).toHaveClass('file-corrupted');

        // Clean file should not have warning icon or corrupted class
        const cleanFileItem = screen.getByText('clean_file.txt').closest('.file-item');
        expect(cleanFileItem).not.toHaveClass('file-corrupted');
    }, 15000);

    it('should complete repair operation on corrupted files', async () => {
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
                        { name: 'log_2024_01.txt', size: '2.5 KB', corrupted: true },
                        { name: 'log_2024_02.txt', size: '3.1 KB', corrupted: true },
                        { name: 'log_2024_03.txt', size: '2.8 KB', corrupted: false },
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

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            expect(screen.getByRole('combobox')).toBeInTheDocument();
        }, { timeout: 10000 });

        // Select file system
        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'fs-001');

        // Wait for files to load
        await waitFor(() => {
            expect(screen.getByText('log_2024_01.txt')).toBeInTheDocument();
        });

        // Initial state: should have 2 corrupted files
        let corruptionIcons = screen.getAllByText('⚠');
        expect(corruptionIcons.length).toBe(2);

        // Repair button should be enabled
        const repairButton = screen.getByRole('button', { name: /repair/i });
        expect(repairButton).not.toBeDisabled();

        // Click repair
        await user.click(repairButton);

        // Should show repairing state
        await waitFor(() => {
            expect(screen.getByText(/repairing/i)).toBeInTheDocument();
        });

        // Wait for repair to complete (uses real timers, takes ~3 seconds)
        await waitFor(() => {
            const updatedIcons = screen.queryAllByText('⚠');
            expect(updatedIcons.length).toBe(0);
        }, { timeout: 5000 });

        // Repair button should be disabled (no more corrupted files)
        expect(repairButton).toBeDisabled();
    }, 20000);

    it('should track file system connections for mission objectives', async () => {
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

        // Track fileSystemConnected events
        const eventHandler = vi.fn();
        triggerEventBus.on('fileSystemConnected', eventHandler);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        // Wait for game to load - check for specific file system
        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toHaveTextContent(/192\.168\.50\.10/);
        });

        // Select file system to connect
        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'fs-001');

        // Event should have been emitted with file system details
        await waitFor(() => {
            expect(eventHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    fileSystemId: 'fs-001',
                    ip: '192.168.50.10',
                })
            );
        });

        triggerEventBus.off('fileSystemConnected', eventHandler);
    }, 15000);

    it('should switch between different file systems', async () => {
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
                        { name: 'file_a.txt', size: '1 KB', corrupted: false },
                    ],
                },
                {
                    id: 'fs-002',
                    ip: '192.168.50.20',
                    name: 'backup-server',
                    files: [
                        { name: 'file_b.txt', size: '2 KB', corrupted: false },
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

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        // Wait for game to load - check for both file systems
        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toHaveTextContent(/192\.168\.50\.10/);
            expect(select).toHaveTextContent(/192\.168\.50\.20/);
        });

        const select = screen.getByRole('combobox');

        // Connect to first file system
        await user.selectOptions(select, 'fs-001');

        await waitFor(() => {
            expect(screen.getByText('file_a.txt')).toBeInTheDocument();
        });

        // Switch to second file system
        await user.selectOptions(select, 'fs-002');

        await waitFor(() => {
            expect(screen.getByText('file_b.txt')).toBeInTheDocument();
        });

        // First file system's files should not be visible
        expect(screen.queryByText('file_a.txt')).not.toBeInTheDocument();
    }, 15000);

    it('should integrate with VPN client for network connections', async () => {
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
                        { name: 'test_file.txt', size: '1 KB', corrupted: false },
                    ],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [], // Start with no connections
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <VPNClient />
                <FileManager />
            </GameProvider>
        );

        // Wait for game to load - check VPN has the network option
        await waitFor(() => {
            expect(screen.getByText('SourceNet VPN Client')).toBeInTheDocument();
            expect(screen.getByText('File Manager')).toBeInTheDocument();
            // Check that VPN selector has our network
            const vpnSelect = screen.getAllByRole('combobox')[0];
            expect(vpnSelect).toHaveTextContent(/Corporate Network/);
        });

        // File Manager should show not connected
        expect(screen.getByText(/Not connected to any networks/i)).toBeInTheDocument();

        // Connect via VPN Client
        const vpnSelect = screen.getAllByRole('combobox')[0]; // VPN Client selector
        await user.selectOptions(vpnSelect, 'corp-net-1');

        const connectButton = screen.getByRole('button', { name: /connect/i });
        await user.click(connectButton);

        // Wait for connection to complete (uses real timers, takes ~3 seconds)
        await waitFor(() => {
            expect(screen.getByText('Select File System')).toBeInTheDocument();
        }, { timeout: 5000 });

        // Should not show "not connected" message anymore
        expect(screen.queryByText(/Not connected to any networks/i)).not.toBeInTheDocument();

        // Can now select file system in File Manager
        const fileManagerSelect = screen.getAllByRole('combobox')[1]; // File Manager selector
        await user.selectOptions(fileManagerSelect, 'fs-001');

        await waitFor(() => {
            expect(screen.getByText('test_file.txt')).toBeInTheDocument();
        });
    }, 20000);
});
