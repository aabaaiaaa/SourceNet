import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import TopBar from '../../components/ui/TopBar';
import networkRegistry from '../../systems/NetworkRegistry';

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
        networkRegistry.reset();
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

            // Register network in NetworkRegistry (accessible: true = authorized)
            networkRegistry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '192.168.1.0/24',
                accessible: true,
                discovered: true,
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

            // Wait for the scheduled callback to execute - check NetworkRegistry
            await waitFor(() => {
                const network = networkRegistry.getNetwork('test-network');
                expect(network.accessible).toBe(false);
                expect(network.revokedReason).toBe('Test mission completed');
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

            // Register network in NetworkRegistry (accessible: true = authorized)
            networkRegistry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '192.168.1.0/24',
                accessible: true,
                discovered: true,
            });

            // Set active connection
            await act(async () => {
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

            // Register network in NetworkRegistry (accessible: true = authorized)
            networkRegistry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '192.168.1.0/24',
                accessible: true,
                discovered: true,
            });

            // Set active connection
            await act(async () => {
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

            // Register network in NetworkRegistry (accessible: true = authorized)
            networkRegistry.registerNetwork({
                networkId: 'clienta-corporate',
                networkName: 'ClientA-Corporate',
                address: '192.168.50.0/24',
                accessible: true,
                discovered: true,
            });

            // Set active connection
            await act(async () => {
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

            // Register multiple networks in NetworkRegistry (accessible: true = authorized)
            networkRegistry.registerNetwork({
                networkId: 'network-alpha',
                networkName: 'Alpha Corp',
                address: '192.168.1.0/24',
                accessible: true,
                discovered: true,
            });
            networkRegistry.registerNetwork({
                networkId: 'network-beta',
                networkName: 'Beta Industries',
                address: '192.168.2.0/24',
                accessible: true,
                discovered: true,
            });
            networkRegistry.registerNetwork({
                networkId: 'network-gamma',
                networkName: 'Gamma Systems',
                address: '192.168.3.0/24',
                accessible: true,
                discovered: true,
            });

            // Set active connections
            await act(async () => {
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

            // Register network in NetworkRegistry (accessible: true = authorized)
            networkRegistry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '192.168.1.0/24',
                accessible: true,
                discovered: true,
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

            // Wait a bit and verify NAR entry is still authorized via NetworkRegistry
            await new Promise(resolve => setTimeout(resolve, 100));

            await waitFor(() => {
                const network = networkRegistry.getNetwork('test-network');
                expect(network.accessible).toBe(true);
            });
        });

        it('should mark all devices as accessible: false when NAR entry is revoked', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Register the network and devices in the NetworkRegistry
            networkRegistry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '192.168.1.0/24',
                accessible: true,
                discovered: true,
            });
            networkRegistry.registerDevice({
                ip: '192.168.1.10',
                hostname: 'fileserver-1',
                networkId: 'test-network',
                fileSystemId: 'fs-1',
                accessible: true,
            });
            networkRegistry.registerDevice({
                ip: '192.168.1.11',
                hostname: 'fileserver-2',
                networkId: 'test-network',
                fileSystemId: 'fs-2',
                accessible: true,
            });
            networkRegistry.registerDevice({
                ip: '192.168.1.12',
                hostname: 'database-1',
                networkId: 'test-network',
                fileSystemId: 'fs-3',
                accessible: true,
            });
            networkRegistry.registerFileSystem({ id: 'fs-1', files: [{ name: 'doc.txt' }] });
            networkRegistry.registerFileSystem({ id: 'fs-2', files: [{ name: 'data.csv' }] });
            networkRegistry.registerFileSystem({ id: 'fs-3', files: [] });

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
                    revokeReason: 'Access credentials expired',
                }],
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Complete the mission
            await act(async () => {
                gameState.completeMission('success', 1000, 1);
            });

            // Wait for revocation to process - check NetworkRegistry
            await waitFor(() => {
                const network = networkRegistry.getNetwork('test-network');
                expect(network.accessible).toBe(false);
            }, { timeout: 1000 });

            // Verify all devices are marked as inaccessible in the NetworkRegistry
            const devices = networkRegistry.getNetworkDevices('test-network');
            expect(devices).toHaveLength(3);
            expect(devices.every(d => d.accessible === false)).toBe(true);

            // Verify files are still preserved in the NetworkRegistry
            const fs1 = networkRegistry.getFileSystem('fs-1');
            const fs2 = networkRegistry.getFileSystem('fs-2');
            expect(fs1.files).toHaveLength(1);
            expect(fs2.files).toHaveLength(1);
        });
    });

    describe('Scripted event revokeNAREntry (sabotage path)', () => {
        it('should revoke NAR entry via triggerEventBus revokeNAREntry event', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Register network and devices in NetworkRegistry
            networkRegistry.registerNetwork({
                networkId: 'clienta-corporate',
                networkName: 'ClientA Corporate',
                address: '10.0.0.0/24',
                accessible: true,
                discovered: true,
            });
            networkRegistry.registerDevice({
                ip: '10.0.0.10',
                hostname: 'workstation',
                networkId: 'clienta-corporate',
                fileSystemId: 'fs-ws',
                accessible: true,
            });
            networkRegistry.registerDevice({
                ip: '10.0.0.11',
                hostname: 'fileserver',
                networkId: 'clienta-corporate',
                fileSystemId: 'fs-srv',
                accessible: true,
            });
            networkRegistry.registerFileSystem({ id: 'fs-ws', files: [{ name: 'data.txt' }] });
            networkRegistry.registerFileSystem({ id: 'fs-srv', files: [{ name: 'backup.zip' }] });

            // Verify network is accessible before event
            const beforeNetwork = networkRegistry.getNetwork('clienta-corporate');
            expect(beforeNetwork.accessible).toBe(true);

            // Verify devices are accessible before event
            expect(networkRegistry.getDevice('10.0.0.10').accessible).toBe(true);
            expect(networkRegistry.getDevice('10.0.0.11').accessible).toBe(true);

            // Emit the revokeNAREntry event directly (simulating sabotage scripted event)
            await act(async () => {
                triggerEventBus.emit('revokeNAREntry', {
                    networkId: 'clienta-corporate',
                    reason: 'Administrator revoked access',
                });
            });

            // Wait for state to update - check NetworkRegistry
            await waitFor(() => {
                const network = networkRegistry.getNetwork('clienta-corporate');
                expect(network.accessible).toBe(false);
            }, { timeout: 1000 });

            // Verify network is now revoked
            const afterNetwork = networkRegistry.getNetwork('clienta-corporate');
            expect(afterNetwork.accessible).toBe(false);
            expect(afterNetwork.revokedReason).toBe('Administrator revoked access');

            // Verify devices are inaccessible in NetworkRegistry
            expect(networkRegistry.getDevice('10.0.0.10').accessible).toBe(false);
            expect(networkRegistry.getDevice('10.0.0.11').accessible).toBe(false);

            // Verify files are still preserved in NetworkRegistry
            const fs1 = networkRegistry.getFileSystem('fs-ws');
            const fs2 = networkRegistry.getFileSystem('fs-srv');
            expect(fs1.files).toHaveLength(1);
            expect(fs2.files).toHaveLength(1);
        });

        it('should disconnect active VPN when NAR is revoked via event', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Register network and device in NetworkRegistry
            networkRegistry.registerNetwork({
                networkId: 'clienta-corporate',
                networkName: 'ClientA Corporate',
                address: '10.0.0.0/24',
                accessible: true,
                discovered: true,
            });
            networkRegistry.registerDevice({
                ip: '10.0.0.10',
                hostname: 'workstation',
                networkId: 'clienta-corporate',
                fileSystemId: 'fs-ws',
                accessible: true,
            });

            // Set active connection
            await act(async () => {
                gameState.setActiveConnections([{
                    networkId: 'clienta-corporate',
                    networkName: 'ClientA Corporate',
                    connectedAt: new Date().toISOString(),
                }]);
            });

            // Verify connection is active
            expect(gameState.activeConnections).toHaveLength(1);

            // Emit revokeNAREntry event
            await act(async () => {
                triggerEventBus.emit('revokeNAREntry', {
                    networkId: 'clienta-corporate',
                    reason: 'Security breach detected',
                });
            });

            // Wait for disconnection
            await waitFor(() => {
                expect(gameState.activeConnections).toHaveLength(0);
            }, { timeout: 1000 });

            // Verify network is revoked via NetworkRegistry
            const network = networkRegistry.getNetwork('clienta-corporate');
            expect(network.accessible).toBe(false);

            // Verify device is inaccessible in NetworkRegistry
            expect(networkRegistry.getDevice('10.0.0.10').accessible).toBe(false);
        });
    });
});
