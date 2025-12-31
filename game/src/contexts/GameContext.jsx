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

  // Banking System extensions
  const [bankruptcyCountdown, setBankruptcyCountdown] = useState(null); // {startTime, endTime, remaining} or null
  const [lastInterestTime, setLastInterestTime] = useState(null); // Last time interest was applied

  // Auto-tracking control (can be disabled for testing)
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(true);

  // Initialize story mission system
  useStoryMissions(
    { gamePhase, username, currentTime, activeConnections, activeMission },
    { setAvailableMissions }
  );

  // Initialize player
  const initializePlayer = useCallback((name) => {
    setUsername(name);
    setPlayerMailId(generateMailId());
    setGamePhase('desktop');

    // Set manager name
    const manager = getRandomManagerName(MANAGER_NAMES);
    setManagerName(manager);

    // Phase 1 messages now come from story mission system (no hardcoded messages)
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

  // Handle story event messages (listen for storyEventTriggered)
  useEffect(() => {
    if (!username) return; // Wait until username is set

    const handleStoryEvent = (data) => {
      const { message } = data;
      if (message) {
        // Replace placeholders with current values
        const replacePlaceholders = (text) => {
          if (!text) return text;
          return text
            .replace(/{username}/g, username)
            .replace(/{managerName}/g, managerName);
        };

        const generateRandomId = () => {
          return `${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        };

        addMessage({
          id: data.eventId,
          from: replacePlaceholders(message.from),
          fromId: message.fromId.replace(/{random}/g, generateRandomId()),
          fromName: replacePlaceholders(message.fromName),
          subject: replacePlaceholders(message.subject),
          body: replacePlaceholders(message.body),
          attachments: message.attachments || [],
        });
      }
    };

    const unsubscribe = triggerEventBus.on('storyEventTriggered', handleStoryEvent);
    return () => unsubscribe();
  }, [username, managerName]); // Include dependencies so placeholders update

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
      bankruptcyCountdown,
      lastInterestTime,
    };

    saveToLocalStorage(username, gameState, saveName);
  }, [username, playerMailId, currentTime, hardware, software, bankAccounts, messages, managerName, windows,
    reputation, reputationCountdown, activeMission, completedMissions, availableMissions, missionCooldowns,
    narEntries, activeConnections, lastScanResults, fileManagerConnections, lastFileOperation,
    downloadQueue, transactions, bankruptcyCountdown, lastInterestTime]);

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
    timeSpeed,
    isPaused,
    setIsPaused,
    hardware,
    software,
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
    bankruptcyCountdown,
    setBankruptcyCountdown,
    lastInterestTime,
    setLastInterestTime,
    autoTrackingEnabled,
    setAutoTrackingEnabled,

    // Actions
    initializePlayer,
    addMessage,
    markMessageAsRead,
    archiveMessage,
    initiateChequeDeposit,
    depositCheque,
    cancelChequeDeposit,
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
    saveGame,
    loadGame,
    rebootSystem,
    resetGame,
    generateUsername,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
