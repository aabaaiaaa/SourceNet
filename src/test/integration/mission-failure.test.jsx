import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';

// Mock the game time scheduler to execute callbacks immediately
vi.mock('../../core/gameTimeScheduler', () => ({
    scheduleGameTimeCallback: vi.fn((callback, _delay, _speed) => {
        // Execute immediately for testing
        setTimeout(callback, 10);
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

describe('Mission Failure Integration', () => {
    beforeEach(() => {
        localStorage.clear();
        networkRegistry.reset();
        triggerEventBus.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Mission Failure via Deleted Files
    // ========================================================================

    describe('mission failure when critical files are deleted', () => {
        it('should fail mission when a target file is deleted from the file system', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            // Initialize player
            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            const initialReputation = gameState.reputation;
            const initialBalance = gameState.bankAccounts[0].balance;

            // Register network and file system with target files
            networkRegistry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '192.168.1.0/24',
                accessible: true,
                discovered: true,
            });

            networkRegistry.registerDevice({
                ip: '192.168.1.10',
                hostname: 'fileserver-01',
                networkId: 'test-network',
                fileSystemId: 'fs-test-001',
                accessible: true,
            });

            networkRegistry.registerFileSystem({
                id: 'fs-test-001',
                files: [
                    { name: 'critical_data.db', size: '50 MB', corrupted: true },
                    { name: 'backup.dat', size: '10 MB', corrupted: false },
                ],
            });

            // Set up active mission with file operation objective
            const testMission = {
                missionId: 'test-mission-repair',
                title: 'Repair Critical Files',
                client: 'Test Corp',
                clientId: 'test-corp',
                difficulty: 'Easy',
                objectives: [
                    {
                        id: 'obj-1',
                        type: 'fileOperation',
                        operation: 'repair',
                        description: 'Repair corrupted files',
                        targetFiles: ['critical_data.db'],
                        status: 'pending',
                    },
                ],
                networks: [{
                    networkId: 'test-network',
                    networkName: 'Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Mission access expired',
                    fileSystems: [{ id: 'fs-test-001', ip: '192.168.1.10' }],
                }],
                consequences: {
                    success: {
                        credits: 1000,
                        reputation: 1,
                        messages: [],
                    },
                    failure: {
                        credits: -250,
                        reputation: -1,
                        messages: [{
                            id: 'msg-failure-test',
                            from: 'Test Corp',
                            fromName: 'Test Corp',
                            subject: 'Mission Failed',
                            body: 'Dear {username},\n\nCritical files have been deleted.\n\nSincerely,\n{clientName}',
                            delay: 0,
                        }],
                        messageVariants: {
                            incomplete: {
                                id: 'msg-failure-incomplete',
                                from: 'Test Corp',
                                fromName: 'Test Corp',
                                subject: 'Mission Failed - Incomplete',
                                body: 'Dear {username},\n\nYou did not complete the mission.\n\nSincerely,\n{clientName}',
                                delay: 0,
                            },
                            filesDeleted: {
                                id: 'msg-failure-files-deleted',
                                from: 'Test Corp',
                                fromName: 'Test Corp',
                                subject: 'Mission Failed - Files Deleted',
                                body: 'Dear {username},\n\nCritical files required for this task have been deleted.\n\nSincerely,\n{clientName}',
                                delay: 0,
                            },
                        },
                    },
                },
                basePayout: 1000,
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Verify mission is active
            expect(gameState.activeMission).not.toBeNull();
            expect(gameState.activeMission.missionId).toBe('test-mission-repair');

            // Delete the critical file (simulating player action)
            await act(async () => {
                networkRegistry.updateFiles('fs-test-001', [
                    // Only keep non-target file
                    { name: 'backup.dat', size: '10 MB', corrupted: false },
                ]);
            });

            // Wait for mission to fail due to impossible objective
            await waitFor(() => {
                expect(gameState.activeMission).toBeNull();
            }, { timeout: 2000 });

            // Verify mission was added to completed missions with failed status
            await waitFor(() => {
                const failedMission = gameState.completedMissions.find(
                    m => m.missionId === 'test-mission-repair'
                );
                expect(failedMission).toBeDefined();
                expect(failedMission.status).toBe('failed');
                expect(failedMission.failureReason).toContain('no longer exist');
            });

            // Verify reputation decreased
            await waitFor(() => {
                expect(gameState.reputation).toBe(initialReputation - 1);
            });

            // Verify credits penalty was applied
            await waitFor(() => {
                expect(gameState.bankAccounts[0].balance).toBe(initialBalance - 250);
            });
        });

        it('should send appropriate failure message when files are deleted', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Register network and file system
            networkRegistry.registerNetwork({
                networkId: 'msg-test-network',
                networkName: 'Message Test Network',
                address: '10.0.0.0/24',
                accessible: true,
                discovered: true,
            });

            networkRegistry.registerDevice({
                ip: '10.0.0.10',
                hostname: 'server-01',
                networkId: 'msg-test-network',
                fileSystemId: 'fs-msg-001',
                accessible: true,
            });

            networkRegistry.registerFileSystem({
                id: 'fs-msg-001',
                files: [
                    { name: 'important_file.enc', size: '25 MB', corrupted: false },
                ],
            });

            const testMission = {
                missionId: 'test-mission-copy',
                title: 'Copy Important Files',
                client: 'SecureCorp',
                clientId: 'secure-corp',
                difficulty: 'Medium',
                objectives: [
                    {
                        id: 'obj-copy',
                        type: 'fileOperation',
                        operation: 'copy',
                        description: 'Copy files for backup',
                        targetFiles: ['important_file.enc'],
                        status: 'pending',
                    },
                ],
                networks: [{
                    networkId: 'msg-test-network',
                    networkName: 'Message Test Network',
                    revokeOnComplete: true,
                    fileSystems: [{ id: 'fs-msg-001', ip: '10.0.0.10' }],
                }],
                consequences: {
                    success: { credits: 2000, reputation: 1, messages: [] },
                    failure: {
                        credits: -500,
                        reputation: -1,
                        messages: [{
                            id: 'msg-default',
                            from: 'SecureCorp',
                            fromName: 'SecureCorp',
                            subject: 'Mission Failed',
                            body: 'Dear {username},\n\nDefault failure message.\n\nSincerely,\n{clientName}',
                            delay: 0,
                        }],
                        messageVariants: {
                            filesDeleted: {
                                id: 'msg-files-deleted',
                                from: 'SecureCorp',
                                fromName: 'SecureCorp',
                                subject: 'Mission Failed - Critical Files Missing',
                                body: 'Dear {username},\n\nThe files you were supposed to copy no longer exist.\n\nSincerely,\n{clientName}',
                                delay: 0,
                            },
                            incomplete: {
                                id: 'msg-incomplete',
                                from: 'SecureCorp',
                                fromName: 'SecureCorp',
                                subject: 'Mission Failed - Incomplete',
                                body: 'Dear {username},\n\nYou abandoned the mission.\n\nSincerely,\n{clientName}',
                                delay: 0,
                            },
                        },
                    },
                },
                basePayout: 2000,
            };

            const initialMessageCount = gameState.messages.length;

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Delete the target file
            await act(async () => {
                networkRegistry.updateFiles('fs-msg-001', []);
            });

            // Wait for failure message to be sent
            await waitFor(() => {
                expect(gameState.messages.length).toBeGreaterThan(initialMessageCount);
            }, { timeout: 2000 });

            // Verify the correct message variant was used (filesDeleted)
            const failureMessage = gameState.messages.find(
                m => m.subject === 'Mission Failed - Critical Files Missing'
            );
            expect(failureMessage).toBeDefined();
            expect(failureMessage.body).toContain('no longer exist');
        });

        it('should revoke network access when mission fails', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Register network
            networkRegistry.registerNetwork({
                networkId: 'revoke-test-network',
                networkName: 'Revoke Test Network',
                address: '172.16.0.0/24',
                accessible: true,
                discovered: true,
            });

            networkRegistry.registerDevice({
                ip: '172.16.0.10',
                hostname: 'server-01',
                networkId: 'revoke-test-network',
                fileSystemId: 'fs-revoke-001',
                accessible: true,
            });

            networkRegistry.registerFileSystem({
                id: 'fs-revoke-001',
                files: [
                    { name: 'data.db', size: '100 MB', corrupted: true },
                ],
            });

            // Connect to the network
            await act(async () => {
                gameState.setActiveConnections([{
                    networkId: 'revoke-test-network',
                    networkName: 'Revoke Test Network',
                    connectedAt: new Date().toISOString(),
                }]);
            });

            const testMission = {
                missionId: 'test-mission-revoke',
                title: 'Repair Database',
                client: 'DataCorp',
                clientId: 'data-corp',
                difficulty: 'Hard',
                objectives: [
                    {
                        id: 'obj-repair',
                        type: 'fileOperation',
                        operation: 'repair',
                        description: 'Repair database',
                        targetFiles: ['data.db'],
                        status: 'pending',
                    },
                ],
                networks: [{
                    networkId: 'revoke-test-network',
                    networkName: 'Revoke Test Network',
                    revokeOnComplete: true,
                    revokeReason: 'Mission access revoked',
                    fileSystems: [{ id: 'fs-revoke-001', ip: '172.16.0.10' }],
                }],
                consequences: {
                    success: { credits: 5000, reputation: 2, messages: [] },
                    failure: {
                        credits: -1250,
                        reputation: -1,
                        messages: [],
                        messageVariants: {
                            filesDeleted: {
                                id: 'msg-revoke-failure',
                                from: 'DataCorp',
                                fromName: 'DataCorp',
                                subject: 'Access Revoked',
                                body: 'Your access has been terminated.',
                                delay: 0,
                            },
                        },
                    },
                },
                basePayout: 5000,
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Verify connected before failure
            expect(gameState.activeConnections).toHaveLength(1);

            // Delete the target file
            await act(async () => {
                networkRegistry.updateFiles('fs-revoke-001', []);
            });

            // Wait for mission to fail and connection to be revoked
            await waitFor(() => {
                expect(gameState.activeMission).toBeNull();
            }, { timeout: 2000 });

            // Verify network access was revoked
            await waitFor(() => {
                const network = networkRegistry.getNetwork('revoke-test-network');
                expect(network.accessible).toBe(false);
            });

            // Verify disconnected from network
            await waitFor(() => {
                expect(gameState.activeConnections).toHaveLength(0);
            });
        });

        it('should not fail mission when non-target files are deleted', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Register network and file system
            networkRegistry.registerNetwork({
                networkId: 'safe-delete-network',
                networkName: 'Safe Delete Network',
                address: '192.168.100.0/24',
                accessible: true,
                discovered: true,
            });

            networkRegistry.registerDevice({
                ip: '192.168.100.10',
                hostname: 'server-01',
                networkId: 'safe-delete-network',
                fileSystemId: 'fs-safe-001',
                accessible: true,
            });

            networkRegistry.registerFileSystem({
                id: 'fs-safe-001',
                files: [
                    { name: 'target_file.db', size: '50 MB', corrupted: true },
                    { name: 'unrelated_file.txt', size: '1 KB', corrupted: false },
                ],
            });

            const testMission = {
                missionId: 'test-mission-safe',
                title: 'Repair Target File',
                client: 'SafeCorp',
                difficulty: 'Easy',
                objectives: [
                    {
                        id: 'obj-repair',
                        type: 'fileOperation',
                        operation: 'repair',
                        description: 'Repair target file',
                        targetFiles: ['target_file.db'],
                        status: 'pending',
                    },
                ],
                networks: [{
                    networkId: 'safe-delete-network',
                    networkName: 'Safe Delete Network',
                    revokeOnComplete: true,
                    fileSystems: [{ id: 'fs-safe-001', ip: '192.168.100.10' }],
                }],
                consequences: {
                    success: { credits: 1000, reputation: 1, messages: [] },
                    failure: { credits: -250, reputation: -1, messages: [] },
                },
                basePayout: 1000,
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Delete a non-target file
            await act(async () => {
                networkRegistry.updateFiles('fs-safe-001', [
                    { name: 'target_file.db', size: '50 MB', corrupted: true },
                    // unrelated_file.txt is deleted
                ]);
            });

            // Wait a bit and verify mission is still active
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(gameState.activeMission).not.toBeNull();
            expect(gameState.activeMission.missionId).toBe('test-mission-safe');
        });

        it('should not fail mission for completed objectives even if files are deleted', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            // Register network and file system
            networkRegistry.registerNetwork({
                networkId: 'completed-obj-network',
                networkName: 'Completed Objective Network',
                address: '10.10.0.0/24',
                accessible: true,
                discovered: true,
            });

            networkRegistry.registerDevice({
                ip: '10.10.0.10',
                hostname: 'server-01',
                networkId: 'completed-obj-network',
                fileSystemId: 'fs-completed-001',
                accessible: true,
            });

            networkRegistry.registerFileSystem({
                id: 'fs-completed-001',
                files: [
                    { name: 'already_copied.db', size: '50 MB', corrupted: false },
                    { name: 'other_file.txt', size: '1 MB', corrupted: false },
                ],
            });

            // This mission has TWO file operations:
            // 1. One that's already complete (file can be deleted without failing)
            // 2. One that's still pending (file must exist for mission to succeed)
            const testMission = {
                missionId: 'test-mission-completed-obj',
                title: 'Copy Files',
                client: 'CompletedCorp',
                difficulty: 'Easy',
                objectives: [
                    {
                        id: 'obj-copy-1',
                        type: 'fileOperation',
                        operation: 'copy',
                        description: 'Copy first file (already done)',
                        targetFiles: ['already_copied.db'],
                        status: 'complete', // Already completed!
                    },
                    {
                        id: 'obj-copy-2',
                        type: 'fileOperation',
                        operation: 'copy',
                        description: 'Copy second file (still pending)',
                        targetFiles: ['other_file.txt'],
                        status: 'pending',
                    },
                ],
                networks: [{
                    networkId: 'completed-obj-network',
                    networkName: 'Completed Objective Network',
                    revokeOnComplete: true,
                    fileSystems: [{ id: 'fs-completed-001', ip: '10.10.0.10' }],
                }],
                consequences: {
                    success: { credits: 1000, reputation: 1, messages: [] },
                    failure: { credits: -250, reputation: -1, messages: [] },
                },
                basePayout: 1000,
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Give React time to update effects after state change
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            });

            // Verify objective status is preserved immediately after setting
            expect(gameState.activeMission).not.toBeNull();
            expect(gameState.activeMission.objectives).toHaveLength(2);
            expect(gameState.activeMission.objectives[0].status).toBe('complete');

            // Delete the file for the COMPLETED objective (not the pending one)
            await act(async () => {
                networkRegistry.updateFiles('fs-completed-001', [
                    // Keep the file needed for the pending objective
                    { name: 'other_file.txt', size: '1 MB', corrupted: false },
                ]);
            });

            // Wait a bit and verify mission is still active
            // (deleting a file for a completed objective shouldn't fail the mission)
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(gameState.activeMission).not.toBeNull();
            expect(gameState.activeMission.missionId).toBe('test-mission-completed-obj');
        });
    });

    // ========================================================================
    // Mission Failure via missionStatusChanged Event
    // ========================================================================

    describe('mission failure via event', () => {
        it('should fail mission when missionStatusChanged event is emitted', async () => {
            let gameState;
            renderWithProvider((game) => {
                gameState = game;
            });

            await act(async () => {
                gameState.initializePlayer('TestPlayer');
            });

            const initialReputation = gameState.reputation;

            const testMission = {
                missionId: 'event-test-mission',
                title: 'Event Test Mission',
                client: 'EventCorp',
                clientId: 'event-corp',
                difficulty: 'Medium',
                objectives: [
                    { id: 'obj-1', type: 'networkConnection', target: 'some-network', status: 'pending' },
                ],
                networks: [],
                consequences: {
                    success: { credits: 1000, reputation: 1, messages: [] },
                    failure: {
                        credits: -250,
                        reputation: -1,
                        messages: [{
                            id: 'msg-event-failure',
                            from: 'EventCorp',
                            fromName: 'EventCorp',
                            subject: 'Mission Failed',
                            body: 'Mission failed via event.',
                            delay: 0,
                        }],
                    },
                },
                basePayout: 1000,
            };

            await act(async () => {
                gameState.setActiveMission(testMission);
            });

            // Emit mission failed event directly
            await act(async () => {
                triggerEventBus.emit('missionStatusChanged', {
                    status: 'failed',
                    failureReason: 'Test failure reason',
                });
            });

            // Wait for mission to be cleared
            await waitFor(() => {
                expect(gameState.activeMission).toBeNull();
            }, { timeout: 2000 });

            // Verify failure was recorded
            await waitFor(() => {
                const failedMission = gameState.completedMissions.find(
                    m => m.missionId === 'event-test-mission'
                );
                expect(failedMission).toBeDefined();
                expect(failedMission.status).toBe('failed');
            });

            // Verify reputation decreased
            expect(gameState.reputation).toBe(initialReputation - 1);
        });
    });
});
