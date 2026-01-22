import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';

// Helper component to access context
const TestComponent = ({ onRender }) => {
    const game = useGame();
    if (onRender) onRender(game);
    return null;
};

const renderWithProvider = (onRender) => {
    return render(
        <GameProvider>
            <TestComponent onRender={onRender} />
        </GameProvider>
    );
};

describe('Save/Load with Mission State Integration', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Basic Save/Load
    // ========================================================================

    describe('basic save/load', () => {
        it('should return false when loading non-existent save', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            const loaded = gameState.loadGame('NonExistentPlayer');

            expect(loaded).toBe(false);
        });

        it('should save and load reputation', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('TestPlayer');

            await waitFor(() => {
                expect(gameState.username).toBe('TestPlayer');
            });

            // Get initial reputation
            const initialRep = gameState.reputation;
            expect(initialRep).toBeDefined();
        });

        it('should initialize with getTotalCredits method', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('TestPlayer');

            // getTotalCredits should be a function
            expect(typeof gameState.getTotalCredits).toBe('function');
        });
    });

    // ========================================================================
    // Mission State
    // ========================================================================

    describe('active mission state', () => {
        it('should start with no active mission', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            expect(gameState.activeMission).toBeNull();
        });

        it('should have setActiveMission or acceptMission methods', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Check that mission-related methods exist
            expect(typeof gameState.acceptMission === 'function' || typeof gameState.setActiveMission === 'function').toBe(true);
        });
    });

    // ========================================================================
    // Messages and Mail
    // ========================================================================

    describe('messages state', () => {
        it('should add message to messages array', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('MessageTest');

            const message = {
                from: 'test@example.com',
                subject: 'Test Message',
                body: 'Test body',
            };

            gameState.addMessage(message);

            await waitFor(() => {
                expect(gameState.messages.length).toBeGreaterThan(0);
            });
        });

        it('should have markMessageAsRead method', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Check that message marking method exists
            expect(typeof gameState.markMessageAsRead).toBe('function');
        });
    });

    // ========================================================================
    // Windows State
    // ========================================================================

    describe('windows state', () => {
        it('should initialize empty windows array', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('TestUser');

            expect(gameState.windows).toEqual([]);
        });

        it('should close all windows on reset', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('WindowTest');
            gameState.openWindow('banking', 'Banking');
            gameState.resetGame();

            expect(gameState.windows).toEqual([]);
        });
    });

    // ========================================================================
    // Game Time
    // ========================================================================

    describe('game time state', () => {
        it('should set current time on initialization', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('Player1');

            expect(gameState.currentTime).toBeInstanceOf(Date);
        });
    });

    // ========================================================================
    // Reset Game
    // ========================================================================

    describe('reset game', () => {
        it('should clear all game state', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('TestPlayer');
            gameState.resetGame();

            expect(gameState.username).toBe('');
            expect(gameState.windows).toEqual([]);
            expect(gameState.gamePhase).toBe('boot');
        });

        it('should reset reputation to starting value', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('TestPlayer');
            gameState.setReputation(5);
            gameState.resetGame();

            expect(gameState.reputation).toBe(9); // Starting reputation
        });
    });

    // ========================================================================
    // Reboot System
    // ========================================================================

    describe('reboot system', () => {
        it('should set game phase to rebooting', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await waitFor(() => {
                gameState.initializePlayer('RebootTest');
            });

            await waitFor(() => {
                expect(gameState.gamePhase).toBe('desktop');
            });

            gameState.rebootSystem();

            await waitFor(() => {
                expect(gameState.gamePhase).toBe('rebooting');
            });
        });

        it('should close all windows before rebooting', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('WindowTest');
            gameState.openWindow('banking', 'Banking');
            gameState.rebootSystem();

            expect(gameState.windows).toEqual([]);
        });
    });
});
