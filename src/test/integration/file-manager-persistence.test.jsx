import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider } from '../../contexts/GameContext';
import FileManager from '../../components/apps/FileManager';
import VPNClient from '../../components/apps/VPNClient';
import TopBar from '../../components/ui/TopBar';
import Desktop from '../../components/ui/Desktop';
import networkRegistry from '../../systems/NetworkRegistry';
import {
    createCompleteSaveState,
    setSaveInLocalStorage,
    createNetworkWithFileSystem,
    populateNetworkRegistry,
} from '../helpers/testData';
import { GameLoader } from '../helpers/integrationHelpers';

describe('File Manager - Persistence & Multi-Instance', () => {
    beforeEach(() => {
        localStorage.clear();
        networkRegistry.reset();
    });

    it('should clear clipboard when disconnecting from source network', async () => {
        const user = userEvent.setup({ delay: null });

        const fileSystems = [{
            id: 'fs-001',
            ip: '192.168.1.10',
            name: 'server-01',
            files: [
                { name: 'data.txt', size: '3.0 KB', corrupted: false },
            ],
        }];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems,
        });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems,
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
                discoveredDevices: {
                    'test-net': ['192.168.1.10'],
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

        await waitFor(() => expect(screen.getByText('File Manager')).toBeInTheDocument(), { timeout: 10000 });

        // Select file system and copy a file (use specific container since VPN dropdown is hidden when connected)
        const fmContainer = document.querySelector('.file-manager');
        const fmSelect = within(fmContainer).getByRole('combobox');
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

        // FileManager should still show Local SSD available after VPN disconnect
        const fmContainerAfterDisconnect = document.querySelector('.file-manager');
        expect(within(fmContainerAfterDisconnect).getByText(/Local SSD/i)).toBeInTheDocument();

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
        const fileSystems = [
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
        ];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems,
        });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems,
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
                discoveredDevices: {
                    'test-net': ['192.168.1.10', '192.168.1.20'],
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

        // Wait for state to propagate to GameContext
        await new Promise(resolve => setTimeout(resolve, 500));

        // Switch to fs-2
        await user.selectOptions(select, 'fs-2');
        await waitFor(() => {
            // fs-2 should still have its original file
            const fileList = document.querySelector('.file-list');
            expect(within(fileList).getByText('source-file.txt')).toBeInTheDocument();
        });

        // Wait before switching back
        await new Promise(resolve => setTimeout(resolve, 500));

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
        const sourceFileSystems = [{
            id: 'fs-source',
            ip: '10.0.0.1',
            name: 'source-server',
            files: [
                { name: 'to-copy.txt', size: '5.0 KB', corrupted: false },
            ],
        }];

        populateNetworkRegistry({
            networkId: 'source-net',
            networkName: 'Source Network',
            fileSystems: sourceFileSystems,
        });

        const sourceNetwork = createNetworkWithFileSystem({
            networkId: 'source-net',
            networkName: 'Source Network',
            fileSystems: sourceFileSystems,
        });

        // Network where we'll paste
        const destFileSystems = [{
            id: 'fs-dest',
            ip: '10.0.0.2',
            name: 'dest-server',
            files: [
                { name: 'existing.txt', size: '3.0 KB', corrupted: false },
            ],
        }];

        // Capture snapshot after populating both networks
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'dest-net',
            networkName: 'Dest Network',
            fileSystems: destFileSystems,
        });

        const destNetwork = createNetworkWithFileSystem({
            networkId: 'dest-net',
            networkName: 'Dest Network',
            fileSystems: destFileSystems,
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                narEntries: [sourceNetwork, destNetwork],
                activeConnections: [
                    { networkId: sourceNetwork.networkId, networkName: sourceNetwork.networkName },
                    { networkId: destNetwork.networkId, networkName: destNetwork.networkName },
                ],
                discoveredDevices: {
                    'source-net': ['10.0.0.1'],
                    'dest-net': ['10.0.0.2'],
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

        await waitFor(() => expect(screen.getByText('File Manager')).toBeInTheDocument(), { timeout: 10000 });

        // Use specific container since VPN dropdown is hidden when all networks are connected
        const fmContainer = document.querySelector('.file-manager');
        const fmSelect = within(fmContainer).getByRole('combobox');

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

        // Wait for state to propagate
        await new Promise(resolve => setTimeout(resolve, 500));

        // Disconnect from dest network
        const disconnectButtons = screen.getAllByRole('button', { name: /disconnect/i });
        // Click the disconnect for dest network (second one)
        await user.click(disconnectButtons[1]);

        await waitFor(() => {
            // Should only show source network's file system now
            // Re-query FileManager select to get fresh reference after state change
            const fmContainer = document.querySelector('.file-manager');
            const select = within(fmContainer).getByRole('combobox');
            expect(within(select).queryByText(/dest-server/i)).not.toBeInTheDocument();
        }, { timeout: 3000 });

        // Reconnect to dest network
        const vpnContainer = document.querySelector('.vpn-client');
        const vpnDropdown = within(vpnContainer).getByRole('combobox');
        await user.selectOptions(vpnDropdown, 'dest-net');

        // Find the Connect button in the new-connection-section (not Disconnect)
        const connectSection = document.querySelector('.new-connection-section');
        const connectButton = within(connectSection).getByRole('button', { name: /connect/i });
        await user.click(connectButton);

        // Wait for connection
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /disconnect/i }).length).toBe(2);
        }, { timeout: 3000 });

        // Wait for state to propagate
        await new Promise(resolve => setTimeout(resolve, 500));

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
        const fileSystems = [
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
        ];

        const registrySnapshot = populateNetworkRegistry({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems,
        });

        const network = createNetworkWithFileSystem({
            networkId: 'test-net',
            networkName: 'Test Network',
            fileSystems,
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            overrides: {
                software: ['mail', 'banking', 'portal', 'file-manager'],
                narEntries: [network],
                activeConnections: [{ networkId: network.networkId, networkName: network.networkName }],
                discoveredDevices: {
                    'test-net': ['192.168.1.10', '192.168.1.20'],
                },
                networkRegistry: registrySnapshot,
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
        const fileSystems1 = [{
            id: 'fs-a',
            ip: '10.0.1.10',
            name: 'server-a',
            files: [
                { name: 'data-a.txt', size: '10.0 KB', corrupted: false },
            ],
        }];

        populateNetworkRegistry({
            networkId: 'network-a',
            networkName: 'Network A',
            fileSystems: fileSystems1,
        });

        const network1 = createNetworkWithFileSystem({
            networkId: 'network-a',
            networkName: 'Network A',
            bandwidth: 100,
            fileSystems: fileSystems1,
        });

        const fileSystems2 = [{
            id: 'fs-b',
            ip: '10.0.2.10',
            name: 'server-b',
            files: [
                { name: 'data-b.txt', size: '5.0 KB', corrupted: false },
            ],
        }];

        // Capture snapshot after populating both networks
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'network-b',
            networkName: 'Network B',
            fileSystems: fileSystems2,
        });

        const network2 = createNetworkWithFileSystem({
            networkId: 'network-b',
            networkName: 'Network B',
            bandwidth: 50,
            fileSystems: fileSystems2,
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
                discoveredDevices: {
                    'network-a': ['10.0.1.10'],
                    'network-b': ['10.0.2.10'],
                },
                networkRegistry: registrySnapshot,
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

    it('should load discovered devices from saved game state', async () => {
        const user = userEvent.setup({ delay: null });

        // Create network with file systems
        const fileSystems = [
            {
                id: 'fs-001',
                ip: '192.168.50.10',
                name: 'fileserver-01',
                files: [
                    { name: 'document.txt', size: '5 KB', corrupted: false },
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
                // Simulate previously discovered devices (as arrays for save format)
                discoveredDevices: {
                    'corp-net-1': ['192.168.50.10', '192.168.50.20']
                },
                networkRegistry: registrySnapshot,
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

        // Wait for game to load
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/credits/);
        });

        // File systems should be immediately available (no scan needed)
        await waitFor(() => {
            const select = screen.getAllByRole('combobox').find(s =>
                s.textContent.includes('192.168.50.10')
            );
            expect(select).toBeDefined();
            expect(select.textContent).toContain('192.168.50.10 - fileserver-01');
            expect(select.textContent).toContain('192.168.50.20 - backup-server');
        });

        // Select first file system
        const select = screen.getAllByRole('combobox').find(s =>
            s.textContent.includes('192.168.50.10')
        );
        await user.selectOptions(select, 'fs-001');

        // Verify files are accessible
        await waitFor(() => {
            expect(screen.getByText('document.txt')).toBeInTheDocument();
            expect(screen.getByText('5 KB')).toBeInTheDocument();
        });

        // Switch to second filesystem
        await user.selectOptions(select, 'fs-002');

        await waitFor(() => {
            expect(screen.getByText('backup.zip')).toBeInTheDocument();
            expect(screen.getByText('100 MB')).toBeInTheDocument();
        });
    }, 15000);
});
