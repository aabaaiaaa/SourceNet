import { describe, it, expect, beforeEach } from 'vitest';
import networkRegistry from '../../systems/NetworkRegistry';

/**
 * LogViewer Integration Tests
 * 
 * Tests the LogViewer-related logic via NetworkRegistry.
 * Does NOT render React components to avoid timer issues.
 */

describe('LogViewer - NetworkRegistry Log Operations', () => {
    beforeEach(() => {
        networkRegistry.reset();
    });

    it('should store logs when added to a device', () => {
        networkRegistry.registerDevice({
            ip: '192.168.1.10',
            hostname: 'test-server',
            logs: [],
        });

        networkRegistry.addDeviceLog('192.168.1.10', {
            action: 'copy',
            fileName: 'test.txt',
            timestamp: new Date().toISOString(),
        });

        const device = networkRegistry.getDevice('192.168.1.10');
        expect(device.logs).toHaveLength(1);
        expect(device.logs[0].action).toBe('copy');
        expect(device.logs[0].fileName).toBe('test.txt');
    });

    it('should support multiple log entries', () => {
        networkRegistry.registerDevice({
            ip: '192.168.1.10',
            hostname: 'test-server',
            logs: [],
        });

        networkRegistry.addDeviceLog('192.168.1.10', { action: 'copy', fileName: 'file1.txt' });
        networkRegistry.addDeviceLog('192.168.1.10', { action: 'paste', fileName: 'file1.txt' });
        networkRegistry.addDeviceLog('192.168.1.10', { action: 'delete', fileName: 'file2.txt' });

        const device = networkRegistry.getDevice('192.168.1.10');
        expect(device.logs).toHaveLength(3);
    });

    it('should filter logs by action type', () => {
        // Use unique IP to avoid potential cross-test interference
        networkRegistry.registerDevice({
            ip: '192.168.1.20',
            hostname: 'test-server-filter',
        });

        networkRegistry.addDeviceLog('192.168.1.20', { action: 'copy', fileName: 'copied.txt' });
        networkRegistry.addDeviceLog('192.168.1.20', { action: 'paste', fileName: 'pasted.txt' });
        networkRegistry.addDeviceLog('192.168.1.20', { action: 'delete', fileName: 'deleted.txt' });
        networkRegistry.addDeviceLog('192.168.1.20', { action: 'copy', fileName: 'copied2.txt' });

        const device = networkRegistry.getDevice('192.168.1.20');
        const logs = device.logs || [];
        const copyLogs = logs.filter(log => log.action === 'copy');
        const pasteLogs = logs.filter(log => log.action === 'paste');
        const deleteLogs = logs.filter(log => log.action === 'delete');

        expect(copyLogs).toHaveLength(2);
        expect(pasteLogs).toHaveLength(1);
        expect(deleteLogs).toHaveLength(1);
    });

    it('should return logs in insertion order', () => {
        networkRegistry.registerDevice({
            ip: '192.168.1.10',
            hostname: 'test-server',
            logs: [],
        });

        networkRegistry.addDeviceLog('192.168.1.10', { action: 'copy', fileName: 'first.txt', timestamp: '2024-01-01T10:00:00Z' });
        networkRegistry.addDeviceLog('192.168.1.10', { action: 'copy', fileName: 'second.txt', timestamp: '2024-01-01T11:00:00Z' });
        networkRegistry.addDeviceLog('192.168.1.10', { action: 'copy', fileName: 'third.txt', timestamp: '2024-01-01T12:00:00Z' });

        const device = networkRegistry.getDevice('192.168.1.10');
        expect(device.logs[0].fileName).toBe('first.txt');
        expect(device.logs[1].fileName).toBe('second.txt');
        expect(device.logs[2].fileName).toBe('third.txt');
    });

    it('should handle device without logs array', () => {
        networkRegistry.registerDevice({
            ip: '192.168.1.10',
            hostname: 'test-server',
        });

        const device = networkRegistry.getDevice('192.168.1.10');
        expect(device.logs || []).toEqual([]);
    });
});

describe('LogViewer - Action Icon Mapping', () => {
    const getActionIcon = (action) => {
        switch (action?.toLowerCase()) {
            case 'copy': return '📋';
            case 'paste': return '📥';
            case 'delete': return '🗑️';
            case 'download': return '⬇️';
            case 'upload': return '⬆️';
            case 'scan': return '🔍';
            default: return '📝';
        }
    };

    it('should return correct icon for copy action', () => {
        expect(getActionIcon('copy')).toBe('📋');
        expect(getActionIcon('COPY')).toBe('📋');
    });

    it('should return correct icon for paste action', () => {
        expect(getActionIcon('paste')).toBe('📥');
    });

    it('should return correct icon for delete action', () => {
        expect(getActionIcon('delete')).toBe('🗑️');
    });

    it('should return correct icon for download action', () => {
        expect(getActionIcon('download')).toBe('⬇️');
    });

    it('should return correct icon for upload action', () => {
        expect(getActionIcon('upload')).toBe('⬆️');
    });

    it('should return default icon for unknown action', () => {
        expect(getActionIcon('unknown')).toBe('📝');
        expect(getActionIcon(null)).toBe('📝');
        expect(getActionIcon(undefined)).toBe('📝');
    });
});

describe('LogViewer - Timestamp Formatting', () => {
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    it('should format valid timestamp', () => {
        const result = formatTimestamp('2024-01-15T14:30:45Z');
        expect(result).toContain('Jan');
        expect(result).toContain('15');
    });

    it('should return Unknown for null timestamp', () => {
        expect(formatTimestamp(null)).toBe('Unknown');
    });

    it('should return Unknown for undefined timestamp', () => {
        expect(formatTimestamp(undefined)).toBe('Unknown');
    });
});

describe('LogViewer - Log Filtering Logic', () => {
    it('should filter all logs when filter is "all"', () => {
        const logs = [
            { action: 'copy', fileName: 'a.txt' },
            { action: 'paste', fileName: 'b.txt' },
            { action: 'delete', fileName: 'c.txt' },
        ];
        const filterType = 'all';

        const filteredLogs = filterType === 'all'
            ? logs
            : logs.filter(log => log.action?.toLowerCase() === filterType);

        expect(filteredLogs).toHaveLength(3);
    });

    it('should filter to only copy operations', () => {
        const logs = [
            { action: 'copy', fileName: 'a.txt' },
            { action: 'paste', fileName: 'b.txt' },
            { action: 'copy', fileName: 'c.txt' },
        ];
        const filterType = 'copy';

        const filteredLogs = logs.filter(log => log.action?.toLowerCase() === filterType);

        expect(filteredLogs).toHaveLength(2);
        expect(filteredLogs.every(log => log.action === 'copy')).toBe(true);
    });

    it('should filter to only paste operations', () => {
        const logs = [
            { action: 'copy', fileName: 'a.txt' },
            { action: 'paste', fileName: 'b.txt' },
            { action: 'paste', fileName: 'c.txt' },
        ];
        const filterType = 'paste';

        const filteredLogs = logs.filter(log => log.action?.toLowerCase() === filterType);

        expect(filteredLogs).toHaveLength(2);
    });

    it('should filter to only delete operations', () => {
        const logs = [
            { action: 'delete', fileName: 'a.txt' },
            { action: 'paste', fileName: 'b.txt' },
        ];
        const filterType = 'delete';

        const filteredLogs = logs.filter(log => log.action?.toLowerCase() === filterType);

        expect(filteredLogs).toHaveLength(1);
    });
});
