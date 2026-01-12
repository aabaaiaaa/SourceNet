import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import SNetMail from '../../components/apps/SNetMail';
import Portal from '../../components/apps/Portal';
import TopBar from '../../components/ui/TopBar';
import InstallationQueue from '../../components/ui/InstallationQueue';
import {
    createMessageWithLicense,
    createBankAccount,
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

describe('Software License Integration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should complete full license activation and installation flow', async () => {
        const user = userEvent.setup();

        // Setup: Create save state with a message containing a software license
        const message = createMessageWithLicense({
            id: 'msg-license-1',
            from: 'SourceNet Manager',
            subject: 'Mission Board License',
            body: 'Here is your complimentary Mission Board license.',
            softwareId: 'mission-board',
            softwareName: 'SourceNet Mission Board',
            price: 250,
            size: 200,
            activated: false,
        });

        const bankAccount = createBankAccount({
            id: 'acc-1',
            bankName: 'Test Bank',
            balance: 100, // Not enough to buy the software (costs 250)
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            messages: [message],
            bankAccounts: [bankAccount],
        });

        setSaveInLocalStorage('test_user', saveState);

        // Render components
        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <SNetMail />
                <Portal />
                <InstallationQueue />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toHaveTextContent(/100\s+credits/);
        });

        // Step 1: Click the message in mail to open it
        const messageItem = screen.getByText(/Mission Board License/i);
        await user.click(messageItem);

        // Step 2: Verify license attachment is visible
        await waitFor(() => {
            expect(screen.getByText(/Software License:/i)).toBeInTheDocument();
        });

        // Step 3: Click the license attachment to activate it
        // Need to be specific since software name appears in both mail and portal
        const attachment = screen.getByText(/Software License:/i).closest('.attachment-item');
        await user.click(attachment);

        // Step 4: Verify license shows as activated
        await waitFor(() => {
            expect(screen.getByText(/✓ Activated/i)).toBeInTheDocument();
        });

        // Step 5: Verify software shows as licensed in portal (not purchased)
        // Portal defaults to Software tab, so no need to switch
        // The portal should show "Install (Licensed)" button instead of "Purchase"
        await waitFor(() => {
            // Query for the licensed software indicator or install button
            const installButton = screen.queryByRole('button', { name: /Install.*Licensed/i });
            expect(installButton).toBeInTheDocument();
        });

        // Step 7: Click the Install button (should not deduct credits)
        const installButton = screen.getByRole('button', { name: /Install.*Licensed/i });
        await user.click(installButton);

        // Step 8: Verify software is being downloaded/installed
        await waitFor(() => {
            // Check for download queue or installation indicator
            // Use getAllByText and check that at least one exists
            const downloadingElements = screen.queryAllByText(/Downloading|Installing/i);
            expect(downloadingElements.length).toBeGreaterThan(0);
        });

        // Step 9: Verify credits unchanged (100 - should not have been charged 250)
        const topBarCredits = screen.getByTitle('Click to open Banking App');
        expect(topBarCredits).toHaveTextContent(/100\s+credits/);

        // Step 10: Verify software eventually shows as installed
        // (This may require waiting for download to complete in the test)
    });

    it('should not allow activating an already-activated license', async () => {
        const user = userEvent.setup();

        // Setup: Create save state with an ALREADY ACTIVATED license
        const message = createMessageWithLicense({
            id: 'msg-license-2',
            from: 'SourceNet Manager',
            subject: 'Already Activated License',
            body: 'This license was already activated.',
            softwareId: 'mission-board',
            softwareName: 'SourceNet Mission Board',
            price: 250,
            size: 200,
            activated: true, // Already activated!
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            messages: [message],
            // Software should already be marked as licensed in the game state
            overrides: {
                licensedSoftware: ['mission-board'], // If this state exists
            },
        });

        setSaveInLocalStorage('test_user', saveState);

        // Render components
        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <TopBar />
                <SNetMail />
            </GameProvider>
        );

        // Wait for game to load
        await waitFor(() => {
            const topBarCredits = screen.getByTitle('Click to open Banking App');
            expect(topBarCredits).toBeTruthy();
        });

        // Step 1: Click the message to open it
        const messageItem = screen.getByText(/Already Activated License/i);
        await user.click(messageItem);

        // Step 2: Verify license shows as already activated
        await waitFor(() => {
            expect(screen.getByText(/✓ Activated/i)).toBeInTheDocument();
        });

        // Step 3: Click the activated license attachment
        const licenseAttachment = screen.getByText(/SourceNet Mission Board/i);
        await user.click(licenseAttachment);

        // Step 4: Verify no change in status (still shows "✓ Activated")
        expect(screen.getByText(/✓ Activated/i)).toBeInTheDocument();

        // License should not be activated again (no duplicate entries in licensedSoftware)
    });

    it('should display license attachment information correctly', async () => {
        const user = userEvent.setup();

        // Setup: Create save state with a license message
        const message = createMessageWithLicense({
            id: 'msg-license-3',
            from: 'Software Vendor',
            subject: 'License Details Test',
            body: 'Testing license display.',
            softwareId: 'network-scanner',
            softwareName: 'Network Scanner Pro',
            price: 500,
            size: 350,
            activated: false,
        });

        const saveState = createCompleteSaveState({
            username: 'test_user',
            messages: [message],
        });

        setSaveInLocalStorage('test_user', saveState);

        // Render components
        render(
            <GameProvider>
                <GameLoader username="test_user" />
                <SNetMail />
            </GameProvider>
        );

        // Wait for game to load and open message
        await waitFor(() => {
            expect(screen.getByText(/License Details Test/i)).toBeInTheDocument();
        });

        const messageItem = screen.getByText(/License Details Test/i);
        await user.click(messageItem);

        // Verify license attachment displays correct information
        await waitFor(() => {
            expect(screen.getByText(/Software License:/i)).toBeInTheDocument();
            expect(screen.getByText(/Network Scanner Pro/i)).toBeInTheDocument();
            expect(screen.getByText(/\$500 value/i)).toBeInTheDocument();
            expect(screen.getByText(/Click to add to Portal|Click to activate/i)).toBeInTheDocument();
        });
    });
});
