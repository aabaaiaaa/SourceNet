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
import { executeScriptedEvent } from '../missions/ScriptedEventExecutor';
import { initializePool, refreshPool, shouldRefreshPool, handleArcProgression, handleArcFailure } from '../missions/MissionPoolManager';

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

  // VPN quick connect (from NAR)
  const [pendingVpnConnection, setPendingVpnConnection] = useState(null);

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
        return newValue;
      });
    } else {
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
  const [discoveredDevices, setDiscoveredDevices] = useState({}); // Map of networkId -> Set of discovered IPs
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

  // ===== PROCEDURAL MISSION SYSTEM =====
  const [proceduralMissionsEnabled, setProceduralMissionsEnabled] = useState(false);
  const [missionPool, setMissionPool] = useState([]); // Available procedural missions
  const [pendingChainMissions, setPendingChainMissions] = useState({}); // Unrevealed chain parts
  const [activeClientIds, setActiveClientIds] = useState([]); // Clients with active/pending missions
  const [clientStandings, setClientStandings] = useState({}); // { clientId: { successCount, failCount, lastMissionDate } }
  const [extensionOffers, setExtensionOffers] = useState({}); // { missionId: extensionOffer }

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
    if (fileClipboard.sourceNetworkId) {
      const stillConnected = activeConnections.some(conn => conn.networkId === fileClipboard.sourceNetworkId);
      if (!stillConnected) {
        console.log('📋 Clipboard cleared - disconnected from source network');
        clearFileClipboard();
      }
    }
  }, [activeConnections, fileClipboard.sourceNetworkId, clearFileClipboard]);

  // Update files in a specific file system within narEntries
  // Note: State updates are batched by React. Components may see stale narEntries
  // for one render cycle if they perform operations that immediately query updated values.
  const updateFileSystemFiles = useCallback((networkId, fileSystemId, updatedFiles) => {
    console.log(`📁 updateFileSystemFiles called: networkId=${networkId}, fsId=${fileSystemId}, fileCount=${updatedFiles?.length}`);

    // Capture previous file count for logging (outside state updater)
    const prevEntry = narEntries.find(e => e.networkId === networkId);
    const prevFs = prevEntry?.fileSystems?.find(fs => fs.id === fileSystemId);
    const prevFileCount = prevFs?.files?.length;

    setNarEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.networkId !== networkId) return entry;
        if (!entry.fileSystems) return entry;

        return {
          ...entry,
          fileSystems: entry.fileSystems.map(fs => {
            if (fs.id !== fileSystemId) return fs;
            return { ...fs, files: updatedFiles };
          }),
        };
      });
      return updated;
    });

    // Log after state update (outside updater)
    console.log(`📁 Updating fs ${fileSystemId} files from ${prevFileCount} to ${updatedFiles?.length}`);
  }, [narEntries]);

  // Accumulate file operations for mission tracking (unique files per operation type)
  useEffect(() => {
    if (lastFileOperation && activeMission) {
      const { operation, fileNames = [] } = lastFileOperation;

      setMissionFileOperations(prev => {
        const existingFiles = prev[operation] || new Set();
        const existingCount = existingFiles.size;
        const updatedFiles = new Set(existingFiles);
        fileNames.forEach(name => updatedFiles.add(name));
        // Log inside updater to get accurate counts (logging is harmless side effect)
        console.log(`📊 Cumulative ${operation}: ${existingCount} + ${fileNames.length} new files`);
        return {
          ...prev,
          [operation]: updatedFiles
        };
      });
    }
  }, [lastFileOperation, activeMission]);

  // Reset cumulative file operations when mission changes
  useEffect(() => {
    console.log('🔄 Mission changed, resetting missionFileOperations');
    setMissionFileOperations({});
  }, [activeMission?.missionId]);

  // Initialize procedural missions when "Better" message is read (after tutorial-part-2)
  useEffect(() => {
    // Listen for the manager's "Better" message being read
    // Message ID is prefixed with 'msg-' when created from event ID
    const handleMessageRead = (data) => {
      if (data.messageId === 'msg-manager-better') {
        console.log('🎯 "Better" message read! Initializing procedural mission pool...');

        // Enable procedural missions
        setProceduralMissionsEnabled(true);

        // Initialize the mission pool
        const poolState = initializePool(reputation, currentTime);
        console.log(`📋 Procedural pool initialized with ${poolState.missions.length} missions, ${Object.keys(poolState.pendingArcMissions || {}).length} arcs pending`);
        setMissionPool(poolState.missions);
        setPendingChainMissions(poolState.pendingArcMissions || {});
        setActiveClientIds(poolState.activeClientIds);
      }
    };

    const unsubscribe = triggerEventBus.on('messageRead', handleMessageRead);
    return () => unsubscribe();
  }, [reputation, currentTime]);

  // Refresh procedural mission pool when reputation changes or time advances significantly
  useEffect(() => {
    if (!proceduralMissionsEnabled || missionPool.length === 0) return;

    const poolState = {
      missions: missionPool,
      pendingArcMissions: pendingChainMissions,
      activeClientIds,
      lastRefresh: new Date().toISOString()
    };

    if (shouldRefreshPool(poolState, reputation)) {
      console.log('🔄 Refreshing procedural mission pool...');
      const activeMissionId = activeMission?.missionId || null;
      const newPoolState = refreshPool(poolState, reputation, currentTime, activeMissionId);
      setMissionPool(newPoolState.missions);
      setPendingChainMissions(newPoolState.pendingArcMissions || {});
      setActiveClientIds(newPoolState.activeClientIds);
    }
  }, [reputation]); // Only trigger on reputation change

  // Handle arc progression/failure when missions complete
  useEffect(() => {
    if (!proceduralMissionsEnabled) return;

    const handleMissionComplete = (data) => {
      // Skip if no arc info (not part of an arc)
      if (!data.arcId) return;

      const poolState = {
        missions: missionPool,
        pendingArcMissions: pendingChainMissions,
        activeClientIds,
        lastRefresh: new Date().toISOString()
      };

      if (data.status === 'success') {
        // Handle arc progression on success
        const result = handleArcProgression(poolState, data, currentTime);

        if (result.nextArcMission) {
          console.log(`🔗 Arc progression: Unlocked "${result.nextArcMission.title}" (${result.nextArcMission.arcSequence}/${result.nextArcMission.arcTotal})`);
          setMissionPool(result.missions);
          setPendingChainMissions(result.pendingArcMissions || {});
          setActiveClientIds(result.activeClientIds);
        } else if (result.arcCompleted) {
          console.log(`✅ Arc completed: "${result.arcCompleted}"`);
          setPendingChainMissions(result.pendingArcMissions || {});
        }
      } else if (data.status === 'failed') {
        // Handle arc cancellation on failure
        const result = handleArcFailure(poolState, data);

        if (result.arcCancelled) {
          console.log(`🚫 Arc cancelled: "${result.arcCancelled}" - remaining missions removed`);
          setPendingChainMissions(result.pendingArcMissions || {});
          setActiveClientIds(result.activeClientIds);
        }
      }
    };

    const unsubscribe = triggerEventBus.on('missionComplete', handleMissionComplete);
    return () => unsubscribe();
  }, [proceduralMissionsEnabled, missionPool, pendingChainMissions, activeClientIds, currentTime]);

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

  // Play alarm sound for forced disconnections (1-2 second warning)
  const playAlarmSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;

      // Create multiple oscillators for a more alarming sound
      // Sweep from 400Hz to 800Hz and back, repeated twice
      for (let i = 0; i < 2; i++) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sawtooth'; // Harsher than sine for alarm effect

        const startTime = now + (i * 0.6);
        const midTime = startTime + 0.25;
        const endTime = startTime + 0.5;

        // Frequency sweep: 400Hz -> 800Hz -> 400Hz
        oscillator.frequency.setValueAtTime(400, startTime);
        oscillator.frequency.linearRampToValueAtTime(800, midTime);
        oscillator.frequency.linearRampToValueAtTime(400, endTime);

        // Volume envelope
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
        gainNode.gain.setValueAtTime(0.4, endTime - 0.05);
        gainNode.gain.linearRampToValueAtTime(0, endTime);

        oscillator.start(startTime);
        oscillator.stop(endTime);
      }

      console.log('🚨 Alarm sound played');
    } catch {
      console.log('🚨 Alarm sound (audio unavailable)');
    }
  }, []);

  // Add message
  const addMessage = useCallback((message) => {
    const newMessage = {
      ...message,
      id: message.id || `msg-${Date.now()}`,
      timestamp: new Date(currentTime),
    };

    // Check for duplicate before state update
    const isDuplicate = messages.some(m => m.id === newMessage.id);
    if (isDuplicate) {
      console.warn(`⚠️ Duplicate message ID '${newMessage.id}' - skipping`);
      return;
    }

    // Pure state update (no side effects)
    setMessages((prev) => [...prev, newMessage]);

    // Play notification chime after state update (outside updater)
    playNotificationChime();

    // If this is the first message, schedule second message when it's read
    if (message.id === 'msg-welcome-hr') {
      // Will be handled when message is marked as read
    }
  }, [currentTime, messages, playNotificationChime]);

  // Add discovered devices from network scan
  const addDiscoveredDevices = useCallback((networkId, ips) => {
    setDiscoveredDevices((prev) => {
      const existingIps = prev[networkId] || new Set();
      const updatedIps = new Set([...existingIps, ...ips]);
      return {
        ...prev,
        [networkId]: updatedIps,
      };
    });
  }, []);

  // Update message (for attachment activation, etc.)
  const updateMessage = useCallback((messageId, updates) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    );
  }, []);

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
    // Pre-calculate ref values before setState to avoid double-increment in StrictMode
    const newWindowId = nextWindowIdRef.current++;
    const newZIndex = nextZIndexRef.current++;

    setWindows((prev) => {
      // Check if app allows multiple instances
      const allowsMultipleInstances = MULTI_INSTANCE_APPS.includes(appId);

      if (!allowsMultipleInstances) {
        // Check if window is already open for single-instance apps
        const existing = prev.find((w) => w.appId === appId);

        if (existing) {
          // Bring existing window to front with pre-calculated z-index
          return prev.map((w) =>
            w.id === existing.id ? { ...w, zIndex: newZIndex, minimized: false } : w
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
        id: `window-${newWindowId}`, // Unique ID for this window instance
        appId, // App type (for rendering the correct component)
        zIndex: newZIndex,
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

  // Initiate VPN connection (called when user clicks Connect in NAR)
  const initiateVpnConnection = useCallback((networkId) => {
    setPendingVpnConnection(networkId);
    openWindow('vpnClient');
  }, [openWindow]);

  // Clear pending VPN connection
  const clearPendingVpnConnection = useCallback(() => {
    setPendingVpnConnection(null);
  }, []);

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
    console.log('📋 Accepting mission:', mission.missionId, mission.title);
    console.log('   Has briefingMessage:', !!mission.briefingMessage);
    console.log('   Is procedural:', !!mission.isProcedurallyGenerated);

    // Calculate deadline if mission has a time limit
    const deadlineTime = mission.timeLimitMinutes
      ? new Date(currentTime.getTime() + mission.timeLimitMinutes * 60 * 1000).toISOString()
      : null;

    setActiveMission({
      ...mission,
      startTime: currentTime.toISOString(),
      acceptedTime: currentTime.toISOString(),
      deadlineTime,
      objectives: mission.objectives.map(obj => ({ ...obj, status: 'pending' })),
    });

    // Remove the accepted mission from available missions (story missions)
    setAvailableMissions(prev => prev.filter(m => m.missionId !== mission.missionId));

    // Also remove from procedural mission pool if it's a procedural mission
    if (mission.isProcedurallyGenerated) {
      setMissionPool(prev => prev.filter(m => m.missionId !== mission.missionId));
    }

    // Send the briefing message with NAR attachments (for procedural missions)
    if (mission.briefingMessage) {
      // Add the briefing message with proper timestamp
      const briefingWithTimestamp = {
        ...mission.briefingMessage,
        id: mission.briefingMessage.id || `msg-briefing-${mission.missionId}-${Date.now()}`,
        timestamp: currentTime.toISOString(),
        read: false,
      };

      // Check for duplicate before state update
      const isDuplicate = messages.some(m => m.id === briefingWithTimestamp.id);
      if (!isDuplicate) {
        // Pure state update (no side effects)
        setMessages(prev => [...prev, briefingWithTimestamp]);
        // Play notification chime after state update (outside updater)
        playNotificationChime();
      }
    }
  }, [currentTime, messages, playNotificationChime]);

  // Complete mission objective
  const completeMissionObjective = useCallback((objectiveId) => {
    // Check for active mission before state update (for logging)
    if (!activeMission) {
      console.log(`⚠️ completeMissionObjective: No active mission to update (objective: ${objectiveId})`);
      return;
    }

    // Log before state update (outside updater)
    console.log(`📋 completeMissionObjective: Updating objective ${objectiveId} for mission ${activeMission.missionId}`);

    // Use functional update to get the latest activeMission state
    // This prevents stale closure issues when multiple updates happen quickly
    setActiveMission((currentMission) => {
      if (!currentMission) {
        return null; // Don't set it back if it was already cleared
      }

      const updatedObjectives = currentMission.objectives.map(obj =>
        obj.id === objectiveId ? { ...obj, status: 'complete' } : obj
      );

      return {
        ...currentMission,
        objectives: updatedObjectives,
      };
    });
  }, [activeMission]);

  // Complete mission (success or failure)
  const completeMission = useCallback((status, payout, reputationChange, failureReason = null) => {
    if (!activeMission) {
      return;
    }

    // Guard against double completion - check if mission was already completed
    const missionId = activeMission.missionId || activeMission.id;
    if (failedMissionsRef.current.has(missionId + '-completed')) {
      return;
    }
    failedMissionsRef.current.add(missionId + '-completed');

    const completedMission = {
      id: activeMission.id || activeMission.missionId,
      missionId: activeMission.missionId || activeMission.id,
      title: activeMission.title,
      client: activeMission.client,
      clientId: activeMission.clientId, // For procedural missions
      difficulty: activeMission.difficulty,
      status,
      completionTime: currentTime.toISOString(),
      payout,
      reputationChange,
      failureReason: status === 'failed' ? (failureReason || 'Mission failed') : null,
    };

    // Add to completed missions (use functional update to avoid stale closure)
    setCompletedMissions(prev => [...prev, completedMission]);

    // Update client standings for procedural missions
    if (activeMission.clientId) {
      setClientStandings(prev => {
        const existing = prev[activeMission.clientId] || { successCount: 0, failCount: 0 };
        return {
          ...prev,
          [activeMission.clientId]: {
            ...existing,
            successCount: status === 'success' ? existing.successCount + 1 : existing.successCount,
            failCount: status === 'failed' ? existing.failCount + 1 : existing.failCount,
            lastMissionDate: currentTime.toISOString(),
            lastMissionStatus: status,
          }
        };
      });
    }

    // Clear active mission
    setActiveMission(null);

    // Emit missionComplete event for mission system
    triggerEventBus.emit('missionComplete', {
      missionId: activeMission.missionId || activeMission.id,
      status,
      title: activeMission.title,
      arcId: activeMission.arcId,
      arcSequence: activeMission.arcSequence,
      arcTotal: activeMission.arcTotal,
      arcName: activeMission.arcName,
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
          addMessage(paymentMessage);
        }
      }, 3000, timeSpeed);
    } else if (payout < 0) {
      // Failure penalty: Apply immediately
      setBankAccounts(prev => {
        return prev.map((account, index) => {
          if (index === 0) {
            return { ...account, balance: account.balance + payout };
          }
          return account;
        });
      });
    }

    // Update reputation
    setReputation(prev => Math.max(1, Math.min(11, prev + reputationChange)));

    // Revoke NAR entries and disconnect if mission has networks with revokeOnComplete
    const networksToRevoke = activeMission.networks?.filter(network => network.revokeOnComplete) || [];

    if (networksToRevoke.length > 0) {
      // Revoke all NAR entries for these networks
      setNarEntries(prev => prev.map(entry => {
        const networkToRevoke = networksToRevoke.find(net => net.networkId === entry.networkId);
        if (networkToRevoke) {
          return {
            ...entry,
            authorized: false,
            revokedReason: networkToRevoke.revokeReason || 'Mission access expired',
          };
        }
        return entry;
      }));

      // Calculate which connections will be disconnected (before state update)
      const connectionsToDisconnect = activeConnections.filter(conn =>
        networksToRevoke.some(net => net.networkId === conn.networkId)
      );

      // Disconnect from all revoked networks (pure state update)
      setActiveConnections(prev =>
        prev.filter(conn => !networksToRevoke.some(net => net.networkId === conn.networkId))
      );

      // Emit networkDisconnected events after state update (outside updater)
      queueMicrotask(() => {
        connectionsToDisconnect.forEach(conn => {
          const networkToRevoke = networksToRevoke.find(net => net.networkId === conn.networkId);
          triggerEventBus.emit('networkDisconnected', {
            networkId: networkToRevoke.networkId,
            networkName: networkToRevoke.networkName || networkToRevoke.networkId,
            reason: networkToRevoke.revokeReason || 'Mission access expired',
          });
        });
      });
    }
  }, [activeMission, currentTime, bankAccounts, timeSpeed]);

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
      arcId: activeMission.arcId,
      arcSequence: activeMission.arcSequence,
      arcTotal: activeMission.arcTotal,
      arcName: activeMission.arcName,
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
      console.log(`🚀 Executing scripted event: ${eventId}`);
      console.log(`📡 EMITTING scriptedEventStart: eventId=${eventId}, missionId=${missionId}, actions=${actions?.length || 0}`);

      // Delegate to ScriptedEventExecutor which handles all action types with proper timing
      await executeScriptedEvent({ id: eventId, actions }, {
        onProgress: (progress) => {
          console.log(`📊 Scripted event progress:`, progress);
        },
        timeSpeed
      });

      console.log(`✅ Scripted event ${eventId} complete`);
    };

    console.log(`🔌 SUBSCRIBED to scriptedEventStart, activeMission=${activeMission?.missionId || 'null'}`);
    triggerEventBus.on('scriptedEventStart', handleScriptedEvent);

    return () => {
      console.log(`🔌 UNSUBSCRIBED from scriptedEventStart`);
      triggerEventBus.off('scriptedEventStart', handleScriptedEvent);
    };
  }, [activeMission, timeSpeed]);

  // Listen for sabotage file operations to delete files from NAR entries
  useEffect(() => {
    const handleSabotageFileOperation = (data) => {
      const { fileName, operation } = data;

      if (operation === 'delete') {
        console.log(`🗑️ Sabotage deleting file: ${fileName}`);

        // Capture file counts before deletion for logging (outside state updater)
        const deletionLog = [];
        narEntries.forEach(entry => {
          entry.fileSystems?.forEach(fs => {
            if (fs.files?.some(f => f.name === fileName)) {
              deletionLog.push({ fsName: fs.name, prevCount: fs.files.length });
            }
          });
        });

        // Remove file by name from NAR entries (pure state update)
        setNarEntries(currentEntries => {
          return currentEntries.map(entry => {
            if (entry.fileSystems) {
              return {
                ...entry,
                fileSystems: entry.fileSystems.map(fs => {
                  if (fs.files && fs.files.length > 0) {
                    // Remove the file matching the fileName
                    const remainingFiles = fs.files.filter(f => f.name !== fileName);
                    return {
                      ...fs,
                      files: remainingFiles
                    };
                  }
                  return fs;
                })
              };
            }
            return entry;
          });
        });

        // Log deletions after state update (outside updater)
        deletionLog.forEach(({ fsName, prevCount }) => {
          console.log(`  🗑️ FS ${fsName}: Deleted ${fileName} (${prevCount} → ${prevCount - 1} files)`);
        });
      }
    };

    triggerEventBus.on('sabotageFileOperation', handleSabotageFileOperation);

    return () => {
      triggerEventBus.off('sabotageFileOperation', handleSabotageFileOperation);
    };
  }, [setNarEntries]);

  // Listen for forced network disconnect
  useEffect(() => {
    const handleForceNetworkDisconnect = (data) => {
      const { networkId } = data;
      console.log(`🔌 Force disconnecting from network: ${networkId}`);

      // Capture connection count before update for logging (outside state updater)
      const prevCount = activeConnections.length;

      // Remove active connections matching the network ID or name (pure state update)
      setActiveConnections(currentConns => {
        return currentConns.filter(conn => {
          return conn.networkId !== networkId && conn.networkName !== networkId;
        });
      });

      // Log after state update (outside updater)
      const matchingCount = activeConnections.filter(conn =>
        conn.networkId === networkId || conn.networkName === networkId
      ).length;
      console.log(`  🔌 Disconnected from ${networkId}: ${prevCount} → ${prevCount - matchingCount} connections`);
    };

    triggerEventBus.on('forceNetworkDisconnect', handleForceNetworkDisconnect);

    return () => {
      triggerEventBus.off('forceNetworkDisconnect', handleForceNetworkDisconnect);
    };
  }, [activeConnections]);

  // Listen for NAR entry revocation
  useEffect(() => {
    const handleRevokeNAREntry = (data) => {
      const { networkId, reason } = data;
      console.log(`🔐 Revoking NAR entry for ${networkId}`);

      setNarEntries(currentEntries => {
        return currentEntries.map(entry => {
          if (entry.networkId === networkId) {
            return {
              ...entry,
              authorized: false,
              revokedReason: reason || 'Access credentials revoked by network administrator'
            };
          }
          return entry;
        });
      });
    };

    triggerEventBus.on('revokeNAREntry', handleRevokeNAREntry);

    return () => {
      triggerEventBus.off('revokeNAREntry', handleRevokeNAREntry);
    };
  }, [setNarEntries]);

  // Listen for mission status changes
  useEffect(() => {
    const handleMissionStatusChanged = (data) => {
      const { status, failureReason } = data;
      console.log(`📋 Mission status changed to: ${status}`);

      if (status === 'failed' && activeMission) {
        const missionId = activeMission.missionId || activeMission.id;

        // Check if already processed
        if (failedMissionsRef.current.has(missionId)) {
          console.log(`⚠️ Mission ${missionId} failure already processed - skipping duplicate`);
          return;
        }

        failedMissionsRef.current.add(missionId);

        // Apply failure consequences
        const failurePayout = activeMission.consequences?.failure?.credits || 0;
        const failureReputation = activeMission.consequences?.failure?.reputation || 0;
        console.log(`💔 Mission failed - applying penalties: ${failurePayout} credits, ${failureReputation} reputation`);

        completeMissionRef.current?.('failed', failurePayout, failureReputation, failureReason || 'Mission failed');
      }
    };

    triggerEventBus.on('missionStatusChanged', handleMissionStatusChanged);

    return () => {
      triggerEventBus.off('missionStatusChanged', handleMissionStatusChanged);
    };
  }, [activeMission]);

  // Poll for mission deadline expiration
  useEffect(() => {
    if (!activeMission?.deadlineTime) {
      return; // No deadline to monitor
    }

    const deadlineDate = new Date(activeMission.deadlineTime);

    // Check if deadline has passed
    if (currentTime >= deadlineDate) {
      console.log(`⏰ Mission deadline has passed! Current: ${currentTime.toISOString()}, Deadline: ${activeMission.deadlineTime}`);

      // Emit mission failed event
      triggerEventBus.emit('missionStatusChanged', {
        status: 'failed',
        failureReason: 'deadline',
      });
    }
  }, [activeMission?.deadlineTime, currentTime]);

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
      discoveredDevices: Object.fromEntries(
        Object.entries(discoveredDevices).map(([networkId, ipSet]) => [
          networkId,
          Array.from(ipSet)
        ])
      ),
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
      // Procedural mission system
      proceduralMissionsEnabled,
      missionPool,
      pendingChainMissions,
      activeClientIds,
      clientStandings,
      extensionOffers,
    };

    saveToLocalStorage(username, gameState, saveName);
  }, [username, playerMailId, currentTime, hardware, software, bankAccounts, messages, managerName, windows,
    reputation, reputationCountdown, activeMission, completedMissions, availableMissions, missionCooldowns,
    narEntries, activeConnections, lastScanResults, discoveredDevices, fileManagerConnections, lastFileOperation,
    downloadQueue, transactions, licensedSoftware, bankruptcyCountdown, lastInterestTime, bankingMessagesSent, reputationMessagesSent,
    proceduralMissionsEnabled, missionPool, pendingChainMissions, activeClientIds, clientStandings, extensionOffers]);

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
    // Reset procedural mission system
    setProceduralMissionsEnabled(false);
    setMissionPool([]);
    setPendingChainMissions({});
    setActiveClientIds([]);
    setClientStandings({});
    setExtensionOffers({});

    // Check if should skip boot (E2E tests or scenarios)
    const urlParams = new URLSearchParams(window.location.search);
    const skipBoot = urlParams.get('skipBoot') === 'true';
    const hasScenario = urlParams.get('scenario');

    if (skipBoot || hasScenario) {
      setGamePhase('username'); // Skip boot, go to username selection for new game
    } else {
      setGamePhase('boot'); // Normal boot sequence
    }
  }, []);

  // Load game
  const loadGame = useCallback((usernameToLoad, saveIndex = null) => {
    const gameState = loadFromLocalStorage(usernameToLoad, saveIndex);

    if (!gameState) {
      return false;
    }
    setUsername(gameState.username);
    setPlayerMailId(gameState.playerMailId);
    setCurrentTime(new Date(gameState.currentTime));
    setHardware(gameState.hardware);
    setSoftware(gameState.software);
    setBankAccounts(gameState.bankAccounts);
    setManagerName(gameState.managerName);

    // Deduplicate messages (some saves may have duplicate IDs from repeated event triggers)
    const seenMessageIds = new Set();
    const deduplicatedMessages = (gameState.messages || []).filter(msg => {
      if (msg.id && seenMessageIds.has(msg.id)) {
        console.warn(`⚠️ Removing duplicate message ID '${msg.id}' from save`);
        return false;
      }
      if (msg.id) seenMessageIds.add(msg.id);
      return true;
    });
    setMessages(deduplicatedMessages);

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
    setDiscoveredDevices(
      gameState.discoveredDevices
        ? Object.fromEntries(
          Object.entries(gameState.discoveredDevices).map(([networkId, ips]) => [
            networkId,
            new Set(ips)
          ])
        )
        : {}
    );
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

    // Restore procedural mission system
    setProceduralMissionsEnabled(gameState.proceduralMissionsEnabled ?? false);
    setMissionPool(gameState.missionPool ?? []);
    setPendingChainMissions(gameState.pendingChainMissions ?? {});
    setActiveClientIds(gameState.activeClientIds ?? []);
    setClientStandings(gameState.clientStandings ?? {});
    setExtensionOffers(gameState.extensionOffers ?? {});

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

    // Reset nextWindowId to be higher than any loaded window id
    const maxWindowId = loadedWindows.reduce((max, w) => {
      const match = w.id?.match(/^window-(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    nextWindowIdRef.current = maxWindowId + 1;

    setTimeSpeed(TIME_SPEEDS.NORMAL); // Always reset to 1x

    // Check if should skip boot (E2E tests or scenarios)
    const urlParams = new URLSearchParams(window.location.search);
    const skipBoot = urlParams.get('skipBoot') === 'true';
    const hasScenario = urlParams.get('scenario');

    if (skipBoot || hasScenario) {
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
    discoveredDevices,
    setDiscoveredDevices,
    addDiscoveredDevices,
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
    bankingMessagesSent,
    setBankingMessagesSent,
    reputationMessagesSent,
    setReputationMessagesSent,
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
    updateFileSystemFiles,

    // Procedural Mission System
    proceduralMissionsEnabled,
    setProceduralMissionsEnabled,
    missionPool,
    setMissionPool,
    pendingChainMissions,
    setPendingChainMissions,
    activeClientIds,
    setActiveClientIds,
    clientStandings,
    setClientStandings,
    extensionOffers,
    setExtensionOffers,

    // Actions
    initializePlayer,
    addMessage,
    updateMessage,
    markMessageAsRead,
    archiveMessage,
    initiateChequeDeposit,
    depositCheque,
    cancelChequeDeposit,
    initiateVpnConnection,
    pendingVpnConnection,
    clearPendingVpnConnection,
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
    playAlarmSound,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
