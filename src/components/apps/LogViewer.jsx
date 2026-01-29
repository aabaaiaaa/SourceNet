import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import networkRegistry from '../../systems/NetworkRegistry';
import './LogViewer.css';

/**
 * LogViewer - View operation logs for discovered devices
 * 
 * Displays file operation logs (copy, paste, delete) stored per-device
 * in NetworkRegistry. Helps players track their activities and detect
 * potential traces of their work.
 */
const LogViewer = () => {
    const game = useGame();
    const { currentTime, lastScanResults, discoveredDevices } = game;
    const [selectedDevice, setSelectedDevice] = useState('');
    const [logs, setLogs] = useState([]);
    const [filterType, setFilterType] = useState('all'); // 'all', 'copy', 'paste', 'delete'
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Get all discovered devices from scan results and stored discovered devices
    const getDiscoveredDevices = () => {
        const devices = [];
        const seen = new Set();

        // Add devices from last scan results
        if (lastScanResults?.machines) {
            lastScanResults.machines.forEach(machine => {
                if (!seen.has(machine.ip)) {
                    seen.add(machine.ip);
                    devices.push({
                        ip: machine.ip,
                        hostname: machine.name || machine.hostname,
                        networkId: lastScanResults.network,
                    });
                }
            });
        }

        // Add devices from stored discovered devices
        if (discoveredDevices) {
            Object.values(discoveredDevices).flat().forEach(device => {
                if (!seen.has(device.ip)) {
                    seen.add(device.ip);
                    devices.push({
                        ip: device.ip,
                        hostname: device.hostname || device.name,
                        networkId: device.networkId,
                    });
                }
            });
        }

        return devices;
    };

    const availableDevices = getDiscoveredDevices();

    // Load logs for selected device
    useEffect(() => {
        if (!selectedDevice) {
            setLogs([]);
            return;
        }

        const device = networkRegistry.getDevice(selectedDevice);
        if (device) {
            const deviceLogs = device.logs || [];
            setLogs(deviceLogs);
        } else {
            setLogs([]);
        }
    }, [selectedDevice, currentTime]); // Refresh when time changes (if auto-refresh is on)

    // Auto-refresh logs periodically
    useEffect(() => {
        if (!autoRefresh || !selectedDevice) return;

        const refreshInterval = setInterval(() => {
            const device = networkRegistry.getDevice(selectedDevice);
            if (device) {
                setLogs(device.logs || []);
            }
        }, 1000);

        return () => clearInterval(refreshInterval);
    }, [autoRefresh, selectedDevice]);

    // Filter logs by type
    const filteredLogs = filterType === 'all'
        ? logs
        : logs.filter(log => log.action?.toLowerCase() === filterType);

    // Format timestamp for display
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

    // Get icon for action type
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

    // Get CSS class for action type
    const getActionClass = (action) => {
        switch (action?.toLowerCase()) {
            case 'copy': return 'action-copy';
            case 'paste': return 'action-paste';
            case 'delete': return 'action-delete';
            case 'download': return 'action-download';
            case 'upload': return 'action-upload';
            default: return '';
        }
    };

    return (
        <div className="log-viewer">
            <div className="log-viewer-header">
                <h2>📋 Log Viewer</h2>
                <p className="log-viewer-subtitle">View file operation logs for discovered devices</p>
            </div>

            <div className="log-viewer-controls">
                <div className="device-selector">
                    <label>Device:</label>
                    <select
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                    >
                        <option value="">-- Select a device --</option>
                        {availableDevices.map(device => (
                            <option key={device.ip} value={device.ip}>
                                {device.hostname} ({device.ip})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-controls">
                    <label>Filter:</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="all">All Operations</option>
                        <option value="copy">Copy Only</option>
                        <option value="paste">Paste Only</option>
                        <option value="delete">Delete Only</option>
                    </select>
                </div>

                <div className="auto-refresh-toggle">
                    <label>
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                </div>
            </div>

            <div className="log-viewer-content">
                {!selectedDevice ? (
                    <div className="log-viewer-empty">
                        <p>Select a device to view its operation logs.</p>
                        <p className="hint">Tip: Scan networks with Network Scanner to discover devices.</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="log-viewer-empty">
                        <p>No {filterType !== 'all' ? filterType + ' ' : ''}logs found for this device.</p>
                        <p className="hint">File operations (copy, paste, delete) will be logged here.</p>
                    </div>
                ) : (
                    <div className="log-entries">
                        <div className="log-header-row">
                            <span className="log-col-time">Time</span>
                            <span className="log-col-action">Action</span>
                            <span className="log-col-file">File</span>
                            <span className="log-col-details">Details</span>
                        </div>
                        {filteredLogs.slice().reverse().map((log, index) => (
                            <div
                                key={log.id || index}
                                className={`log-entry ${getActionClass(log.action)}`}
                            >
                                <span className="log-col-time">{formatTimestamp(log.timestamp)}</span>
                                <span className="log-col-action">
                                    {getActionIcon(log.action)} {log.action?.toUpperCase()}
                                </span>
                                <span className="log-col-file" title={log.filePath || log.fileName}>
                                    {log.fileName || log.filePath || 'Unknown'}
                                </span>
                                <span className="log-col-details">
                                    {log.sizeBytes ? `${(log.sizeBytes / 1024).toFixed(1)} KB` : ''}
                                    {log.sourceIp && log.sourceIp !== selectedDevice ? ` from ${log.sourceIp}` : ''}
                                    {log.destIp && log.destIp !== selectedDevice ? ` to ${log.destIp}` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="log-viewer-footer">
                <span className="log-count">
                    {filteredLogs.length} {filterType !== 'all' ? filterType + ' ' : ''}log entries
                </span>
                {autoRefresh && (
                    <span className="refresh-indicator">🔄 Auto-refreshing</span>
                )}
            </div>
        </div>
    );
};

export default LogViewer;
