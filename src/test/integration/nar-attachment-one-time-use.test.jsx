import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import SNetMail from '../../components/apps/SNetMail';
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

describe('NAR Attachment One-Time Use', () => {
    beforeEach(() => {
        localStorage.clear();
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

        const message = createMessageWithNetworkAddress({
            id: 'msg-old',
            from: 'Admin <admin@corp.local>',
            subject: 'Old Credentials',
            body: 'Old network access.',
            networkId: 'corp-net-1',
            networkName: 'Corp Network',
            address: '10.0.0.0/24',
        });

        // Mark attachment as already activated
        message.attachments[0].activated = true;

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
                    fileSystems: [],
                },
            ],
        });

        setSaveInLocalStorage('testuser', saveState);

        render(
            <GameProvider>
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
    });

    it('should show correct status for fresh attachment on already-authorized network', async () => {
        const user = userEvent.setup();

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
                    fileSystems: ['fs-corp-01'],
                },
            ],
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

        // Fresh attachment but network already in NAR - should show "Already in NAR"
        await waitFor(() => {
            expect(screen.getByText('✓ Already in NAR')).toBeInTheDocument();
        });
    });
});
