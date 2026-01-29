import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import triggerEventBus from '../../core/triggerEventBus';

describe('Hardware Unlock Story Trigger Integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        triggerEventBus.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('creditsChanged event conditions', () => {
        it('should emit creditsChanged event with correct data structure', () => {
            const handler = vi.fn();
            triggerEventBus.on('creditsChanged', handler);

            // Emit the event like GameContext does
            triggerEventBus.emit('creditsChanged', {
                newBalance: 1500,
                oldBalance: 800,
                reason: 'cheque-deposit',
                amount: 700,
            });

            expect(handler).toHaveBeenCalledWith({
                newBalance: 1500,
                oldBalance: 800,
                reason: 'cheque-deposit',
                amount: 700,
            });
        });

        it('should trigger unlock when newBalance >= 1000 threshold', () => {
            // Simulate the hardware unlock handler behavior
            let unlockTriggered = false;

            const handleCreditsChanged = (data) => {
                const { newBalance } = data;
                if (newBalance >= 1000) {
                    unlockTriggered = true;
                }
            };

            triggerEventBus.on('creditsChanged', handleCreditsChanged);

            // Below threshold - should not trigger
            triggerEventBus.emit('creditsChanged', { newBalance: 999 });
            expect(unlockTriggered).toBe(false);

            // At threshold - should trigger
            triggerEventBus.emit('creditsChanged', { newBalance: 1000 });
            expect(unlockTriggered).toBe(true);
        });

        it('should trigger unlock when well above threshold', () => {
            let unlockTriggered = false;

            triggerEventBus.on('creditsChanged', (data) => {
                if (data.newBalance >= 1000) {
                    unlockTriggered = true;
                }
            });

            triggerEventBus.emit('creditsChanged', { newBalance: 5000 });
            expect(unlockTriggered).toBe(true);
        });
    });

    describe('betterMessageRead prerequisite', () => {
        it('should only trigger unlock when both conditions are met', () => {
            // This simulates the logic in GameContext.jsx
            let betterMessageRead = false;
            let hardwareUnlockMessageSent = false;
            let unlockTriggered = false;

            const handleCreditsChanged = (data) => {
                // Skip if conditions not met
                if (!betterMessageRead || hardwareUnlockMessageSent) return;

                const { newBalance } = data;
                if (newBalance >= 1000) {
                    hardwareUnlockMessageSent = true;
                    unlockTriggered = true;
                }
            };

            triggerEventBus.on('creditsChanged', handleCreditsChanged);

            // Has credits but hasn't read the message - should not trigger
            triggerEventBus.emit('creditsChanged', { newBalance: 2000 });
            expect(unlockTriggered).toBe(false);

            // Read the 'better' message
            betterMessageRead = true;

            // Now credits change - should trigger
            triggerEventBus.emit('creditsChanged', { newBalance: 2000 });
            expect(unlockTriggered).toBe(true);
        });

        it('should not trigger twice (idempotent)', () => {
            let betterMessageRead = true;
            let hardwareUnlockMessageSent = false;
            let triggerCount = 0;

            const handleCreditsChanged = (data) => {
                if (!betterMessageRead || hardwareUnlockMessageSent) return;

                const { newBalance } = data;
                if (newBalance >= 1000) {
                    hardwareUnlockMessageSent = true;
                    triggerCount++;
                }
            };

            triggerEventBus.on('creditsChanged', handleCreditsChanged);

            // First trigger
            triggerEventBus.emit('creditsChanged', { newBalance: 1000 });
            expect(triggerCount).toBe(1);

            // Second trigger - should not increment
            triggerEventBus.emit('creditsChanged', { newBalance: 2000 });
            expect(triggerCount).toBe(1);

            // Third trigger - still shouldn't increment
            triggerEventBus.emit('creditsChanged', { newBalance: 5000 });
            expect(triggerCount).toBe(1);
        });
    });

    describe('unlock feature integration', () => {
        it('should send message (but NOT unlock features) when credits reach 1000', () => {
            // Features are NOT unlocked when message is sent - only when it's READ
            let unlockedFeatures = [];
            let messageSent = false;
            let betterMessageRead = true;
            let hardwareUnlockMessageSent = false;

            const handleCreditsChanged = (data) => {
                if (!betterMessageRead || hardwareUnlockMessageSent) return;

                const { newBalance } = data;
                if (newBalance >= 1000) {
                    hardwareUnlockMessageSent = true;
                    messageSent = true;
                    // NOTE: Features are NOT unlocked here - they unlock when message is READ
                }
            };

            triggerEventBus.on('creditsChanged', handleCreditsChanged);

            triggerEventBus.emit('creditsChanged', { newBalance: 1500 });

            // Message should be sent
            expect(messageSent).toBe(true);
            // But features should NOT be unlocked yet
            expect(unlockedFeatures).toHaveLength(0);
        });

        it('should unlock network-adapters and advanced-tools when "New Opportunities" message is read', () => {
            let unlockedFeatures = [];
            const messages = [
                { id: 'msg-12345-abc123', subject: 'New Opportunities - Hardware & Tools' }
            ];

            const handleMessageRead = (data) => {
                const message = messages.find(m => m.id === data.messageId);
                if (message && message.subject && message.subject.includes('New Opportunities')) {
                    unlockedFeatures = [...unlockedFeatures, 'network-adapters', 'advanced-tools'];
                }
            };

            triggerEventBus.on('messageRead', handleMessageRead);

            // Read the "New Opportunities" message
            triggerEventBus.emit('messageRead', { messageId: 'msg-12345-abc123' });

            expect(unlockedFeatures).toContain('network-adapters');
            expect(unlockedFeatures).toContain('advanced-tools');
            expect(unlockedFeatures).toHaveLength(2);
        });

        it('should NOT unlock features for other messages', () => {
            let unlockedFeatures = [];
            const messages = [
                { id: 'msg-99999-xyz789', subject: 'Some Other Message' }
            ];

            const handleMessageRead = (data) => {
                const message = messages.find(m => m.id === data.messageId);
                if (message && message.subject && message.subject.includes('New Opportunities')) {
                    unlockedFeatures = [...unlockedFeatures, 'network-adapters', 'advanced-tools'];
                }
            };

            triggerEventBus.on('messageRead', handleMessageRead);

            // Read a different message
            triggerEventBus.emit('messageRead', { messageId: 'msg-99999-xyz789' });

            // Features should NOT be unlocked
            expect(unlockedFeatures).toHaveLength(0);
        });
    });

    describe('event bus cleanup', () => {
        it('should properly unsubscribe from creditsChanged events', () => {
            const handler = vi.fn();
            const unsubscribe = triggerEventBus.on('creditsChanged', handler);

            triggerEventBus.emit('creditsChanged', { newBalance: 500 });
            expect(handler).toHaveBeenCalledTimes(1);

            unsubscribe();

            triggerEventBus.emit('creditsChanged', { newBalance: 1000 });
            expect(handler).toHaveBeenCalledTimes(1); // Should still be 1
        });
    });
});
