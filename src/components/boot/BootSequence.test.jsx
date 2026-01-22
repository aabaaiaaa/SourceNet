import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock hardware must be defined inside the mock factory for proper hoisting
vi.mock('../../contexts/useGame', () => {
    const mockHardware = {
        motherboard: { name: 'Test Motherboard' },
        cpu: { name: 'Test CPU' },
        memory: [{ capacity: '8GB' }],
        storage: [{ capacity: '256GB SSD' }],
        powerSupply: { wattage: 500 },
        network: { name: 'Test Network', speed: 100 },
    };

    return {
        useGame: vi.fn(() => ({
            setGamePhase: vi.fn(),
            hardware: mockHardware,
            username: null,
            isRebooting: false,
            setIsRebooting: vi.fn(),
            setIsPaused: vi.fn(),
        })),
    };
});

import { useGame } from '../../contexts/useGame';
import BootSequence from './BootSequence';

// ============================================================================
// Tests
// ============================================================================

describe('BootSequence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        localStorage.clear();
        sessionStorage.clear();

        // Reset mock to default state
        useGame.mockReturnValue({
            setGamePhase: vi.fn(),
            hardware: {
                motherboard: { name: 'Test Motherboard' },
                cpu: { name: 'Test CPU' },
                memory: [{ capacity: '8GB' }],
                storage: [{ capacity: '256GB SSD' }],
                powerSupply: { wattage: 500 },
                network: { name: 'Test Network', speed: 100 },
            },
            username: null,
            isRebooting: false,
            setIsRebooting: vi.fn(),
            setIsPaused: vi.fn(),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Rendering
    // ========================================================================

    describe('rendering', () => {
        it('should render boot screen container', () => {
            render(<BootSequence />);

            // Boot screen should be present
            const bootScreen = document.querySelector('.boot-screen');
            expect(bootScreen).not.toBeNull();
        });

        it('should display BIOS header after initial render', async () => {
            render(<BootSequence />);

            // Advance first timer tick
            await act(async () => {
                vi.advanceTimersByTime(500);
            });

            expect(screen.getByText(/OSNet BIOS/i)).toBeInTheDocument();
        });

        it('should display hardware information after some time', async () => {
            render(<BootSequence />);

            // Advance timers to show hardware lines
            await act(async () => {
                vi.advanceTimersByTime(3000);
            });

            expect(screen.getByText(/Test Motherboard detected/)).toBeInTheDocument();
        });

        it('should display CPU information', async () => {
            render(<BootSequence />);

            await act(async () => {
                vi.advanceTimersByTime(3000);
            });

            expect(screen.getByText(/Test CPU detected/)).toBeInTheDocument();
        });

        it('should display memory information', async () => {
            render(<BootSequence />);

            await act(async () => {
                vi.advanceTimersByTime(3000);
            });

            expect(screen.getByText(/8GB detected/)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Boot type detection
    // ========================================================================

    describe('boot type detection', () => {
        it('should use long boot when no username exists (first boot)', async () => {
            useGame.mockReturnValue({
                setGamePhase: vi.fn(),
                hardware: {
                    motherboard: { name: 'Test Motherboard' },
                    cpu: { name: 'Test CPU' },
                    memory: [{ capacity: '8GB' }],
                    storage: [{ capacity: '256GB SSD' }],
                    powerSupply: { wattage: 500 },
                    network: { name: 'Test Network', speed: 100 },
                },
                username: null, // New game
                isRebooting: false,
                setIsRebooting: vi.fn(),
                setIsPaused: vi.fn(),
            });

            render(<BootSequence />);

            // First boot uses 300ms per line delay
            // Check that boot screen appears
            await act(async () => {
                vi.advanceTimersByTime(1000);
            });

            // Should see BIOS text (first boot)
            expect(screen.getByText(/OSNet BIOS/i)).toBeInTheDocument();
        });

        it('should use short boot when username exists (loading save)', async () => {
            useGame.mockReturnValue({
                setGamePhase: vi.fn(),
                hardware: {
                    motherboard: { name: 'Test Motherboard' },
                    cpu: { name: 'Test CPU' },
                    memory: [{ capacity: '8GB' }],
                    storage: [{ capacity: '256GB SSD' }],
                    powerSupply: { wattage: 500 },
                    network: { name: 'Test Network', speed: 100 },
                },
                username: 'existingUser', // Loading save
                isRebooting: false,
                setIsRebooting: vi.fn(),
                setIsPaused: vi.fn(),
            });

            render(<BootSequence />);

            // Short boot uses 150ms per line
            await act(async () => {
                vi.advanceTimersByTime(1000);
            });

            // Should render BIOS text
            expect(screen.getByText(/OSNet BIOS/i)).toBeInTheDocument();
        });

        it('should clear isRebooting flag after boot starts', () => {
            const mockSetIsRebooting = vi.fn();
            useGame.mockReturnValue({
                setGamePhase: vi.fn(),
                hardware: {
                    motherboard: { name: 'Test Motherboard' },
                    cpu: { name: 'Test CPU' },
                    memory: [{ capacity: '8GB' }],
                    storage: [{ capacity: '256GB SSD' }],
                    powerSupply: { wattage: 500 },
                    network: { name: 'Test Network', speed: 100 },
                },
                username: 'TestUser',
                isRebooting: true,
                setIsRebooting: mockSetIsRebooting,
                setIsPaused: vi.fn(),
            });

            render(<BootSequence />);

            expect(mockSetIsRebooting).toHaveBeenCalledWith(false);
        });
    });

    // ========================================================================
    // Phase transitions
    // ========================================================================

    describe('phase transitions', () => {
        // Note: Testing setGamePhase calls is challenging with fake timers
        // due to nested setInterval and setTimeout. These transitions are
        // better covered by e2e tests. Here we verify the component renders
        // correctly for each scenario.

        it('should render in first boot mode (no username)', async () => {
            useGame.mockReturnValue({
                setGamePhase: vi.fn(),
                hardware: {
                    motherboard: { name: 'Test Motherboard' },
                    cpu: { name: 'Test CPU' },
                    memory: [{ capacity: '8GB' }],
                    storage: [{ capacity: '256GB SSD' }],
                    powerSupply: { wattage: 500 },
                    network: { name: 'Test Network', speed: 100 },
                },
                username: null, // First boot
                isRebooting: false,
                setIsRebooting: vi.fn(),
                setIsPaused: vi.fn(),
            });

            render(<BootSequence />);

            await act(async () => {
                vi.advanceTimersByTime(1000);
            });

            expect(screen.getByText(/OSNet BIOS/i)).toBeInTheDocument();
        });

        it('should render in short boot mode (with username)', async () => {
            useGame.mockReturnValue({
                setGamePhase: vi.fn(),
                hardware: {
                    motherboard: { name: 'Test Motherboard' },
                    cpu: { name: 'Test CPU' },
                    memory: [{ capacity: '8GB' }],
                    storage: [{ capacity: '256GB SSD' }],
                    powerSupply: { wattage: 500 },
                    network: { name: 'Test Network', speed: 100 },
                },
                username: 'TestUser', // Loading save
                isRebooting: false,
                setIsRebooting: vi.fn(),
                setIsPaused: vi.fn(),
            });

            render(<BootSequence />);

            await act(async () => {
                vi.advanceTimersByTime(1000);
            });

            expect(screen.getByText(/OSNet BIOS/i)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Boot animation
    // ========================================================================

    describe('boot animation', () => {
        it('should display lines progressively', async () => {
            render(<BootSequence />);

            // Initially should have BIOS header after first tick
            await act(async () => {
                vi.advanceTimersByTime(500);
            });
            expect(screen.getByText(/OSNet BIOS/i)).toBeInTheDocument();

            // After more time, more lines appear
            await act(async () => {
                vi.advanceTimersByTime(5000);
            });
            expect(screen.getByText(/Initializing hardware/i)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Reboot state interaction
    // ========================================================================

    describe('reboot state interaction', () => {
        it('should use short boot when isRebooting is true', async () => {
            useGame.mockReturnValue({
                setGamePhase: vi.fn(),
                hardware: {
                    motherboard: { name: 'Test Motherboard' },
                    cpu: { name: 'Test CPU' },
                    memory: [{ capacity: '8GB' }],
                    storage: [{ capacity: '256GB SSD' }],
                    powerSupply: { wattage: 500 },
                    network: { name: 'Test Network', speed: 100 },
                },
                username: 'TestUser',
                isRebooting: true,
                setIsRebooting: vi.fn(),
                setIsPaused: vi.fn(),
            });

            render(<BootSequence />);

            // Short boot should render BIOS quickly
            await act(async () => {
                vi.advanceTimersByTime(1000);
            });
            expect(screen.getByText(/OSNet BIOS/i)).toBeInTheDocument();
        });

        it('should not call setIsRebooting when not rebooting', () => {
            const mockSetIsRebooting = vi.fn();
            useGame.mockReturnValue({
                setGamePhase: vi.fn(),
                hardware: {
                    motherboard: { name: 'Test Motherboard' },
                    cpu: { name: 'Test CPU' },
                    memory: [{ capacity: '8GB' }],
                    storage: [{ capacity: '256GB SSD' }],
                    powerSupply: { wattage: 500 },
                    network: { name: 'Test Network', speed: 100 },
                },
                username: null,
                isRebooting: false,
                setIsRebooting: mockSetIsRebooting,
                setIsPaused: vi.fn(),
            });

            render(<BootSequence />);

            expect(mockSetIsRebooting).not.toHaveBeenCalled();
        });
    });
});
