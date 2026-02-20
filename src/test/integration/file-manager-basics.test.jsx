import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider } from '../../contexts/GameContext';
import FileManager from '../../components/apps/FileManager';
import NetworkScanner from '../../components/apps/NetworkScanner';
import VPNClient from '../../components/apps/VPNClient';
import TopBar from '../../components/ui/TopBar';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import {
    createCompleteSaveState,
    setSaveInLocalStorage,
    createNetworkWithFileSystem,
    populateNetworkRegistry,
} from '../helpers/testData';
import { GameLoader, performNetworkScan } from '../helpers/integrationHelpers';

describe('File Manager - Basics', () => {
    beforeEach(() => {
        localStorage.clear();
        networkRegistry.reset();
    });

    it('should show Local SSD in file system selector even without VPN connections', () => {
        render(
            <GameProvider>
                <FileManager />
            </GameProvider>
        );

        // Should show file system selector with Local SSD available
        expect(screen.getByText('Select File System')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByText(/Local SSD/i)).toBeInTheDocument();
    });

    it('should display file systems from connected network after scanning', async () => {
        const user = userEvent.setup();

        // Define file systems for the test
        const fileSystems = [
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
        ];

        // Populate NetworkRegistry with network data
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

        // Create NAR entry (now only contains deviceAccess, not fileSystems)
        const network = createNetworkWithFileSystem({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            address: '192.168.50.0/24',
            fileSystems, // Used to populate deviceAccess list
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
                // Explicitly set empty discoveredDevices to test scanning flow
                discoveredDevices: {},
                networkRegistry: registrySnapshot,
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <NetworkScanner />
                <FileManager />
            </GameProvider>
        );

        // Wait for game to load by checking TopBar renders
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // FileManager should show Local SSD option even before network scan
        const fileManagerSelect = screen.getAllByRole('combobox').find(select =>
            select.textContent.includes('Local SSD')
        );
        expect(fileManagerSelect).toBeDefined();
        expect(fileManagerSelect.textContent).toContain('Local SSD');

        // Perform network scan
        await performNetworkScan(user, 'corp-net-1');

        // Now file systems should appear in FileManager dropdown
        await waitFor(() => {
            const select = screen.getAllByRole('combobox').find(s =>
                s.textContent.includes('192.168.50.10')
            );
            expect(select).toBeDefined();
            expect(select.textContent).toContain('192.168.50.10');
            expect(select.textContent).toContain('192.168.50.20');
        });

        // Select first file system
        const select = screen.getAllByRole('combobox').find(s =>
            s.textContent.includes('192.168.50.10')
        );
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

        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'fileserver-01',
                files: [
                    { name: 'corrupted_file.txt', size: '10 KB', corrupted: true },
                    { name: 'clean_file.txt', size: '5 KB', corrupted: false },
                ],
            },
        ];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

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
                discoveredDevices: {
                    'corp-net-1': ['192.168.50.10'],
                },
                networkRegistry: registrySnapshot,
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
        const corruptionIcons = screen.getAllByText('\u26A0');
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

        const fileSystems = [
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
        ];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

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
                discoveredDevices: {
                    'corp-net-1': ['192.168.50.10'],
                },
                networkRegistry: registrySnapshot,
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
        let corruptionIcons = screen.getAllByText('\u26A0');
        expect(corruptionIcons.length).toBe(2);

        // Select the corrupted files by clicking on them
        const fileItems = screen.getAllByText(/log_2024/);
        const corruptedFile1 = fileItems[0].closest('.file-item');
        const corruptedFile2 = fileItems[1].closest('.file-item');

        await user.click(corruptedFile1);
        await user.click(corruptedFile2);

        // Verify files are selected
        expect(corruptedFile1).toHaveClass('file-selected');
        expect(corruptedFile2).toHaveClass('file-selected');

        // Repair button should now show (2) corrupted files selected
        const repairButton = screen.getByRole('button', { name: /repair \(2\)/i });
        expect(repairButton).not.toBeDisabled();

        // Click repair
        await user.click(repairButton);

        // Wait for repair to complete (uses game time at 100x speed, should be fast)
        await waitFor(() => {
            const updatedIcons = screen.queryAllByText('\u26A0');
            expect(updatedIcons.length).toBe(0);
        }, { timeout: 5000 });

        // Repair button should be disabled (no corrupted files selected)
        const updatedRepairButton = screen.getByRole('button', { name: /repair \(0\)/i });
        expect(updatedRepairButton).toBeDisabled();
    }, 20000);

    it('should track file system connections for mission objectives', async () => {
        const user = userEvent.setup({ delay: null });

        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'fileserver-01',
                files: [],
            },
        ];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

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
                discoveredDevices: {
                    'corp-net-1': ['192.168.50.10'],
                },
                networkRegistry: registrySnapshot,
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

        const fileSystems = [
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
        ];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

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
                discoveredDevices: {
                    'corp-net-1': ['192.168.50.10', '192.168.50.20'],
                },
                networkRegistry: registrySnapshot,
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

        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'fileserver-01',
                files: [
                    { name: 'test_file.txt', size: '1 KB', corrupted: false },
                ],
            },
        ];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corporate Network',
            fileSystems,
        });

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
                activeConnections: [], // Start with no connections
                discoveredDevices: {
                    'corp-net-1': ['192.168.50.10'],
                },
                networkRegistry: registrySnapshot,
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

        // File Manager should show Local SSD available (no VPN required for local access)
        const fileManagerContainer = document.querySelector('.file-manager');
        expect(within(fileManagerContainer).getByText(/Local SSD/i)).toBeInTheDocument();

        // Connect via VPN Client to get access to remote file systems
        const vpnSelect = screen.getAllByRole('combobox')[0]; // VPN Client selector
        await user.selectOptions(vpnSelect, 'corp-net-1');

        const connectButton = screen.getByRole('button', { name: /connect/i });
        await user.click(connectButton);

        // Wait for connection to complete and remote file system to appear
        await waitFor(() => {
            const fmSelect = within(fileManagerContainer).getByRole('combobox');
            expect(fmSelect).toHaveTextContent(/fileserver-01/i);
        }, { timeout: 5000 });

        // Can now select remote file system in File Manager
        const fileManagerSelect = within(fileManagerContainer).getByRole('combobox');
        await user.selectOptions(fileManagerSelect, 'fs-001');

        await waitFor(() => {
            expect(screen.getByText('test_file.txt')).toBeInTheDocument();
        });
    }, 20000);
});
