/**
 * App Registry - Single source of truth for app metadata
 *
 * Replaces duplicated getAppTitle() switches in Window.jsx, MinimizedWindowBar.jsx,
 * and appMap in TopBar.jsx.
 */

/**
 * Registry of all apps, keyed by appId.
 * Each entry has: appId, title, softwareId, and optional flags.
 */
export const APP_REGISTRY = {
  mail: { appId: 'mail', title: 'SNet Mail', softwareId: 'mail' },
  banking: { appId: 'banking', title: 'SNet Banking App', softwareId: 'banking' },
  portal: { appId: 'portal', title: 'OSNet Portal', softwareId: 'portal' },
  missionBoard: { appId: 'missionBoard', title: 'SourceNet Mission Board', softwareId: 'mission-board' },
  vpnClient: { appId: 'vpnClient', title: 'SourceNet VPN Client', softwareId: 'vpn-client' },
  networkScanner: { appId: 'networkScanner', title: 'Network Scanner', softwareId: 'network-scanner' },
  networkAddressRegister: { appId: 'networkAddressRegister', title: 'Network Address Register', softwareId: 'network-address-register' },
  fileManager: { appId: 'fileManager', title: 'File Manager', softwareId: 'file-manager' },
  logViewer: { appId: 'logViewer', title: 'Log Viewer', softwareId: 'log-viewer' },
  dataRecoveryTool: { appId: 'dataRecoveryTool', title: 'Data Recovery Tool', softwareId: 'data-recovery-tool' },
  decryptionTool: { appId: 'decryptionTool', title: 'Decryption Tool', softwareId: 'decryption-tool' },
  advancedFirewallAv: { appId: 'advancedFirewallAv', title: 'Advanced Firewall & Antivirus', softwareId: 'advanced-firewall-av' },
  passwordCracker: { appId: 'passwordCracker', title: 'Password Cracker', softwareId: 'password-cracker' },
  vpnRelayUpgrade: { appId: 'vpnRelayUpgrade', title: 'VPN Relay Module', softwareId: 'vpn-relay-upgrade', hidden: true },
  traceMonitor: { appId: 'traceMonitor', title: 'Trace Monitor', softwareId: 'trace-monitor' },
  networkSniffer: { appId: 'networkSniffer', title: 'Network Sniffer', softwareId: 'network-sniffer' },
};

/**
 * Get app title by appId
 * @param {string} appId - The app ID (e.g. 'mail', 'vpnClient')
 * @returns {string} The display title
 */
export function getAppTitle(appId) {
  return APP_REGISTRY[appId]?.title || 'Unknown App';
}

// Index by softwareId for TopBar's app launcher
const softwareIdIndex = Object.fromEntries(
  Object.values(APP_REGISTRY).map(entry => [entry.softwareId, entry])
);

/**
 * Get app entry by softwareId
 * @param {string} softwareId - The software ID (e.g. 'vpn-client', 'mission-board')
 * @returns {object|null} The app registry entry or null
 */
export function getAppBySoftwareId(softwareId) {
  return softwareIdIndex[softwareId] || null;
}
