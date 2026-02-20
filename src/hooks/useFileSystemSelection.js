/**
 * useFileSystemSelection - Shared hook for building available file system list.
 *
 * Iterates activeConnections, checks networkRegistry for accessible devices
 * that have been discovered, and returns a memoized list of file systems.
 *
 * Used by: DataRecoveryTool, DecryptionTool, and similar tools that operate
 * on remote file systems.
 *
 * @param {Array} activeConnections - Array of active network connections
 * @param {Object} discoveredDevices - Map of networkId -> Set of discovered IPs
 * @returns {Array} Array of { id, ip, name, label, files, networkId }
 */

import { useMemo } from 'react';
import networkRegistry from '../systems/NetworkRegistry';

export function useFileSystemSelection(activeConnections, discoveredDevices) {
  return useMemo(() => {
    const fileSystems = [];
    if (!activeConnections) return fileSystems;

    activeConnections.forEach((connection) => {
      const network = networkRegistry.getNetwork(connection.networkId);
      const discoveredData = discoveredDevices?.[connection.networkId];
      const discovered = discoveredData instanceof Set
        ? discoveredData
        : new Set(discoveredData || []);

      if (network && network.accessible) {
        const accessibleDevices = networkRegistry.getAccessibleDevices(connection.networkId);
        accessibleDevices.forEach((device) => {
          if (discovered.has(device.ip) && device.fileSystemId) {
            const fs = networkRegistry.getFileSystem(device.fileSystemId);
            if (fs) {
              fileSystems.push({
                id: fs.id,
                ip: device.ip,
                name: device.hostname,
                label: `${device.ip} - ${device.hostname}`,
                files: fs.files || [],
                networkId: connection.networkId,
              });
            }
          }
        });
      }
    });

    return fileSystems;
  }, [activeConnections, discoveredDevices]);
}

export default useFileSystemSelection;
