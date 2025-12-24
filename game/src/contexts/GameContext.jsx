import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  GAME_START_DATE,
  TIME_SPEEDS,
  STARTING_HARDWARE,
  STARTING_SOFTWARE,
  STARTING_BANK_ACCOUNT,
  INITIAL_MESSAGES,
  MANAGER_NAMES,
  MESSAGE_TIMING,
} from '../constants/gameConstants';
import {
  generateMailId,
  generateUsername,
  getRandomManagerName,
  saveGameState as saveToLocalStorage,
  loadGameState as loadFromLocalStorage,
} from '../utils/helpers';

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

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // Timers
  const timeIntervalRef = useRef(null);
  const messageTimerRef = useRef(null);

  // Initialize player
  const initializePlayer = useCallback((name) => {
    setUsername(name);
    setPlayerMailId(generateMailId());
    setGamePhase('desktop');

    // Set manager name
    const manager = getRandomManagerName(MANAGER_NAMES);
    setManagerName(manager);

    // Schedule first message
    setTimeout(() => {
      addMessage(INITIAL_MESSAGES[0]);
    }, MESSAGE_TIMING.FIRST_MESSAGE_DELAY);
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

    // If this is the first message, schedule second message
    if (messageId === 'msg-welcome-hr') {
      setTimeout(() => {
        const managerMailId = `SNET-MGR-${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        const managerMessage = {
          id: 'msg-welcome-manager',
          from: `SourceNet Manager ${managerName}`,
          fromId: managerMailId,
          subject: `Hi from your manager - ${managerName}`,
          body: `Hey ${username}!

Welcome to the team! I'm ${managerName}, and I'll be your manager here at SourceNet. I was present during your interview process and I have to say, you really impressed us with your skills and dedication.

To help you get started, I've attached a welcome bonus cheque for 1,000 credits. Just click on the attachment to deposit it into your bank account.

Take some time to get comfortable with your setup. I'll be reaching out again soon with your first assignment.

Looking forward to working with you!

- ${managerName}`,
          timestamp: new Date(currentTime),
          read: false,
          archived: false,
          attachment: {
            type: 'cheque',
            amount: 1000,
            deposited: false,
          },
        };

        addMessage(managerMessage);
      }, MESSAGE_TIMING.SECOND_MESSAGE_DELAY);
    }
  }, [managerName, username, currentTime]);

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
    if (!message || !message.attachment || message.attachment.deposited) {
      return;
    }

    // Mark cheque as deposited
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              attachment: { ...msg.attachment, deposited: true },
            }
          : msg
      )
    );

    // Add funds to account
    setBankAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId
          ? { ...acc, balance: acc.balance + message.attachment.amount }
          : acc
      )
    );

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

    timeIntervalRef.current = setInterval(() => {
      setCurrentTime((prev) => new Date(prev.getTime() + 1000 * timeSpeed));
    }, 1000);

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
    } catch (error) {
      console.log('🔔 Notification chime (audio unavailable)');
    }
  }, []);

  // Get total credits
  const getTotalCredits = useCallback(() => {
    return bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [bankAccounts]);

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
    };

    saveToLocalStorage(username, gameState, saveName);
  }, [username, playerMailId, currentTime, hardware, software, bankAccounts, messages, managerName, windows]);

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

    // Always show boot sequence when loading (subsequent boot ~4s)
    // This provides consistent "booting up your computer" experience
    setGamePhase('boot');

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
    messages,
    managerName,
    windows,
    pendingChequeDeposit,

    // Actions
    initializePlayer,
    addMessage,
    markMessageAsRead,
    archiveMessage,
    initiateChequeDeposit,
    depositCheque,
    cancelChequeDeposit,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    bringToFront,
    moveWindow,
    toggleTimeSpeed,
    getTotalCredits,
    saveGame,
    loadGame,
    rebootSystem,
    generateUsername,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
