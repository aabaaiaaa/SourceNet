import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';

// Mock the game time scheduler to execute callbacks immediately
vi.mock('../../core/gameTimeScheduler', () => ({
    scheduleGameTimeCallback: vi.fn((callback, _delay, _speed) => {
        // Execute immediately for testing
        setTimeout(callback, 10); // Small delay to allow state to settle
        return Date.now();
    }),
    clearGameTimeCallback: vi.fn(),
    rescheduleAllTimers: vi.fn(),
}));

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

describe('Mission NAR Revocation', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Mission network revokeOnComplete', () => {
        it('should revoke NAR entry when mission with revokeOnComplete completes', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Initialize player and set up initial state
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Add a NAR entry
            await act(async () => {
                gameState.setNarEntries([{
                    id: 'nar-test-1',
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    address: '192.168.1.0/24',
                    authorized: true,
                    status: 'active',
                }]);
            });

            // Set up active mission with revokeOnComplete
            const testMission = {
                missionId: 'test-mission-1',
                title: 'Test Mission',
                client: 'Test Client',
                difficulty: 'Easy',
                objectives: [{ id: 'obj-1', description: 'Test objective', status: 'complete' }],
                network: {
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Test mission completed',
                },
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Complete the mission
            await act(async () => {
                gameState.completeMission('success', 1000, 1);
            });

            // Wait for the scheduled callback to execute
            await waitFor(() => {
                const entry = gameState.narEntries.find(e => e.networkId === 'test-network');
                expect(entry.authorized).toBe(false);
                expect(entry.revokedReason).toBe('Test mission completed');
            }, { timeout: 1000 });
        });

        it('should disconnect active VPN connection when NAR entry is revoked', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Add NAR entry and active connection
            await act(async () => {
                gameState.setNarEntries([{
                    id: 'nar-test-1',
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    address: '192.168.1.0/24',
                    authorized: true,
                    status: 'active',
                }]);
                gameState.setActiveConnections([{
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    connectedAt: new Date().toISOString(),
                }]);
            });

            // Set up mission with revokeOnComplete
            const testMission = {
                missionId: 'test-mission-1',
                title: 'Test Mission',
                client: 'Test Client',
                difficulty: 'Easy',
                objectives: [{ id: 'obj-1', description: 'Test', status: 'complete' }],
                network: {
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Mission ended',
                },
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Complete mission
            await act(async () => {
                gameState.completeMission('success', 1000, 1);
            });

            // Wait for connection to be removed
            await waitFor(() => {
                expect(gameState.activeConnections).toHaveLength(0);
            }, { timeout: 1000 });
        });

        it('should emit networkDisconnected event when revoking and disconnecting', async () => {
            let gameState;
            const disconnectHandler = vi.fn();

            renderWithProvider((game) => {
                gameState = game;
            });

            // Subscribe to event
            triggerEventBus.on('networkDisconnected', disconnectHandler);

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Add NAR entry and active connection
            await act(async () => {
                gameState.setNarEntries([{
                    id: 'nar-test-1',
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    address: '192.168.1.0/24',
                    authorized: true,
                    status: 'active',
                }]);
                gameState.setActiveConnections([{
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    connectedAt: new Date().toISOString(),
                }]);
            });

            // Set up mission with revokeOnComplete
            const testMission = {
                missionId: 'test-mission-1',
                title: 'Test Mission',
                client: 'Test Client',
                difficulty: 'Easy',
                objectives: [{ id: 'obj-1', description: 'Test', status: 'complete' }],
                network: {
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Access expired',
                },
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Complete mission
            await act(async () => {
                gameState.completeMission('success', 1000, 1);
            });

            // Wait for event to be emitted
            await waitFor(() => {
                expect(disconnectHandler).toHaveBeenCalledWith({
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    reason: 'Access expired',
                });
            }, { timeout: 1000 });

            // Cleanup
            triggerEventBus.off('networkDisconnected', disconnectHandler);
        });

        it('should NOT revoke NAR entry when mission without revokeOnComplete completes', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Add NAR entry
            await act(async () => {
                gameState.setNarEntries([{
                    id: 'nar-test-1',
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    address: '192.168.1.0/24',
                    authorized: true,
                    status: 'active',
                }]);
            });

            // Set up mission WITHOUT revokeOnComplete
            const testMission = {
                missionId: 'test-mission-1',
                title: 'Test Mission',
                client: 'Test Client',
                difficulty: 'Easy',
                objectives: [{ id: 'obj-1', description: 'Test', status: 'complete' }],
                network: {
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    // No revokeOnComplete
                },
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Complete mission
            await act(async () => {
                gameState.completeMission('success', 1000, 1);
            });

            // Wait a bit and verify NAR entry is still authorized
            await new Promise(resolve => setTimeout(resolve, 100));

            await waitFor(() => {
                const entry = gameState.narEntries.find(e => e.networkId === 'test-network');
                expect(entry.authorized).toBe(true);
            });
        });
    });
});
