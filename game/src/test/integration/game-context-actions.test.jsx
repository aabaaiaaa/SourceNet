import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../../contexts/GameContext';

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

describe('GameContext - Core Actions', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initializePlayer', () => {
        it('should set username when initialized', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await waitFor(() => {
                gameState.initializePlayer('TestPlayer');
            });

            await waitFor(() => {
                expect(gameState.username).toBe('TestPlayer');
            });
        });

        it('should set playerMailId when initialized', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await waitFor(() => {
                gameState.initializePlayer('NewPlayer');
            });

            await waitFor(() => {
                expect(gameState.playerMailId).toBeTruthy();
            });
        });

        it('should initialize empty windows array', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('TestUser');

            expect(gameState.windows).toEqual([]);
        });

        it('should set current time', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            gameState.initializePlayer('Player1');

            expect(gameState.currentTime).toBeInstanceOf(Date);
        });
    });

    describe('resetGame', () => {
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

    describe('saveGame / loadGame', () => {
        it('should return false when no save exists', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            const loaded = gameState.loadGame('NonExistentPlayer');

            expect(loaded).toBe(false);
        });
    });

    describe('rebootSystem', () => {
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

    describe('completeMission', () => {
        it('should clear active mission', () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            expect(gameState.activeMission).toBeNull();
        });
    });

    describe('Messages', () => {
        it('should add message to messages array', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await waitFor(() => {
                gameState.initializePlayer('MessageTest');
            });

            const message = {
                from: 'test@example.com',
                subject: 'Test Message',
                body: 'Test body',
            };

            gameState.addMessage(message);

            await waitFor(() => {
                expect(gameState.messages.length).toBeGreaterThan(0);
            });

            await waitFor(() => {
                expect(gameState.messages[0]).toMatchObject({
                    from: 'test@example.com',
                    subject: 'Test Message',
                });
            });
        });

        it('should mark message as read', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await waitFor(() => {
                gameState.initializePlayer('ReadTest');
            });

            const message = {
                from: 'test@example.com',
                subject: 'Test',
                body: 'Test',
            };

            gameState.addMessage(message);

            await waitFor(() => {
                expect(gameState.messages.length).toBeGreaterThan(0);
            });

            const messageId = gameState.messages[0].id;
            gameState.markMessageAsRead(messageId);

            await waitFor(() => {
                const updatedMessage = gameState.messages.find(m => m.id === messageId);
                expect(updatedMessage.read).toBe(true);
            });
        });
    });
});
