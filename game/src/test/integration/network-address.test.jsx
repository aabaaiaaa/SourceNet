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
});
