import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider } from '../../contexts/GameContext';
import FileManager from '../../components/apps/FileManager';
import networkRegistry from '../../systems/NetworkRegistry';
import {
    createCompleteSaveState,
    setSaveInLocalStorage,
    createNetworkWithFileSystem,
    populateNetworkRegistry,
} from '../helpers/testData';
import { GameLoader } from '../helpers/integrationHelpers';

describe('File Manager - File Operations', () => {
    beforeEach(() => {
        localStorage.clear();
        networkRegistry.reset();
    });

    it('should allow file selection by clicking', async () => {
        const user = userEvent.setup({ delay: null });

        const fileSystems = [{
            id: 'fs-001',
            ip: '192.168.1.10',
            name: 'server-01',
            files: [
                { name: 'file1.txt', size: '1.0 KB', corrupted: false },
                { name: 'file2.txt', size: '2.0 KB', corrupted: false },
                { name: 'file3.txt', size: '3.0 KB', corrupted: true },
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

        const fileSystems = [{
            id: 'fs-001',
            ip: '192.168.1.10',
            name: 'server-01',
            files: [
                { name: 'doc1.txt', size: '5.0 KB', corrupted: false },
                { name: 'doc2.txt', size: '10.0 KB', corrupted: false },
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

        const fileSystems = [{
            id: 'fs-001',
            ip: '192.168.1.10',
            name: 'server-01',
            files: [
                { name: 'old1.txt', size: '1.0 KB', corrupted: false },
                { name: 'old2.txt', size: '1.5 KB', corrupted: false },
                { name: 'keep.txt', size: '2.0 KB', corrupted: false },
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

        const fileSystems = [{
            id: 'fs-001',
            ip: '192.168.1.10',
            name: 'server-01',
            files: [
                { name: 'source.txt', size: '5.0 KB', corrupted: false },
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

        const fileSystems = [
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
});
