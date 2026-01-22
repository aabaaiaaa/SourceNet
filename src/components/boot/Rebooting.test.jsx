import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock useGame hook
const mockSetGamePhase = vi.fn();

vi.mock('../../contexts/useGame', () => ({
    useGame: vi.fn(() => ({
        setGamePhase: mockSetGamePhase,
    })),
}));

import Rebooting from './Rebooting';

// ============================================================================
// Tests
// ============================================================================

describe('Rebooting', () => {
    let originalLocation;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Save original location
        originalLocation = window.location;

        // Mock window.location
        delete window.location;
        window.location = {
            search: '',
            href: 'http://localhost/',
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        window.location = originalLocation;
    });

    // ========================================================================
    // Rendering
    // ========================================================================

    describe('rendering', () => {
        it('should display "Rebooting" message', () => {
            render(<Rebooting />);

            expect(screen.getByText('Rebooting')).toBeInTheDocument();
        });

        it('should display animated dots', () => {
            render(<Rebooting />);

            const dots = screen.getAllByText('.');
            expect(dots).toHaveLength(3);
        });
    });

    // ========================================================================
    // Phase transitions
    // ========================================================================

    describe('phase transitions', () => {
        it('should transition to "boot" phase after 2 seconds', async () => {
            render(<Rebooting />);

            // Should not transition immediately
            expect(mockSetGamePhase).not.toHaveBeenCalled();

            // Advance time by 2 seconds
            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            expect(mockSetGamePhase).toHaveBeenCalledWith('boot');
        });

        it('should not transition before 2 seconds', async () => {
            render(<Rebooting />);

            await act(async () => {
                vi.advanceTimersByTime(1500);
            });

            expect(mockSetGamePhase).not.toHaveBeenCalled();
        });
    });

    // ========================================================================
    // E2E skip detection
    // ========================================================================

    describe('E2E skip detection', () => {
        it('should skip to "desktop" when skipBoot param is true', async () => {
            window.location.search = '?skipBoot=true';

            render(<Rebooting />);

            // Should immediately transition to desktop
            expect(mockSetGamePhase).toHaveBeenCalledWith('desktop');
        });

        it('should skip to "desktop" when scenario param exists', async () => {
            window.location.search = '?scenario=test-scenario';

            render(<Rebooting />);

            expect(mockSetGamePhase).toHaveBeenCalledWith('desktop');
        });

        it('should skip to "desktop" when both skipBoot and scenario params exist', async () => {
            window.location.search = '?skipBoot=true&scenario=test';

            render(<Rebooting />);

            expect(mockSetGamePhase).toHaveBeenCalledWith('desktop');
        });

        it('should NOT skip when skipBoot is false', async () => {
            window.location.search = '?skipBoot=false';

            render(<Rebooting />);

            // Should not skip immediately
            expect(mockSetGamePhase).not.toHaveBeenCalledWith('desktop');

            // Should transition to boot after delay
            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            expect(mockSetGamePhase).toHaveBeenCalledWith('boot');
        });

        it('should NOT skip when no skip params present', async () => {
            window.location.search = '';

            render(<Rebooting />);

            expect(mockSetGamePhase).not.toHaveBeenCalled();

            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            expect(mockSetGamePhase).toHaveBeenCalledWith('boot');
        });

        it('should NOT skip when other params are present', async () => {
            window.location.search = '?debug=true&other=value';

            render(<Rebooting />);

            expect(mockSetGamePhase).not.toHaveBeenCalled();

            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            expect(mockSetGamePhase).toHaveBeenCalledWith('boot');
        });
    });

    // ========================================================================
    // Cleanup
    // ========================================================================

    describe('cleanup', () => {
        it('should clear timer on unmount', async () => {
            const { unmount } = render(<Rebooting />);

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
