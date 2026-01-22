import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock useGame hook
const mockSetGamePhase = vi.fn();

vi.mock('../../contexts/useGame', () => ({
    useGame: vi.fn(() => ({
        setGamePhase: mockSetGamePhase,
    })),
}));

import SleepAnimation from './SleepAnimation';

// ============================================================================
// Tests
// ============================================================================

describe('SleepAnimation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Rendering
    // ========================================================================

    describe('rendering', () => {
        it('should display sleep icon', () => {
            render(<SleepAnimation />);

            expect(screen.getByText('💤')).toBeInTheDocument();
        });

        it('should display "Sleeping..." message', () => {
            render(<SleepAnimation />);

            expect(screen.getByText('Sleeping...')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Phase transitions
    // ========================================================================

    describe('phase transitions', () => {
        it('should transition to "login" phase after 2 seconds', async () => {
            render(<SleepAnimation />);

            // Should not transition immediately
            expect(mockSetGamePhase).not.toHaveBeenCalled();

            // Advance time by 2 seconds
            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            expect(mockSetGamePhase).toHaveBeenCalledWith('login');
        });

        it('should not transition before 2 seconds', async () => {
            render(<SleepAnimation />);

            await act(async () => {
                vi.advanceTimersByTime(1500);
            });

            expect(mockSetGamePhase).not.toHaveBeenCalled();
        });

        it('should transition exactly at 2 seconds', async () => {
            render(<SleepAnimation />);

            await act(async () => {
                vi.advanceTimersByTime(1999);
            });

            expect(mockSetGamePhase).not.toHaveBeenCalled();

            await act(async () => {
                vi.advanceTimersByTime(1);
            });

            expect(mockSetGamePhase).toHaveBeenCalledWith('login');
        });
    });

    // ========================================================================
    // Cleanup
    // ========================================================================

    describe('cleanup', () => {
        it('should clear timer on unmount', async () => {
            const { unmount } = render(<SleepAnimation />);

            // Unmount before timer fires
            unmount();

            // Advance time
            await act(async () => {
                vi.advanceTimersByTime(3000);
            });

            // Should not have called setGamePhase after unmount
            expect(mockSetGamePhase).not.toHaveBeenCalled();
        });
    });
});
