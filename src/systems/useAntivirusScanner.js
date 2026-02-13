/**
 * useAntivirusScanner Hook - Active antivirus scanning for local SSD files
 *
 * When the Advanced Firewall & Antivirus is running as active passive software,
 * this hook monitors localSSDFiles for files with malware: true.
 * After a CPU-dependent scan delay, it quarantines (removes) the file,
 * sends an alert message, and emits an avThreatDetected event.
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
 * @param {function} params.addMessage - Function to add a message
 */
export const useAntivirusScanner = ({
  activePassiveSoftware,
  localSSDFiles,
  cpuSpecs,
  timeSpeed,
  removeFileFromLocalSSD,
  addMessage,
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

      const timerId = scheduleGameTimeCallback(() => {
        activeTimersRef.current.delete(timerId);

        // Quarantine: remove from local SSD
        removeFileFromLocalSSD(file.name);

        // Send AV alert message
        addMessage({
          id: `av-alert-${file.name}-${Date.now()}`,
          from: 'Advanced Firewall & Antivirus',
          fromId: 'SNET-AV-001',
          fromName: 'Advanced Firewall & Antivirus',
          subject: `Threat Detected: ${file.name}`,
          body: `THREAT ALERT

A malicious file has been detected and quarantined on your local SSD.

File: ${file.name}
Size: ${file.size || 'Unknown'}
Status: QUARANTINED (removed from local storage)

The file has been securely removed from your system. No further action is required.

If this file was part of a mission, check if additional cleanup is needed on remote servers.

- Advanced Firewall & Antivirus`,
          timestamp: null,
          read: false,
          archived: false,
        });

        // Emit event for mission objective tracking
        triggerEventBus.emit('avThreatDetected', {
          fileName: file.name,
          fileSystemId: file.sourceFileSystemId || null,
        });
      }, delay, timeSpeed);

      activeTimersRef.current.add(timerId);
    });
  }, [isAvActive, localSSDFiles, cpuSpecs, timeSpeed, removeFileFromLocalSSD, addMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeTimersRef.current.forEach(timerId => clearGameTimeCallback(timerId));
      activeTimersRef.current = new Set();
    };
  }, []);
};

export default useAntivirusScanner;
