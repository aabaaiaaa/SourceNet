import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  GAME_START_DATE,
  TIME_SPEEDS,
  STARTING_HARDWARE,
  STARTING_SOFTWARE,
  STARTING_BANK_ACCOUNT,
  MANAGER_NAMES,
  MULTI_INSTANCE_APPS,
} from '../constants/gameConstants';
import {
  generateMailId,
  generateUsername,
  getRandomManagerName,
  saveGameState as saveToLocalStorage,
  loadGameState as loadFromLocalStorage,
} from '../utils/helpers';
import useStoryMissions from '../missions/useStoryMissions';
import { useObjectiveAutoTracking } from '../missions/useObjectiveAutoTracking';
import { createMessageFromTemplate, MESSAGE_TEMPLATES } from '../missions/messageTemplates';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../core/gameTimeScheduler';
import { useDownloadManager } from '../systems/useDownloadManager';
import storyMissionManager from '../missions/StoryMissionManager';
import {
  getNetworkBandwidth,
  getAdapterSpeed,
  calculateTransferSpeed,
  calculateOperationTime,
} from '../systems/NetworkBandwidthSystem';
import { updateBankruptcyCountdown, shouldTriggerBankruptcy, startBankruptcyCountdown } from '../systems/BankingSystem';
import { updateReputationCountdown, startReputationCountdown } from '../systems/ReputationSystem';
import { BANKING_MESSAGES, HR_MESSAGES } from '../core/systemMessages';
import { getReputationTier } from '../systems/ReputationSystem';
import triggerEventBus from '../core/triggerEventBus';

export const GameContext = createContext();

export const GameProvider = ({ children }) => {
  // Game state
  const [gamePhase, setGamePhase] = useState('boot'); // boot, login, username, desktop
  const [username, setUsername] = useState('');
  const [playerMailId, setPlayerMailId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date(GAME_START_DATE));
  const [timeSpeed, setTimeSpeed] = useState(TIME_SPEEDS.NORMAL);
  const [isPaused, setIsPaused] = useState(false);

  // Hardware/Software
  const [hardware, setHardware] = useState(STARTING_HARDWARE);
  const [software, setSoftware] = useState(STARTING_SOFTWARE);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState([STARTING_BANK_ACCOUNT]);

  // Messages
  const [messages, setMessages] = useState([]);
  const [managerName, setManagerName] = useState('');

  // Cheque deposit
  const [pendingChequeDeposit, setPendingChequeDeposit] = useState(null);

  // Windows
  const [windows, setWindows] = useState([]);
  const nextZIndexRef = useRef(1000);
  const nextWindowIdRef = useRef(1);

  // Timers
  const timeIntervalRef = useRef(null);

  // Banking message tracking
  const prevBalanceRef = useRef(null);
  const bankingMessageQueueRef = useRef([]); // Queue of pending banking messages
  const bankingMessageTimerRef = useRef(null); // Timer for current queued message
  const processBankingMessageQueueRef = useRef(null); // Ref for recursive call
  const [bankingMessagesSent, setBankingMessagesSent] = useState({
    firstOverdraft: false,
    approachingBankruptcy: false,
    bankruptcyCountdownStart: false,
    bankruptcyCancelled: false,
  });

  // HR message tracking
  const prevReputationTierRef = useRef(null);
  const [reputationMessagesSent, setReputationMessagesSent] = useState({
    performancePlanWarning: false,
    finalTerminationWarning: false,
    performanceImproved: false,
  });

  // ===== EXTENDED GAME STATE =====

  // Reputation System
  const [reputation, setReputation] = useState(9); // Tier 9 = "Superb" (starting reputation)
  const [reputationCountdown, setReputationCountdown] = useState(null); // {startTime, endTime, remaining} or null

  // Mission System
  const [activeMission, setActiveMissionRaw] = useState(null); // Current mission object or null
  const setActiveMission = useCallback((valueOrUpdater) => {
    if (typeof valueOrUpdater === 'function') {
      // Functional update - wrap to log the actual value
      setActiveMissionRaw((prev) => {
        const newValue = valueOrUpdater(prev);
        console.log(`🎯 setActiveMission (functional) called: prev=${prev?.missionId || 'null'} -> new=${newValue?.missionId || 'null'}`);
        return newValue;
      });
    } else {
      console.log(`🎯 setActiveMission called with:`, valueOrUpdater === null ? 'null' : valueOrUpdater?.missionId || 'unknown');
      setActiveMissionRaw(valueOrUpdater);
    }
  }, []);
  const [completedMissions, setCompletedMissions] = useState([]); // Array of completed mission objects
  const [availableMissions, setAvailableMissions] = useState([]); // Array of available mission objects
  const [missionCooldowns, setMissionCooldowns] = useState({ easy: null, medium: null, hard: null });

  // Network System
  const [narEntries, setNarEntries] = useState([]); // Network Address Register entries
  const [activeConnections, setActiveConnections] = useState([]); // Currently connected networks
  const [lastScanResults, setLastScanResults] = useState(null); // Last network scan results
  const [fileManagerConnections, setFileManagerConnections] = useState([]); // Active File Manager connections
  const [lastFileOperation, setLastFileOperation] = useState(null); // Last file operation completed
  const [missionFileOperations, setMissionFileOperations] = useState({}); // Cumulative file operations for current mission {repair: 5, copy: 3}

  // Purchasing & Installation
  const [downloadQueue, setDownloadQueue] = useState([]); // Items being downloaded/installed
  const [transactions, setTransactions] = useState([]); // Banking transaction history
  const [licensedSoftware, setLicensedSoftware] = useState([]); // Array of software IDs that have been licensed

  // Bandwidth Operations (non-download operations that use bandwidth)
  const [bandwidthOperations, setBandwidthOperations] = useState([]); // {id, type, status, progress}

  // Banking System extensions
  const [bankruptcyCountdown, setBankruptcyCountdown] = useState(null); // {startTime, endTime, remaining} or null
  const [lastInterestTime, setLastInterestTime] = useState(null); // Last time interest was applied

  // File Manager Clipboard (shared across instances, cleared on disconnect)
  const [fileClipboard, setFileClipboard] = useState({ files: [], sourceFileSystemId: '', sourceNetworkId: '' });

  // Auto-tracking control (can be disabled for testing)
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(true);

  // Track failed missions to prevent duplicate penalty application
  const failedMissionsRef = useRef(new Set());

  // Ref to hold the latest completeMission function
  const completeMissionRef = useRef(null);

  // Clear file clipboard
  const clearFileClipboard = useCallback(() => {
    setFileClipboard({ files: [], sourceFileSystemId: '', sourceNetworkId: '' });
  }, []);

  // Download completion callback - adds software to installed list
  const handleDownloadComplete = useCallback((softwareId) => {
    setSoftware((prev) => {
      if (prev.includes(softwareId)) return prev;
      return [...prev, softwareId];
    });
  }, []);

  // Clear clipboard when disconnecting from source network
  useEffect(() => {
    if (fileClipboard.sourceNetworkId && activeConnections.length > 0) {
      const stillConnected = activeConnections.some(conn => conn.networkId === fileClipboard.sourceNetworkId);
      if (!stillConnected) {
        console.log('📋 Clipboard cleared - disconnected from source network');
        clearFileClipboard();
      }
    }
  }, [activeConnections, fileClipboard.sourceNetworkId, clearFileClipboard]);

  // Accumulate file operations for mission tracking (cumulative count per operation type)
  useEffect(() => {
    if (lastFileOperation && activeMission) {
      const { operation, filesAffected } = lastFileOperation;
      setMissionFileOperations(prev => {
        const newCount = (prev[operation] || 0) + filesAffected;
        console.log(`📊 Cumulative ${operation}: ${prev[operation] || 0} + ${filesAffected} = ${newCount}`);
        return {
          ...prev,
          [operation]: newCount
        };
      });
    }
  }, [lastFileOperation, activeMission]);

  // Reset cumulative file operations when mission changes
  useEffect(() => {
    console.log('🔄 Mission changed, resetting missionFileOperations');
    setMissionFileOperations({});
  }, [activeMission?.missionId]);

  // Download manager - handles progress updates for downloads based on game time
  useDownloadManager(
    downloadQueue,
    setDownloadQueue,
    hardware,
    handleDownloadComplete,
    currentTime,
    gamePhase === 'desktop' // Only run when on desktop
  );

  // ===== BANDWIDTH SYSTEM =====

  // Count active bandwidth operations (downloads + other operations)
  const getActiveBandwidthOperationCount = useCallback(() => {
    const activeDownloads = (downloadQueue || []).filter(
      (item) => item.status === 'downloading'
    ).length;
    const activeOps = (bandwidthOperations || []).filter(
      (op) => op.status === 'active'
    ).length;
    return activeDownloads + activeOps;
  }, [downloadQueue, bandwidthOperations]);

  // Calculate current bandwidth info
  const getBandwidthInfo = useCallback(() => {
    const adapterSpeed = getAdapterSpeed(hardware);
    const connectionSpeed = getNetworkBandwidth();
    const maxBandwidth = Math.min(adapterSpeed, connectionSpeed);
    const activeCount = getActiveBandwidthOperationCount();
    const bandwidthPerOperation = activeCount > 0 ? maxBandwidth / activeCount : maxBandwidth;
    const transferSpeedMBps = calculateTransferSpeed(bandwidthPerOperation);

    return {
      maxBandwidth,
      activeOperations: activeCount,
      bandwidthPerOperation,
      transferSpeedMBps,
      usagePercent: Math.min(100, (activeCount / 4) * 100), // Cap visual at 4 ops
    };
  }, [hardware, getActiveBandwidthOperationCount]);

  // Register a bandwidth operation (returns operation info including estimated time)
  const registerBandwidthOperation = useCallback((type, sizeInMB, metadata = {}) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const operation = {
      id,
      type,
      sizeInMB,
      status: 'active',
      progress: 0,
      startTime: Date.now(),
      metadata,
    };

    setBandwidthOperations((prev) => [...prev, operation]);

    // Calculate estimated time with the new operation included
    const adapterSpeed = getAdapterSpeed(hardware);
    const connectionSpeed = getNetworkBandwidth();
    const maxBandwidth = Math.min(adapterSpeed, connectionSpeed);
    const newActiveCount = getActiveBandwidthOperationCount() + 1;
    const bandwidthShare = maxBandwidth / newActiveCount;
    const transferSpeed = calculateTransferSpeed(bandwidthShare);
    const estimatedTimeMs = calculateOperationTime(sizeInMB, transferSpeed) * 1000;

    return {
      operationId: id,
      estimatedTimeMs,
      transferSpeedMBps: transferSpeed,
    };
  }, [hardware, getActiveBandwidthOperationCount]);

  // Complete a bandwidth operation
  const completeBandwidthOperation = useCallback((operationId) => {
    setBandwidthOperations((prev) =>
      prev.filter((op) => op.id !== operationId)
    );
  }, []);

  // Update bandwidth operation progress
  const updateBandwidthOperationProgress = useCallback((operationId, progress) => {
    setBandwidthOperations((prev) =>
      prev.map((op) =>
        op.id === operationId ? { ...op, progress } : op
      )
    );
  }, []);

  // Ref to track if this is a new game (for emitting newGameStarted event)
  const isNewGameRef = useRef(false);

  // Function to clear the new game flag (called by useStoryMissions after emitting event)
  const clearNewGameFlag = useCallback(() => {
    isNewGameRef.current = false;
  }, []);

  // Initialize player
  const initializePlayer = useCallback((name) => {
    setUsername(name);
    setPlayerMailId(generateMailId());
    setGamePhase('desktop');

    // Set manager name
    const manager = getRandomManagerName(MANAGER_NAMES);
    setManagerName(manager);

    // Mark this as a new game so useStoryMissions can emit newGameStarted
    isNewGameRef.current = true;

    // Welcome messages now come from story mission system (no hardcoded messages)
  }, []);

  // Play notification chime
  const playNotificationChime = useCallback(() => {
    // Create a simple notification sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // OSNet notification chime: short, pleasant beep
      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);

      console.log('🔔 Notification chime played');
    } catch {
      console.log('🔔 Notification chime (audio unavailable)');
    }
  }, []);

  // Add message
  const addMessage = useCallback((message) => {
    const newMessage = {
      ...message,
      id: message.id || `msg-${Date.now()}`,
      timestamp: new Date(currentTime),
    };

    setMessages((prev) => [...prev, newMessage]);

    // Play notification chime
    playNotificationChime();

    // If this is the first message, schedule second message when it's read
    if (message.id === 'msg-welcome-hr') {
      // Will be handled when message is marked as read
    }
  }, [currentTime]);

  // Mark message as read
  const markMessageAsRead = useCallback((messageId) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, read: true } : msg
      )
    );

    // Emit message read event for story missions
    triggerEventBus.emit('messageRead', {
      messageId: messageId,
    });

    // Second message now comes from story mission system
  }, []);

  // Archive message
  const archiveMessage = useCallback((messageId) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, archived: true } : msg
      )
    );
  }, []);

  // Window management (defined before initiateChequeDeposit which uses it)
  const openWindow = useCallback((appId) => {
    setWindows((prev) => {
      // Check if app allows multiple instances
      const allowsMultipleInstances = MULTI_INSTANCE_APPS.includes(appId);

      if (!allowsMultipleInstances) {
        // Check if window is already open for single-instance apps
        const existing = prev.find((w) => w.appId === appId);

        if (existing) {
          // Bring existing window to front with new z-index
          const newZ = nextZIndexRef.current++;
          return prev.map((w) =>
            w.id === existing.id ? { ...w, zIndex: newZ, minimized: false } : w
          );
        }
      }

      // Create new window instance
      const CASCADE_OFFSET = 30;
      const BASE_X = 50;
      const BASE_Y = 100;
      const openWindows = prev.filter((w) => !w.minimized);
      const offset = openWindows.length * CASCADE_OFFSET;

      const newWindow = {
        id: `window-${nextWindowIdRef.current++}`, // Unique ID for this window instance
        appId, // App type (for rendering the correct component)
        zIndex: nextZIndexRef.current++,
        minimized: false,
        position: {
          x: BASE_X + offset,
          y: BASE_Y + offset,
        },
      };

      return [...prev, newWindow];
    });
  }, []);

  // Initiate cheque deposit (called when user clicks attachment in Mail)
  const initiateChequeDeposit = useCallback((messageId) => {
    setPendingChequeDeposit(messageId);
    openWindow('banking');
  }, [openWindow]);

  // Deposit cheque
  const depositCheque = useCallback((messageId, accountId) => {
    const message = messages.find((m) => m.id === messageId);
    const chequeAttachment = message?.attachments?.find(
      att => att.type === 'cheque' && !att.deposited
    );

    if (!message || !chequeAttachment) {
      return;
    }

    // Mark cheque as deposited
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
            ...msg,
            attachments: msg.attachments.map(att =>
              att.type === 'cheque' && !att.deposited
                ? { ...att, deposited: true }
                : att
            ),
          }
          : msg
      )
    );

    // Add funds to account
    const newBalance = bankAccounts.find(acc => acc.id === accountId).balance + chequeAttachment.amount;

    setBankAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId
          ? { ...acc, balance: acc.balance + chequeAttachment.amount }
          : acc
      )
    );

    // Add transaction record
    setTransactions((prev) => [
      ...prev,
      {
        id: `txn-cheque-${Date.now()}`,
        date: currentTime.toISOString(),
        type: 'income',
        amount: chequeAttachment.amount,
        description: chequeAttachment.description || 'Cheque Deposit',
        balanceAfter: newBalance,
      },
    ]);

    // Clear pending deposit and play notification chime
    setPendingChequeDeposit(null);
    playNotificationChime();
  }, [messages]);

  // Cancel cheque deposit
  const cancelChequeDeposit = useCallback(() => {
    setPendingChequeDeposit(null);
  }, []);

  // Activate software license
  const activateLicense = useCallback((messageId, softwareId) => {
    // Mark license as activated in message
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          return {
            ...msg,
            attachments: msg.attachments.map((att) =>
              att.type === 'softwareLicense' && att.softwareId === softwareId
                ? { ...att, activated: true }
                : att
            ),
          };
        }
        return msg;
      })
    );

    // Add to licensed software list if not already there
    setLicensedSoftware((prev) => {
      if (prev.includes(softwareId)) return prev;
      return [...prev, softwareId];
    });
  }, []);

  const closeWindow = useCallback((windowId) => {
    setWindows((prev) => prev.filter((w) => w.id !== windowId));
  }, []);

  const minimizeWindow = useCallback((windowId) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, minimized: true } : w
      )
    );
  }, []);

  const restoreWindow = useCallback((windowId) => {
    const newZ = nextZIndexRef.current++;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, minimized: false, zIndex: newZ } : w
      )
    );
  }, []);

  const bringToFront = useCallback((windowId) => {
    const newZ = nextZIndexRef.current++;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, zIndex: newZ } : w
      )
    );
  }, []);

  const moveWindow = useCallback((windowId, position) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, position } : w
      )
    );
  }, []);

  // Time management
  useEffect(() => {
    if (isPaused) {
      return;
    }

    // Check if this is an active reboot (time should continue)
    const isActiveReboot = sessionStorage.getItem('is_active_reboot') === 'true';

    // Time only runs during:
    // - Desktop (normal gameplay)
    // - Rebooting/Boot during an active reboot (game continues)
    if (gamePhase === 'desktop' || (isActiveReboot && (gamePhase === 'rebooting' || gamePhase === 'boot'))) {
      // Time runs
    } else {
      return; // Don't run time
    }

    // Update interval based on time speed for smooth ticking
    // At 1x: update every 1000ms, add 1 second
    // At 10x: update every 100ms, add 1 second (ticks 10x faster visually)
    const updateInterval = 1000 / timeSpeed;
    timeIntervalRef.current = setInterval(() => {
      setCurrentTime((prev) => new Date(prev.getTime() + 1000));
    }, updateInterval);

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, [timeSpeed, isPaused, gamePhase]);

  // Toggle time speed
  const toggleTimeSpeed = useCallback(() => {
    setTimeSpeed((prev) =>
      prev === TIME_SPEEDS.NORMAL ? TIME_SPEEDS.FAST : TIME_SPEEDS.NORMAL
    );
  }, []);

  // Set specific time speed (for testing)
  const setSpecificTimeSpeed = useCallback((speed) => {
    setTimeSpeed(speed);
  }, []);

  // Get total credits
  const getTotalCredits = useCallback(() => {
    return bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [bankAccounts]);

  // Interest accumulation (1% per minute when overdrawn)
  const lastInterestRef = useRef(currentTime);

  useEffect(() => {
    if (!username || isPaused || gamePhase !== 'desktop') return;

    const totalCredits = getTotalCredits();
    if (totalCredits >= 0) {
      lastInterestRef.current = currentTime;
      return;
    }

    const now = currentTime.getTime();
    const lastTime = lastInterestRef.current.getTime();
    const minutesPassed = Math.floor((now - lastTime) / 60000);

    if (minutesPassed >= 1) {
      const interest = Math.floor(totalCredits * 0.01);

      // Update balance
      const newAccounts = [...bankAccounts];
      if (newAccounts[0]) {
        newAccounts[0].balance += interest;
        setBankAccounts(newAccounts);

        // Add transaction
        setTransactions((prev) => [
          ...prev,
          {
            id: `txn-interest-${Date.now()}`,
            date: currentTime.toISOString(),
            type: 'expense',
            amount: interest,
            description: 'Overdraft Interest',
            balanceAfter: newAccounts[0].balance,
          },
        ]);
      }

      lastInterestRef.current = currentTime;
    }
  }, [currentTime, isPaused, gamePhase, username, getTotalCredits, bankAccounts]);

  // Bankruptcy countdown
  const prevBankruptcyRef = useRef(null);

  useEffect(() => {
    if (!username || isPaused || gamePhase !== 'desktop') return;

    const totalCredits = getTotalCredits();

    if (shouldTriggerBankruptcy(totalCredits) && !bankruptcyCountdown) {
      setBankruptcyCountdown(startBankruptcyCountdown(currentTime));
    }

    if (bankruptcyCountdown) {
      const updated = updateBankruptcyCountdown(bankruptcyCountdown, currentTime, totalCredits);

      if (updated === null) {
        if (totalCredits <= -10000) {
          setGamePhase('gameOver-bankruptcy');
        } else {
          setBankruptcyCountdown(null);
        }
      } else {
        // Only update state if remaining time actually changed (avoid infinite loop)
        if (updated.remaining !== bankruptcyCountdown.remaining) {
          if (updated.remaining <= 10 && prevBankruptcyRef.current && prevBankruptcyRef.current.remaining > 10) {
            playNotificationChime();
          }
          prevBankruptcyRef.current = updated;
          setBankruptcyCountdown(updated);
        }
      }
    }
  }, [currentTime, bankruptcyCountdown, isPaused, gamePhase, username, getTotalCredits, playNotificationChime]);

  // Reputation countdown
  const prevReputationRef = useRef(null);

  useEffect(() => {
    if (!username || isPaused || gamePhase !== 'desktop') return;

    if (reputation === 1 && !reputationCountdown) {
      setReputationCountdown(startReputationCountdown(currentTime));
    }

    if (reputationCountdown) {
      const updated = updateReputationCountdown(reputationCountdown, currentTime);

      if (updated === null) {
        setGamePhase('gameOver-termination');
      } else {
        // Only update state if remaining time actually changed (avoid infinite loop)
        if (updated.remaining !== reputationCountdown.remaining) {
          if (updated.remaining <= 10) {
            playNotificationChime();
          }
          prevReputationRef.current = updated;
          setReputationCountdown(updated);
        }
      }
    }

    if (reputation > 1 && reputationCountdown) {
      setReputationCountdown(null);
    }
  }, [currentTime, reputation, reputationCountdown, isPaused, gamePhase, username, playNotificationChime]);

  // ===== MISSION ACTIONS =====

  // Accept mission
  const acceptMission = useCallback((mission) => {
    setActiveMission({
      ...mission,
      startTime: currentTime.toISOString(),
      acceptedTime: currentTime.toISOString(),
      objectives: mission.objectives.map(obj => ({ ...obj, status: 'pending' })),
    });

    // Remove the accepted mission from available missions
    setAvailableMissions(prev => prev.filter(m => m.missionId !== mission.missionId));

    // If mission has network file systems, add them to the NAR entry
    if (mission.network && mission.network.fileSystems && Array.isArray(mission.network.fileSystems)) {
      const networkId = mission.network.networkId;

      setNarEntries(prev => {
        const existingEntry = prev.find(entry => entry.networkId === networkId);

        if (existingEntry) {
          // Merge file systems into existing entry
          const updatedEntries = prev.map(entry => {
            if (entry.networkId === networkId) {
              // Merge file systems, updating existing ones by id
              const existingFileSystems = entry.fileSystems || [];
              const newFileSystems = mission.network.fileSystems;

              const mergedFileSystems = [...existingFileSystems];
              newFileSystems.forEach(newFs => {
                const existingIndex = mergedFileSystems.findIndex(fs => fs.id === newFs.id);
                if (existingIndex !== -1) {
                  // Update existing file system
                  mergedFileSystems[existingIndex] = newFs;
                } else {
                  // Add new file system
                  mergedFileSystems.push(newFs);
                }
              });

              return {
                ...entry,
                fileSystems: mergedFileSystems,
              };
            }
            return entry;
          });

          console.log(`✅ Merged ${mission.network.fileSystems.length} file systems into NAR entry for ${networkId}`);
          return updatedEntries;
        }

        return prev;
      });
    }
  }, [currentTime]);

  // Complete mission objective
  const completeMissionObjective = useCallback((objectiveId) => {
    // Use functional update to get the latest activeMission state
    // This prevents stale closure issues when multiple updates happen quickly
    setActiveMission((currentMission) => {
      if (!currentMission) {
        console.log(`⚠️ completeMissionObjective: No active mission to update (objective: ${objectiveId})`);
        return null; // Don't set it back if it was already cleared
      }

      const updatedObjectives = currentMission.objectives.map(obj =>
        obj.id === objectiveId ? { ...obj, status: 'complete' } : obj
      );

      console.log(`📋 completeMissionObjective: Updating objective ${objectiveId} for mission ${currentMission.missionId}`);
      return {
        ...currentMission,
        objectives: updatedObjectives,
      };
    });
  }, []);

  // Complete mission (success or failure)
  const completeMission = useCallback((status, payout, reputationChange, failureReason = null) => {
    console.log(`🏁 completeMission called: status=${status}, activeMission=${activeMission?.missionId}`);
    if (!activeMission) {
      console.log('⚠️ No active mission to complete');
      return;
    }

    // Guard against double completion - check if mission was already completed
    const missionId = activeMission.missionId || activeMission.id;
    if (failedMissionsRef.current.has(missionId + '-completed')) {
      console.log(`⚠️ Mission ${missionId} completion already processed - skipping duplicate`);
      return;
    }
    failedMissionsRef.current.add(missionId + '-completed');

    const completedMission = {
      id: activeMission.id || activeMission.missionId,
      missionId: activeMission.missionId || activeMission.id,
      title: activeMission.title,
      client: activeMission.client,
      difficulty: activeMission.difficulty,
      status,
      completionTime: currentTime.toISOString(),
      payout,
      reputationChange,
      failureReason: status === 'failed' ? (failureReason || 'Mission failed') : null,
    };

    // Add to completed missions (use functional update to avoid stale closure)
    setCompletedMissions(prev => [...prev, completedMission]);

    // Clear active mission
    setActiveMission(null);
    console.log(`✅ Active mission cleared, setting to null`);

    // Emit missionComplete event for mission system
    triggerEventBus.emit('missionComplete', {
      missionId: activeMission.missionId || activeMission.id,
      status,
      title: activeMission.title,
    });

    // Handle payment based on mission status
    if (status === 'success' && payout > 0) {
      // Success: Send client payment message with cheque (delayed)
      scheduleGameTimeCallback(() => {
        const paymentMessage = createMessageFromTemplate('client-payment', {
          username,
          clientName: activeMission.client,
          missionTitle: activeMission.title,
          payoutAmount: payout.toLocaleString(),
          chequeAmount: payout,
        });

        if (paymentMessage) {
          console.log(`💰 Sending payment message from ${activeMission.client} for ${payout} credits`);
          addMessage(paymentMessage);
        }
      }, 3000, timeSpeed);
    } else if (payout < 0) {
      // Failure penalty: Apply immediately
      setBankAccounts(prev => {
        return prev.map((account, index) => {
          if (index === 0) {
            console.log(`BALANCE_LOG completeMission penalty: ${account.balance} + ${payout} = ${account.balance + payout}`);
            return { ...account, balance: account.balance + payout };
          }
          return account;
        });
      });
    }

    // Update reputation
    setReputation(prev => Math.max(1, Math.min(11, prev + reputationChange)));

    // Schedule NAR entry revocation if mission has revokeOnComplete
    if (activeMission.network?.revokeOnComplete) {
      const networkId = activeMission.network.networkId;
      const networkName = activeMission.network.networkName || networkId;
      const revokeReason = activeMission.network.revokeReason || 'Mission access expired';

      console.log(`🔒 Scheduling NAR revocation for ${networkId} in 5 seconds (game time)`);

      scheduleGameTimeCallback(() => {
        console.log(`🔒 Revoking NAR entry for ${networkId}`);

        // Revoke the NAR entry
        setNarEntries(prev => prev.map(entry => {
          if (entry.networkId === networkId) {
            return {
              ...entry,
              authorized: false,
              revokedReason: revokeReason,
            };
          }
          return entry;
        }));

        // Disconnect any active VPN connection to this network
        setActiveConnections(prev => {
          const wasConnected = prev.some(conn => conn.networkId === networkId);
          if (wasConnected) {
            console.log(`📡 Disconnecting from ${networkName} due to access revocation`);
            // Emit networkDisconnected event for TopBar notification
            triggerEventBus.emit('networkDisconnected', {
              networkId,
              networkName,
              reason: revokeReason,
            });
          }
          return prev.filter(conn => conn.networkId !== networkId);
        });
      }, 5000, timeSpeed);
    }
  }, [activeMission, currentTime, completedMissions, bankAccounts, timeSpeed]);

  // Keep completeMissionRef updated
  useEffect(() => {
    completeMissionRef.current = completeMission;
  }, [completeMission]);

  // Initialize story mission system
  useStoryMissions(
    { gamePhase, username, managerName, currentTime, activeConnections, activeMission, timeSpeed, software, messages, reputation, completedMissions, isNewGameRef },
    { setAvailableMissions, addMessage, completeMissionObjective, completeMission, clearNewGameFlag }
  );

  // Auto-complete mission when status changes to 'failed'
  useEffect(() => {
    if (!activeMission || activeMission.status !== 'failed') return;
    if (!activeMission.missionId) return; // Already processed

    console.log('❌ Mission failed - applying penalties');
    console.log('❌  activeMission.consequences:', activeMission.consequences);

    // Get mission consequences from mission data
    const missionData = activeMission; // Could look up from missionData if needed
    const consequences = missionData.consequences?.failure || {};
    console.log('❌  failure consequences:', consequences);

    const penaltyCredits = consequences.credits || -10000;
    const reputationChange = consequences.reputation || -6;

    // Calculate mission duration
    const acceptedTime = activeMission.acceptedTime ? new Date(activeMission.acceptedTime) : currentTime;
    const duration = Math.round((currentTime - acceptedTime) / (1000 * 60)); // in minutes

    // Add failure reason to completed mission
    const failureReason = activeMission.failureReason || 'Mission failed';

    // Complete the mission with failure status
    const completedMission = {
      id: activeMission.id || activeMission.missionId,
      missionId: activeMission.missionId,
      title: activeMission.title,
      client: activeMission.client,
      difficulty: activeMission.difficulty,
      status: 'failed',
      completionTime: currentTime.toISOString(),
      payout: penaltyCredits,
      reputationChange: reputationChange,
      duration: duration,
      failureReason: failureReason,
    };

    // Add to completed missions
    setCompletedMissions(prev => [...prev, completedMission]);

    // Clear active mission
    setActiveMission(null);

    // Emit missionComplete event for mission system
    triggerEventBus.emit('missionComplete', {
      missionId: activeMission.missionId || activeMission.id,
      status: 'failed',
      title: activeMission.title,
    });
    console.log(`❌ Emitted missionComplete event for ${activeMission.missionId}`);

    // Update credits (apply penalty - use functional update with deep copy)
    setBankAccounts(prev => {
      return prev.map((account, index) => {
        if (index === 0) {
          console.log(`BALANCE_LOG useEffect failed status: ${account.balance} + ${penaltyCredits} = ${account.balance + penaltyCredits}`);
          return { ...account, balance: account.balance + penaltyCredits };
        }
        return account;
      });
    });

    // Update reputation
    setReputation(prev => Math.max(1, Math.min(11, prev + reputationChange)));

    console.log(`❌ About to check for failure messages`);
    console.log(`❌ consequences.messages:`, consequences.messages);
    console.log(`❌ Array.isArray:`, Array.isArray(consequences.messages));
    console.log(`❌ messages.length:`, consequences.messages?.length);
    console.log(`❌ Full condition check:`, {
      hasMessages: !!consequences.messages,
      isArray: Array.isArray(consequences.messages),
      hasLength: consequences.messages?.length > 0,
      overall: consequences.messages && Array.isArray(consequences.messages) && consequences.messages.length > 0
    });

    // Schedule failure messages (if any)
    if (consequences.messages && Array.isArray(consequences.messages) && consequences.messages.length > 0) {
      console.log(`📧 Found ${consequences.messages.length} failure messages to schedule`);

      // Create messages from templates
      consequences.messages.forEach(msgConfig => {
        console.log(`📧 Processing message config:`, msgConfig);

        const messageData = {
          username: username,
          managerName: managerName,
        };

        const message = createMessageFromTemplate(msgConfig.templateId, messageData);

        if (message) {
          const delay = msgConfig.delay || 0;
          console.log(`📧 Scheduling message "${message.subject}" with ${delay}ms game time delay`);

          // Schedule the message using game-time-aware callback
          scheduleGameTimeCallback(() => {
            console.log(`📧 Sending failure message: ${message.subject}`);
            addMessage(message);
          }, delay);
        }
      });
    } else {
      console.log(`❌ No failure messages found or not an array`);
    }

    console.log(`❌ Mission failed: ${completedMission.title}`);
    console.log(`  💰 Penalty: ${penaltyCredits} credits`);
    console.log(`  📊 Reputation change: ${reputationChange}`);
  }, [activeMission, currentTime, bankAccounts, completedMissions, username, managerName, addMessage]);

  // Helper to process the banking message queue (sends next message with 5s delay)
  const processBankingMessageQueue = useCallback(() => {
    if (bankingMessageQueueRef.current.length === 0) {
      console.log(`💳 Banking message queue empty`);
      return;
    }

    // If already processing, skip
    if (bankingMessageTimerRef.current) {
      console.log(`💳 Already processing banking message queue`);
      return;
    }

    const nextMessage = bankingMessageQueueRef.current[0];
    console.log(`💳 Processing banking message queue: ${nextMessage.type} (${bankingMessageQueueRef.current.length} in queue)`);

    // Schedule the message with 5 second delay
    bankingMessageTimerRef.current = scheduleGameTimeCallback(() => {
      // Remove from queue
      const messageToSend = bankingMessageQueueRef.current.shift();
      bankingMessageTimerRef.current = null;

      if (messageToSend) {
        // Mark as sent
        setBankingMessagesSent(prev => ({ ...prev, [messageToSend.type]: true }));

        // Send the message
        addMessage(messageToSend.message);
        console.log(`💳 Banking message sent: ${messageToSend.message.subject}`);

        // Process next in queue (if any) - use ref to avoid accessing before declaration
        processBankingMessageQueueRef.current?.();
      }
    }, 5000, timeSpeed);
  }, [addMessage, timeSpeed]);

  // Keep processBankingMessageQueueRef updated for recursive calls
  useEffect(() => {
    processBankingMessageQueueRef.current = processBankingMessageQueue;
  }, [processBankingMessageQueue]);

  // Banking messages - send automated messages for overdrafts and bankruptcy warnings
  useEffect(() => {
    if (!username || gamePhase !== 'desktop') return;

    const totalCredits = getTotalCredits();

    // Initialize prev balance on first run
    if (prevBalanceRef.current === null) {
      prevBalanceRef.current = totalCredits;
      return;
    }

    const prevBalance = prevBalanceRef.current;

    // Reset sent flags when conditions no longer apply
    if (totalCredits >= 0 && bankingMessagesSent.firstOverdraft) {
      setBankingMessagesSent(prev => ({ ...prev, firstOverdraft: false }));
      console.log(`💳 Reset firstOverdraft flag (balance now positive)`);
    }
    if (totalCredits >= -8000 && bankingMessagesSent.approachingBankruptcy) {
      setBankingMessagesSent(prev => ({ ...prev, approachingBankruptcy: false }));
      console.log(`💳 Reset approachingBankruptcy flag (balance above -8000)`);
    }
    if (totalCredits > -10000 && bankingMessagesSent.bankruptcyCountdownStart) {
      setBankingMessagesSent(prev => ({ ...prev, bankruptcyCountdownStart: false }));
      console.log(`💳 Reset bankruptcyCountdownStart flag (balance above -10000)`);
    }
    if (bankruptcyCountdown && bankingMessagesSent.bankruptcyCancelled) {
      setBankingMessagesSent(prev => ({ ...prev, bankruptcyCancelled: false }));
      console.log(`💳 Reset bankruptcyCancelled flag (bankruptcy countdown active again)`);
    }

    // Determine which messages should be queued based on thresholds crossed
    // Order by threshold: firstOverdraft (0) → approachingBankruptcy (-8000) → bankruptcyCountdownStart (-10000)
    const messagesToQueue = [];

    // Check each threshold in order
    if (totalCredits < 0 && totalCredits > -10000 && prevBalance >= 0 && !bankingMessagesSent.firstOverdraft) {
      messagesToQueue.push('firstOverdraft');
    }
    if (totalCredits < -8000 && totalCredits > -10000 && prevBalance >= -8000 && !bankingMessagesSent.approachingBankruptcy) {
      messagesToQueue.push('approachingBankruptcy');
    }
    if (totalCredits <= -10000 && prevBalance > -10000 && !bankingMessagesSent.bankruptcyCountdownStart) {
      messagesToQueue.push('bankruptcyCountdownStart');
    }
    if (totalCredits > -10000 && bankruptcyCountdown && !bankingMessagesSent.bankruptcyCancelled) {
      messagesToQueue.push('bankruptcyCancelled');
    }

    // Queue each message
    messagesToQueue.forEach(messageType => {
      console.log(`💳 Queueing banking message: ${messageType}`);
      const template = BANKING_MESSAGES[messageType];
      if (template) {
        let body = '';
        if (messageType === 'firstOverdraft' || messageType === 'approachingBankruptcy' || messageType === 'bankruptcyCancelled') {
          body = template.bodyTemplate(totalCredits);
        } else if (messageType === 'bankruptcyCountdownStart') {
          const timeRemaining = bankruptcyCountdown ? bankruptcyCountdown.remaining : 5;
          body = template.bodyTemplate(totalCredits, timeRemaining);
        }

        // Replace {username} placeholder
        body = body.replace(/{username}/g, username);

        const message = {
          id: `bank-${messageType}-${Date.now()}`,
          from: template.fromName,
          fromId: template.fromId,
          to: username,
          toId: playerMailId,
          subject: template.subject,
          body,
          timestamp: currentTime.toISOString(),
          read: false,
        };

        bankingMessageQueueRef.current.push({ type: messageType, message });
      }
    });

    // Start processing queue if we added messages
    if (messagesToQueue.length > 0) {
      processBankingMessageQueue();
    }

    // Update previous balance
    prevBalanceRef.current = totalCredits;
  }, [bankAccounts, username, gamePhase, getTotalCredits, bankruptcyCountdown, currentTime, playerMailId, addMessage, bankingMessagesSent, processBankingMessageQueue, timeSpeed]);

  // HR messages - send automated messages for reputation changes and termination warnings
  useEffect(() => {
    if (!username || gamePhase !== 'desktop') return;

    const currentTier = reputation;

    // Reset sent flags when conditions no longer apply (allows re-triggering if player drops again)
    if (currentTier >= 3 && reputationMessagesSent.performancePlanWarning) {
      setReputationMessagesSent(prev => ({ ...prev, performancePlanWarning: false }));
      console.log(`👔 Reset performancePlanWarning flag (tier improved to ${currentTier})`);
    }
    if (currentTier >= 2 && reputationMessagesSent.finalTerminationWarning) {
      setReputationMessagesSent(prev => ({ ...prev, finalTerminationWarning: false }));
      console.log(`👔 Reset finalTerminationWarning flag (tier improved to ${currentTier})`);
    }
    if (currentTier === 1 && reputationMessagesSent.performanceImproved) {
      setReputationMessagesSent(prev => ({ ...prev, performanceImproved: false }));
      console.log(`👔 Reset performanceImproved flag (tier dropped back to 1)`);
    }

    // Initialize prev reputation tier on first run
    if (prevReputationTierRef.current === null) {
      prevReputationTierRef.current = currentTier;
      return;
    }

    const prevTier = prevReputationTierRef.current;

    // Only send messages when tier changes
    if (currentTier !== prevTier) {
      let messageType = null;

      // Check for reputation transitions that trigger messages (only if not already sent)
      if (currentTier === 2 && prevTier > 2 && !reputationMessagesSent.performancePlanWarning) {
        // Dropped to Tier 2 - performance plan warning
        messageType = 'performancePlanWarning';
      } else if (currentTier === 1 && prevTier > 1 && !reputationMessagesSent.finalTerminationWarning) {
        // Dropped to Tier 1 - final termination warning
        messageType = 'finalTerminationWarning';
      } else if (currentTier > 1 && prevTier === 1 && !reputationMessagesSent.performanceImproved) {
        // Improved from Tier 1 - performance improved (saved from termination)
        messageType = 'performanceImproved';
      }

      if (messageType) {
        console.log(`👔 HR message triggered: ${messageType}`);
        console.log(`  Previous tier: ${prevTier}, Current tier: ${currentTier}`);

        // Mark as sent before sending
        setReputationMessagesSent(prev => ({ ...prev, [messageType]: true }));

        const template = HR_MESSAGES[messageType];
        if (template) {
          const tierInfo = getReputationTier(currentTier);
          let body = template.bodyTemplate(currentTier, tierInfo.name);

          // Replace {username} placeholder
          body = body.replace(/{username}/g, username);

          addMessage({
            id: `hr-${messageType}-${Date.now()}`,
            from: template.fromName,
            fromId: template.fromId,
            to: username,
            toId: playerMailId,
            subject: template.subject,
            body,
            timestamp: currentTime.toISOString(),
            read: false,
          });

          console.log(`👔 HR message sent: ${template.subject}`);
        }
      }
    }

    // Update previous tier
    prevReputationTierRef.current = currentTier;
  }, [reputation, username, gamePhase, currentTime, playerMailId, addMessage, reputationMessagesSent]);

  // Objective auto-tracking - automatically completes objectives when game events occur
  useObjectiveAutoTracking(
    activeMission,
    {
      activeConnections,
      lastScanResults,
      fileManagerConnections,
      lastFileOperation,
      missionFileOperations, // Cumulative file operations for objectives with count requirements
      narEntries, // For NAR entry added objectives
    },
    reputation,
    completeMissionObjective,
    completeMission,
    autoTrackingEnabled
  );

  // Scripted event execution - listen for and execute scripted events
  useEffect(() => {
    const handleScriptedEvent = async (data) => {
      const { eventId, actions, missionId } = data;
      console.log(`🚀 Executing scripted event: ${eventId} with ${actions?.length || 0} actions`);
      console.log(`🚀 Action types:`, actions.map(a => a.type).join(', '));

      // Process each action sequentially
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        console.log(`  → Processing action ${i + 1}/${actions.length}: ${action.type}`);

        switch (action.type) {
          case 'forceFileOperation':
            if (action.operation === 'delete') {
              const filesToDelete = typeof action.files === 'number' ? action.files : 8;
              console.log(`🗑️ Scripted: Deleting ${filesToDelete} files`);

              // Update NAR entries to remove files from the targeted filesystem
              setNarEntries(currentEntries => {
                console.log(`  NAR entries before deletion:`, currentEntries.length);
                return currentEntries.map(entry => {
                  if (entry.fileSystems) {
                    return {
                      ...entry,
                      fileSystems: entry.fileSystems.map(fs => {
                        // Delete files from all filesystems (sabotage affects all)
                        const remainingFiles = (fs.files || []).slice(filesToDelete);
                        console.log(`  🗑️ FS ${fs.name}: ${fs.files?.length || 0} files → ${remainingFiles.length} files`);
                        return {
                          ...fs,
                          files: remainingFiles
                        };
                      })
                    };
                  }
                  return entry;
                });
              });

              console.log(`🗑️ All ${filesToDelete} files deleted by sabotage`);
            }
            break;

          case 'forceDisconnect':
            console.log(`🔌 Scripted: Force disconnecting from network "${action.network}"`);

            // Remove active connections matching the network ID or name
            setActiveConnections(currentConns => {
              console.log(`  🔌 Current connections (${currentConns.length}):`, currentConns.map(c => `${c.networkId}/${c.networkName}`));
              console.log(`  🔌 Looking for: "${action.network}"`);
              const filtered = currentConns.filter(conn => {
                const keepConnection = conn.networkId !== action.network && conn.networkName !== action.network;
                console.log(`    Connection ${conn.networkId}: ${keepConnection ? 'KEEP' : 'REMOVE'}`);
                return keepConnection;
              });
              console.log(`  🔌 After filter (${filtered.length}):`, filtered.map(c => `${c.networkId}/${c.networkName}`));
              return filtered;
            });

            // Emit disconnect event
            triggerEventBus.emit('forceNetworkDisconnect', {
              networkId: action.network,
              reason: action.reason || 'Network administrator terminated connection',
            });

            console.log(`🔌 Network disconnected: ${action.network}`);
            break;

          case 'revokeNAREntry':
            console.log(`🔐 Scripted: Revoking NAR entry for ${action.network}`);
            setNarEntries(currentEntries => {
              const updated = currentEntries.map(entry => {
                if (entry.networkId === action.network) {
                  return {
                    ...entry,
                    authorized: false,
                    revokedReason: action.reason || 'Access credentials revoked by network administrator'
                  };
                }
                return entry;
              });
              console.log(`🔐 NAR entry revoked: ${action.network}`);
              return updated;
            });
            break;

          case 'setMissionStatus':
            console.log(`📋 Scripted: Setting mission status to ${action.status}, completeMissionRef=${typeof completeMissionRef.current}`);
            if (action.status === 'failed') {
              // Check if we've already processed this mission failure
              if (failedMissionsRef.current.has(missionId)) {
                console.log(`⚠️ Mission ${missionId} failure already processed - skipping duplicate`);
                break;
              }

              failedMissionsRef.current.add(missionId);

              // Check if mission is still active
              console.log(`🔍 Checking mission status: activeMission=${JSON.stringify({ id: activeMission?.id, missionId: activeMission?.missionId })}, lookingFor=${missionId}`);
              if (activeMission && (activeMission.missionId === missionId || activeMission.id === missionId)) {
                // Mission still active - complete it with failure status
                const failurePayout = activeMission.consequences?.failure?.credits || 0;
                const failureReputation = activeMission.consequences?.failure?.reputation || 0;
                const failureReason = action.failureReason || 'Mission failed';
                console.log(`💔 Mission failed - applying penalties: ${failurePayout} credits, ${failureReputation} reputation`);
                console.log(`🎯 About to call completeMissionRef.current, ref type=${typeof completeMissionRef.current}, value=${completeMissionRef.current}`);
                completeMissionRef.current?.('failed', failurePayout, failureReputation, failureReason);
                console.log(`✅ completeMission call finished`);
              } else {
                // Mission already completed - update the completed mission's status
                console.log(`⚠️ Mission ${missionId} already completed - updating status to failed`);

                const failurePayout = action.failureConsequences?.credits ?? -10000;
                const failureReputation = action.failureConsequences?.reputation ?? -6;

                // Update the mission and bank account in one go to ensure atomicity
                setCompletedMissions(prevCompleted => {
                  const mission = prevCompleted.find(m => m.missionId === missionId || m.id === missionId);

                  if (!mission) {
                    console.log(`⚠️ Mission ${missionId} not found in completed missions`);
                    return prevCompleted;
                  }

                  if (mission.status === 'failed') {
                    console.log(`⚠️ Mission already marked as failed in state - skipping`);
                    return prevCompleted;
                  }

                  console.log(`💔 Updating completed mission to failed - adjusting penalties: ${failurePayout} credits, ${failureReputation} reputation`);
                  const payoutDiff = failurePayout - (mission.payout || 0);
                  console.log(`💰 Payout diff: ${payoutDiff} (failure: ${failurePayout}, success was: ${mission.payout || 0})`);

                  // Update bank account synchronously
                  setBankAccounts(prevAccounts => {
                    const newAccounts = [...prevAccounts];
                    if (newAccounts[0]) {
                      const oldBalance = newAccounts[0].balance;
                      newAccounts[0].balance += payoutDiff;
                      console.log(`💰 Balance: ${oldBalance} → ${newAccounts[0].balance} (diff: ${payoutDiff})`);
                    }
                    return newAccounts;
                  });

                  return prevCompleted.map(m => {
                    if (m.missionId === missionId || m.id === missionId) {
                      return {
                        ...m,
                        status: 'failed',
                        payout: failurePayout,
                        reputationChange: failureReputation,
                        failureReason: action.failureReason || 'Mission failed'
                      };
                    }
                    return m;
                  });
                });
              }
            }
            break;

          default:
            console.warn(`Unknown scripted action type: ${action.type}`);
        }
      }

      // Emit completion event
      triggerEventBus.emit('scriptedEventComplete', { eventId });
      console.log(`✅ Scripted event ${eventId} complete`);
    };

    console.log(`🔌 SUBSCRIBED to scriptedEventStart, activeMission=${activeMission?.missionId || 'null'}`);
    triggerEventBus.on('scriptedEventStart', handleScriptedEvent);

    return () => {
      console.log(`🔌 UNSUBSCRIBED from scriptedEventStart`);
      triggerEventBus.off('scriptedEventStart', handleScriptedEvent);
    };
  }, [activeMission, completedMissions, bankAccounts, setNarEntries, setActiveConnections, setActiveMission]);

  // Handle scheduled story events (e.g., failure messages)
  useEffect(() => {
    const scheduledTimeouts = []; // Store scheduled timeouts

    const handleScheduleEvent = (data) => {
      const { eventId, delay, message } = data;
      console.log(`📅 Received schedule request for ${eventId} with delay ${delay}ms`);

      if (message && message.templateId) {
        // Create message from template
        const messageData = {
          username: username,
          managerName: managerName,
        };

        const fullMessage = createMessageFromTemplate(message.templateId, messageData);

        if (fullMessage) {
          console.log(`📧 Will send message "${fullMessage.subject}" in ${delay}ms game time`);

          // Schedule in real time (game time will be handled by time speed)
          // For now, we'll use a simple timeout
          // TODO: Integrate with game time system properly
          const timeoutId = setTimeout(() => {
            console.log(`📧 Sending scheduled message: ${fullMessage.subject}`);
            addMessage(fullMessage);
          }, delay);

          scheduledTimeouts.push(timeoutId);
        }
      }
    };

    triggerEventBus.on('scheduleStoryEvent', handleScheduleEvent);

    return () => {
      triggerEventBus.off('scheduleStoryEvent', handleScheduleEvent);
      // Clear any pending timeouts
      scheduledTimeouts.forEach(clearTimeout);
    };
  }, [username, managerName, addMessage]);

  // Mission intro messages
  useEffect(() => {
    const handleMissionIntroMessage = (data) => {
      const { missionId, introMessage } = data;
      console.log(`📧 Handling intro message for mission: ${missionId}`);

      const template = MESSAGE_TEMPLATES[introMessage.templateId];
      if (!template) {
        console.error(`❌ Message template not found: ${introMessage.templateId}`);
        return;
      }

      // Create message from template
      const message = createMessageFromTemplate(introMessage.templateId, {
        username,
        managerName,
      });

      if (!message) {
        console.error(`❌ Failed to create message from template: ${introMessage.templateId}`);
        return;
      }

      // Set timestamp
      message.timestamp = currentTime.toISOString();
      message.toId = playerMailId;
      message.to = username;

      console.log(`📧 Sending intro message: ${message.subject}`);
      addMessage(message);
    };

    triggerEventBus.on('sendMissionIntroMessage', handleMissionIntroMessage);

    return () => {
      triggerEventBus.off('sendMissionIntroMessage', handleMissionIntroMessage);
    };
  }, [username, playerMailId, managerName, currentTime, addMessage]);

  // Save game
  const saveGame = useCallback((saveName = null) => {
    const gameState = {
      username,
      playerMailId,
      currentTime: currentTime.toISOString(),
      hardware,
      software,
      bankAccounts,
      messages,
      managerName,
      windows: windows.map((w) => ({ ...w })),
      // Extended state (missions, reputation, network, transactions)
      reputation,
      reputationCountdown,
      activeMission,
      completedMissions,
      availableMissions,
      missionCooldowns,
      narEntries,
      activeConnections,
      lastScanResults,
      fileManagerConnections,
      lastFileOperation,
      downloadQueue,
      transactions,
      licensedSoftware,
      bankruptcyCountdown,
      lastInterestTime,
      // Story progression (prevents duplicate messages)
      processedEvents: storyMissionManager.getFiredEvents(),
      // Pending story events (timers in progress)
      pendingStoryEvents: storyMissionManager.getPendingEvents(),
      // Banking message tracking
      bankingMessagesSent,
      // HR message tracking
      reputationMessagesSent,
    };

    saveToLocalStorage(username, gameState, saveName);
  }, [username, playerMailId, currentTime, hardware, software, bankAccounts, messages, managerName, windows,
    reputation, reputationCountdown, activeMission, completedMissions, availableMissions, missionCooldowns,
    narEntries, activeConnections, lastScanResults, fileManagerConnections, lastFileOperation,
    downloadQueue, transactions, licensedSoftware, bankruptcyCountdown, lastInterestTime, bankingMessagesSent, reputationMessagesSent]);

  // Reboot system
  const rebootSystem = useCallback(() => {
    // Close all windows but keep all other state
    setWindows([]);
    // Mark that this is a reboot (time should continue)
    localStorage.setItem('osnet_rebooting', 'true');
    sessionStorage.setItem('is_active_reboot', 'true');
    // Go to reboot animation phase
    setGamePhase('rebooting');
  }, []);

  // Reset game state for new game
  const resetGame = useCallback(() => {
    // Reset all state to initial values
    setUsername('');
    setPlayerMailId('');
    setCurrentTime(new Date(GAME_START_DATE));
    setTimeSpeed(TIME_SPEEDS.NORMAL);
    setIsPaused(false);
    setHardware(STARTING_HARDWARE);
    setSoftware(STARTING_SOFTWARE);
    setBankAccounts([STARTING_BANK_ACCOUNT]);
    setMessages([]);
    setManagerName('');
    setWindows([]);
    setPendingChequeDeposit(null);
    nextZIndexRef.current = 1000;
    nextWindowIdRef.current = 1;
    // Reset extended state
    setReputation(9); // Superb (starting reputation)
    setReputationCountdown(null);
    setActiveMission(null);
    setCompletedMissions([]);
    setAvailableMissions([]);
    setMissionCooldowns({ easy: null, medium: null, hard: null });
    setNarEntries([]);
    setActiveConnections([]);
    setLastScanResults(null);
    setFileManagerConnections([]);
    setLastFileOperation(null);
    setDownloadQueue([]);
    setTransactions([]);
    setLicensedSoftware([]);
    setBankruptcyCountdown(null);
    setLastInterestTime(null);
    // Reset banking message tracking
    setBankingMessagesSent({
      firstOverdraft: false,
      approachingBankruptcy: false,
      bankruptcyCountdownStart: false,
      bankruptcyCancelled: false,
    });
    bankingMessageQueueRef.current = [];
    if (bankingMessageTimerRef.current) {
      clearGameTimeCallback(bankingMessageTimerRef.current);
      bankingMessageTimerRef.current = null;
    }
    // Reset HR message tracking
    setReputationMessagesSent({
      performancePlanWarning: false,
      finalTerminationWarning: false,
      performanceImproved: false,
    });
    // Go to boot phase
    setGamePhase('boot');
  }, []);

  // Load game
  const loadGame = useCallback((usernameToLoad) => {
    const gameState = loadFromLocalStorage(usernameToLoad);

    if (!gameState) {
      return false;
    }
    setUsername(gameState.username);
    setPlayerMailId(gameState.playerMailId);
    setCurrentTime(new Date(gameState.currentTime));
    setHardware(gameState.hardware);
    setSoftware(gameState.software);
    setBankAccounts(gameState.bankAccounts);
    setMessages(gameState.messages);
    setManagerName(gameState.managerName);

    // Load extended state (with defaults for older save formats)
    setReputation(gameState.reputation ?? 9);
    setReputationCountdown(gameState.reputationCountdown ?? null);
    setActiveMission(gameState.activeMission ?? null);
    setCompletedMissions(gameState.completedMissions ?? []);
    setAvailableMissions(gameState.availableMissions ?? []);
    setMissionCooldowns(gameState.missionCooldowns ?? { easy: null, medium: null, hard: null });
    setNarEntries(gameState.narEntries ?? []);
    setActiveConnections(gameState.activeConnections ?? []);
    setLastScanResults(gameState.lastScanResults ?? null);
    setFileManagerConnections(gameState.fileManagerConnections ?? []);
    setLastFileOperation(gameState.lastFileOperation ?? null);
    setDownloadQueue(gameState.downloadQueue ?? []);
    setTransactions(gameState.transactions ?? []);
    setLicensedSoftware(gameState.licensedSoftware ?? []);
    setBankruptcyCountdown(gameState.bankruptcyCountdown ?? null);
    setLastInterestTime(gameState.lastInterestTime ?? null);

    // Restore story progression (prevents duplicate messages)
    storyMissionManager.setFiredEvents(gameState.processedEvents ?? []);

    // Restore pending story events (timers in progress)
    storyMissionManager.setPendingEvents(gameState.pendingStoryEvents ?? []);

    // Restore banking message tracking
    setBankingMessagesSent(gameState.bankingMessagesSent ?? {
      firstOverdraft: false,
      approachingBankruptcy: false,
      bankruptcyCountdownStart: false,
      bankruptcyCancelled: false,
    });

    // Restore HR message tracking
    setReputationMessagesSent(gameState.reputationMessagesSent ?? {
      performancePlanWarning: false,
      finalTerminationWarning: false,
      performanceImproved: false,
    });

    // Validate and fix window positions when loading
    const loadedWindows = (gameState.windows || []).map((w, index) => {
      // If position is missing or invalid, calculate a valid position
      if (!w.position || typeof w.position.x !== 'number' || typeof w.position.y !== 'number') {
        const CASCADE_OFFSET = 30;
        const BASE_X = 50;
        const BASE_Y = 100;
        return {
          ...w,
          position: {
            x: BASE_X + (index * CASCADE_OFFSET),
            y: BASE_Y + (index * CASCADE_OFFSET)
          }
        };
      }
      return w;
    });
    setWindows(loadedWindows);

    // Reset nextZIndex to be higher than any loaded window z-index
    const maxZIndex = loadedWindows.reduce((max, w) => Math.max(max, w.zIndex || 0), 1000);
    nextZIndexRef.current = maxZIndex + 1;

    setTimeSpeed(TIME_SPEEDS.NORMAL); // Always reset to 1x

    // Check if should skip boot (E2E tests)
    const urlParams = new URLSearchParams(window.location.search);
    const skipBoot = urlParams.get('skipBoot') === 'true';

    if (skipBoot) {
      setGamePhase('desktop'); // Skip boot, go straight to desktop
    } else {
      setGamePhase('boot'); // Normal boot sequence
    }

    return true;
  }, []);

  // Context value
  const value = {
    // State
    gamePhase,
    setGamePhase,
    username,
    setUsername,
    playerMailId,
    setPlayerMailId,
    currentTime,
    setCurrentTime,
    timeSpeed,
    setTimeSpeed,
    isPaused,
    setIsPaused,
    hardware,
    setHardware,
    software,
    setSoftware,
    bankAccounts,
    setBankAccounts,
    messages,
    setMessages,
    managerName,
    setManagerName,
    windows,
    setWindows,
    pendingChequeDeposit,

    // New game tracking (for welcome messages)
    isNewGameRef,

    // Extended State (missions, reputation, network, transactions)
    reputation,
    setReputation,
    reputationCountdown,
    setReputationCountdown,
    activeMission,
    setActiveMission,
    completedMissions,
    setCompletedMissions,
    availableMissions,
    setAvailableMissions,
    missionCooldowns,
    setMissionCooldowns,
    narEntries,
    setNarEntries,
    activeConnections,
    setActiveConnections,
    lastScanResults,
    setLastScanResults,
    fileManagerConnections,
    setFileManagerConnections,
    lastFileOperation,
    setLastFileOperation,
    downloadQueue,
    setDownloadQueue,
    transactions,
    setTransactions,
    licensedSoftware,
    setLicensedSoftware,
    bankruptcyCountdown,
    setBankruptcyCountdown,
    lastInterestTime,
    setLastInterestTime,
    autoTrackingEnabled,
    setAutoTrackingEnabled,
    bandwidthOperations,
    getBandwidthInfo,
    registerBandwidthOperation,
    completeBandwidthOperation,
    updateBandwidthOperationProgress,
    fileClipboard,
    setFileClipboard,
    clearFileClipboard,

    // Actions
    initializePlayer,
    addMessage,
    markMessageAsRead,
    archiveMessage,
    initiateChequeDeposit,
    depositCheque,
    cancelChequeDeposit,
    activateLicense,
    getTotalCredits,
    acceptMission,
    completeMissionObjective,
    completeMission,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    bringToFront,
    moveWindow,
    toggleTimeSpeed,
    setSpecificTimeSpeed,
    saveGame,
    loadGame,
    rebootSystem,
    resetGame,
    generateUsername,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
