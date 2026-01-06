import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  GAME_START_DATE,
  TIME_SPEEDS,
  STARTING_HARDWARE,
  STARTING_SOFTWARE,
  STARTING_BANK_ACCOUNT,
  MANAGER_NAMES,
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
import { useDownloadManager } from '../systems/useDownloadManager';
import {
  getNetworkBandwidth,
  getAdapterSpeed,
  calculateAvailableBandwidth,
  calculateTransferSpeed,
  calculateOperationTime,
} from '../systems/NetworkBandwidthSystem';
import { updateBankruptcyCountdown, shouldTriggerBankruptcy, startBankruptcyCountdown } from '../systems/BankingSystem';
import { updateReputationCountdown, startReputationCountdown } from '../systems/ReputationSystem';
import triggerEventBus from '../core/triggerEventBus';

const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

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

  // Timers
  const timeIntervalRef = useRef(null);

  // ===== EXTENDED GAME STATE =====

  // Reputation System
  const [reputation, setReputation] = useState(9); // Tier 9 = "Superb" (starting reputation)
  const [reputationCountdown, setReputationCountdown] = useState(null); // {startTime, endTime, remaining} or null

  // Mission System
  const [activeMission, setActiveMission] = useState(null); // Current mission object or null
  const [completedMissions, setCompletedMissions] = useState([]); // Array of completed mission objects
  const [availableMissions, setAvailableMissions] = useState([]); // Array of available mission objects
  const [missionCooldowns, setMissionCooldowns] = useState({ easy: null, medium: null, hard: null });

  // Network System
  const [narEntries, setNarEntries] = useState([]); // Network Address Register entries
  const [activeConnections, setActiveConnections] = useState([]); // Currently connected networks
  const [lastScanResults, setLastScanResults] = useState(null); // Last network scan results
  const [fileManagerConnections, setFileManagerConnections] = useState([]); // Active File Manager connections
  const [lastFileOperation, setLastFileOperation] = useState(null); // Last file operation completed

  // Purchasing & Installation
  const [downloadQueue, setDownloadQueue] = useState([]); // Items being downloaded/installed
  const [transactions, setTransactions] = useState([]); // Banking transaction history
  const [licensedSoftware, setLicensedSoftware] = useState([]); // Array of software IDs that have been licensed

  // Bandwidth Operations (non-download operations that use bandwidth)
  const [bandwidthOperations, setBandwidthOperations] = useState([]); // {id, type, status, progress}

  // Banking System extensions
  const [bankruptcyCountdown, setBankruptcyCountdown] = useState(null); // {startTime, endTime, remaining} or null
  const [lastInterestTime, setLastInterestTime] = useState(null); // Last time interest was applied

  // Auto-tracking control (can be disabled for testing)
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(true);

  // Download completion callback - adds software to installed list
  const handleDownloadComplete = useCallback((softwareId) => {
    setSoftware((prev) => {
      if (prev.includes(softwareId)) return prev;
      return [...prev, softwareId];
    });
  }, []);

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

  // Initialize player
  const initializePlayer = useCallback((name) => {
    setUsername(name);
    setPlayerMailId(generateMailId());
    setGamePhase('desktop');

    // Set manager name
    const manager = getRandomManagerName(MANAGER_NAMES);
    setManagerName(manager);

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

  // Initiate cheque deposit (called when user clicks attachment in Mail)
  const initiateChequeDeposit = useCallback((messageId) => {
    setPendingChequeDeposit(messageId);
    openWindow('banking');
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
        description: 'Cheque Deposit',
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

  // Initialize story mission system
  useStoryMissions(
    { gamePhase, username, managerName, currentTime, activeConnections, activeMission, timeSpeed },
    { setAvailableMissions, addMessage }
  );

  // Window management
  const openWindow = useCallback((appId) => {
    setWindows((prev) => {
      // Check if window is already open
      const existing = prev.find((w) => w.appId === appId);

      if (existing) {
        // Bring to front with new z-index
        const newZ = nextZIndexRef.current++;
        return prev.map((w) =>
          w.appId === appId ? { ...w, zIndex: newZ, minimized: false } : w
        );
      }

      // Create new window - calculate position inline
      const CASCADE_OFFSET = 30;
      const BASE_X = 50;
      const BASE_Y = 100;
      const openWindows = prev.filter((w) => !w.minimized);
      const offset = openWindows.length * CASCADE_OFFSET;

      const newWindow = {
        appId,
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

  const closeWindow = useCallback((appId) => {
    setWindows((prev) => prev.filter((w) => w.appId !== appId));
  }, []);

  const minimizeWindow = useCallback((appId) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.appId === appId ? { ...w, minimized: true } : w
      )
    );
  }, []);

  const restoreWindow = useCallback((appId) => {
    const newZ = nextZIndexRef.current++;
    setWindows((prev) =>
      prev.map((w) =>
        w.appId === appId ? { ...w, minimized: false, zIndex: newZ } : w
      )
    );
  }, []);

  const bringToFront = useCallback((appId) => {
    const newZ = nextZIndexRef.current++;
    setWindows((prev) =>
      prev.map((w) =>
        w.appId === appId ? { ...w, zIndex: newZ } : w
      )
    );
  }, []);

  const moveWindow = useCallback((appId, position) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.appId === appId ? { ...w, position } : w
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
        if (updated.remaining <= 10 && prevBankruptcyRef.current && prevBankruptcyRef.current.remaining > 10) {
          playNotificationChime();
        }
        prevBankruptcyRef.current = updated;
        setBankruptcyCountdown(updated);
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
        if (updated.remaining <= 10) {
          playNotificationChime();
        }
        prevReputationRef.current = updated;
        setReputationCountdown(updated);
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
      objectives: mission.objectives.map(obj => ({ ...obj, status: 'pending' })),
    });
  }, [currentTime]);

  // Complete mission objective
  const completeMissionObjective = useCallback((objectiveId) => {
    if (!activeMission) return;

    const updatedObjectives = activeMission.objectives.map(obj =>
      obj.id === objectiveId ? { ...obj, status: 'complete' } : obj
    );

    setActiveMission({
      ...activeMission,
      objectives: updatedObjectives,
    });
  }, [activeMission]);

  // Complete mission (success or failure)
  const completeMission = useCallback((status, payout, reputationChange) => {
    if (!activeMission) return;

    const completedMission = {
      id: activeMission.id || activeMission.missionId,
      title: activeMission.title,
      client: activeMission.client,
      difficulty: activeMission.difficulty,
      status,
      completionTime: currentTime.toISOString(),
      payout,
      reputationChange,
    };

    // Add to completed missions
    setCompletedMissions([...completedMissions, completedMission]);

    // Clear active mission
    setActiveMission(null);

    // Update credits
    const newAccounts = [...bankAccounts];
    if (newAccounts[0]) {
      newAccounts[0].balance += payout;
      setBankAccounts(newAccounts);
    }

    // Update reputation
    setReputation(prev => Math.max(1, Math.min(11, prev + reputationChange)));
  }, [activeMission, currentTime, completedMissions, bankAccounts]);

  // Objective auto-tracking - automatically completes objectives when game events occur
  useObjectiveAutoTracking(
    activeMission,
    {
      activeConnections,
      lastScanResults,
      fileManagerConnections,
      lastFileOperation,
    },
    reputation,
    completeMissionObjective,
    completeMission,
    autoTrackingEnabled
  );

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
    };

    saveToLocalStorage(username, gameState, saveName);
  }, [username, playerMailId, currentTime, hardware, software, bankAccounts, messages, managerName, windows,
    reputation, reputationCountdown, activeMission, completedMissions, availableMissions, missionCooldowns,
    narEntries, activeConnections, lastScanResults, fileManagerConnections, lastFileOperation,
    downloadQueue, transactions, licensedSoftware, bankruptcyCountdown, lastInterestTime]);

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
    playerMailId,
    currentTime,
    setCurrentTime,
    timeSpeed,
    isPaused,
    setIsPaused,
    hardware,
    software,
    setSoftware,
    bankAccounts,
    setBankAccounts,
    messages,
    managerName,
    windows,
    pendingChequeDeposit,

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
