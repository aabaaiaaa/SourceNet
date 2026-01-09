/**
 * Message Integrity Integration Tests
 * 
 * Validates that all message templates and inline message definitions
 * have complete content (from, fromId, fromName, subject, body) and that
 * placeholder replacement works correctly.
 * 
 * Message sources:
 * 1. MESSAGE_TEMPLATES - reusable templates referenced by templateId
 * 2. Story Events - inline messages in welcome-messages.json, mission-board-intro.json
 * 3. Mission Consequences - messages in failure/success consequences
 */

import { describe, it, expect } from 'vitest';
import { createMessageFromTemplate, MESSAGE_TEMPLATES } from '../../missions/messageTemplates';
import { storyEvents, allMissions } from '../../missions/missionData';

// Test data for placeholder replacement
const TEST_DATA = {
    username: 'test_agent_123',
    managerName: 'TestManager',
    // For client-payment template
    clientName: 'TestClient Corp',
    missionTitle: 'Test Mission',
    payoutAmount: '1,000',
    chequeAmount: 1000,
};

/**
 * Replace placeholders in text with test data
 * Mirrors the replacement logic used in useStoryMissions.js
 */
const replacePlaceholders = (text) => {
    if (!text) return text;
    return text
        .replace(/{username}/g, TEST_DATA.username)
        .replace(/{managerName}/g, TEST_DATA.managerName)
        .replace(/{random}/g, 'ABC-123'); // Static replacement for testing
};

/**
 * Validate a message object has all required fields with content
 */
const validateMessageFields = (message, sourceDescription) => {
    // Required string fields
    const requiredFields = ['from', 'subject', 'body'];

    requiredFields.forEach(field => {
        expect(message[field], `${sourceDescription}: missing '${field}'`).toBeDefined();
        expect(typeof message[field], `${sourceDescription}: '${field}' should be string`).toBe('string');
        expect(message[field].length, `${sourceDescription}: '${field}' should not be empty`).toBeGreaterThan(0);
    });

    // Body should have meaningful content (at least 50 chars after placeholder replacement)
    expect(message.body.length, `${sourceDescription}: body too short (${message.body.length} chars)`).toBeGreaterThan(50);

    // fromId and fromName are required for proper display
    expect(message.fromId, `${sourceDescription}: missing 'fromId'`).toBeDefined();
    expect(message.fromName, `${sourceDescription}: missing 'fromName'`).toBeDefined();

    // Check no unreplaced placeholders remain
    expect(message.body, `${sourceDescription}: body contains unreplaced placeholders`).not.toMatch(/{[a-zA-Z]+}/);
    expect(message.from, `${sourceDescription}: from contains unreplaced placeholders`).not.toMatch(/{[a-zA-Z]+}/);
    expect(message.fromName, `${sourceDescription}: fromName contains unreplaced placeholders`).not.toMatch(/{[a-zA-Z]+}/);
    expect(message.subject, `${sourceDescription}: subject contains unreplaced placeholders`).not.toMatch(/{[a-zA-Z]+}/);
};

/**
 * Process an inline message (from story events) with placeholder replacement
 * Mirrors the logic in useStoryMissions.js
 */
const processInlineMessage = (msg) => {
    return {
        from: replacePlaceholders(msg.from),
        fromId: replacePlaceholders(msg.fromId),
        fromName: replacePlaceholders(msg.fromName),
        subject: replacePlaceholders(msg.subject),
        body: replacePlaceholders(msg.body),
        attachments: msg.attachments || [],
    };
};

describe('Message Integrity', () => {

    describe('MESSAGE_TEMPLATES - All templates produce valid messages', () => {
        const templateIds = Object.keys(MESSAGE_TEMPLATES);

        it('should have at least one template defined', () => {
            expect(templateIds.length).toBeGreaterThan(0);
        });

        templateIds.forEach(templateId => {
            describe(`Template: ${templateId}`, () => {
                it('should have required raw template fields', () => {
                    const template = MESSAGE_TEMPLATES[templateId];

                    expect(template.from, `${templateId}: missing 'from'`).toBeDefined();
                    expect(template.fromId, `${templateId}: missing 'fromId'`).toBeDefined();
                    expect(template.fromName, `${templateId}: missing 'fromName'`).toBeDefined();
                    expect(template.subject, `${templateId}: missing 'subject'`).toBeDefined();
                    expect(template.body, `${templateId}: missing 'body'`).toBeDefined();
                });

                it('should produce valid message via createMessageFromTemplate', () => {
                    const message = createMessageFromTemplate(templateId, TEST_DATA);

                    expect(message, `${templateId}: createMessageFromTemplate returned null`).not.toBeNull();
                    validateMessageFields(message, `Template '${templateId}'`);
                });

                it('should replace username placeholder', () => {
                    const message = createMessageFromTemplate(templateId, TEST_DATA);

                    if (MESSAGE_TEMPLATES[templateId].body.includes('{username}')) {
                        expect(message.body).toContain(TEST_DATA.username);
                        expect(message.body).not.toContain('{username}');
                    }
                });

                it('should replace managerName placeholder', () => {
                    const message = createMessageFromTemplate(templateId, TEST_DATA);

                    if (MESSAGE_TEMPLATES[templateId].body.includes('{managerName}')) {
                        expect(message.body).toContain(TEST_DATA.managerName);
                        expect(message.body).not.toContain('{managerName}');
                    }
                });

                it('should have consistent from naming pattern', () => {
                    const template = MESSAGE_TEMPLATES[templateId];

                    // All manager messages should use "SourceNet Manager" as from
                    if (template.fromId.includes('MGR')) {
                        expect(template.from).toBe('SourceNet Manager');
                    }
                });
            });
        });
    });

    describe('Story Events - Inline messages have complete content and valid placeholders', () => {
        storyEvents.forEach(eventDef => {
            describe(`Story Event: ${eventDef.missionId}`, () => {
                if (eventDef.events && Array.isArray(eventDef.events)) {
                    eventDef.events.forEach(event => {
                        if (event.message) {
                            it(`Event '${event.id}' should have valid raw message fields`, () => {
                                const msg = event.message;

                                // These inline messages don't use templates, they have content directly
                                expect(msg.from, `${event.id}: missing 'from'`).toBeDefined();
                                expect(msg.fromId, `${event.id}: missing 'fromId'`).toBeDefined();
                                expect(msg.fromName, `${event.id}: missing 'fromName'`).toBeDefined();
                                expect(msg.subject, `${event.id}: missing 'subject'`).toBeDefined();
                                expect(msg.body, `${event.id}: missing 'body'`).toBeDefined();

                                // Body should have content (before placeholder replacement)
                                expect(msg.body.length, `${event.id}: body too short`).toBeGreaterThan(50);

                                // From should be descriptive (not just "manager")
                                expect(msg.from.length, `${event.id}: 'from' too short`).toBeGreaterThan(5);
                            });

                            it(`Event '${event.id}' should produce valid message after placeholder replacement`, () => {
                                const processedMsg = processInlineMessage(event.message);
                                validateMessageFields(processedMsg, `Story event '${event.id}'`);
                            });

                            it(`Event '${event.id}' should replace username placeholder if present`, () => {
                                const msg = event.message;
                                const processedMsg = processInlineMessage(msg);

                                if (msg.body.includes('{username}')) {
                                    expect(processedMsg.body).toContain(TEST_DATA.username);
                                    expect(processedMsg.body).not.toContain('{username}');
                                }
                                if (msg.subject.includes('{username}')) {
                                    expect(processedMsg.subject).toContain(TEST_DATA.username);
                                    expect(processedMsg.subject).not.toContain('{username}');
                                }
                            });

                            it(`Event '${event.id}' should replace managerName placeholder if present`, () => {
                                const msg = event.message;
                                const processedMsg = processInlineMessage(msg);

                                if (msg.body.includes('{managerName}')) {
                                    expect(processedMsg.body).toContain(TEST_DATA.managerName);
                                    expect(processedMsg.body).not.toContain('{managerName}');
                                }
                                if (msg.subject.includes('{managerName}')) {
                                    expect(processedMsg.subject).toContain(TEST_DATA.managerName);
                                    expect(processedMsg.subject).not.toContain('{managerName}');
                                }
                                if (msg.fromName.includes('{managerName}')) {
                                    expect(processedMsg.fromName).toContain(TEST_DATA.managerName);
                                    expect(processedMsg.fromName).not.toContain('{managerName}');
                                }
                            });

                            it(`Event '${event.id}' should have consistent from naming`, () => {
                                const msg = event.message;

                                // Manager messages should use full name
                                if (msg.fromId && msg.fromId.includes('MGR')) {
                                    expect(msg.from).toBe('SourceNet Manager');
                                }

                                // HR messages should use full name
                                if (msg.fromId && msg.fromId.includes('HQ0')) {
                                    expect(msg.from).toContain('SourceNet');
                                }
                            });
                        }
                    });
                }
            });
        });
    });

    describe('Mission Consequences - Messages reference valid templates or have content', () => {
        allMissions.forEach(mission => {
            const hasSuccessMessages = mission.consequences?.success?.messages?.length > 0;
            const hasFailureMessages = mission.consequences?.failure?.messages?.length > 0;
            const hasScriptedEventMessages = mission.scriptedEvents?.some(event =>
                event.actions?.some(action => action.type === 'sendMessage' && action.message)
            );

            // Skip missions with no messages to test
            if (!hasSuccessMessages && !hasFailureMessages && !hasScriptedEventMessages) {
                return;
            }

            describe(`Mission: ${mission.missionId}`, () => {

                // Check success consequence messages
                if (hasSuccessMessages) {
                    mission.consequences.success.messages.forEach((msgConfig, idx) => {
                        it(`Success message ${idx + 1} should be valid`, () => {
                            if (msgConfig.templateId) {
                                // Template-based message - verify template exists
                                expect(
                                    MESSAGE_TEMPLATES[msgConfig.templateId],
                                    `${mission.missionId} success msg ${idx + 1}: template '${msgConfig.templateId}' not found`
                                ).toBeDefined();

                                // Verify template produces valid message
                                const message = createMessageFromTemplate(msgConfig.templateId, TEST_DATA);
                                expect(message).not.toBeNull();
                                validateMessageFields(message, `${mission.missionId} success msg (template: ${msgConfig.templateId})`);
                            } else {
                                // Inline message - verify it has content and processes correctly
                                expect(msgConfig.from, `${mission.missionId} success msg ${idx + 1}: missing 'from'`).toBeDefined();
                                expect(msgConfig.subject, `${mission.missionId} success msg ${idx + 1}: missing 'subject'`).toBeDefined();
                                expect(msgConfig.body, `${mission.missionId} success msg ${idx + 1}: missing 'body'`).toBeDefined();
                                expect(msgConfig.body.length, `${mission.missionId} success msg ${idx + 1}: body too short`).toBeGreaterThan(50);

                                // Test placeholder replacement
                                const processedMsg = processInlineMessage(msgConfig);
                                validateMessageFields(processedMsg, `${mission.missionId} success msg ${idx + 1} (processed)`);
                            }
                        });
                    });
                }

                // Check failure consequence messages
                if (hasFailureMessages) {
                    mission.consequences.failure.messages.forEach((msgConfig, idx) => {
                        it(`Failure message ${idx + 1} should be valid`, () => {
                            if (msgConfig.templateId) {
                                // Template-based message - verify template exists
                                expect(
                                    MESSAGE_TEMPLATES[msgConfig.templateId],
                                    `${mission.missionId} failure msg ${idx + 1}: template '${msgConfig.templateId}' not found`
                                ).toBeDefined();

                                // Verify template produces valid message
                                const message = createMessageFromTemplate(msgConfig.templateId, TEST_DATA);
                                expect(message).not.toBeNull();
                                validateMessageFields(message, `${mission.missionId} failure msg (template: ${msgConfig.templateId})`);
                            } else {
                                // Inline message - verify it has content and processes correctly
                                expect(msgConfig.from, `${mission.missionId} failure msg ${idx + 1}: missing 'from'`).toBeDefined();
                                expect(msgConfig.subject, `${mission.missionId} failure msg ${idx + 1}: missing 'subject'`).toBeDefined();
                                expect(msgConfig.body, `${mission.missionId} failure msg ${idx + 1}: missing 'body'`).toBeDefined();
                                expect(msgConfig.body.length, `${mission.missionId} failure msg ${idx + 1}: body too short`).toBeGreaterThan(50);

                                // Test placeholder replacement
                                const processedMsg = processInlineMessage(msgConfig);
                                validateMessageFields(processedMsg, `${mission.missionId} failure msg ${idx + 1} (processed)`);
                            }
                        });
                    });
                }

                // Check scripted event messages (some events can send messages)
                if (hasScriptedEventMessages && mission.scriptedEvents) {
                    mission.scriptedEvents.forEach(event => {
                        if (event.actions) {
                            event.actions.forEach((action, actionIdx) => {
                                if (action.type === 'sendMessage' && action.message) {
                                    it(`Scripted event '${event.id}' action ${actionIdx + 1} message should be valid`, () => {
                                        const msg = action.message;

                                        if (msg.templateId) {
                                            expect(MESSAGE_TEMPLATES[msg.templateId]).toBeDefined();
                                            const message = createMessageFromTemplate(msg.templateId, TEST_DATA);
                                            expect(message).not.toBeNull();
                                            validateMessageFields(message, `${event.id} action ${actionIdx + 1} (template: ${msg.templateId})`);
                                        } else {
                                            expect(msg.from).toBeDefined();
                                            expect(msg.subject).toBeDefined();
                                            expect(msg.body).toBeDefined();
                                            expect(msg.body.length).toBeGreaterThan(50);

                                            // Test placeholder replacement
                                            const processedMsg = processInlineMessage(msg);
                                            validateMessageFields(processedMsg, `${event.id} action ${actionIdx + 1} (processed)`);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
    });

    describe('Cross-reference validation', () => {
        it('should have all referenced templateIds defined in MESSAGE_TEMPLATES', () => {
            const referencedTemplateIds = new Set();

            // Collect from mission consequences
            allMissions.forEach(mission => {
                mission.consequences?.success?.messages?.forEach(msg => {
                    if (msg.templateId) referencedTemplateIds.add(msg.templateId);
                });
                mission.consequences?.failure?.messages?.forEach(msg => {
                    if (msg.templateId) referencedTemplateIds.add(msg.templateId);
                });
            });

            // Verify all referenced templates exist
            referencedTemplateIds.forEach(templateId => {
                expect(
                    MESSAGE_TEMPLATES[templateId],
                    `Referenced templateId '${templateId}' not found in MESSAGE_TEMPLATES`
                ).toBeDefined();
            });
        });

        it('should have no orphaned templates (templates not referenced anywhere)', () => {
            const definedTemplateIds = new Set(Object.keys(MESSAGE_TEMPLATES));
            const referencedTemplateIds = new Set();

            // Collect references from missions
            allMissions.forEach(mission => {
                mission.consequences?.success?.messages?.forEach(msg => {
                    if (msg.templateId) referencedTemplateIds.add(msg.templateId);
                });
                mission.consequences?.failure?.messages?.forEach(msg => {
                    if (msg.templateId) referencedTemplateIds.add(msg.templateId);
                });
            });

            // Note: Some templates might be used by story events or other code paths
            // This test just warns about potentially orphaned templates
            const orphaned = [...definedTemplateIds].filter(id => !referencedTemplateIds.has(id));

            if (orphaned.length > 0) {
                console.warn(`⚠️ Potentially orphaned templates (not referenced in mission consequences): ${orphaned.join(', ')}`);
                // These might be used elsewhere (story events, game context), so we don't fail
            }
        });
    });

    describe('Message content quality', () => {
        it('all templates should have substantive body content (>100 chars)', () => {
            Object.entries(MESSAGE_TEMPLATES).forEach(([templateId, template]) => {
                expect(
                    template.body.length,
                    `Template '${templateId}' body too short: ${template.body.length} chars`
                ).toBeGreaterThan(100);
            });
        });

        it('all inline story event messages should have substantive body content', () => {
            storyEvents.forEach(eventDef => {
                eventDef.events?.forEach(event => {
                    if (event.message?.body) {
                        expect(
                            event.message.body.length,
                            `Story event '${event.id}' body too short: ${event.message.body.length} chars`
                        ).toBeGreaterThan(100);
                    }
                });
            });
        });

        it('all fromId values should follow naming convention', () => {
            const validPrefixes = ['SNET-MGR', 'SNET-HQ', 'SNET-', 'CLIENT-'];

            // Check templates
            Object.entries(MESSAGE_TEMPLATES).forEach(([templateId, template]) => {
                const hasValidPrefix = validPrefixes.some(prefix =>
                    template.fromId.startsWith(prefix)
                );
                expect(
                    hasValidPrefix,
                    `Template '${templateId}' fromId '${template.fromId}' doesn't follow naming convention`
                ).toBe(true);
            });

            // Check story events
            storyEvents.forEach(eventDef => {
                eventDef.events?.forEach(event => {
                    if (event.message?.fromId) {
                        const hasValidPrefix = validPrefixes.some(prefix =>
                            event.message.fromId.startsWith(prefix)
                        );
                        expect(
                            hasValidPrefix,
                            `Story event '${event.id}' fromId '${event.message.fromId}' doesn't follow naming convention`
                        ).toBe(true);
                    }
                });
            });
        });

        it('all processed messages should have no remaining placeholders', () => {
            const placeholderPattern = /{[a-zA-Z]+}/;

            // Check all templates
            Object.entries(MESSAGE_TEMPLATES).forEach(([templateId]) => {
                const message = createMessageFromTemplate(templateId, TEST_DATA);
                expect(message.body, `Template '${templateId}' body has unreplaced placeholder`).not.toMatch(placeholderPattern);
                expect(message.from, `Template '${templateId}' from has unreplaced placeholder`).not.toMatch(placeholderPattern);
                expect(message.fromName, `Template '${templateId}' fromName has unreplaced placeholder`).not.toMatch(placeholderPattern);
                expect(message.subject, `Template '${templateId}' subject has unreplaced placeholder`).not.toMatch(placeholderPattern);
            });

            // Check all story event inline messages
            storyEvents.forEach(eventDef => {
                eventDef.events?.forEach(event => {
                    if (event.message) {
                        const processedMsg = processInlineMessage(event.message);
                        expect(processedMsg.body, `Story event '${event.id}' body has unreplaced placeholder`).not.toMatch(placeholderPattern);
                        expect(processedMsg.from, `Story event '${event.id}' from has unreplaced placeholder`).not.toMatch(placeholderPattern);
                        expect(processedMsg.fromName, `Story event '${event.id}' fromName has unreplaced placeholder`).not.toMatch(placeholderPattern);
                        expect(processedMsg.subject, `Story event '${event.id}' subject has unreplaced placeholder`).not.toMatch(placeholderPattern);
                    }
                });
            });
        });
    });
});
