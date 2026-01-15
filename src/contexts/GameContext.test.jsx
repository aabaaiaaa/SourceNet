import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { GameProvider, GameContext } from './GameContext';
import { useContext } from 'react';

describe('GameContext', () => {
    let originalLocation;

    beforeEach(() => {
        originalLocation = window.location;
    });

    afterEach(() => {
        delete window.location;
        window.location = originalLocation;
    });

    const setMockUrl = (search = '') => {
        delete window.location;
        window.location = {
            ...originalLocation,
            search,
            href: `http://localhost/${search}`,
        };
    };

    // Helper component to access context
    const TestComponent = ({ onRender }) => {
        const context = useContext(GameContext);
        if (onRender) onRender(context);
        return null;
    };

    describe('gamePhase initialization', () => {
        it('should always initialize to boot phase regardless of URL parameters', () => {
            setMockUrl('');
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.gamePhase).toBe('boot');
        });

        it('should initialize to boot phase even with scenario parameter', () => {
            setMockUrl('?scenario=fresh-start');
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.gamePhase).toBe('boot');
        });

        it('should initialize to boot phase even with skipBoot parameter', () => {
            setMockUrl('?skipBoot=true');
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.gamePhase).toBe('boot');
        });

        it('should initialize to boot phase with both scenario and skipBoot parameters', () => {
            setMockUrl('?scenario=fresh-start&skipBoot=true');
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.gamePhase).toBe('boot');
        });
    });

    describe('context value exports', () => {
        it('should export setGamePhase function', () => {
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.setGamePhase).toBeTypeOf('function');
        });

        it('should export setBankingMessagesSent function', () => {
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.setBankingMessagesSent).toBeTypeOf('function');
        });

        it('should export setReputationMessagesSent function', () => {
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.setReputationMessagesSent).toBeTypeOf('function');
        });

        it('should export all required state setters for scenario fixtures', () => {
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            // Critical setters that scenarios need
            const requiredSetters = [
                'setGamePhase',
                'setUsername',
                'setPlayerMailId',
                'setCurrentTime',
                'setBankAccounts',
                'setMessages',
                'setHardware',
                'setSoftware',
                'setNarEntries',
                'setAvailableMissions',
                'setActiveMission',
                'setCompletedMissions',
                'setBankingMessagesSent',
                'setReputationMessagesSent',
            ];

            requiredSetters.forEach(setter => {
                expect(capturedContext[setter], `Missing setter: ${setter}`).toBeTypeOf('function');
            });
        });
    });

    describe('initial state values', () => {
        it('should have correct initial gamePhase value', () => {
            setMockUrl('');
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.gamePhase).toBe('boot');
        });

        it('should have empty username initially', () => {
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.username).toBe('');
        });

        it('should have bankingMessagesSent with all flags set to false', () => {
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.bankingMessagesSent).toEqual({
                firstOverdraft: false,
                approachingBankruptcy: false,
                bankruptcyCountdownStart: false,
                bankruptcyCancelled: false,
            });
        });

        it('should have reputationMessagesSent with all flags set to false', () => {
            let capturedContext;

            render(
                <GameProvider>
                    <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
                </GameProvider>
            );

            expect(capturedContext.reputationMessagesSent).toEqual({
                performancePlanWarning: false,
                finalTerminationWarning: false,
                performanceImproved: false,
            });
        });
    });
});
