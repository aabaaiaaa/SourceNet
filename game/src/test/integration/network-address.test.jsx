import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameProvider, useGame } from '../../contexts/GameContext';
import SNetMail from '../../components/apps/SNetMail';
import TopBar from '../../components/ui/TopBar';
import {
    createMessageWithNetworkAddress,
    createCompleteSaveState,
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

describe('Network Address Integration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should display network address attachment correctly', async () => {
        const user = userEvent.setup();

        const message = createMessageWithNetworkAddress({
            id: 'msg-network-1',
            from: 'Network Admin <admin@corp.local>',
            subject: 'Network Access Credentials',
            body: 'Please find attached your network access credentials.',
            networkId: 'corp-network-1',
            networkName: 'Corporate Network Alpha',
            address: '10.50.0.0/16',
        });

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'osnet', type: 'os' },
                { id: 'portal', type: 'system' },
                { id: 'mail', type: 'system' },
                { id: 'banking', type: 'system' },
                { id: 'network-address-register', type: 'utility', name: 'Network Address Register', size: 50 },
            ],
            narEntries: [],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <TopBar />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
        });

        await user.click(screen.getByText('Network Access Credentials'));

        await waitFor(() => {
            expect(screen.getByText(/Network Credentials: Corporate Network Alpha/i)).toBeInTheDocument();
            expect(screen.getByText(/Click to add to Network Address Register/i)).toBeInTheDocument();
            expect(screen.getByTestId('network-attachment-corp-network-1')).toBeInTheDocument();
        });
    });

    it('should show installation requirement when NAR is not installed', async () => {
        const user = userEvent.setup();

        const message = createMessageWithNetworkAddress({
            id: 'msg-network-2',
            from: 'Network Admin <admin@corp.local>',
            subject: 'Network Access Credentials',
            body: 'Please find attached your network access credentials.',
            networkId: 'corp-network-2',
            networkName: 'Corporate Network Beta',
            address: '10.60.0.0/16',
        });

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'osnet', type: 'os' },
                { id: 'portal', type: 'system' },
                { id: 'mail', type: 'system' },
                { id: 'banking', type: 'system' },
                // NAR NOT installed
            ],
            narEntries: [],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <TopBar />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
        });

        await user.click(screen.getByText('Network Access Credentials'));

        await waitFor(() => {
            expect(screen.getByText(/Network Credentials: Corporate Network Beta/i)).toBeInTheDocument();
        });

        // Should show installation requirement message
        expect(screen.getByText(/Install Network Address Register to use this attachment/i)).toBeInTheDocument();
        expect(screen.queryByText(/✓ Added to NAR/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Click to add/i)).not.toBeInTheDocument();
    });

    it('should display existing NAR entries as already added', async () => {
        const user = userEvent.setup();

        const message = createMessageWithNetworkAddress({
            id: 'msg-network-3',
            from: 'Network Admin <admin@corp.local>',
            subject: 'Network Access Reminder',
            body: 'Reminder: Your network access credentials.',
            networkId: 'corp-network-3',
            networkName: 'Corporate Network Gamma',
            address: '10.70.0.0/16',
        });

        const existingNarEntry = {
            id: 'nar-existing-1',
            networkId: 'corp-network-3',
            networkName: 'Corporate Network Gamma',
            address: '10.70.0.0/16',
            status: 'active',
            dateAdded: '2020-03-25T08:00:00.000Z',
        };

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'osnet', type: 'os' },
                { id: 'portal', type: 'system' },
                { id: 'mail', type: 'system' },
                { id: 'banking', type: 'system' },
                { id: 'network-address-register', type: 'utility', name: 'Network Address Register', size: 50 },
            ],
            narEntries: [existingNarEntry],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <TopBar />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
        });

        await user.click(screen.getByText('Network Access Reminder'));

        // Should immediately show "Added to NAR" (already exists in narEntries)
        await waitFor(() => {
            expect(screen.getByText(/✓ Added to NAR/i)).toBeInTheDocument();
        });
    });

    it('should display multiple network attachments', async () => {
        const user = userEvent.setup();

        const message = {
            id: 'msg-multi-network',
            from: 'Network Admin <admin@corp.local>',
            to: 'testuser@sourcenet.local',
            subject: 'Multiple Network Access',
            body: 'You have been granted access to multiple networks.',
            timestamp: '2020-03-25T09:00:00.000Z',
            read: false,
            archived: false,
            attachments: [
                {
                    type: 'networkAddress',
                    networkId: 'multi-net-a',
                    networkName: 'Network A',
                    address: '10.1.0.0/16',
                },
                {
                    type: 'networkAddress',
                    networkId: 'multi-net-b',
                    networkName: 'Network B',
                    address: '10.2.0.0/16',
                },
            ],
        };

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'osnet', type: 'os' },
                { id: 'portal', type: 'system' },
                { id: 'mail', type: 'system' },
                { id: 'banking', type: 'system' },
                { id: 'network-address-register', type: 'utility', name: 'Network Address Register', size: 50 },
            ],
            narEntries: [],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <TopBar />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
        });

        await user.click(screen.getByText('Multiple Network Access'));

        // Both network attachments should be visible
        await waitFor(() => {
            expect(screen.getByText(/Network Credentials: Network A/i)).toBeInTheDocument();
            expect(screen.getByText(/Network Credentials: Network B/i)).toBeInTheDocument();
            expect(screen.getByTestId('network-attachment-multi-net-a')).toBeInTheDocument();
            expect(screen.getByTestId('network-attachment-multi-net-b')).toBeInTheDocument();
        });
    });

    it('should include fileSystems in NAR entry when attachment contains them', async () => {
        const user = userEvent.setup();

        // Create message with network attachment including fileSystems (like tutorial mission)
        const message = {
            id: 'msg-mission-network',
            from: 'SourceNet Manager <manager@sourcenet.local>',
            to: 'testuser@sourcenet.local',
            subject: 'Mission Software & Network Access',
            body: 'Network credentials for your first mission.',
            timestamp: '2020-03-25T09:00:00.000Z',
            read: false,
            archived: false,
            attachments: [
                {
                    type: 'networkAddress',
                    networkId: 'clienta-corporate',
                    networkName: 'ClientA-Corporate',
                    address: '192.168.50.0/24',
                    fileSystems: [
                        {
                            id: 'fs-clienta-01',
                            ip: '192.168.50.10',
                            name: 'fileserver-01',
                            files: [
                                { name: 'log_2024_01.txt', size: '2.5 KB', corrupted: true },
                                { name: 'log_2024_02.txt', size: '3.1 KB', corrupted: true },
                            ],
                        },
                    ],
                },
            ],
        };

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'osnet', type: 'os' },
                { id: 'portal', type: 'system' },
                { id: 'mail', type: 'system' },
                { id: 'banking', type: 'system' },
                { id: 'network-address-register', type: 'utility', name: 'Network Address Register', size: 50 },
            ],
            narEntries: [],
        });

        setSaveInLocalStorage('testuser', saveState);

        let capturedNarEntries = null;

        const NarCapture = () => {
            const { narEntries } = useGame();

            useEffect(() => {
                if (narEntries && narEntries.length > 0) {
                    capturedNarEntries = narEntries;
                }
            }, [narEntries]);

            return null;
        };

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <NarCapture />
                <TopBar />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
        });

        // Click the message to open it
        await user.click(screen.getByText('Mission Software & Network Access'));

        await waitFor(() => {
            expect(screen.getByText(/Network Credentials: ClientA-Corporate/i)).toBeInTheDocument();
        });

        // Click the network attachment to add to NAR
        const attachment = screen.getByTestId('network-attachment-clienta-corporate');
        await user.click(attachment);

        // Wait for NAR to update
        await waitFor(() => {
            expect(screen.getByText(/✓ Added to NAR/i)).toBeInTheDocument();
        });

        // Wait for NAR state to propagate
        await waitFor(() => {
            expect(capturedNarEntries).not.toBeNull();
            expect(capturedNarEntries.length).toBeGreaterThan(0);
        });

        // Verify NAR entry includes fileSystems
        const narEntry = capturedNarEntries[0];
        expect(narEntry).toBeDefined();
        expect(narEntry.networkId).toBe('clienta-corporate');
        expect(narEntry.networkName).toBe('ClientA-Corporate');
        expect(narEntry.address).toBe('192.168.50.0/24');
        expect(narEntry.fileSystems).toBeDefined();
        expect(narEntry.fileSystems.length).toBe(1);
        expect(narEntry.fileSystems[0].id).toBe('fs-clienta-01');
        expect(narEntry.fileSystems[0].ip).toBe('192.168.50.10');
        expect(narEntry.fileSystems[0].name).toBe('fileserver-01');
        expect(narEntry.fileSystems[0].files).toBeDefined();
        expect(narEntry.fileSystems[0].files.length).toBe(2);

        console.log('✅ Verified NAR entry includes fileSystems from mission network attachment');
    });

    it('should resolve network data from mission when attachment uses missionId reference', async () => {
        const user = userEvent.setup();

        // Create message with network attachment that references mission (no duplication)
        const message = {
            id: 'msg-mission-ref',
            from: 'SourceNet Manager <manager@sourcenet.local>',
            to: 'testuser@sourcenet.local',
            subject: 'Mission Software & Network Access',
            body: 'Network credentials for your first mission.',
            timestamp: '2020-03-25T09:00:00.000Z',
            read: false,
            archived: false,
            attachments: [
                {
                    type: 'networkAddress',
                    missionId: 'tutorial-part-1',  // Reference to mission, not duplicate data
                },
            ],
        };

        const saveState = createCompleteSaveState({
            username: 'testuser',
            messages: [message],
            software: [
                { id: 'osnet', type: 'os' },
                { id: 'portal', type: 'system' },
                { id: 'mail', type: 'system' },
                { id: 'banking', type: 'system' },
                { id: 'network-address-register', type: 'utility', name: 'Network Address Register', size: 50 },
            ],
            narEntries: [],
        });

        setSaveInLocalStorage('testuser', saveState);

        let capturedNarEntries = null;

        const NarCapture = () => {
            const { narEntries } = useGame();
            
            useEffect(() => {
                if (narEntries && narEntries.length > 0) {
                    capturedNarEntries = narEntries;
                }
            }, [narEntries]);

            return null;
        };

        render(
            <GameProvider>
                <GameLoader username="testuser" />
                <NarCapture />
                <TopBar />
                <SNetMail />
            </GameProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
        });

        // Click the message to open it
        await user.click(screen.getByText('Mission Software & Network Access'));

        await waitFor(() => {
            // Should display resolved network name from tutorial-part-1 mission
            expect(screen.getByText(/Network Credentials: ClientA-Corporate/i)).toBeInTheDocument();
        });

        // Click the network attachment to add to NAR
        const attachment = screen.getByTestId('network-attachment-clienta-corporate');
        await user.click(attachment);

        // Wait for NAR to update
        await waitFor(() => {
            expect(screen.getByText(/✓ Added to NAR/i)).toBeInTheDocument();
        });

        // Wait for NAR state to propagate
        await waitFor(() => {
            expect(capturedNarEntries).not.toBeNull();
            expect(capturedNarEntries.length).toBeGreaterThan(0);
        });

        // Verify NAR entry includes complete network data from tutorial-part-1 mission
        const narEntry = capturedNarEntries[0];
        expect(narEntry.networkId).toBe('clienta-corporate');
        expect(narEntry.networkName).toBe('ClientA-Corporate');
        expect(narEntry.address).toBe('192.168.50.0/24');
        
        // Most importantly: verify fileSystems were resolved from mission
        expect(narEntry.fileSystems).toBeDefined();
        expect(narEntry.fileSystems.length).toBe(1);
        expect(narEntry.fileSystems[0].id).toBe('fs-clienta-01');
        expect(narEntry.fileSystems[0].ip).toBe('192.168.50.10');
        expect(narEntry.fileSystems[0].name).toBe('fileserver-01');
        expect(narEntry.fileSystems[0].files.length).toBe(11);

        console.log('✅ Verified missionId reference resolves complete network data from tutorial-part-1.json');
    });
});
