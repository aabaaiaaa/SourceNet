/**
 * Shared test rendering helpers
 * Eliminates duplicate renderWithProvider / renderWithContext across test files
 */

import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { GameProvider, GameContext } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';

/**
 * Render a component wrapped in GameProvider (real context).
 * Use for component tests that work with default game state.
 * @param {React.ReactElement} component - Component to render
 * @returns {import('@testing-library/react').RenderResult}
 */
export function renderWithGame(component) {
    return render(<GameProvider>{component}</GameProvider>);
}

/**
 * Render a component with custom GameContext values (mocked context).
 * Use for component tests that need specific context values without full GameProvider.
 * @param {React.ReactElement} component - Component to render
 * @param {Object} overrides - Context value overrides
 * @returns {import('@testing-library/react').RenderResult}
 */
export function renderWithGameContext(component, overrides = {}) {
    const contextValue = {
        gamePhase: 'playing',
        currentTime: new Date('2026-01-26T12:00:00'),
        availableMissions: [],
        activeMission: null,
        completedMissions: [],
        missionFileOperations: {},
        playerReputation: 50,
        setActiveMission: vi.fn(),
        setAvailableMissions: vi.fn(),
        setCompletedMissions: vi.fn(),
        ...overrides,
    };
    return render(
        <GameContext.Provider value={contextValue}>
            {component}
        </GameContext.Provider>
    );
}

/**
 * Render a GameProvider with a test component that exposes the game context via callback.
 * Use for integration tests that need to inspect or call context functions.
 * @param {Function} onRender - Callback receiving the game context
 * @returns {import('@testing-library/react').RenderResult}
 */
export function renderWithGameHook(onRender) {
    const TestComponent = () => {
        const game = useGame();
        if (onRender) onRender(game);
        return null;
    };
    return render(
        <GameProvider>
            <TestComponent />
        </GameProvider>
    );
}
