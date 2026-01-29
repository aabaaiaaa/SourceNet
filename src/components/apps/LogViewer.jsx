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
    const { lastScanResults, discoveredDevices } = game;
    const [selectedDevice, setSelectedDevice] = useState('');
    const [logs, setLogs] = useState([]);
    const [logType, setLogType] = useState('all'); // 'all', 'file', 'remote', 'process'
    const [scope, setScope] = useState('device'); // 'device' | 'network'
    const [selectedNetwork, setSelectedNetwork] = useState('');

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

    const getDiscoveredNetworks = () => {
        const networks = new Set();
        if (lastScanResults?.network) networks.add(lastScanResults.network);
        if (discoveredDevices) {
            Object.keys(discoveredDevices).forEach(nid => networks.add(nid));
        }
        return Array.from(networks);
    };

    const availableNetworks = getDiscoveredNetworks();

    // Load logs for selected device
    useEffect(() => {
        // Clear logs when scope changes
        setLogs([]);

        if (scope === 'device') {
            if (!selectedDevice) return;
            const device = networkRegistry.getDevice(selectedDevice);
            if (device) setLogs(device.logs || []);
            else setLogs([]);
        } else {
            if (!selectedNetwork) return;
            const networkLogs = networkRegistry.getNetworkLogs(selectedNetwork);
            setLogs(networkLogs || []);
        }
    }, [selectedDevice, selectedNetwork, scope]);

    // (auto-refresh removed)

    // Filter logs by explicit log.type
    const filteredLogs = logType === 'all'
        ? logs
        : logs.filter(log => log.type === logType);

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

    return (
        <div className="log-viewer">
            <div className="log-viewer-header">
                <h2>📋 Log Viewer</h2>
                <p className="log-viewer-subtitle">View file operation logs for discovered devices</p>
            </div>

            <div className="log-viewer-controls">
                <div className="device-selector">
                    <label>Scope:</label>
                    <select value={scope} onChange={(e) => { setScope(e.target.value); setSelectedDevice(''); setSelectedNetwork(''); }}>
                        <option value="device">Device</option>
                        <option value="network">Network</option>
                    </select>

                    {scope === 'device' ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <label>Network:</label>
                            <select
                                value={selectedNetwork}
                                onChange={(e) => setSelectedNetwork(e.target.value)}
                            >
                                <option value="">-- Select a network --</option>
                                {availableNetworks.map(nid => (
                                    <option key={nid} value={nid}>{nid}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>

                <div className="filter-controls">
                    <label>Log Type:</label>
                    <select
                        value={logType}
                        onChange={(e) => setLogType(e.target.value)}
                    >
                        <option value="all">All Types</option>
                        <option value="file">File Operations</option>
                        <option value="remote">Remote Connections</option>
                        <option value="process">Processes</option>
                    </select>
                </div>

                {/* auto-refresh removed */}
            </div>

            <div className="log-viewer-content">
                {scope === 'device' ? (
                    !selectedDevice ? (
                        <div className="log-viewer-empty">
                            <p>Select a device to view its operation logs.</p>
                            <p className="hint">Tip: Scan networks with Network Scanner to discover devices.</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="log-viewer-empty">
                            <p>No logs of the selected type found for this device.</p>
                            <p className="hint">Device activity such as file operations, remote connections, and processes will appear here.</p>
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
                                    className="log-entry"
                                >
                                    <span className="log-col-time">{formatTimestamp(log.timestamp)}</span>
                                    <span className="log-col-action">
                                        {log.action?.toUpperCase()}
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
                    )
                ) : (
                    !selectedNetwork ? (
                        <div className="log-viewer-empty">
                            <p>Select a network to view its connection logs.</p>
                            <p className="hint">Tip: Use Network Scanner to discover and connect to networks.</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="log-viewer-empty">
                            <p>No logs of the selected type found for this network.</p>
                            <p className="hint">Network connection events will appear here.</p>
                        </div>
                    ) : (
                        <div className="log-entries">
                            <div className="log-header-row">
                                <span className="log-col-time">Time</span>
                                <span className="log-col-action">Action</span>
                                <span className="log-col-file">Note</span>
                                <span className="log-col-details">Details</span>
                            </div>
                            {filteredLogs.slice().reverse().map((log, index) => (
                                <div
                                    key={log.id || index}
                                    className="log-entry"
                                >
                                    <span className="log-col-time">{formatTimestamp(log.timestamp)}</span>
                                    <span className="log-col-action">
                                        {log.action?.toUpperCase()}
                                    </span>
                                    <span className="log-col-file" title={log.note || ''}>
                                        {log.note || ''}
                                    </span>
                                    <span className="log-col-details">
                                        {log.sourceIp ? `from ${log.sourceIp}` : ''}
                                        {log.destIp ? ` to ${log.destIp}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            <div className="log-viewer-footer">
                <span className="log-count">
                    {filteredLogs.length} log entries
                </span>
                {/* auto-refresh indicator removed */}
            </div>
        </div>
    );
};

export default LogViewer;
