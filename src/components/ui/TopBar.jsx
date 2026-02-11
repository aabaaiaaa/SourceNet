import { useState, useRef, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import { MULTI_INSTANCE_APPS } from '../../constants/gameConstants';
import { formatDateTime, getAllSavesFlat } from '../../utils/helpers';
import { getReputationTier } from '../../systems/ReputationSystem';
import { calculateStorageUsed, calculateLocalFilesSize, formatStorage } from '../../systems/StorageSystem';
import { SOFTWARE_CATALOG } from '../../constants/gameConstants';
import networkRegistry from '../../systems/NetworkRegistry';
import SecurityIndicator from './SecurityIndicator';
import triggerEventBus from '../../core/triggerEventBus';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../../core/gameTimeScheduler';
import './TopBar.css';

/**
 * Format deadline countdown for display
 * @param {Date} deadlineTime - The deadline time
 * @param {Date} currentTime - Current game time
 * @returns {{ text: string, isUrgent: boolean, isExpired: boolean }}
 */
const formatDeadlineCountdown = (deadlineTime, currentTime) => {
  if (!deadlineTime || !currentTime) {
    return { text: '', isUrgent: false, isExpired: false };
  }

  const deadline = new Date(deadlineTime);
  const now = new Date(currentTime);
  const remainingMs = deadline - now;

  if (remainingMs <= 0) {
    return { text: 'EXPIRED', isUrgent: true, isExpired: true };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const isUrgent = minutes < 1;
  const text = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return { text, isUrgent, isExpired: false };
};

const TopBar = () => {
  const {
    currentTime,
    timeSpeed,
    toggleTimeSpeed,
    isPaused,
    setIsPaused,
    messages,
    bankAccounts,
    openWindow,
    saveGame,
    loadGame,
    setGamePhase,
    getTotalCredits,
    rebootSystem,
    // Extended state
    reputation,
    activeConnections,
    activeMission,
    bankruptcyCountdown,
    reputationCountdown,
    software,
    getBandwidthInfo,
    // Subscribe to these to trigger re-renders when bandwidth operations change
    // (the actual values are used by getBandwidthInfo internally)
    bandwidthOperations: _bandwidthOperations,
    downloadQueue: _downloadQueue,
    localSSDFiles,
    activePassiveSoftware,
    startPassiveSoftware,
  } = useGame();

  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [showMailPreview, setShowMailPreview] = useState(false);
  const [showBankPreview, setShowBankPreview] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [showReputationPreview, setShowReputationPreview] = useState(false);
  const [showNetworkPreview, setShowNetworkPreview] = useState(false);
  const [showMissionPreview, setShowMissionPreview] = useState(false);
  const [showBandwidthPreview, setShowBandwidthPreview] = useState(false);
  const [disconnectionNotices, setDisconnectionNotices] = useState([]);

  // Ransomware cleanup state for SecurityIndicator
  const [ransomwareThreat, setRansomwareThreat] = useState(false);
  const [ransomwareCleaning, setRansomwareCleaning] = useState(false);
  const [ransomwareCleanupProgress, setRansomwareCleanupProgress] = useState(0);

  // Keep a ref to currentTime for use in animation frames
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  // Timeout refs for delayed menu closing
  const powerMenuTimeout = useRef(null);
  const appLauncherTimeout = useRef(null);
  const disconnectionTimerRef = useRef(null);

  // Subscribe to network disconnection events
  useEffect(() => {
    const handleNetworkDisconnected = (data) => {
      const { networkId, networkName, reason } = data;
      console.log(`📡 TopBar received networkDisconnected: ${networkName} - ${reason}`);

      // Add to notices (deduplicate by networkId, keeping latest)
      setDisconnectionNotices(prev => [
        ...prev.filter(n => n.networkId !== networkId),
        { networkId, networkName, reason }
      ]);

      // Clear existing timer and start new 3-second timer (resets on new notices)
      if (disconnectionTimerRef.current) {
        clearGameTimeCallback(disconnectionTimerRef.current);
      }
      disconnectionTimerRef.current = scheduleGameTimeCallback(() => {
        setDisconnectionNotices([]);
        disconnectionTimerRef.current = null;
      }, 3000, timeSpeed);
    };

    triggerEventBus.on('networkDisconnected', handleNetworkDisconnected);

    return () => {
      triggerEventBus.off('networkDisconnected', handleNetworkDisconnected);
      if (disconnectionTimerRef.current) {
        clearGameTimeCallback(disconnectionTimerRef.current);
      }
    };
  }, [timeSpeed]);

  // Subscribe to ransomware events for SecurityIndicator
  useEffect(() => {
    const handleTriggerRansomware = () => {
      setRansomwareThreat(true);
      setRansomwareCleaning(false);
      setRansomwareCleanupProgress(0);
    };

    const handlePauseRansomware = () => {
      setRansomwareCleaning(true);
      setRansomwareCleanupProgress(0);

      // Track cleanup progress over 30 game-time seconds
      const cleanupStartGameTime = currentTimeRef.current?.getTime() || Date.now();
      const cleanupDuration = 30000; // 30s in game time
      let animId = null;

      const updateCleanup = () => {
        const now = currentTimeRef.current?.getTime() || Date.now();
        const elapsed = now - cleanupStartGameTime;
        const progress = Math.min(100, (elapsed / cleanupDuration) * 100);
        setRansomwareCleanupProgress(progress);

        if (progress < 100) {
          animId = requestAnimationFrame(updateCleanup);
        }
      };

      animId = requestAnimationFrame(updateCleanup);

      // Store cancel function for cleanup
      handlePauseRansomware._cancel = () => {
        if (animId) cancelAnimationFrame(animId);
      };
    };

    const handleCleanupComplete = () => {
      setRansomwareThreat(false);
      setRansomwareCleaning(false);
      setRansomwareCleanupProgress(0);
    };

    triggerEventBus.on('triggerRansomware', handleTriggerRansomware);
    triggerEventBus.on('pauseRansomware', handlePauseRansomware);
    triggerEventBus.on('ransomwareCleanupComplete', handleCleanupComplete);

    return () => {
      triggerEventBus.off('triggerRansomware', handleTriggerRansomware);
      triggerEventBus.off('pauseRansomware', handlePauseRansomware);
      triggerEventBus.off('ransomwareCleanupComplete', handleCleanupComplete);
    };
  }, []);

  const dismissDisconnectionNotices = () => {
    setDisconnectionNotices([]);
    if (disconnectionTimerRef.current) {
      clearGameTimeCallback(disconnectionTimerRef.current);
      disconnectionTimerRef.current = null;
    }
  };

  const unreadMessages = messages.filter((m) => !m.read);
  const totalCredits = getTotalCredits();

  // Map software IDs to app launcher entries (only show installed software)
  const appMap = {
    mail: { id: 'mail', name: 'SNet Mail', softwareId: 'mail' },
    banking: { id: 'banking', name: 'SNet Banking App', softwareId: 'banking' },
    portal: { id: 'portal', name: 'OSNet Portal', softwareId: 'portal' },
    'mission-board': { id: 'missionBoard', name: 'SourceNet Mission Board', softwareId: 'mission-board' },
    'vpn-client': { id: 'vpnClient', name: 'SourceNet VPN Client', softwareId: 'vpn-client' },
    'network-scanner': { id: 'networkScanner', name: 'Network Scanner', softwareId: 'network-scanner' },
    'network-address-register': { id: 'networkAddressRegister', name: 'Network Address Register', softwareId: 'network-address-register' },
    'file-manager': { id: 'fileManager', name: 'File Manager', softwareId: 'file-manager' },
    'log-viewer': { id: 'logViewer', name: 'Log Viewer', softwareId: 'log-viewer' },
    'data-recovery-tool': { id: 'dataRecoveryTool', name: 'Data Recovery Tool', softwareId: 'data-recovery-tool' },
    'decryption-tool': { id: 'decryptionTool', name: 'Decryption Tool', softwareId: 'decryption-tool' },
    'advanced-firewall-av': { id: 'advancedFirewallAv', name: 'Advanced Firewall & Antivirus', softwareId: 'advanced-firewall-av' },
  };

  const apps = (software || [])
    .map((sw) => typeof sw === 'string' ? appMap[sw] : appMap[sw.id])
    .filter((app) => app !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = () => {
    const saveName = prompt('Enter save name (or leave blank for auto-name):');
    saveGame(saveName || null);
    alert('Game saved!');
    setShowPowerMenu(false);
  };

  const handleLoad = () => {
    setShowPowerMenu(false);
    setShowLoadMenu(true);
  };

  const handleLoadSave = (username, saveIndex) => {
    const success = loadGame(username, saveIndex);
    if (success) {
      setShowLoadMenu(false);
    } else {
      alert('Failed to load save!');
    }
  };

  const handleReboot = () => {
    if (confirm('Reboot the system? This will close all opened apps.')) {
      rebootSystem();
    }
    setShowPowerMenu(false);
  };

  const handleSleep = () => {
    // Check if user has active connections - warn them they will be disconnected
    if (activeConnections?.length > 0) {
      const confirmed = window.confirm('Sleeping will disconnect you from all networks. Continue?');
      if (!confirmed) {
        return;
      }
    }

    // Go to sleep phase - SleepOverlay handles disconnection, save, and transition
    setShowPowerMenu(false);
    setGamePhase('sleeping');
  };

  return (
    <div className="topbar">
      {/* Bankruptcy Warning Banner (flashing) */}
      {bankruptcyCountdown && bankruptcyCountdown.remaining <= 300 && (
        <div className="bankruptcy-warning-banner">
          ⚠️ BANKRUPTCY WARNING: {Math.floor(bankruptcyCountdown.remaining / 60)}:{String(bankruptcyCountdown.remaining % 60).padStart(2, '0')} remaining ⚠️
        </div>
      )}

      {/* Reputation Warning Banner */}
      {reputationCountdown && (
        <div className="reputation-warning-banner">
          ⚠️ TERMINATION WARNING: {Math.floor(reputationCountdown.remaining / 60)}:{String(reputationCountdown.remaining % 60).padStart(2, '0')} remaining ⚠️
        </div>
      )}

      {/* Left: Power Button */}
      <div className="topbar-section">
        <div
          className="topbar-button-wrapper"
          onMouseEnter={() => {
            if (powerMenuTimeout.current) {
              clearTimeout(powerMenuTimeout.current);
            }
            setShowPowerMenu(true);
          }}
          onMouseLeave={() => {
            powerMenuTimeout.current = setTimeout(() => {
              setShowPowerMenu(false);
            }, 100);
          }}
        >
          <button className="topbar-button">⏻</button>
          {showPowerMenu && (
            <div
              className="dropdown-menu power-menu"
              onMouseEnter={() => {
                if (powerMenuTimeout.current) {
                  clearTimeout(powerMenuTimeout.current);
                }
              }}
              onMouseLeave={() => {
                powerMenuTimeout.current = setTimeout(() => {
                  setShowPowerMenu(false);
                }, 100);
              }}
            >
              {!isPaused ? (
                <button onClick={() => setIsPaused(true)}>Pause</button>
              ) : (
                <button onClick={() => setIsPaused(false)}>Resume</button>
              )}
              <button
                onClick={handleSave}
                disabled={activeConnections?.length > 0 || ransomwareThreat}
                title={ransomwareThreat ? 'Cannot save during ransomware attack' : activeConnections?.length > 0 ? 'Disconnect from all networks to save your game' : undefined}
              >Save</button>
              <button onClick={handleLoad}>Load</button>
              <button
                onClick={handleReboot}
                disabled={ransomwareThreat}
                title={ransomwareThreat ? 'Cannot reboot during ransomware attack' : undefined}
              >Reboot</button>
              <button
                onClick={handleSleep}
                disabled={ransomwareThreat}
                title={ransomwareThreat ? 'Cannot sleep during ransomware attack' : undefined}
              >Sleep</button>
            </div>
          )}
        </div>
      </div>

      {/* Left-Center: Date/Time */}
      <div className="topbar-section">
        <span className="topbar-time">{formatDateTime(currentTime)}</span>
        <button className="topbar-button time-speed" onClick={toggleTimeSpeed}>
          {timeSpeed}x
        </button>
      </div>

      {/* Center-Right: Notifications */}
      <div className="topbar-section">
        <div
          className="topbar-notification"
          onMouseEnter={() => setShowMailPreview(true)}
          onMouseLeave={() => setShowMailPreview(false)}
          onClick={() => {
            openWindow('mail');
            setShowMailPreview(false);
          }}
        >
          <span className="notification-icon">
            ✉ {unreadMessages.length > 0 && <span className="badge">{unreadMessages.length}</span>}
          </span>
          {showMailPreview && unreadMessages.length > 0 && (
            <div className="notification-preview">
              <div className="preview-header">Unread Messages:</div>
              {unreadMessages.slice(0, 3).map((msg) => (
                <div key={msg.id} className="preview-item">
                  <strong>{msg.from}</strong>: {msg.subject}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="topbar-notification"
          onMouseEnter={() => setShowBankPreview(true)}
          onMouseLeave={() => setShowBankPreview(false)}
          onClick={() => {
            openWindow('banking');
            setShowBankPreview(false);
          }}
        >
          <span className="notification-icon">💳</span>
          {showBankPreview && (
            <div className="notification-preview">
              <div className="preview-header">Bank Accounts:</div>
              {bankAccounts.map((acc) => (
                <div key={acc.id} className="preview-item">
                  {acc.bankName}: {acc.balance} credits
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="topbar-credits"
          onClick={() => openWindow('banking')}
          title="Click to open Banking App"
        >
          {totalCredits} credits
        </div>

        {/* Reputation Indicator */}
        <div
          className="topbar-reputation"
          onMouseEnter={() => setShowReputationPreview(true)}
          onMouseLeave={() => setShowReputationPreview(false)}
        >
          <span
            className="reputation-badge"
            style={{ backgroundColor: getReputationTier(reputation).color, cursor: 'pointer' }}
          >
            Tier {reputation}
          </span>
          {showReputationPreview && (
            <div className="notification-preview">
              <div className="preview-header">Reputation:</div>
              <div className="preview-item">
                <strong>{getReputationTier(reputation).name}</strong> (Tier {reputation})
              </div>
              <div className="preview-item-small">
                {getReputationTier(reputation).description}
              </div>
              <div className="preview-item-small">
                Payout Multiplier: {getReputationTier(reputation).payoutMultiplier}x
              </div>
            </div>
          )}
        </div>

        {/* Network Connection Indicator */}
        {activeConnections && activeConnections.length > 0 && (
          <div
            className="topbar-network"
            onMouseEnter={() => setShowNetworkPreview(true)}
            onMouseLeave={() => setShowNetworkPreview(false)}
            title="Active Network Connections"
          >
            <span className="network-icon" style={{ color: '#32CD32' }}>📶</span>
            <span className="network-badge">{activeConnections.length}</span>
            {showNetworkPreview && (
              <div className="notification-preview">
                <div className="preview-header">Connected Networks:</div>
                {activeConnections.map((conn, idx) => {
                  const network = networkRegistry.getNetwork(conn.networkId);
                  const bandwidth = network?.bandwidth || 50;
                  const speedMBps = (bandwidth / 8).toFixed(1);
                  const speedColor = bandwidth >= 75 ? '#32CD32' : bandwidth >= 50 ? '#FFD700' : '#FFA500';
                  return (
                    <div key={idx} className="preview-item network-connection-item">
                      <span className="connection-name">{conn.networkName || conn.networkId}</span>
                      <span className="connection-bandwidth" style={{ color: speedColor }}>{speedMBps} MB/s</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Network Disconnection Notices */}
        {disconnectionNotices.length > 0 && (
          <div className="topbar-network disconnection-indicator">
            <span className="network-icon" style={{ color: '#DC143C' }}>📶</span>
            <div className="notification-preview disconnection-notice">
              <div className="preview-header">
                Network Disconnected
                <button className="dismiss-btn" onClick={dismissDisconnectionNotices}>×</button>
              </div>
              {disconnectionNotices.map((notice) => (
                <div key={notice.networkId} className="preview-item">
                  <strong>{notice.networkName}</strong>
                  <div className="preview-item-small">{notice.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Indicator */}
        {activePassiveSoftware?.includes('advanced-firewall-av') && (
          <SecurityIndicator
            processing={ransomwareCleaning}
            cleanupProgress={ransomwareCleanupProgress}
            threatCount={ransomwareThreat ? 1 : 0}
          />
        )}

        {/* Bandwidth Indicator */}
        {getBandwidthInfo && (() => {
          const bandwidthInfo = getBandwidthInfo();
          const hasActivity = bandwidthInfo.activeOperations > 0;
          return (
            <div
              className={`topbar-bandwidth ${hasActivity ? 'active' : ''}`}
              onMouseEnter={() => setShowBandwidthPreview(true)}
              onMouseLeave={() => setShowBandwidthPreview(false)}
              title="Bandwidth Status"
            >
              <span className="bandwidth-icon">{hasActivity ? '⬇' : '○'}</span>
              {hasActivity && (
                <span className="bandwidth-speed">
                  {bandwidthInfo.transferSpeedMBps.toFixed(1)}
                </span>
              )}
              {showBandwidthPreview && (() => {
                const totalMBps = bandwidthInfo.adapterSpeed / 8;
                const inUseMBps = hasActivity ? bandwidthInfo.maxBandwidth / 8 : 0;
                const availableMBps = totalMBps - inUseMBps;
                const usagePercent = totalMBps > 0 ? (inUseMBps / totalMBps) * 100 : 0;
                return (
                  <div className="notification-preview bandwidth-preview">
                    <div className="preview-header">Bandwidth</div>
                    <div className="preview-item">
                      Total: {totalMBps.toFixed(1)} MB/s
                    </div>
                    <div className="preview-item">
                      In Use: {inUseMBps.toFixed(1)} MB/s
                    </div>
                    <div className="preview-item">
                      Available: {availableMBps.toFixed(1)} MB/s
                    </div>
                    <div className="preview-item">
                      Active Operations: {bandwidthInfo.activeOperations}
                    </div>
                    {bandwidthInfo.limitedBy === 'adapter' && activeConnections?.length > 0 && (
                      <div className="preview-item-small bandwidth-limited">
                        Limited by network adapter
                      </div>
                    )}
                    {usagePercent > 0 && (
                      <div className="bandwidth-usage-bar">
                        <div
                          className="bandwidth-usage-fill"
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Active Mission Indicator */}
        {activeMission && (() => {
          const countdown = formatDeadlineCountdown(activeMission.deadlineTime, currentTime);
          return (
            <div
              className={`topbar-mission ${countdown.isUrgent ? 'mission-urgent' : ''}`}
              onMouseEnter={() => setShowMissionPreview(true)}
              onMouseLeave={() => setShowMissionPreview(false)}
              onClick={() => openWindow('missionBoard')}
              title="Click to open Mission Board"
            >
              <span className="mission-icon">📋</span>
              {countdown.text ? (
                <span className={`mission-countdown ${countdown.isUrgent ? 'urgent' : ''}`}>
                  {countdown.text}
                </span>
              ) : (
                <span className="mission-badge">
                  {activeMission.objectives?.filter(o => o.status !== 'complete').length || 0}
                </span>
              )}
              {showMissionPreview && (
                <div className="notification-preview">
                  <div className="preview-header">{activeMission.title}</div>
                  {countdown.text && (
                    <div className={`preview-countdown ${countdown.isUrgent ? 'urgent' : ''}`}>
                      ⏱️ {countdown.isExpired ? 'TIME EXPIRED!' : `Time remaining: ${countdown.text}`}
                    </div>
                  )}
                  {activeMission.objectives?.map((obj) => (
                    <div
                      key={obj.id}
                      className="preview-item-small"
                      style={{
                        textDecoration: obj.status === 'complete' ? 'line-through' : 'none',
                        color: obj.status === 'complete' ? '#32CD32' : '#222',
                      }}
                    >
                      {obj.status === 'complete' ? '☑' : '☐'} {obj.description}
                      {obj.required === false && <span className="optional-label">(Optional)</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Right: App Launcher */}
      <div className="topbar-section">
        <div
          className="topbar-button-wrapper"
          onMouseEnter={() => {
            if (appLauncherTimeout.current) {
              clearTimeout(appLauncherTimeout.current);
            }
            setShowAppLauncher(true);
          }}
          onMouseLeave={() => {
            appLauncherTimeout.current = setTimeout(() => {
              setShowAppLauncher(false);
            }, 100);
          }}
        >
          <button className="topbar-button">☰</button>
          {showAppLauncher && (
            <div
              className="dropdown-menu app-launcher-menu"
              onMouseEnter={() => {
                if (appLauncherTimeout.current) {
                  clearTimeout(appLauncherTimeout.current);
                }
              }}
              onMouseLeave={() => {
                appLauncherTimeout.current = setTimeout(() => {
                  setShowAppLauncher(false);
                }, 100);
              }}
            >
              {apps.map((app) => {
                // Check if this is passive software
                const catalogEntry = SOFTWARE_CATALOG.find(s => s.id === app.softwareId);
                const isPassive = catalogEntry?.passive === true;
                const isPassiveRunning = isPassive && activePassiveSoftware?.includes(app.softwareId);

                return (
                  <button
                    key={app.id}
                    onClick={() => {
                      if (isPassive) {
                        if (!isPassiveRunning && startPassiveSoftware) {
                          startPassiveSoftware(app.softwareId);
                        }
                      } else {
                        openWindow(app.id);
                      }
                      setShowAppLauncher(false);
                    }}
                    className={MULTI_INSTANCE_APPS.includes(app.id) ? 'multi-instance-app' : ''}
                    title={isPassive
                      ? (isPassiveRunning ? `${app.name} (running)` : `${app.name} (click to start)`)
                      : (MULTI_INSTANCE_APPS.includes(app.id) ? `${app.name} (can open multiple)` : app.name)}
                  >
                    {app.name}
                    {MULTI_INSTANCE_APPS.includes(app.id) && <span className="multi-instance-badge">⊞</span>}
                    {isPassiveRunning && <span className="multi-instance-badge">✓</span>}
                  </button>
                );
              })}
              <div className="app-launcher-storage">
                {formatStorage(calculateStorageUsed(software || []), calculateLocalFilesSize(localSSDFiles || []), 90)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Load Game Modal */}
      {showLoadMenu && (
        <div className="modal-overlay" onClick={() => setShowLoadMenu(false)}>
          <div className="modal-content load-game-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Load Game</h3>
            <div className="load-saves-list">
              {getAllSavesFlat().length === 0 ? (
                <p>No saved games found.</p>
              ) : (
                getAllSavesFlat().map((save, _index) => {
                  // Find the save index within this user's saves (sorted by savedAt desc)
                  const userSaves = getAllSavesFlat().filter(s => s.username === save.username);
                  const saveIndex = userSaves.findIndex(s => s.savedAt === save.savedAt);

                  return (
                    <button
                      key={`${save.username}-${save.savedAt}`}
                      className="load-save-btn"
                      onClick={() => handleLoadSave(save.username, saveIndex)}
                    >
                      <span className="load-save-username">{save.username}</span>
                      <span className="load-save-name">{save.saveName}</span>
                      <span className="load-save-date">{new Date(save.savedAt).toLocaleString()}</span>
                    </button>
                  );
                })
              )}
            </div>
            <button
              className="modal-close-btn"
              onClick={() => setShowLoadMenu(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
