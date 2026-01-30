/**
 * Debug Panel - UI for rapid state manipulation
 *
 * Access via ?debug=true URL parameter (development mode only)
 *
 * Features:
 * - Quick scenario loading (9 pre-configured states)
 * - Manual state manipulation (credits, reputation, time)
 * - Mission control (trigger missions, complete objectives)
 * - Network simulation (add networks, connect)
 * - Software management (install instantly)
 */

import { useState, useMemo } from 'react';
import { useGame } from '../contexts/useGame';
import { getDebugScenarios, loadScenario } from './scenarios';
import { getAllClients, getClientsGroupedByIndustry, getIndustryInfo } from '../data/clientRegistry';
import { canAccessClientType } from '../systems/ReputationSystem';
import networkRegistry from '../systems/NetworkRegistry';
import triggerEventBus from '../core/triggerEventBus';
import './DebugPanel.css';

const DebugPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('scenarios');
  const [creditsInput, setCreditsInput] = useState('');
  const [reputationInput, setReputationInput] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [expandedNetworks, setExpandedNetworks] = useState({});
  const [expandedDevices, setExpandedDevices] = useState({});
  const [expandedFileSystems, setExpandedFileSystems] = useState({});
  const gameContext = useGame();

  // Get available scenarios dynamically
  const scenarios = useMemo(() => getDebugScenarios(), []);

  // Show status message that auto-clears
  const showStatus = (message, isError = false) => {
    setStatusMessage({ message, isError });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLoadScenario = (scenarioId) => {
    const success = loadScenario(scenarioId, gameContext);
    if (success) {
      showStatus(`✅ Scenario loaded: ${scenarios[scenarioId]?.name || scenarioId}`);
    } else {
      showStatus(`❌ Failed to load scenario: ${scenarioId}`, true);
    }
  };

  // Set credits by updating bank account balance (triggers banking message system)
  const handleSetCredits = () => {
    const newCredits = parseInt(creditsInput, 10);
    if (isNaN(newCredits)) return;

    const oldBalance = gameContext.bankAccounts[0]?.balance || 0;
    const newAccounts = [...gameContext.bankAccounts];
    if (newAccounts[0]) {
      newAccounts[0].balance = newCredits;
    }
    gameContext.setBankAccounts(newAccounts);

    // Emit creditsChanged event for debug operations too
    queueMicrotask(() => {
      triggerEventBus.emit('creditsChanged', {
        newBalance: newCredits,
        change: newCredits - oldBalance,
        reason: 'debug-set',
        accountId: newAccounts[0]?.id,
      });
    });

    setCreditsInput('');
  };

  // Set reputation (triggers HR message system)
  const handleSetReputation = () => {
    const newRep = parseInt(reputationInput, 10);
    if (isNaN(newRep) || newRep < 1 || newRep > 11) return;

    gameContext.setReputation(newRep);
    setReputationInput('');
  };

  // Quick actions for triggering specific states
  const handleTriggerOverdraft = () => {
    // First ensure balance is positive so the transition is detected
    const setupAccounts = [...gameContext.bankAccounts];
    if (setupAccounts[0] && setupAccounts[0].balance <= 0) {
      setupAccounts[0].balance = 1000;
      gameContext.setBankAccounts(setupAccounts);
    }

    // Then after a brief delay, set to negative
    // This allows the message system to detect the transition
    setTimeout(() => {
      const newAccounts = [...gameContext.bankAccounts];
      if (newAccounts[0]) {
        newAccounts[0].balance = -500;
      }
      gameContext.setBankAccounts(newAccounts);
    }, 50);
  };

  const handleTriggerApproachingBankruptcy = () => {
    // First ensure balance is positive so the transition is detected
    const setupAccounts = [...gameContext.bankAccounts];
    if (setupAccounts[0] && setupAccounts[0].balance >= -8000) {
      setupAccounts[0].balance = 1000;
      gameContext.setBankAccounts(setupAccounts);
    }

    // Then after a brief delay, set to approaching bankruptcy level
    setTimeout(() => {
      const newAccounts = [...gameContext.bankAccounts];
      if (newAccounts[0]) {
        newAccounts[0].balance = -9500;
      }
      gameContext.setBankAccounts(newAccounts);
    }, 50);
  };

  const handleTriggerBankruptcyCountdown = () => {
    // First ensure balance is positive so the transition is detected
    const setupAccounts = [...gameContext.bankAccounts];
    if (setupAccounts[0] && setupAccounts[0].balance >= -10000) {
      // If not already in bankruptcy territory, set positive first
      setupAccounts[0].balance = 1000;
      gameContext.setBankAccounts(setupAccounts);
    }

    // Then after a brief delay, set to bankruptcy level
    // This allows the message system to detect the transition
    setTimeout(() => {
      const newAccounts = [...gameContext.bankAccounts];
      if (newAccounts[0]) {
        newAccounts[0].balance = -10500;
      }
      gameContext.setBankAccounts(newAccounts);
      // Let the normal game logic start the countdown
    }, 50);
  };

  const handleCancelBankruptcy = () => {
    const newAccounts = [...gameContext.bankAccounts];
    if (newAccounts[0]) {
      newAccounts[0].balance = 1000;
    }
    gameContext.setBankAccounts(newAccounts);
  };

  const handleTriggerPerformancePlan = () => {
    // First ensure reputation is higher so the transition is detected
    if (gameContext.reputation <= 2) {
      gameContext.setReputation(5);
    }
    // Then after a brief delay, set to tier 2
    setTimeout(() => {
      gameContext.setReputation(2);
    }, 50);
  };

  const handleTriggerTerminationCountdown = () => {
    // First ensure reputation is higher so the transition is detected
    if (gameContext.reputation <= 1) {
      gameContext.setReputation(5);
    }
    // Then after a brief delay, set to tier 1
    // This allows the message system to detect the transition
    // and the normal game logic will start the countdown
    setTimeout(() => {
      gameContext.setReputation(1);
    }, 50);
  };

  const handleCancelTermination = () => {
    gameContext.setReputation(5);
  };

  // Unlock hardware and advanced tools features
  const handleUnlockHardwareFeatures = () => {
    if (gameContext.setUnlockedFeatures) {
      gameContext.setUnlockedFeatures(prev => {
        const newFeatures = new Set(prev);
        newFeatures.add('network-adapters');
        return Array.from(newFeatures);
      });
      showStatus('✅ Unlocked: network-adapters');
    } else {
      showStatus('❌ setUnlockedFeatures not available', true);
    }
  };

  const renderScenariosTab = () => {
    const scenarioKeys = Object.keys(scenarios);

    return (
      <div className="debug-scenarios">
        <h3>Quick Load Scenarios</h3>
        <p className="debug-hint">
          Load pre-configured game states from fixtures.
          {scenarioKeys.length === 0 && ' Run `npm run generate:scenarios` to create fixtures.'}
        </p>

        {scenarioKeys.length === 0 ? (
          <div className="no-scenarios">
            <p>No scenario fixtures found.</p>
            <p>Generate them by running:</p>
            <code>npm run generate:scenarios</code>
          </div>
        ) : (
          <div className="scenarios-grid">
            {scenarioKeys.map((key) => {
              const scenario = scenarios[key];
              return (
                <button
                  key={key}
                  className="scenario-btn"
                  onClick={() => handleLoadScenario(key)}
                >
                  <div className="scenario-name">{scenario.name}</div>
                  <div className="scenario-desc">{scenario.description}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderGameStateTab = () => {
    const currentCredits = gameContext.getTotalCredits();
    const currentRep = gameContext.reputation;

    return (
      <div className="debug-game-state">
        <h3>Game State Controls</h3>
        <p className="debug-hint">Modify game state to trigger system messages</p>

        <div className="state-controls">
          <div className="control-group">
            <h4>💰 Credits (Current: {currentCredits.toLocaleString()})</h4>
            <div className="control-row">
              <input
                type="number"
                value={creditsInput}
                onChange={(e) => setCreditsInput(e.target.value)}
                placeholder="Enter credits"
                data-testid="debug-credits-input"
              />
              <button onClick={handleSetCredits} data-testid="debug-set-credits">Set</button>
            </div>
            <div className="quick-actions">
              <button onClick={handleTriggerOverdraft} data-testid="debug-trigger-overdraft">
                Trigger Overdraft (-500)
              </button>
              <button onClick={handleTriggerApproachingBankruptcy} data-testid="debug-approaching-bankruptcy">
                Approaching Bankruptcy (-9,500)
              </button>
              <button onClick={handleTriggerBankruptcyCountdown} data-testid="debug-trigger-bankruptcy">
                Start Bankruptcy Countdown (-10,500)
              </button>
              <button onClick={handleCancelBankruptcy} data-testid="debug-cancel-bankruptcy">
                Cancel Bankruptcy (+1,000)
              </button>
            </div>
            {gameContext.bankruptcyCountdown && (
              <div className="countdown-status">
                ⚠️ Bankruptcy countdown active: {gameContext.bankruptcyCountdown.remaining}s remaining
              </div>
            )}
          </div>

          <div className="control-group">
            <h4>⭐ Reputation (Current: Tier {currentRep})</h4>
            <div className="control-row">
              <input
                type="number"
                min="1"
                max="11"
                value={reputationInput}
                onChange={(e) => setReputationInput(e.target.value)}
                placeholder="Enter tier (1-11)"
                data-testid="debug-reputation-input"
              />
              <button onClick={handleSetReputation} data-testid="debug-set-reputation">Set</button>
            </div>
            <div className="quick-actions">
              <button onClick={handleTriggerPerformancePlan} data-testid="debug-trigger-performance-plan">
                Trigger Performance Plan (Tier 2)
              </button>
              <button onClick={handleTriggerTerminationCountdown} data-testid="debug-trigger-termination">
                Start Termination Countdown (Tier 1)
              </button>
              <button onClick={handleCancelTermination} data-testid="debug-cancel-termination">
                Cancel Termination (Tier 5)
              </button>
            </div>
            {gameContext.reputationCountdown && (
              <div className="countdown-status">
                ⚠️ Termination countdown active: {gameContext.reputationCountdown.remaining}s remaining
              </div>
            )}
          </div>

          <div className="control-group">
            <h4>🔓 Feature Unlocks</h4>
            <div className="quick-actions">
              <button onClick={handleUnlockHardwareFeatures} data-testid="debug-unlock-features">
                Unlock Hardware &amp; Advanced Tools
              </button>
            </div>
            <div className="state-item">
              <span className="state-label">Unlocked Features:</span>
              <span className="state-value">
                {gameContext.unlockedFeatures?.length > 0
                  ? gameContext.unlockedFeatures.join(', ')
                  : 'None'}
              </span>
            </div>
          </div>
        </div>

        <div className="state-display">
          <h4>Current State</h4>
          <div className="state-item">
            <span className="state-label">Active Mission:</span>
            <span className="state-value">
              {gameContext.activeMission ? gameContext.activeMission.title : 'None'}
            </span>
          </div>
          <div className="state-item">
            <span className="state-label">Completed Missions:</span>
            <span className="state-value">{gameContext.completedMissions?.length || 0}</span>
          </div>
          <div className="state-item">
            <span className="state-label">Transactions:</span>
            <span className="state-value">{gameContext.transactions?.length || 0}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderClientsTab = () => {
    const clientsByIndustry = getClientsGroupedByIndustry();
    const { clientStandings = {}, reputation, missionPool = [] } = gameContext;

    // Get clients with active missions
    const activeClientIds = new Set(missionPool.map(m => m.clientId).filter(Boolean));

    return (
      <div className="debug-clients">
        <h3>Client Registry & Standings</h3>
        <p className="debug-hint">
          Shows all clients grouped by industry, their accessibility at current reputation (Tier {reputation}), and mission standings.
        </p>

        <div className="clients-summary">
          <span>Total Clients: {getAllClients().length}</span>
          <span>Clients with Standings: {Object.keys(clientStandings).length}</span>
        </div>

        <div className="clients-by-industry">
          {Object.entries(clientsByIndustry).map(([industry, clients]) => {
            const industryInfo = getIndustryInfo(industry);

            return (
              <div key={industry} className="industry-group">
                <h4 className="industry-header">
                  {industryInfo?.displayName || industry}
                  <span className="industry-count">({clients.length} clients)</span>
                </h4>

                <div className="clients-list">
                  {clients.map(client => {
                    const isAccessible = canAccessClientType(client.clientType, reputation);
                    const standing = clientStandings[client.id];
                    const hasActiveMission = activeClientIds.has(client.id);

                    return (
                      <div
                        key={client.id}
                        className={`client-item ${isAccessible ? 'accessible' : 'locked'} ${hasActiveMission ? 'has-mission' : ''}`}
                      >
                        <div className="client-header">
                          <span className="client-name">{client.name}</span>
                          <span className={`client-tier tier-${client.tier}`}>{client.tier}</span>
                        </div>
                        <div className="client-details">
                          <span className="client-type">{client.clientType}</span>
                          <span className="client-rep">Min Rep: {client.minReputation}</span>
                          {isAccessible ? (
                            <span className="client-status accessible">✓ Accessible</span>
                          ) : (
                            <span className="client-status locked">🔒 Locked</span>
                          )}
                        </div>
                        {standing && (
                          <div className="client-standing">
                            <span className="standing-success">✓ {standing.successCount || 0}</span>
                            <span className="standing-fail">✗ {standing.failCount || 0}</span>
                            {standing.lastMissionDate && (
                              <span className="standing-last">
                                Last: {new Date(standing.lastMissionDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                        {hasActiveMission && (
                          <div className="client-active-mission">📋 Has pending mission</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRegistryTab = () => {
    const snapshot = networkRegistry.getSnapshot();
    const { networks, devices, fileSystems } = snapshot;

    const toggleNetwork = (networkId) => {
      setExpandedNetworks(prev => ({ ...prev, [networkId]: !prev[networkId] }));
    };

    const toggleDevice = (deviceIp) => {
      setExpandedDevices(prev => ({ ...prev, [deviceIp]: !prev[deviceIp] }));
    };

    const toggleFileSystem = (fsId) => {
      setExpandedFileSystems(prev => ({ ...prev, [fsId]: !prev[fsId] }));
    };

    // Group devices by network
    const devicesByNetwork = {};
    devices.forEach(device => {
      if (!devicesByNetwork[device.networkId]) {
        devicesByNetwork[device.networkId] = [];
      }
      devicesByNetwork[device.networkId].push(device);
    });

    // Create a lookup for file systems by id
    const fsById = {};
    fileSystems.forEach(fs => {
      fsById[fs.id] = fs;
    });

    return (
      <div className="debug-registry">
        <h3>Network Registry</h3>
        <p className="debug-hint">
          All networks, devices, file systems, and files registered from accepted missions.
        </p>

        <div className="registry-summary">
          <span>Networks: {networks.length}</span>
          <span>Devices: {devices.length}</span>
          <span>File Systems: {fileSystems.length}</span>
        </div>

        {networks.length === 0 ? (
          <div className="registry-empty">
            <p>No networks registered yet.</p>
            <p className="debug-hint">Accept a mission to populate the registry.</p>
          </div>
        ) : (
          <div className="registry-tree">
            {networks.map(network => (
              <div key={network.networkId} className="registry-network">
                <div
                  className="registry-header network-header"
                  onClick={() => toggleNetwork(network.networkId)}
                >
                  <span className="toggle-icon">{expandedNetworks[network.networkId] ? '▼' : '▶'}</span>
                  <span className="network-name">🌐 {network.networkName || network.networkId}</span>
                  <span className="network-subnet">{network.address}</span>
                  <div className="network-status">
                    {network.discovered && <span className="status-badge discovered">Discovered</span>}
                    {network.accessible && <span className="status-badge has-access">Has Access</span>}
                    {network.revokedReason && <span className="status-badge revoked">{network.revokedReason}</span>}
                  </div>
                </div>

                {expandedNetworks[network.networkId] && (
                  <div className="registry-children">
                    {(devicesByNetwork[network.networkId] || []).map(device => {
                      const deviceFs = device.fileSystemId ? fsById[device.fileSystemId] : null;
                      return (
                        <div key={device.ip} className="registry-device">
                          <div
                            className="registry-header device-header"
                            onClick={() => toggleDevice(device.ip)}
                          >
                            <span className="toggle-icon">{expandedDevices[device.ip] ? '▼' : '▶'}</span>
                            <span className="device-name">💻 {device.hostname || 'Unknown'}</span>
                            <span className="device-ip">{device.ip}</span>
                            <div className="device-status">
                              {device.accessible && <span className="status-badge accessible">Accessible</span>}
                              {deviceFs && <span className="status-badge has-fs">Has FS</span>}
                            </div>
                          </div>

                          {expandedDevices[device.ip] && deviceFs && (
                            <div className="registry-children">
                              <div className="registry-filesystem">
                                <div
                                  className="registry-header filesystem-header"
                                  onClick={() => toggleFileSystem(deviceFs.id)}
                                >
                                  <span className="toggle-icon">{expandedFileSystems[deviceFs.id] ? '▼' : '▶'}</span>
                                  <span className="filesystem-name">📁 {deviceFs.id}</span>
                                  <span className="filesystem-files">{deviceFs.files?.length || 0} files</span>
                                </div>

                                {expandedFileSystems[deviceFs.id] && deviceFs.files && deviceFs.files.length > 0 && (
                                  <div className="registry-children files-list">
                                    {deviceFs.files.map((file, idx) => (
                                      <div key={idx} className="registry-file">
                                        <span className="file-icon">📄</span>
                                        <span className="file-name">{file.name}</span>
                                        <span className="file-size">{file.size} bytes</span>
                                        {file.corrupted && <span className="status-badge corrupted">Corrupted</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {expandedDevices[device.ip] && !deviceFs && (
                            <div className="registry-children">
                              <div className="registry-empty-note">No file system</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!devicesByNetwork[network.networkId] || devicesByNetwork[network.networkId].length === 0) && (
                      <div className="registry-empty-note">No devices</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="debug-panel-overlay">
      <div className="debug-panel">
        <div className="debug-header">
          <h2>🔧 Debug Panel</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {statusMessage && (
          <div className={`debug-status ${statusMessage.isError ? 'error' : 'success'}`} data-testid="debug-status">
            {statusMessage.message}
          </div>
        )}

        <div className="debug-tabs">
          <button
            className={`debug-tab ${activeTab === 'scenarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenarios')}
          >
            Scenarios
          </button>
          <button
            className={`debug-tab ${activeTab === 'state' ? 'active' : ''}`}
            onClick={() => setActiveTab('state')}
          >
            State Controls
          </button>
          <button
            className={`debug-tab ${activeTab === 'clients' ? 'active' : ''}`}
            onClick={() => setActiveTab('clients')}
          >
            Clients
          </button>
          <button
            className={`debug-tab ${activeTab === 'registry' ? 'active' : ''}`}
            onClick={() => setActiveTab('registry')}
          >
            Registry
          </button>
        </div>

        <div className="debug-content">
          {activeTab === 'scenarios' && renderScenariosTab()}
          {activeTab === 'state' && renderGameStateTab()}
          {activeTab === 'clients' && renderClientsTab()}
          {activeTab === 'registry' && renderRegistryTab()}
        </div>

        <div className="debug-footer">
          <p className="debug-warning">⚠️ Development Mode Only - Changes not saved unless you use Save Game</p>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;
