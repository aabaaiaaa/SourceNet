/**
 * Shared helpers for integration tests
 * Extracted from file-manager.test.jsx to support split test files
 */

import { screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { useGame } from '../../contexts/useGame';

/**
 * Helper component that loads a saved game state on mount.
 * Sets game phase to 'desktop' and time speed to 100x for fast test execution.
 * @param {{ username: string }} props
 */
export const GameLoader = ({ username }) => {
    const { loadGame, setGamePhase, setSpecificTimeSpeed } = useGame();

    useEffect(() => {
        loadGame(username);
        setGamePhase('desktop');
        setSpecificTimeSpeed(100);
    }, [loadGame, setGamePhase, setSpecificTimeSpeed, username]);

    return null;
};

/**
 * Perform a network scan in the NetworkScanner component.
 * Selects the network, clicks scan, and waits for completion.
 * @param {Object} user - userEvent instance
 * @param {string} networkId - Network ID to scan
 */
export async function performNetworkScan(user, networkId) {
    const networkSelect = screen.getByRole('combobox', { name: /network/i });
    await user.selectOptions(networkSelect, networkId);

    const scanButton = screen.getByRole('button', { name: /start scan/i });
    await user.click(scanButton);

    await waitFor(
        () => {
            expect(screen.queryByText(/scanning/i)).not.toBeInTheDocument();
        },
        { timeout: 10000 }
    );
}
