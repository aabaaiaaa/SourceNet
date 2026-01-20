import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import SNetMail from '../../components/apps/SNetMail';
import networkRegistry from '../../systems/NetworkRegistry';
import {
    createMessageWithNetworkAddress,
    createCompleteSaveState,
    createNetworkWithFileSystem,
    populateNetworkRegistry,
    setSaveInLocalStorage,
} from '../helpers/testData';

// Helper component to load game state on mount
const GameLoader = ({ username }) => {
    const { loadGame } = useGame();

    useEffect(() => {
        loadGame(username);
    }, [loadGame, username]);

    return null;
};

// Helper component to expose game state for assertions
const StateInspector = ({ stateRef }) => {
    const game = useGame();
    stateRef.current = game;
    return null;
};

describe('NAR Attachment One-Time Use', () => {
    beforeEach(() => {
        localStorage.clear();
        networkRegistry.reset();
    });

    it('should mark attachment as activated after first use', async () => {
        const user = userEvent.setup();

        const message = createMessageWithNetworkAddress({
            id: 'msg-network-1',
            from: 'Admin <admin@corp.local>',
            subject: 'Network Credentials',
            body: 'Network access attached.',
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
        });

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
            ],
            narEntries: [],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('Network Credentials')).toBeInTheDocument());
        await user.click(screen.getByText('Network Credentials'));

        // Click the attachment to add to NAR
        const attachment = screen.getByTestId('network-attachment-corp-net-1');
        await waitFor(() => expect(attachment).toBeInTheDocument());
        expect(screen.getByText('Click to add to Network Address Register')).toBeInTheDocument();

        await user.click(attachment);

        // Verify status changed to "used"
        await waitFor(() => {
            expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
        });
    });

    it('should prevent clicking same attachment twice', async () => {
        const user = userEvent.setup();

        const message = createMessageWithNetworkAddress({
            id: 'msg-network-1',
            from: 'Admin <admin@corp.local>',
            subject: 'Network Credentials',
            body: 'Network access attached.',
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
        });

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
            ],
            narEntries: [],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('Network Credentials')).toBeInTheDocument());
        await user.click(screen.getByText('Network Credentials'));

        const attachment = screen.getByTestId('network-attachment-corp-net-1');
        await user.click(attachment);

        await waitFor(() => {
            expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
        });

        // Try clicking again - should have no effect
        await user.click(attachment);

        // Still shows as used, no duplicate entry created
        expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
    });

    it('should allow fresh attachment to re-authorize revoked network', async () => {
        const user = userEvent.setup();

        // Populate NetworkRegistry with revoked network (must include revokedReason)
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
            accessible: false, // Revoked
            revokedReason: 'Network access revoked by mission',
            fileSystems: [],
        });

        const oldMessage = createMessageWithNetworkAddress({
            id: 'msg-old',
            from: 'Admin <admin@corp.local>',
            subject: 'Old Credentials',
            body: 'Old network access.',
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
        });

        const newMessage = createMessageWithNetworkAddress({
            id: 'msg-new',
            from: 'Admin <admin@corp.local>',
            subject: 'Updated Credentials',
            body: 'New network access.',
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
        });

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [oldMessage, newMessage],
            software: [
                { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
            ],
            narEntries: [
                {
                    networkId: 'corp-net-1',
                    networkName: 'Corp Network',
                    address: '10.0.0.0/24',
                    authorized: false,
                    revokedReason: 'Network access revoked by mission',
                    fileSystems: [],
                },
            ],
            overrides: {
                networkRegistry: registrySnapshot,
            },
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('Updated Credentials')).toBeInTheDocument());
        await user.click(screen.getByText('Updated Credentials'));

        // Fresh attachment should be clickable even though network is revoked
        const newAttachment = screen.getByTestId('network-attachment-corp-net-1');
        await waitFor(() => {
            expect(screen.getByText('Click to add updated network credentials to NAR')).toBeInTheDocument();
        });

        await user.click(newAttachment);

        // Should now show as used
        await waitFor(() => {
            expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
        });
    });

    it('should NOT allow already-used attachment to re-authorize revoked network', async () => {
        const user = userEvent.setup();
        const stateRef = { current: null };

        const message = createMessageWithNetworkAddress({
            id: 'msg-old',
            from: 'Admin <admin@corp.local>',
            subject: 'Old Credentials',
            body: 'Old network access.',
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
            activated: true, // Already used
            fileSystems: [
                { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver', accessible: true },
            ],
        });

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
            ],
            narEntries: [
                {
                    networkId: 'corp-net-1',
                    networkName: 'Corp Network',
                    address: '10.0.0.0/24',
                    authorized: false,
                    revokedReason: 'Network access revoked by mission',
                    fileSystems: [
                        { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver', files: [], accessible: false },
                    ],
                },
            ],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <StateInspector stateRef={stateRef} />
                <GameLoader username="testuser" />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('Old Credentials')).toBeInTheDocument());
        await user.click(screen.getByText('Old Credentials'));

        // Already-used attachment should show as used, not clickable
        await waitFor(() => {
            expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
        });

        const attachment = screen.getByTestId('network-attachment-corp-net-1');

        // Try clicking - should have no effect since already activated
        await user.click(attachment);

        // Network should still be revoked, attachment still shows as used
        expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();

        // Verify NAR entry state - should remain unauthorized
        const narEntry = stateRef.current.narEntries.find(e => e.networkId === 'corp-net-1');
        expect(narEntry.authorized).toBe(false);
    });

    it('should show merge option for fresh attachment on already-authorized network', async () => {
        const user = userEvent.setup();

        // Populate NetworkRegistry with authorized network
        const registrySnapshot = populateNetworkRegistry({
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
            accessible: true, // Already authorized
            fileSystems: [
                { id: 'fs-corp-01', ip: '10.0.0.10', name: 'fileserver', files: [], accessible: true },
            ],
        });

        const message = createMessageWithNetworkAddress({
            id: 'msg-1',
            from: 'Admin <admin@corp.local>',
            subject: 'Network Credentials',
            body: 'Network access attached.',
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
        });

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
            ],
            narEntries: [
                {
                    networkId: 'corp-net-1',
                    networkName: 'Corp Network',
                    address: '10.0.0.0/24',
                    authorized: true,
                    fileSystems: [{ id: 'fs-corp-01', ip: '10.0.0.10', name: 'fileserver', files: [], accessible: true }],
                },
            ],
            overrides: {
                networkRegistry: registrySnapshot,
            },
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => expect(screen.getByText('Network Credentials')).toBeInTheDocument());
        await user.click(screen.getByText('Network Credentials'));

        // Fresh attachment on authorized network - should allow merging
        await waitFor(() => {
            expect(screen.getByText('Click to add updated network credentials to NAR')).toBeInTheDocument();
        });
    });

    describe('Device Accessibility', () => {
        it('should mark all devices as accessible: true when NAR entry first added', async () => {
            const user = userEvent.setup();
            const stateRef = { current: null };

            // Populate NetworkRegistry with file system data before loading game
            const registrySnapshot = populateNetworkRegistry({
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: true },
                    { id: 'fs-002', ip: '10.0.0.11', name: 'fileserver-2', files: [], accessible: true },
                ],
            });

            const message = createMessageWithNetworkAddress({
                id: 'msg-network-1',
                from: 'Admin <admin@corp.local>',
                subject: 'Network Credentials',
                body: 'Network access attached.',
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                address: '10.0.0.0/24',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: true },
                    { id: 'fs-002', ip: '10.0.0.11', name: 'fileserver-2', files: [], accessible: true },
                ],
            });

            const saveState = createCompleteSaveState({
                username: 'testuser',
                messages: [message],
                software: [
                    { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
                ],
                narEntries: [],
                overrides: {
                    networkRegistry: registrySnapshot,
                },
            });

            setSaveInLocalStorage('testuser', saveState);

            render(
                <GameProvider>
                    <StateInspector stateRef={stateRef} />
                    <GameLoader username="testuser" />
                    <SNetMail />
                </GameProvider>
            );

            await waitFor(() => expect(screen.getByText('Network Credentials')).toBeInTheDocument());
            await user.click(screen.getByText('Network Credentials'));

            const attachment = screen.getByTestId('network-attachment-corp-net-1');
            await user.click(attachment);

            await waitFor(() => {
                expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
            });

            // Verify all devices are accessible via NetworkRegistry
            const narEntry = stateRef.current.narEntries.find(e => e.networkId === 'corp-net-1');
            expect(narEntry).toBeDefined();
            expect(narEntry.authorized).toBe(true);

            const devices = networkRegistry.getNetworkDevices('corp-net-1');
            expect(devices).toHaveLength(2);
            expect(networkRegistry.getDevice('10.0.0.10').accessible).toBe(true);
            expect(networkRegistry.getDevice('10.0.0.11').accessible).toBe(true);
        });

        it('should merge new devices into authorized NAR entry', async () => {
            const user = userEvent.setup();
            const stateRef = { current: null };

            // Populate NetworkRegistry with existing device and new device
            const registrySnapshot = populateNetworkRegistry({
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: true },
                    { id: 'fs-002', ip: '10.0.0.11', name: 'fileserver-2', files: [], accessible: true },
                ],
            });

            // Fresh attachment with device-B (device-A already in NAR)
            const message = createMessageWithNetworkAddress({
                id: 'msg-network-1',
                from: 'Admin <admin@corp.local>',
                subject: 'Updated Network Credentials',
                body: 'Additional access granted.',
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                address: '10.0.0.0/24',
                fileSystems: [
                    { id: 'fs-002', ip: '10.0.0.11', name: 'fileserver-2', files: [], accessible: true },
                ],
            });

            const saveState = createCompleteSaveState({
                username: 'testuser',
                messages: [message],
                software: [
                    { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
                ],
                narEntries: [
                    createNetworkWithFileSystem({
                        networkId: 'corp-net-1',
                        networkName: 'Corp Network',
                        address: '10.0.0.0/24',
                        authorized: true,
                        fileSystems: [
                            { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: true },
                        ],
                    }),
                ],
                overrides: {
                    networkRegistry: registrySnapshot,
                },
            });

            setSaveInLocalStorage('testuser', saveState);

            render(
                <GameProvider>
                    <StateInspector stateRef={stateRef} />
                    <GameLoader username="testuser" />
                    <SNetMail />
                </GameProvider>
            );

            await waitFor(() => expect(screen.getByText('Updated Network Credentials')).toBeInTheDocument());
            await user.click(screen.getByText('Updated Network Credentials'));

            // Should show option to merge (not "Already in NAR" which blocks clicking)
            const attachment = screen.getByTestId('network-attachment-corp-net-1');
            await waitFor(() => {
                expect(screen.getByText('Click to add updated network credentials to NAR')).toBeInTheDocument();
            });

            await user.click(attachment);

            await waitFor(() => {
                expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
            });

            // Verify attachment is marked as activated in the message state (critical for persistence)
            const updatedMessage = stateRef.current.messages.find(m => m.id === 'msg-network-1');
            const networkAttachment = updatedMessage.attachments.find(a => a.type === 'networkAddress');
            expect(networkAttachment.activated).toBe(true);

            // Verify both devices are now in NAR and accessible via NetworkRegistry
            const narEntry = stateRef.current.narEntries.find(e => e.networkId === 'corp-net-1');
            expect(narEntry).toBeDefined();
            expect(narEntry.authorized).toBe(true);
            expect(narEntry.deviceAccess).toHaveLength(2);

            const device1 = networkRegistry.getDevice('10.0.0.10');
            const device2 = networkRegistry.getDevice('10.0.0.11');
            expect(device1).toBeDefined();
            expect(device2).toBeDefined();
            expect(device1.accessible).toBe(true);
            expect(device2.accessible).toBe(true);
        });

        it('should re-enable revoked NAR with same devices', async () => {
            const user = userEvent.setup();
            const stateRef = { current: null };

            // Populate NetworkRegistry with device (initially revoked, will be restored)
            const registrySnapshot = populateNetworkRegistry({
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                revokedReason: 'Mission completed',  // Must include revokedReason to show 'updated credentials'
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: false },
                ],
            });

            // Fresh attachment with same device that was revoked
            const message = createMessageWithNetworkAddress({
                id: 'msg-new',
                from: 'Admin <admin@corp.local>',
                subject: 'Restored Network Credentials',
                body: 'Access restored.',
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                address: '10.0.0.0/24',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: true },
                ],
            });

            const saveState = createCompleteSaveState({
                username: 'testuser',
                messages: [message],
                software: [
                    { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
                ],
                narEntries: [
                    {
                        id: 'nar-corp-net-1',
                        networkId: 'corp-net-1',
                        networkName: 'Corp Network',
                        address: '10.0.0.0/24',
                        authorized: false,
                        revokedReason: 'Mission completed',
                        deviceAccess: ['10.0.0.10'],
                    },
                ],
                overrides: {
                    networkRegistry: registrySnapshot,
                },
            });

            setSaveInLocalStorage('testuser', saveState);

            render(
                <GameProvider>
                    <StateInspector stateRef={stateRef} />
                    <GameLoader username="testuser" />
                    <SNetMail />
                </GameProvider>
            );

            await waitFor(() => expect(screen.getByText('Restored Network Credentials')).toBeInTheDocument());
            await user.click(screen.getByText('Restored Network Credentials'));

            const attachment = screen.getByTestId('network-attachment-corp-net-1');
            await waitFor(() => {
                expect(screen.getByText('Click to add updated network credentials to NAR')).toBeInTheDocument();
            });

            await user.click(attachment);

            await waitFor(() => {
                expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
            });

            // Verify NAR is re-authorized and device is accessible via NetworkRegistry
            const narEntry = stateRef.current.narEntries.find(e => e.networkId === 'corp-net-1');
            expect(narEntry.authorized).toBe(true);
            expect(narEntry.revokedReason).toBeUndefined();
            expect(networkRegistry.getDevice('10.0.0.10').accessible).toBe(true);
        });

        it('should re-enable revoked NAR with fewer devices - old devices remain inaccessible', async () => {
            const user = userEvent.setup();
            const stateRef = { current: null };

            // Populate NetworkRegistry with both devices (both initially inaccessible)
            const registrySnapshot = populateNetworkRegistry({
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [{ name: 'old-file.txt' }], accessible: false },
                    { id: 'fs-002', ip: '10.0.0.11', name: 'fileserver-2', files: [{ name: 'secret.dat' }], accessible: false },
                ],
            });

            // Fresh attachment with only device-A (device-B was also previously accessible)
            const message = createMessageWithNetworkAddress({
                id: 'msg-new',
                from: 'Admin <admin@corp.local>',
                subject: 'Limited Network Credentials',
                body: 'Partial access restored.',
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                address: '10.0.0.0/24',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: true },
                ],
            });

            const saveState = createCompleteSaveState({
                username: 'testuser',
                messages: [message],
                software: [
                    { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
                ],
                narEntries: [
                    {
                        id: 'nar-corp-net-1',
                        networkId: 'corp-net-1',
                        networkName: 'Corp Network',
                        address: '10.0.0.0/24',
                        authorized: false,
                        revokedReason: 'Mission completed',
                        deviceAccess: ['10.0.0.10', '10.0.0.11'],
                    },
                ],
                overrides: {
                    networkRegistry: registrySnapshot,
                },
            });

            setSaveInLocalStorage('testuser', saveState);

            render(
                <GameProvider>
                    <StateInspector stateRef={stateRef} />
                    <GameLoader username="testuser" />
                    <SNetMail />
                </GameProvider>
            );

            await waitFor(() => expect(screen.getByText('Limited Network Credentials')).toBeInTheDocument());
            await user.click(screen.getByText('Limited Network Credentials'));

            const attachment = screen.getByTestId('network-attachment-corp-net-1');
            await user.click(attachment);

            await waitFor(() => {
                expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
            });

            // Verify NAR is re-authorized
            const narEntry = stateRef.current.narEntries.find(e => e.networkId === 'corp-net-1');
            expect(narEntry.authorized).toBe(true);

            // Device-A should be accessible, device-B should remain inaccessible via NetworkRegistry
            expect(networkRegistry.getDevice('10.0.0.10').accessible).toBe(true);
            expect(networkRegistry.getDevice('10.0.0.11').accessible).toBe(false);

            // Files on both devices should still be preserved in NetworkRegistry
            const fs1 = networkRegistry.getFileSystem('fs-001');
            const fs2 = networkRegistry.getFileSystem('fs-002');
            expect(fs1.files).toHaveLength(1);
            expect(fs2.files).toHaveLength(1);
        });

        it('should re-enable revoked NAR with additional devices', async () => {
            const user = userEvent.setup();
            const stateRef = { current: null };

            // Populate NetworkRegistry with both devices
            const registrySnapshot = populateNetworkRegistry({
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: false },
                    { id: 'fs-002', ip: '10.0.0.11', name: 'fileserver-2', files: [], accessible: true },
                ],
            });

            // Fresh attachment with device-A and new device-B
            const message = createMessageWithNetworkAddress({
                id: 'msg-new',
                from: 'Admin <admin@corp.local>',
                subject: 'Expanded Network Credentials',
                body: 'Extended access granted.',
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                address: '10.0.0.0/24',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [], accessible: true },
                    { id: 'fs-002', ip: '10.0.0.11', name: 'fileserver-2', files: [], accessible: true },
                ],
            });

            const saveState = createCompleteSaveState({
                username: 'testuser',
                messages: [message],
                software: [
                    { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
                ],
                narEntries: [
                    {
                        id: 'nar-corp-net-1',
                        networkId: 'corp-net-1',
                        networkName: 'Corp Network',
                        address: '10.0.0.0/24',
                        authorized: false,
                        revokedReason: 'Mission completed',
                        deviceAccess: ['10.0.0.10'],
                    },
                ],
                overrides: {
                    networkRegistry: registrySnapshot,
                },
            });

            setSaveInLocalStorage('testuser', saveState);

            render(
                <GameProvider>
                    <StateInspector stateRef={stateRef} />
                    <GameLoader username="testuser" />
                    <SNetMail />
                </GameProvider>
            );

            await waitFor(() => expect(screen.getByText('Expanded Network Credentials')).toBeInTheDocument());
            await user.click(screen.getByText('Expanded Network Credentials'));

            const attachment = screen.getByTestId('network-attachment-corp-net-1');
            await user.click(attachment);

            await waitFor(() => {
                expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
            });

            // Verify NAR is re-authorized with both devices accessible via NetworkRegistry
            const narEntry = stateRef.current.narEntries.find(e => e.networkId === 'corp-net-1');
            expect(narEntry.authorized).toBe(true);
            expect(narEntry.deviceAccess).toHaveLength(2);

            expect(networkRegistry.getDevice('10.0.0.10').accessible).toBe(true);
            expect(networkRegistry.getDevice('10.0.0.11').accessible).toBe(true);
        });

        it('should merge files when re-enabling with same device', async () => {
            const user = userEvent.setup();
            const stateRef = { current: null };

            // Populate NetworkRegistry with device containing existing files
            const registrySnapshot = populateNetworkRegistry({
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [{ name: 'file1.txt' }, { name: 'file2.txt' }], accessible: false },
                ],
            });

            // Fresh attachment with device containing new files
            const message = createMessageWithNetworkAddress({
                id: 'msg-new',
                from: 'Admin <admin@corp.local>',
                subject: 'Updated Network Credentials',
                body: 'Access with updated files.',
                networkId: 'corp-net-1',
                networkName: 'Corp Network',
                address: '10.0.0.0/24',
                fileSystems: [
                    { id: 'fs-001', ip: '10.0.0.10', name: 'fileserver-1', files: [{ name: 'file2.txt' }, { name: 'file3.txt' }], accessible: true },
                ],
            });

            const saveState = createCompleteSaveState({
                username: 'testuser',
                messages: [message],
                software: [
                    { id: 'network-address-register', type: 'utility', name: 'NAR', size: 50 },
                ],
                narEntries: [
                    {
                        id: 'nar-corp-net-1',
                        networkId: 'corp-net-1',
                        networkName: 'Corp Network',
                        address: '10.0.0.0/24',
                        authorized: false,
                        revokedReason: 'Mission completed',
                        deviceAccess: ['10.0.0.10'],
                    },
                ],
                overrides: {
                    networkRegistry: registrySnapshot,
                },
            });

            setSaveInLocalStorage('testuser', saveState);

            render(
                <GameProvider>
                    <StateInspector stateRef={stateRef} />
                    <GameLoader username="testuser" />
                    <SNetMail />
                </GameProvider>
            );

            await waitFor(() => expect(screen.getByText('Updated Network Credentials')).toBeInTheDocument());
            await user.click(screen.getByText('Updated Network Credentials'));

            const attachment = screen.getByTestId('network-attachment-corp-net-1');
            await user.click(attachment);

            await waitFor(() => {
                expect(screen.getByText('✓ Network credentials used')).toBeInTheDocument();
            });

            // Verify files are merged (file1.txt from old, file2.txt common, file3.txt from new) via NetworkRegistry
            const fs = networkRegistry.getFileSystem('fs-001');
            const device = networkRegistry.getDevice('10.0.0.10');

            expect(device.accessible).toBe(true);
            expect(fs.files.length).toBeGreaterThanOrEqual(3);

            const fileNames = fs.files.map(f => f.name);
            expect(fileNames).toContain('file1.txt');
            expect(fileNames).toContain('file2.txt');
            expect(fileNames).toContain('file3.txt');
        });
    });
});
