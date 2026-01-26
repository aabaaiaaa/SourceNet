import { describe, it, expect } from 'vitest';
import { formatTimeRemaining, formatTransferSpeed, formatSize } from './formatUtils';

describe('formatUtils', () => {
    describe('formatTimeRemaining', () => {
        it('should return empty string for zero or negative seconds', () => {
            expect(formatTimeRemaining(0)).toBe('');
            expect(formatTimeRemaining(-5)).toBe('');
        });

        it('should return empty string for non-finite values', () => {
            expect(formatTimeRemaining(Infinity)).toBe('');
            expect(formatTimeRemaining(NaN)).toBe('');
        });

        it('should format seconds only when less than 60', () => {
            expect(formatTimeRemaining(5)).toBe('5s');
            expect(formatTimeRemaining(30)).toBe('30s');
            expect(formatTimeRemaining(59.4)).toBe('60s');
        });

        it('should format minutes and seconds when 60 or more', () => {
            expect(formatTimeRemaining(60)).toBe('1m 0s');
            expect(formatTimeRemaining(90)).toBe('1m 30s');
            expect(formatTimeRemaining(125)).toBe('2m 5s');
        });
    });

    describe('formatTransferSpeed', () => {
        it('should return empty string for invalid values', () => {
            expect(formatTransferSpeed(0)).toBe('');
            expect(formatTransferSpeed(-5)).toBe('');
            expect(formatTransferSpeed(null)).toBe('');
            expect(formatTransferSpeed(undefined)).toBe('');
            expect(formatTransferSpeed(Infinity)).toBe('');
        });

        it('should format speed with one decimal place', () => {
            expect(formatTransferSpeed(3.2)).toBe('3.2 MB/s');
            expect(formatTransferSpeed(10)).toBe('10.0 MB/s');
            expect(formatTransferSpeed(0.5)).toBe('0.5 MB/s');
        });
    });

    describe('formatSize', () => {
        it('should format MB for values under 1000', () => {
            expect(formatSize(150)).toBe('150 MB');
            expect(formatSize(500)).toBe('500 MB');
        });

        it('should format GB for values 1000 or more', () => {
            expect(formatSize(1000)).toBe('1.0 GB');
            expect(formatSize(1500)).toBe('1.5 GB');
            expect(formatSize(2048)).toBe('2.0 GB');
        });
    });
});
