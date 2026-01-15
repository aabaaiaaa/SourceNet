import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import TopBar from '../../components/ui/TopBar';

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
                networks: [{
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Test mission completed',
                }],
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
                networks: [{
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Mission ended',
                }],
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
                networks: [{
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Access expired',
                }],
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

        it('should emit networkDisconnected event only ONCE per network (no duplicates)', async () => {
            let gameState;
            const disconnectHandler = vi.fn();

            // Subscribe to event
            triggerEventBus.on('networkDisconnected', disconnectHandler);

            render(
                <GameProvider>
                    <TestComponent onRender={(game) => { gameState = game; }} />
                    <TopBar />
                </GameProvider>
            );

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Add NAR entry and active connection
            await act(async () => {
                gameState.setNarEntries([{
                    id: 'nar-test-1',
                    networkId: 'clienta-corporate',
                    networkName: 'ClientA-Corporate',
                    address: '192.168.50.0/24',
                    authorized: true,
                    status: 'active',
                }]);
                gameState.setActiveConnections([{
                    networkId: 'clienta-corporate',
                    networkName: 'ClientA-Corporate',
                    connectedAt: new Date().toISOString(),
                }]);
            });

            // Set up mission with revokeOnComplete (like tutorial-part-2)
            const testMission = {
                missionId: 'tutorial-part-2',
                title: 'Data Retrieval',
                client: 'Client A',
                difficulty: 'Easy',
                objectives: [{ id: 'obj-1', description: 'Test', status: 'complete' }],
                networks: [{
                    networkId: 'clienta-corporate',
                    networkName: 'ClientA-Corporate',
                    revokeOnComplete: true,
                    revokeReason: 'Mission access expired',
                }],
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
                expect(disconnectHandler).toHaveBeenCalled();
            }, { timeout: 1000 });

            // Give extra time to ensure no duplicate events fire
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify event was called EXACTLY ONCE (not twice)
            expect(disconnectHandler).toHaveBeenCalledTimes(1);
            expect(disconnectHandler).toHaveBeenCalledWith({
                networkId: 'clienta-corporate',
                networkName: 'ClientA-Corporate',
                reason: 'Mission access expired',
            });

            // Cleanup
            triggerEventBus.off('networkDisconnected', disconnectHandler);
        });

        it('should emit networkDisconnected for each network when mission has multiple networks', async () => {
            let gameState;
            const disconnectHandler = vi.fn();

            // Subscribe to event
            triggerEventBus.on('networkDisconnected', disconnectHandler);

            render(
                <GameProvider>
                    <TestComponent onRender={(game) => { gameState = game; }} />
                    <TopBar />
                </GameProvider>
            );

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Add multiple NAR entries and active connections
            await act(async () => {
                gameState.setNarEntries([
                    {
                        id: 'nar-test-1',
                        networkId: 'network-alpha',
                        networkName: 'Alpha Corp',
                        address: '192.168.1.0/24',
                        authorized: true,
                        status: 'active',
                    },
                    {
                        id: 'nar-test-2',
                        networkId: 'network-beta',
                        networkName: 'Beta Industries',
                        address: '192.168.2.0/24',
                        authorized: true,
                        status: 'active',
                    },
                    {
                        id: 'nar-test-3',
                        networkId: 'network-gamma',
                        networkName: 'Gamma Systems',
                        address: '192.168.3.0/24',
                        authorized: true,
                        status: 'active',
                    }
                ]);
                gameState.setActiveConnections([
                    {
                        networkId: 'network-alpha',
                        networkName: 'Alpha Corp',
                        connectedAt: new Date().toISOString(),
                    },
                    {
                        networkId: 'network-beta',
                        networkName: 'Beta Industries',
                        connectedAt: new Date().toISOString(),
                    },
                    {
                        networkId: 'network-gamma',
                        networkName: 'Gamma Systems',
                        connectedAt: new Date().toISOString(),
                    }
                ]);
            });

            // Set up mission with multiple networks to revoke
            const testMission = {
                missionId: 'multi-network-mission',
                title: 'Multi-Network Operation',
                client: 'Test Client',
                difficulty: 'Medium',
                objectives: [{ id: 'obj-1', description: 'Test', status: 'complete' }],
                networks: [
                    {
                        networkId: 'network-alpha',
                        networkName: 'Alpha Corp',
                        revokeOnComplete: true,
                        revokeReason: 'Mission complete',
                    },
                    {
                        networkId: 'network-beta',
                        networkName: 'Beta Industries',
                        revokeOnComplete: true,
                        revokeReason: 'Access expired',
                    },
                    {
                        networkId: 'network-gamma',
                        networkName: 'Gamma Systems',
                        revokeOnComplete: true,
                        revokeReason: 'Contract ended',
                    }
                ],
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Complete mission
            await act(async () => {
                gameState.completeMission('success', 2000, 2);
            });

            // Wait for all events to be emitted
            await waitFor(() => {
                expect(disconnectHandler).toHaveBeenCalledTimes(3);
            }, { timeout: 1000 });

            // Give extra time to ensure no duplicate events fire
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify each network disconnected exactly once
            expect(disconnectHandler).toHaveBeenCalledTimes(3);
            expect(disconnectHandler).toHaveBeenCalledWith({
                networkId: 'network-alpha',
                networkName: 'Alpha Corp',
                reason: 'Mission complete',
            });
            expect(disconnectHandler).toHaveBeenCalledWith({
                networkId: 'network-beta',
                networkName: 'Beta Industries',
                reason: 'Access expired',
            });
            expect(disconnectHandler).toHaveBeenCalledWith({
                networkId: 'network-gamma',
                networkName: 'Gamma Systems',
                reason: 'Contract ended',
            });

            // Verify all connections were removed
            expect(gameState.activeConnections).toHaveLength(0);

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
                networks: [{
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    // No revokeOnComplete
                }],
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
