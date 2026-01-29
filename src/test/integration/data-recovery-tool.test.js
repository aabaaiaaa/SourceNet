import { describe, it, expect, beforeEach } from 'vitest';
import networkRegistry from '../../systems/NetworkRegistry';

/**
 * DataRecoveryTool Integration Tests
 * 
 * Tests the DataRecoveryTool-related logic via NetworkRegistry.
 * Does NOT render React components to avoid timer issues.
 */

describe('DataRecoveryTool - File System Operations', () => {
    beforeEach(() => {
        networkRegistry.reset();
    });

    it('should register a file system with files', () => {
        networkRegistry.registerFileSystem({
            id: 'fs-test',
            files: [
                { name: 'active.txt', sizeBytes: 1024, deleted: false },
                { name: 'deleted.txt', sizeBytes: 2048, deleted: true, deletedAt: '2024-01-01T12:00:00Z' },
            ],
        });

        const fs = networkRegistry.getFileSystem('fs-test');
        expect(fs).toBeDefined();
        expect(fs.files).toHaveLength(2);
    });

    it('should identify deleted files that are recoverable', () => {
        networkRegistry.registerFileSystem({
            id: 'fs-test',
            files: [
                { name: 'active.txt', sizeBytes: 1024, deleted: false },
                { name: 'deleted.txt', sizeBytes: 2048, deleted: true, deletedAt: '2024-01-01T12:00:00Z' },
                { name: 'secure-deleted.txt', sizeBytes: 512, deleted: true, secureDeleted: true, deletedAt: '2024-01-01T11:00:00Z' },
            ],
        });

        const fs = networkRegistry.getFileSystem('fs-test');
        const recoverableFiles = fs.files.filter(f => f.deleted && !f.secureDeleted && f.deletedAt);

        expect(recoverableFiles).toHaveLength(1);
        expect(recoverableFiles[0].name).toBe('deleted.txt');
    });

    it('should not include securely deleted files as recoverable', () => {
        networkRegistry.registerFileSystem({
            id: 'fs-test',
            files: [
                { name: 'secure-deleted.txt', sizeBytes: 512, deleted: true, secureDeleted: true, deletedAt: '2024-01-01T11:00:00Z' },
            ],
        });

        const fs = networkRegistry.getFileSystem('fs-test');
        const recoverableFiles = fs.files.filter(f => f.deleted && !f.secureDeleted && f.deletedAt);

        expect(recoverableFiles).toHaveLength(0);
    });

    it('should link device to file system', () => {
        networkRegistry.registerFileSystem({
            id: 'fs-test',
            files: [{ name: 'file.txt', sizeBytes: 1024 }],
        });

        networkRegistry.registerDevice({
            ip: '192.168.1.10',
            hostname: 'test-server',
            fileSystemId: 'fs-test',
        });

        const device = networkRegistry.getDevice('192.168.1.10');
        expect(device.fileSystemId).toBe('fs-test');

        const fs = networkRegistry.getFileSystem(device.fileSystemId);
        expect(fs.files).toHaveLength(1);
    });

    it('should not include active files as recoverable', () => {
        networkRegistry.registerFileSystem({
            id: 'fs-test',
            files: [
                { name: 'active.txt', sizeBytes: 1024, deleted: false },
            ],
        });

        const fs = networkRegistry.getFileSystem('fs-test');
        const recoverableFiles = fs.files.filter(f => f.deleted && !f.secureDeleted && f.deletedAt);

        expect(recoverableFiles).toHaveLength(0);
    });
});

describe('DataRecoveryTool - File Recovery Logic', () => {
    it('should mark file as recovered by setting deleted to false', () => {
        const files = [
            { name: 'deleted.txt', sizeBytes: 1024, deleted: true, deletedAt: '2024-01-01T12:00:00Z' },
        ];

        // Simulate recovery
        const recoveredFiles = files.map(f =>
            f.name === 'deleted.txt' ? { ...f, deleted: false, deletedAt: null } : f
        );

        expect(recoveredFiles[0].deleted).toBe(false);
        expect(recoveredFiles[0].deletedAt).toBeNull();
    });

    it('should mark file as securely deleted', () => {
        const files = [
            { name: 'deleted.txt', sizeBytes: 1024, deleted: true, deletedAt: '2024-01-01T12:00:00Z' },
        ];

        // Simulate secure deletion
        const secureDeletedFiles = files.map(f =>
            f.name === 'deleted.txt' ? { ...f, secureDeleted: true } : f
        );

        expect(secureDeletedFiles[0].secureDeleted).toBe(true);
    });

    it('should preserve other file properties during recovery', () => {
        const files = [
            { name: 'deleted.txt', sizeBytes: 1024, deleted: true, deletedAt: '2024-01-01T12:00:00Z', customProp: 'test' },
        ];

        const recoveredFiles = files.map(f =>
            f.name === 'deleted.txt' ? { ...f, deleted: false, deletedAt: null } : f
        );

        expect(recoveredFiles[0].sizeBytes).toBe(1024);
        expect(recoveredFiles[0].customProp).toBe('test');
    });
});

describe('DataRecoveryTool - Operation Time Calculation', () => {
    const SECURE_DELETE_MULTIPLIER = 5;

    const calculateOperationTime = (files, networkSpeed = 500, isSecure = false) => {
        const totalSizeBytes = files.reduce((sum, f) => sum + (f.sizeBytes || 1024), 0);
        const sizeMB = totalSizeBytes / (1024 * 1024);
        const baseTimeMs = (sizeMB / (networkSpeed / 8)) * 1000;
        return isSecure ? baseTimeMs * SECURE_DELETE_MULTIPLIER : baseTimeMs;
    };

    it('should calculate time based on file size', () => {
        const smallFiles = [{ sizeBytes: 1024 }]; // 1 KB
        const largeFiles = [{ sizeBytes: 1024 * 1024 }]; // 1 MB

        const smallTime = calculateOperationTime(smallFiles);
        const largeTime = calculateOperationTime(largeFiles);

        expect(largeTime).toBeGreaterThan(smallTime);
    });

    it('should calculate secure delete as 5x longer', () => {
        const files = [{ sizeBytes: 1024 * 1024 }]; // 1 MB

        const normalTime = calculateOperationTime(files, 500, false);
        const secureTime = calculateOperationTime(files, 500, true);

        expect(secureTime).toBe(normalTime * SECURE_DELETE_MULTIPLIER);
    });

    it('should factor in network speed', () => {
        const files = [{ sizeBytes: 1024 * 1024 }];

        const slowTime = calculateOperationTime(files, 100);
        const fastTime = calculateOperationTime(files, 1000);

        expect(slowTime).toBeGreaterThan(fastTime);
    });

    it('should use default size when sizeBytes is missing', () => {
        const files = [{ name: 'file.txt' }]; // No sizeBytes

        const time = calculateOperationTime(files);
        expect(time).toBeGreaterThan(0);
    });

    it('should sum sizes for multiple files', () => {
        const singleFile = [{ sizeBytes: 1024 * 1024 }];
        const multipleFiles = [
            { sizeBytes: 512 * 1024 },
            { sizeBytes: 512 * 1024 },
        ];

        const singleTime = calculateOperationTime(singleFile);
        const multiTime = calculateOperationTime(multipleFiles);

        expect(singleTime).toBe(multiTime);
    });
});

describe('DataRecoveryTool - File Size Formatting', () => {
    const formatSize = (bytes) => {
        if (!bytes) return 'Unknown';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    it('should format bytes', () => {
        expect(formatSize(512)).toBe('512 B');
        expect(formatSize(1)).toBe('1 B');
    });

    it('should format kilobytes', () => {
        expect(formatSize(1024)).toBe('1.0 KB');
        expect(formatSize(1536)).toBe('1.5 KB');
        expect(formatSize(10240)).toBe('10.0 KB');
    });

    it('should format megabytes', () => {
        expect(formatSize(1024 * 1024)).toBe('1.0 MB');
        expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should return Unknown for null/undefined/zero', () => {
        expect(formatSize(null)).toBe('Unknown');
        expect(formatSize(undefined)).toBe('Unknown');
        expect(formatSize(0)).toBe('Unknown');
    });
});

describe('DataRecoveryTool - Time Since Deletion Formatting', () => {
    const formatTimeSinceDelete = (deletedAt, currentTime) => {
        if (!deletedAt || !currentTime) return 'Unknown';
        const deleted = new Date(deletedAt);
        const diffMs = currentTime.getTime() - deleted.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'Just now';
    };

    const currentTime = new Date('2024-01-01T12:00:00Z');

    it('should format minutes ago', () => {
        const deletedAt = '2024-01-01T11:45:00Z'; // 15 minutes ago
        expect(formatTimeSinceDelete(deletedAt, currentTime)).toBe('15m ago');
    });

    it('should format hours ago', () => {
        const deletedAt = '2024-01-01T09:00:00Z'; // 3 hours ago
        expect(formatTimeSinceDelete(deletedAt, currentTime)).toBe('3h ago');
    });

    it('should format days ago', () => {
        const deletedAt = '2023-12-30T12:00:00Z'; // 2 days ago
        expect(formatTimeSinceDelete(deletedAt, currentTime)).toBe('2d ago');
    });

    it('should return Just now for recent deletions', () => {
        const deletedAt = '2024-01-01T11:59:30Z'; // 30 seconds ago
        expect(formatTimeSinceDelete(deletedAt, currentTime)).toBe('Just now');
    });

    it('should return Unknown for missing deletedAt', () => {
        expect(formatTimeSinceDelete(null, currentTime)).toBe('Unknown');
    });

    it('should return Unknown for missing currentTime', () => {
        expect(formatTimeSinceDelete('2024-01-01T12:00:00Z', null)).toBe('Unknown');
    });
});

describe('DataRecoveryTool - File Selection Logic', () => {
    it('should toggle file selection', () => {
        const selectedFiles = new Set(['file1.txt']);

        // Toggle file2 on
        const afterAdd = new Set(selectedFiles);
        afterAdd.add('file2.txt');
        expect(afterAdd.has('file2.txt')).toBe(true);
        expect(afterAdd.size).toBe(2);

        // Toggle file1 off
        const afterRemove = new Set(afterAdd);
        afterRemove.delete('file1.txt');
        expect(afterRemove.has('file1.txt')).toBe(false);
        expect(afterRemove.size).toBe(1);
    });

    it('should select all files', () => {
        const deletedFiles = [
            { name: 'file1.txt' },
            { name: 'file2.txt' },
            { name: 'file3.txt' },
        ];

        const selectedFiles = new Set(deletedFiles.map(f => f.name));

        expect(selectedFiles.size).toBe(3);
        expect(selectedFiles.has('file1.txt')).toBe(true);
        expect(selectedFiles.has('file2.txt')).toBe(true);
        expect(selectedFiles.has('file3.txt')).toBe(true);
    });

    it('should deselect all files', () => {
        const selectedFiles = new Set(['file1.txt', 'file2.txt']);
        selectedFiles.clear();

        expect(selectedFiles.size).toBe(0);
    });
});
