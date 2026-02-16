/**
 * useAntivirusScanner Hook - Active antivirus scanning for local SSD files
 *
 * When the Advanced Firewall & Antivirus is running as active passive software,
 * this hook monitors localSSDFiles for files with malware: true.
 * After a CPU-dependent scan delay, it quarantines (removes) the file,
 * marks it as known malicious, and emits events for UI and mission tracking.
 */

import { useEffect, useRef } from 'react';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../core/gameTimeScheduler';
import { parseCpuSpecs } from './DecryptionSystem';
import triggerEventBus from '../core/triggerEventBus';

/**
 * Calculate scan delay based on CPU specs
 * Faster CPUs scan faster. Range: 3000ms - 8000ms game time.
 * @param {string} cpuSpecs - CPU specs string (e.g., "2GHz, 2 cores")
 * @returns {number} Scan delay in milliseconds
 */
const calculateScanDelay = (cpuSpecs) => {
  const { ghz, cores } = parseCpuSpecs(cpuSpecs);
  return Math.max(3000, Math.round(8000 / (ghz * cores)));
};

/**
 * Hook to actively scan local SSD files for malware
 * @param {object} params
 * @param {string[]} params.activePassiveSoftware - Active passive software IDs
 * @param {object[]} params.localSSDFiles - Files on local SSD
 * @param {string} params.cpuSpecs - CPU specs string
 * @param {number} params.timeSpeed - Current game time speed
 * @param {function} params.removeFileFromLocalSSD - Function to remove a file
 * @param {function} params.addKnownMaliciousFile - Function to mark a file as known malicious
 */
export const useAntivirusScanner = ({
  activePassiveSoftware,
  localSSDFiles,
  cpuSpecs,
  timeSpeed,
  removeFileFromLocalSSD,
  addKnownMaliciousFile,
}) => {
  // Track files already scanned or currently being scanned (by name + source key)
  const scannedFilesRef = useRef(new Set());
  // Track active scan timers for cleanup
  const activeTimersRef = useRef(new Set());

  const isAvActive = activePassiveSoftware.includes('advanced-firewall-av');

  // Clear scanned files when AV is deactivated
  useEffect(() => {
    if (!isAvActive) {
      scannedFilesRef.current = new Set();
      activeTimersRef.current.forEach(timerId => clearGameTimeCallback(timerId));
      activeTimersRef.current = new Set();
    }
  }, [isAvActive]);

  // Monitor for malware files
  useEffect(() => {
    if (!isAvActive) return;

    const malwareFiles = localSSDFiles.filter(
      f => f.malware === true && !scannedFilesRef.current.has(f.name)
    );

    if (malwareFiles.length === 0) return;

    malwareFiles.forEach(file => {
      // Mark as being scanned immediately to prevent duplicates
      scannedFilesRef.current.add(file.name);

      const delay = calculateScanDelay(cpuSpecs);

      // Emit scan started event for SecurityIndicator
      triggerEventBus.emit('avScanStarted', {
        fileName: file.name,
        sourceFileSystemId: file.sourceFileSystemId || null,
      });

      const timerId = scheduleGameTimeCallback(() => {
        activeTimersRef.current.delete(timerId);

        // Mark as known malicious
        addKnownMaliciousFile(file.name, file.sourceFileSystemId || null);

        // Quarantine: remove from local SSD
        removeFileFromLocalSSD(file.name);

        // Emit event for mission objective tracking
        triggerEventBus.emit('avThreatDetected', {
          fileName: file.name,
          fileSystemId: file.sourceFileSystemId || null,
        });

        // Emit event for SecurityIndicator to show "cleared"
        triggerEventBus.emit('avThreatCleared', {
          fileName: file.name,
        });
      }, delay, timeSpeed);

      activeTimersRef.current.add(timerId);
    });
  }, [isAvActive, localSSDFiles, cpuSpecs, timeSpeed, removeFileFromLocalSSD, addKnownMaliciousFile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeTimersRef.current.forEach(timerId => clearGameTimeCallback(timerId));
      activeTimersRef.current = new Set();
    };
  }, []);
};

export default useAntivirusScanner;
