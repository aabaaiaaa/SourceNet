import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import FileManager from '../../components/apps/FileManager';
import VPNClient from '../../components/apps/VPNClient';
import TopBar from '../../components/ui/TopBar';
import Desktop from '../../components/ui/Desktop';
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
            const updatedIcons = screen.queryAllByText('⚠');
            expect(updatedIcons.length).toBe(0);
        }, { timeout: 5000 });

        // Repair button should be disabled (no corrupted files selected)
        const updatedRepairButton = screen.getByRole('button', { name: /repair \(0\)/i });
        expect(updatedRepairButton).toBeDisabled();
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

    it('should allow file selection by clicking', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [{
                id: 'fs-001',
                ip: '192.168.1.10',
                name: 'server-01',
                files: [
                    { name: 'file1.txt', size: '1.0 KB', corrupted: false },
                    { name: 'file2.txt', size: '2.0 KB', corrupted: false },
                    { name: 'file3.txt', size: '3.0 KB', corrupted: true },
                ],
            }],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument(), { timeout: 10000 });

        // Select file system
        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'fs-001');

        await waitFor(() => expect(screen.getByText('file1.txt')).toBeInTheDocument());

        // Initially no files selected
        const copyButton = screen.getByRole('button', { name: /copy \(0\)/i });
        expect(copyButton).toBeDisabled();

        // Click to select file1
        const file1 = screen.getByText('file1.txt').closest('.file-item');
        await user.click(file1);

        // File should be selected
        expect(file1).toHaveClass('file-selected');
        await waitFor(() => {
            const updatedCopyButton = screen.getByRole('button', { name: /copy \(1\)/i });
            expect(updatedCopyButton).not.toBeDisabled();
        });

        // Click to select file2
        const file2 = screen.getByText('file2.txt').closest('.file-item');
        await user.click(file2);

        await waitFor(() => {
            const updatedCopyButton = screen.getByRole('button', { name: /copy \(2\)/i });
            expect(updatedCopyButton).not.toBeDisabled();
        });

        // Click file1 again to deselect
        await user.click(file1);

        await waitFor(() => {
            const updatedCopyButton = screen.getByRole('button', { name: /copy \(1\)/i });
            expect(updatedCopyButton).not.toBeDisabled();
        });
    }, 20000);

    it('should copy selected files to clipboard', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [{
                id: 'fs-001',
                ip: '192.168.1.10',
                name: 'server-01',
                files: [
                    { name: 'doc1.txt', size: '5.0 KB', corrupted: false },
                    { name: 'doc2.txt', size: '10.0 KB', corrupted: false },
                ],
            }],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument(), { timeout: 10000 });

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'fs-001');

        await waitFor(() => expect(screen.getByText('doc1.txt')).toBeInTheDocument());

        // Select both files
        const file1 = screen.getByText('doc1.txt').closest('.file-item');
        const file2 = screen.getByText('doc2.txt').closest('.file-item');
        await user.click(file1);
        await user.click(file2);

        // Copy should be enabled
        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy \(2\)/i });
            expect(copyButton).not.toBeDisabled();
        });

        // Click copy
        const copyButton = screen.getByRole('button', { name: /copy \(2\)/i });
        await user.click(copyButton);

        // Wait for copy to complete (very fast operation)
        await waitFor(() => {
            // Clipboard panel should appear
            expect(screen.getByText(/📋 Clipboard/i)).toBeInTheDocument();
            expect(screen.getByText(/2 files/i)).toBeInTheDocument();
        }, { timeout: 2000 });

        // Wait for copy operations to complete before paste button is enabled
        await waitFor(() => {
            const pasteButton = screen.getByRole('button', { name: /paste \(2\)/i });
            expect(pasteButton).not.toBeDisabled();
        }, { timeout: 3000 });
    }, 20000);

    it('should delete selected files', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [{
                id: 'fs-001',
                ip: '192.168.1.10',
                name: 'server-01',
                files: [
                    { name: 'old1.txt', size: '1.0 KB', corrupted: false },
                    { name: 'old2.txt', size: '1.5 KB', corrupted: false },
                    { name: 'keep.txt', size: '2.0 KB', corrupted: false },
                ],
            }],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument(), { timeout: 10000 });

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'fs-001');

        await waitFor(() => expect(screen.getByText('old1.txt')).toBeInTheDocument());

        // Select files to delete
        const file1 = screen.getByText('old1.txt').closest('.file-item');
        const file2 = screen.getByText('old2.txt').closest('.file-item');
        await user.click(file1);
        await user.click(file2);

        // Delete button should be enabled
        await waitFor(() => {
            const deleteButton = screen.getByRole('button', { name: /delete \(2\)/i });
            expect(deleteButton).not.toBeDisabled();
        });

        // Click delete
        const deleteButton = screen.getByRole('button', { name: /delete \(2\)/i });
        await user.click(deleteButton);

        // Wait for delete to complete (fast operation with game time)
        await waitFor(() => {
            // Check file-list specifically (not activity log)
            const fileList = screen.getByRole('combobox').closest('.file-manager').querySelector('.file-list');
            expect(fileList).toBeInTheDocument();
            expect(within(fileList).queryByText('old1.txt')).not.toBeInTheDocument();
            expect(within(fileList).queryByText('old2.txt')).not.toBeInTheDocument();
        }, { timeout: 3000 });

        // Only keep.txt should remain in file list
        const fileList = screen.getByRole('combobox').closest('.file-manager').querySelector('.file-list');
        expect(within(fileList).getByText('keep.txt')).toBeInTheDocument();
    }, 20000);

    it('should paste files from clipboard', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [{
                id: 'fs-001',
                ip: '192.168.1.10',
                name: 'server-01',
                files: [
                    { name: 'source.txt', size: '5.0 KB', corrupted: false },
                ],
            }],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument(), { timeout: 10000 });

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'fs-001');

        await waitFor(() => expect(screen.getByText('source.txt')).toBeInTheDocument());

        // Select and copy the file
        const sourceFile = screen.getByText('source.txt').closest('.file-item');
        await user.click(sourceFile);

        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy \(1\)/i });
            expect(copyButton).not.toBeDisabled();
        });

        const copyButton = screen.getByRole('button', { name: /copy \(1\)/i });
        await user.click(copyButton);

        // Wait for clipboard to populate
        await waitFor(() => {
            expect(screen.getByText(/📋 Clipboard/i)).toBeInTheDocument();
        }, { timeout: 2000 });

        // Now paste
        const pasteButton = screen.getByRole('button', { name: /paste \(1\)/i });
        await user.click(pasteButton);

        // Should skip duplicate (same filesystem)
        await waitFor(() => {
            // Check file-list specifically, not clipboard
            const fileList = document.querySelector('.file-list');
            const fileItems = fileList.querySelectorAll('.file-item');
            expect(fileItems.length).toBe(1); // Still only one file in the list
        }, { timeout: 3000 });
    }, 20000);

    it('should clear clipboard after paste operation', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [
                {
                    id: 'fs-source',
                    ip: '192.168.1.10',
                    name: 'source-server',
                    files: [
                        { name: 'file-to-copy.txt', size: '5.0 KB', corrupted: false },
                    ],
                },
                {
                    id: 'fs-dest',
                    ip: '192.168.1.20',
                    name: 'dest-server',
                    files: [],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument(), { timeout: 10000 });

        const select = screen.getByRole('combobox');

        // Select source file system and copy file
        await user.selectOptions(select, 'fs-source');
        await waitFor(() => expect(screen.getByText('file-to-copy.txt')).toBeInTheDocument());

        const sourceFile = screen.getByText('file-to-copy.txt').closest('.file-item');
        await user.click(sourceFile);

        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy \(1\)/i });
            expect(copyButton).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /copy \(1\)/i }));

        // Verify clipboard populated
        await waitFor(() => {
            expect(screen.getByText(/📋 Clipboard/i)).toBeInTheDocument();
        }, { timeout: 2000 });

        // Switch to destination and paste
        await user.selectOptions(select, 'fs-dest');

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /paste \(1\)/i })).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /paste \(1\)/i }));

        // Verify clipboard is cleared immediately
        await waitFor(() => {
            expect(screen.queryByText(/📋 Clipboard/i)).not.toBeInTheDocument();
        }, { timeout: 2000 });

        // Verify paste button shows 0 and is disabled
        await waitFor(() => {
            const pasteButton = screen.getByRole('button', { name: /paste \(0\)/i });
            expect(pasteButton).toBeDisabled();
        });
    }, 20000);

    it('should clear clipboard when disconnecting from source network', async () => {
        const user = userEvent.setup({ delay: null });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [{
                id: 'fs-001',
                ip: '192.168.1.10',
                name: 'server-01',
                files: [
                    { name: 'data.txt', size: '3.0 KB', corrupted: false },
                ],
            }],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
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

        await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0), { timeout: 10000 });

        // Select file system and copy a file
        const fmSelect = screen.getAllByRole('combobox')[1]; // FileManager selector
        await user.selectOptions(fmSelect, 'fs-001');

        await waitFor(() => expect(screen.getByText('data.txt')).toBeInTheDocument());

        const dataFile = screen.getByText('data.txt').closest('.file-item');
        await user.click(dataFile);

        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy \(1\)/i });
            expect(copyButton).not.toBeDisabled();
        });

        const copyButton = screen.getByRole('button', { name: /copy \(1\)/i });
        await user.click(copyButton);

        // Wait for clipboard
        await waitFor(() => {
            expect(screen.getByText(/📋 Clipboard/i)).toBeInTheDocument();
        }, { timeout: 2000 });

        // Now disconnect from VPN
        const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
        await user.click(disconnectButton);

        // Wait for disconnect to complete
        await waitFor(() => {
            expect(screen.getByText(/No active connections/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        // Clipboard should be cleared (check by absence of clipboard panel)
        await waitFor(() => {
            expect(screen.queryByText(/📋 Clipboard/i)).not.toBeInTheDocument();
        }, { timeout: 2000 });

        // FileManager should show not connected
        expect(screen.getByText(/Not connected to any networks/i)).toBeInTheDocument();

        // Reconnect to the same network - first select the network from dropdown
        const vpnDropdown = screen.getAllByRole('combobox')[0]; // VPN network dropdown
        await user.selectOptions(vpnDropdown, 'test-net');

        const reconnectButton = screen.getByRole('button', { name: /connect/i });
        await user.click(reconnectButton);

        // Wait for reconnection
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
        }, { timeout: 3000 });

        // Clipboard should still be cleared after reconnecting
        expect(screen.queryByText(/📋 Clipboard/i)).not.toBeInTheDocument();
    }, 20000);

    it('should persist pasted files when switching file systems and back', async () => {
        const user = userEvent.setup({ delay: null });

        // Network with two file systems
        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [
                {
                    id: 'fs-1',
                    ip: '192.168.1.10',
                    name: 'server-1',
                    files: [
                        { name: 'original.txt', size: '5.0 KB', corrupted: false },
                    ],
                },
                {
                    id: 'fs-2',
                    ip: '192.168.1.20',
                    name: 'server-2',
                    files: [
                        { name: 'source-file.txt', size: '3.0 KB', corrupted: false },
                    ],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <FileManager />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument(), { timeout: 10000 });

        const select = screen.getByRole('combobox');

        // Copy a file from fs-2
        await user.selectOptions(select, 'fs-2');
        await waitFor(() => expect(screen.getByText('source-file.txt')).toBeInTheDocument());

        const sourceFile = screen.getByText('source-file.txt').closest('.file-item');
        await user.click(sourceFile);

        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy \(1\)/i });
            expect(copyButton).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /copy \(1\)/i }));

        // Verify clipboard populated
        await waitFor(() => {
            expect(screen.getByText(/📋 Clipboard/i)).toBeInTheDocument();
        }, { timeout: 2000 });

        // Switch to fs-1 and paste the file
        await user.selectOptions(select, 'fs-1');
        await waitFor(() => expect(screen.getByText('original.txt')).toBeInTheDocument());

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /paste \(1\)/i })).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /paste \(1\)/i }));

        // Wait for paste operation to fully complete (activity log entry appears when done)
        await waitFor(() => {
            const fileList = document.querySelector('.file-list');
            expect(within(fileList).getByText('source-file.txt')).toBeInTheDocument();
            // Also verify the activity log shows the paste completed
            const activityLog = document.querySelector('.activity-log-content');
            expect(activityLog).toHaveTextContent(/PASTE/i);
        }, { timeout: 5000 });

        // fs-1 should now have both files
        {
            const fileList = document.querySelector('.file-list');
            expect(within(fileList).getByText('original.txt')).toBeInTheDocument();
            expect(within(fileList).getByText('source-file.txt')).toBeInTheDocument();
        }

        // Switch to fs-2
        await user.selectOptions(select, 'fs-2');
        await waitFor(() => {
            // fs-2 should still have its original file
            const fileList = document.querySelector('.file-list');
            expect(within(fileList).getByText('source-file.txt')).toBeInTheDocument();
        });

        // Switch back to fs-1 - pasted file should still be there
        await user.selectOptions(select, 'fs-1');
        await waitFor(() => {
            const fileList = document.querySelector('.file-list');
            expect(within(fileList).getByText('original.txt')).toBeInTheDocument();
            expect(within(fileList).getByText('source-file.txt')).toBeInTheDocument();
        });
    }, 20000);

    it('should persist file changes when disconnecting and reconnecting', async () => {
        const user = userEvent.setup({ delay: null });

        // Network with source file to copy
        const sourceNetwork = createNetworkWithFileSystem({
            networkId: 'source-net',
            networkName: 'Source Network',
            fileSystems: [{
                id: 'fs-source',
                ip: '10.0.0.1',
                name: 'source-server',
                files: [
                    { name: 'to-copy.txt', size: '5.0 KB', corrupted: false },
                ],
            }],
        });

        // Network where we'll paste
        const destNetwork = createNetworkWithFileSystem({
            networkId: 'dest-net',
            networkName: 'Dest Network',
            fileSystems: [{
                id: 'fs-dest',
                ip: '10.0.0.2',
                name: 'dest-server',
                files: [
                    { name: 'existing.txt', size: '3.0 KB', corrupted: false },
                ],
            }],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [sourceNetwork, destNetwork],
                activeConnections: [
                    { networkId: sourceNetwork.networkId, networkName: sourceNetwork.networkName },
                    { networkId: destNetwork.networkId, networkName: destNetwork.networkName },
                ],
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

        await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0), { timeout: 10000 });

        const fmSelect = screen.getAllByRole('combobox')[1]; // FileManager selector

        // Copy from source network
        await user.selectOptions(fmSelect, 'fs-source');
        await waitFor(() => expect(screen.getByText('to-copy.txt')).toBeInTheDocument());

        const sourceFile = screen.getByText('to-copy.txt').closest('.file-item');
        await user.click(sourceFile);

        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy \(1\)/i });
            expect(copyButton).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /copy \(1\)/i }));

        await waitFor(() => {
            expect(screen.getByText(/📋 Clipboard/i)).toBeInTheDocument();
        }, { timeout: 2000 });

        // Paste to dest network
        await user.selectOptions(fmSelect, 'fs-dest');
        await waitFor(() => expect(screen.getByText('existing.txt')).toBeInTheDocument());

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /paste \(1\)/i })).not.toBeDisabled();
        });

        await user.click(screen.getByRole('button', { name: /paste \(1\)/i }));

        // Wait for paste operation to fully complete (activity log entry appears when done)
        await waitFor(() => {
            const fileList = document.querySelector('.file-list');
            expect(within(fileList).getByText('to-copy.txt')).toBeInTheDocument();
            // Also verify the activity log shows the paste completed
            const activityLog = document.querySelector('.activity-log-content');
            expect(activityLog).toHaveTextContent(/PASTE/i);
        }, { timeout: 5000 });

        // Verify both files present in file list
        const fileList = document.querySelector('.file-list');
        expect(within(fileList).getByText('existing.txt')).toBeInTheDocument();
        expect(within(fileList).getByText('to-copy.txt')).toBeInTheDocument();

        // Disconnect from dest network
        const disconnectButtons = screen.getAllByRole('button', { name: /disconnect/i });
        // Click the disconnect for dest network (second one)
        await user.click(disconnectButtons[1]);

        await waitFor(() => {
            // Should only show source network's file system now
            // Either file list is empty or existing.txt is not visible
            const fileList = document.querySelector('.file-list');
            if (fileList) {
                expect(within(fileList).queryByText('existing.txt')).not.toBeInTheDocument();
            }
            // Also verify dest-net file system is not in dropdown
            const select = screen.getAllByRole('combobox')[1]; // FileManager selector
            expect(within(select).queryByText(/dest-server/i)).not.toBeInTheDocument();
        }, { timeout: 3000 });

        // Reconnect to dest network
        const vpnDropdown = screen.getAllByRole('combobox')[0];
        await user.selectOptions(vpnDropdown, 'dest-net');

        // Find the Connect button in the new-connection-section (not Disconnect)
        const connectSection = document.querySelector('.new-connection-section');
        const connectButton = within(connectSection).getByRole('button', { name: /connect/i });
        await user.click(connectButton);

        // Wait for connection
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /disconnect/i }).length).toBe(2);
        }, { timeout: 3000 });

        // Select dest file system again
        await user.selectOptions(fmSelect, 'fs-dest');

        // Pasted file should still be there (check file list specifically)
        await waitFor(() => {
            const fileList = document.querySelector('.file-list');
            expect(within(fileList).getByText('existing.txt')).toBeInTheDocument();
            expect(within(fileList).getByText('to-copy.txt')).toBeInTheDocument();
        }, { timeout: 3000 });
    }, 30000);

    it('should allow copy/paste between two File Manager instances on same network', async () => {
        const user = userEvent.setup({ delay: null });

        // Network with two file systems
        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems: [
                {
                    id: 'fs-source',
                    ip: '192.168.1.10',
                    name: 'source-server',
                    files: [
                        { name: 'file1.txt', size: '5.0 KB', corrupted: false },
                        { name: 'file2.txt', size: '3.0 KB', corrupted: false },
                    ],
                },
                {
                    id: 'fs-dest',
                    ip: '192.168.1.20',
                    name: 'dest-server',
                    files: [
                        { name: 'existing.txt', size: '1.0 KB', corrupted: false },
                    ],
                },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                software: ['mail', 'banking', 'portal', 'file-manager'],
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <Desktop />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('☰')).toBeInTheDocument(), { timeout: 10000 });

        // Open first File Manager instance
        const appLauncher = screen.getByText('☰');
        fireEvent.mouseEnter(appLauncher.parentElement);
        await waitFor(() => {
            const menuButtons = screen.getAllByText('File Manager');
            const menuButton = menuButtons.find(el => el.tagName === 'BUTTON');
            expect(menuButton).toBeInTheDocument();
        });
        const menuButtons1 = screen.getAllByText('File Manager');
        const fileManagerBtn1 = menuButtons1.find(el => el.tagName === 'BUTTON');
        fireEvent.click(fileManagerBtn1);

        await waitFor(() => {
            const windows = container.querySelectorAll('.window');
            expect(windows).toHaveLength(1);
        });

        // Open second File Manager instance
        fireEvent.mouseEnter(appLauncher.parentElement);
        await waitFor(() => {
            const menuButtons = screen.getAllByText('File Manager');
            const menuButton = menuButtons.find(el => el.tagName === 'BUTTON');
            expect(menuButton).toBeInTheDocument();
        });
        const menuButtons2 = screen.getAllByText('File Manager');
        const fileManagerBtn2 = menuButtons2.find(el => el.tagName === 'BUTTON');
        fireEvent.click(fileManagerBtn2);

        await waitFor(() => {
            const windows = container.querySelectorAll('.window');
            expect(windows).toHaveLength(2);
        });

        // Get the two windows
        const windows = container.querySelectorAll('.window');
        const firstFM = windows[0];
        const secondFM = windows[1];

        // In first instance, connect to source file system
        const firstSelect = firstFM.querySelector('select');
        await user.selectOptions(firstSelect, 'fs-source');

        await waitFor(() => {
            const firstFileList = firstFM.querySelector('.file-list');
            expect(firstFileList).toHaveTextContent('file1.txt');
        });

        // In second instance, connect to destination file system
        const secondSelect = secondFM.querySelector('select');
        await user.selectOptions(secondSelect, 'fs-dest');

        await waitFor(() => {
            const secondFileList = secondFM.querySelector('.file-list');
            expect(secondFileList).toHaveTextContent('existing.txt');
        });

        // In first instance, select and copy file1.txt
        const file1InFirst = Array.from(firstFM.querySelectorAll('.file-item'))
            .find(item => item.textContent.includes('file1.txt'));
        await user.click(file1InFirst);

        await waitFor(() => {
            expect(file1InFirst).toHaveClass('file-selected');
        });

        const copyBtnInFirst = Array.from(firstFM.querySelectorAll('button'))
            .find(btn => btn.textContent.includes('Copy'));
        await user.click(copyBtnInFirst);

        // Wait for clipboard to populate (check in first FileManager)
        await waitFor(() => {
            const clipboardPanel = firstFM.querySelector('.clipboard-panel');
            expect(clipboardPanel).toBeInTheDocument();
        }, { timeout: 2000 });

        // In second instance, paste the file
        const pasteBtnInSecond = Array.from(secondFM.querySelectorAll('button'))
            .find(btn => btn.textContent.includes('Paste'));
        await user.click(pasteBtnInSecond);

        // Wait for paste to complete
        await waitFor(() => {
            const secondFileList = secondFM.querySelector('.file-list');
            expect(secondFileList).toHaveTextContent('file1.txt');
            expect(secondFileList).toHaveTextContent('existing.txt');
        }, { timeout: 3000 });

        // Verify both files exist in destination
        const fileItemsInSecond = secondFM.querySelectorAll('.file-item');
        expect(fileItemsInSecond.length).toBe(2);
    }, 25000);

    it('should allow cross-network copy/paste between two File Manager instances', async () => {
        const user = userEvent.setup({ delay: null });

        // Two different networks
        const network1 = createNetworkWithFileSystem({
            networkId: 'network-a',
            networkName: 'Network A',
            bandwidth: 100,
            fileSystems: [{
                id: 'fs-a',
                ip: '10.0.1.10',
                name: 'server-a',
                files: [
                    { name: 'data-a.txt', size: '10.0 KB', corrupted: false },
                ],
            }],
        });

        const network2 = createNetworkWithFileSystem({
            networkId: 'network-b',
            networkName: 'Network B',
            bandwidth: 50,
            fileSystems: [{
                id: 'fs-b',
                ip: '10.0.2.10',
                name: 'server-b',
                files: [
                    { name: 'data-b.txt', size: '5.0 KB', corrupted: false },
                ],
            }],
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                software: ['mail', 'banking', 'portal', 'file-manager'],
                narEntries: [network1, network2],
                activeConnections: [
                    { networkId: network1.networkId, networkName: network1.networkName },
                    { networkId: network2.networkId, networkName: network2.networkName },
                ],
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        const { container } = render(
            <GameProvider>
                <GameLoader username="test_user" />
                <Desktop />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('☰')).toBeInTheDocument(), { timeout: 10000 });

        // Open two File Manager instances
        const appLauncher = screen.getByText('☰');

        fireEvent.mouseEnter(appLauncher.parentElement);
        await waitFor(() => {
            const menuButtons = screen.getAllByText('File Manager');
            const menuButton = menuButtons.find(el => el.tagName === 'BUTTON');
            expect(menuButton).toBeInTheDocument();
        });
        const menuButtons1 = screen.getAllByText('File Manager');
        const fileManagerBtn1 = menuButtons1.find(el => el.tagName === 'BUTTON');
        fireEvent.click(fileManagerBtn1);

        await waitFor(() => expect(container.querySelectorAll('.window')).toHaveLength(1));

        fireEvent.mouseEnter(appLauncher.parentElement);
        await waitFor(() => {
            const menuButtons = screen.getAllByText('File Manager');
            const menuButton = menuButtons.find(el => el.tagName === 'BUTTON');
            expect(menuButton).toBeInTheDocument();
        });
        const menuButtons2 = screen.getAllByText('File Manager');
        const fileManagerBtn2 = menuButtons2.find(el => el.tagName === 'BUTTON');
        fireEvent.click(fileManagerBtn2);

        await waitFor(() => expect(container.querySelectorAll('.window')).toHaveLength(2));

        const windows = container.querySelectorAll('.window');
        const firstFM = windows[0];
        const secondFM = windows[1];

        // First instance: connect to Network A
        const firstSelect = firstFM.querySelector('select');
        await user.selectOptions(firstSelect, 'fs-a');

        await waitFor(() => {
            expect(firstFM.querySelector('.file-list')).toHaveTextContent('data-a.txt');
        });

        // Second instance: connect to Network B
        const secondSelect = secondFM.querySelector('select');
        await user.selectOptions(secondSelect, 'fs-b');

        await waitFor(() => {
            expect(secondFM.querySelector('.file-list')).toHaveTextContent('data-b.txt');
        });

        // Copy from Network A
        const fileInFirst = Array.from(firstFM.querySelectorAll('.file-item'))
            .find(item => item.textContent.includes('data-a.txt'));
        await user.click(fileInFirst);

        const copyBtn = Array.from(firstFM.querySelectorAll('button'))
            .find(btn => btn.textContent.includes('Copy'));
        await user.click(copyBtn);

        await waitFor(() => {
            const clipboardPanel = firstFM.querySelector('.clipboard-panel');
            expect(clipboardPanel).toBeInTheDocument();
            expect(clipboardPanel).toHaveTextContent('Network A');
        }, { timeout: 2000 });

        // Paste to Network B (cross-network)
        const pasteBtn = Array.from(secondFM.querySelectorAll('button'))
            .find(btn => btn.textContent.includes('Paste'));
        await user.click(pasteBtn);

        // Wait for paste to complete - should show cross-network indicator
        await waitFor(() => {
            const secondFileList = secondFM.querySelector('.file-list');
            expect(secondFileList).toHaveTextContent('data-a.txt');
            expect(secondFileList).toHaveTextContent('data-b.txt');
        }, { timeout: 3000 });

        // Verify cross-network paste completed
        const fileItemsInSecond = secondFM.querySelectorAll('.file-item');
        expect(fileItemsInSecond.length).toBe(2);
    }, 25000);
});
