import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  GAME_START_DATE,
  TIME_SPEEDS,
  STARTING_HARDWARE,
  STARTING_SOFTWARE,
  STARTING_BANK_ACCOUNT,
  MANAGER_NAMES,
  MULTI_INSTANCE_APPS,
  LOCAL_SSD_NETWORK_ID,
  VERIFICATION_DELAY_MS,
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
import { initializePool, refreshPool, shouldRefreshPool, handleArcProgression, handleArcFailure, generatePoolMission, addExpirationToMission, poolConfig, getPoolConfigForProgression } from '../missions/MissionPoolManager';
import { shouldTriggerExtension, generateExtension, getObjectiveProgress } from '../missions/MissionExtensionGenerator';
import { checkObjectiveImpossible } from '../missions/ObjectiveTracker';
import networkRegistry from '../systems/NetworkRegistry';
import { applyPendingHardware } from '../systems/HardwareInstallationSystem';

export const GameContext = createContext();

export const GameProvider = ({ children }) => {
  // Game state
  const [gamePhase, setGamePhase] = useState('boot'); // boot, login, username, desktop
  const [username, setUsername] = useState('');
  const [playerMailId, setPlayerMailId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date(GAME_START_DATE));
  const [timeSpeed, setTimeSpeed] = useState(TIME_SPEEDS.NORMAL);
  const [isPaused, setIsPaused] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [ransomwareLockout, setRansomwareLockout] = useState(false);

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
  const [activeConnections, setActiveConnections] = useState([]); // Currently connected networks
  const [lastScanResults, setLastScanResults] = useState(null); // Last network scan results
  const [discoveredDevices, setDiscoveredDevices] = useState({}); // Map of networkId -> Set of discovered IPs
  const [fileManagerConnections, setFileManagerConnections] = useState([]); // Active File Manager connections
  const [lastFileOperation, setLastFileOperation] = useState(null); // Last file operation completed
  const [missionFileOperations, setMissionFileOperations] = useState({}); // Cumulative file operations for current mission {repair: 5, copy: 3}
  const [missionSubmitting, setMissionSubmitting] = useState(false); // True while submit-for-completion is in progress

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

  // Local SSD files (files stored on the player's terminal)
  const [localSSDFiles, setLocalSSDFiles] = useState([]);

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

  // ===== HARDWARE & SOFTWARE UNLOCK SYSTEM =====
  const [betterMessageRead, setBetterMessageRead] = useState(false); // Track if tutorial "better" message was read
  const [hardwareUnlockMessageSent, setHardwareUnlockMessageSent] = useState(false); // Track if hardware unlock message was sent
  const [unlockedFeatures, setUnlockedFeatures] = useState([]); // Array of unlocked feature IDs (e.g., 'network-adapters')
  const [pendingHardwareUpgrades, setPendingHardwareUpgrades] = useState({}); // Hardware queued for install on reboot
  const [lastAppliedHardware, setLastAppliedHardware] = useState([]); // Hardware applied in last reboot (for boot message)

  // ===== FUTURE CONTENT TEASE SYSTEM =====
  const [creditThresholdForDecryption, setCreditThresholdForDecryption] = useState(null); // Credit threshold for decryption tease message
  const [decryptionMessageSent, setDecryptionMessageSent] = useState(false); // Track if decryption tease message was sent

  // ===== DECRYPTION SYSTEM =====
  const [decryptionAlgorithms, setDecryptionAlgorithms] = useState(['aes-128', 'aes-256']); // Available decryption algorithms
  const [missionDecryptionOperations, setMissionDecryptionOperations] = useState({ decrypted: new Set() }); // Track decrypted files for mission objectives
  const [missionUploadOperations, setMissionUploadOperations] = useState({ uploaded: new Set(), uploadDestinations: new Map() }); // Track uploaded files for mission objectives

  // ===== PASSIVE SOFTWARE SYSTEM =====
  const [activePassiveSoftware, setActivePassiveSoftware] = useState([]); // Array of active passive software IDs

  // ===== BANKING HELPERS =====
  // Helper function to update bank balance and emit creditsChanged event
  // This ensures consistent event emission across all balance-changing operations
  const updateBankBalance = useCallback((accountId, amount, reason) => {
    setBankAccounts(prev => {
      const newAccounts = prev.map(acc =>
        acc.id === accountId
          ? { ...acc, balance: acc.balance + amount }
          : acc
      );

      // Calculate new total after update
      const newTotal = newAccounts.reduce((sum, acc) => sum + acc.balance, 0);

      // Emit creditsChanged event after state update via microtask
      queueMicrotask(() => {
        triggerEventBus.emit('creditsChanged', {
          newBalance: newTotal,
          change: amount,
          reason: reason,
          accountId: accountId,
        });
      });

      return newAccounts;
    });
  }, []);

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

  // Clear clipboard when disconnecting from source network (exempt local SSD)
  useEffect(() => {
    if (fileClipboard.sourceNetworkId && fileClipboard.sourceNetworkId !== LOCAL_SSD_NETWORK_ID) {
      const stillConnected = activeConnections.some(conn => conn.networkId === fileClipboard.sourceNetworkId);
      if (!stillConnected) {
        console.log('📋 Clipboard cleared - disconnected from source network');
        clearFileClipboard();
      }
    }
  }, [activeConnections, fileClipboard.sourceNetworkId, clearFileClipboard]);

  // Update files in a specific file system - uses NetworkRegistry as source of truth
  // Note: This updates the global NetworkRegistry. The event 'fileSystemChanged' is emitted
  // by the registry, which FileManager can subscribe to for live updates.
  const updateFileSystemFiles = useCallback((networkId, fileSystemId, updatedFiles) => {
    console.log(`📁 updateFileSystemFiles called: networkId=${networkId}, fsId=${fileSystemId}, fileCount=${updatedFiles?.length}`);

    // Get previous file count from registry for logging
    const prevFs = networkRegistry.getFileSystem(fileSystemId);
    const prevFileCount = prevFs?.files?.length;

    // Update the registry (this will emit 'fileSystemChanged' event)
    const success = networkRegistry.updateFiles(fileSystemId, updatedFiles);

    if (success) {
      console.log(`📁 Updated fs ${fileSystemId} files from ${prevFileCount} to ${updatedFiles?.length}`);
    } else {
      console.warn(`📁 Failed to update fs ${fileSystemId} - not found in registry`);
    }
  }, []);

  // Add files to a specific file system atomically - prevents race conditions
  // Use this instead of updateFileSystemFiles when adding new files during paste operations
  const addFilesToFileSystem = useCallback((networkId, fileSystemId, newFiles) => {
    console.log(`📁 addFilesToFileSystem called: networkId=${networkId}, fsId=${fileSystemId}, newFileCount=${newFiles?.length}`);

    // Add files atomically using NetworkRegistry (this will emit 'fileSystemChanged' event)
    const success = networkRegistry.addFilesToFileSystem(fileSystemId, newFiles);

    if (success) {
      console.log(`📁 Added ${newFiles?.length} files to fs ${fileSystemId}`);
    } else {
      console.warn(`📁 Failed to add files to fs ${fileSystemId} - not found in registry`);
    }

    return success;
  }, []);

  // Accumulate file operations for mission tracking (unique files per operation type)
  // For paste operations, also track the destination IP for each file
  useEffect(() => {
    if (lastFileOperation && activeMission) {
      const { operation, fileNames = [], fileSystemIp } = lastFileOperation;

      setMissionFileOperations(prev => {
        const existingFiles = prev[operation] || new Set();
        const existingCount = existingFiles.size;
        const updatedFiles = new Set(existingFiles);
        fileNames.forEach(name => updatedFiles.add(name));
        // Log inside updater to get accurate counts (logging is harmless side effect)
        console.log(`📊 Cumulative ${operation}: ${existingCount} + ${fileNames.length} new files`);

        // For paste operations, track the destination IP for each file
        // This allows objective checking to verify files were pasted to the correct location
        if (operation === 'paste' && fileSystemIp) {
          const existingDestinations = prev.pasteDestinations || new Map();
          const updatedDestinations = new Map(existingDestinations);
          fileNames.forEach(name => updatedDestinations.set(name, fileSystemIp));
          console.log(`📍 Tracking paste destinations to ${fileSystemIp}: ${fileNames.join(', ')}`);
          return {
            ...prev,
            [operation]: updatedFiles,
            pasteDestinations: updatedDestinations
          };
        }

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
    setMissionDecryptionOperations({ decrypted: new Set() });
    setMissionUploadOperations({ uploaded: new Set(), uploadDestinations: new Map() });
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

        // Mark "better" message as read for hardware unlock trigger
        setBetterMessageRead(true);

        // Initialize the mission pool with unlocked features for investigation missions
        const poolState = initializePool(reputation, currentTime, { unlockedSoftware: unlockedFeatures });
        console.log(`📋 Procedural pool initialized with ${poolState.missions.length} missions, ${Object.keys(poolState.pendingArcMissions || {}).length} arcs pending`);
        setMissionPool(poolState.missions);
        setPendingChainMissions(poolState.pendingArcMissions || {});
        setActiveClientIds(poolState.activeClientIds);
      }
    };

    const unsubscribe = triggerEventBus.on('messageRead', handleMessageRead);
    return () => unsubscribe();
  }, [reputation, currentTime, unlockedFeatures]);

  // Refresh procedural mission pool when reputation changes or unlocked features change
  useEffect(() => {
    if (!proceduralMissionsEnabled || missionPool.length === 0) return;

    const poolState = {
      missions: missionPool,
      pendingArcMissions: pendingChainMissions,
      activeClientIds,
      lastRefresh: new Date().toISOString()
    };

    if (shouldRefreshPool(poolState, reputation, { unlockedSoftware: unlockedFeatures })) {
      console.log('🔄 Refreshing procedural mission pool...');
      const activeMissionId = activeMission?.missionId || null;
      const newPoolState = refreshPool(poolState, reputation, currentTime, activeMissionId, { unlockedSoftware: unlockedFeatures });
      setMissionPool(newPoolState.missions);
      setPendingChainMissions(newPoolState.pendingArcMissions || {});
      setActiveClientIds(newPoolState.activeClientIds);
    }
  }, [reputation, unlockedFeatures]); // Trigger on reputation or unlocked features change

  // Auto-regenerate missions after expiration (immediate generation, hidden for 1 game minute)
  useEffect(() => {
    if (!proceduralMissionsEnabled || missionPool.length === 0) return;

    const currentTimeMs = currentTime.getTime();
    const activeMissionId = activeMission?.missionId || null;

    // Find expired missions that need regeneration
    const expiredMissions = missionPool.filter(mission => {
      // Skip active mission
      if (mission.missionId === activeMissionId) return false;
      // Skip if no expiration time
      if (!mission.expiresAt) return false;
      // Skip if already has a replacement generated
      if (mission.replacementGeneratedAt) return false;
      // Check if expired
      return currentTimeMs > new Date(mission.expiresAt).getTime();
    });

    if (expiredMissions.length === 0) return;

    // Process each expired mission
    const newMissions = [];
    const newPendingArcs = {};
    const expiredMissionsToMark = new Map(); // missionId -> replacementGeneratedAt timestamp
    const clientIdsToAdd = new Set();
    const arcIdsToCleanup = new Set();

    expiredMissions.forEach(mission => {
      // Check pool capacity (excluding expired missions)
      const nonExpiredCount = missionPool.filter(m => {
        if (expiredMissionsToMark.has(m.missionId) || m.missionId === mission.missionId) return false;
        if (!m.expiresAt) return true;
        return currentTimeMs <= new Date(m.expiresAt).getTime();
      }).length + newMissions.length;

      // Use progression-based pool config for capacity check
      const currentPoolConfig = getPoolConfigForProgression(unlockedFeatures);
      if (nonExpiredCount >= currentPoolConfig.max) {
        console.log(`⏭️ Mission "${mission.title}" expired but pool at max capacity - removing without replacement`);
        // Mark for removal without replacement
        expiredMissionsToMark.set(mission.missionId, { removeImmediately: true });
        if (mission.arcId) arcIdsToCleanup.add(mission.arcId);
        return;
      }

      // Build current activeClientIds set (excluding this expired mission's client, including new ones)
      const currentActiveClients = new Set([
        ...activeClientIds.filter(id => id !== mission.clientId),
        ...clientIdsToAdd
      ]);

      // Generate replacement mission immediately with unlocked features
      const result = generatePoolMission(reputation, currentTime, currentActiveClients, false, { unlockedSoftware: unlockedFeatures });

      if (result) {
        let newMission;
        // Set visibleAt to 1 game minute from now
        const visibleAt = new Date(currentTimeMs + poolConfig.regenerationDelayMs).toISOString();

        if (result.arcId) {
          // Arc - add first mission with expiration and visibleAt, store rest in pending
          newMission = {
            ...addExpirationToMission(result.missions[0], currentTime),
            visibleAt,
            replacesExpiredMissionId: mission.missionId
          };
          newPendingArcs[result.arcId] = result.missions.slice(1);
        } else {
          // Single mission - add expiration and visibleAt
          newMission = {
            ...addExpirationToMission(result, currentTime),
            visibleAt,
            replacesExpiredMissionId: mission.missionId
          };
        }

        console.log(`🔄 Regenerated mission: "${newMission.title}" (replacing expired "${mission.title}") - visible at ${visibleAt}`);
        newMissions.push(newMission);
        clientIdsToAdd.add(newMission.clientId);
        // Mark expired mission with timestamp so we know replacement was generated
        expiredMissionsToMark.set(mission.missionId, { replacementGeneratedAt: currentTime.toISOString() });
      } else {
        console.log(`⚠️ Failed to generate replacement mission for expired "${mission.title}"`);
        // Mark for removal since no replacement could be generated
        expiredMissionsToMark.set(mission.missionId, { removeImmediately: true });
      }

      if (mission.arcId) arcIdsToCleanup.add(mission.arcId);
    });

    // Batch update state if there are changes
    if (expiredMissionsToMark.size > 0) {
      setMissionPool(prev => [
        // Update expired missions with marker, or remove if no replacement
        ...prev.map(m => {
          const markData = expiredMissionsToMark.get(m.missionId);
          if (markData) {
            if (markData.removeImmediately) return null; // Will be filtered out
            return { ...m, replacementGeneratedAt: markData.replacementGeneratedAt };
          }
          return m;
        }).filter(Boolean),
        ...newMissions
      ]);

      // Only add new client IDs - expired mission clients stay until their mission is filtered out
      if (clientIdsToAdd.size > 0) {
        setActiveClientIds(prev => [...prev, ...clientIdsToAdd]);
      }

      if (Object.keys(newPendingArcs).length > 0) {
        setPendingChainMissions(prev => ({ ...prev, ...newPendingArcs }));
      }

      if (arcIdsToCleanup.size > 0) {
        setPendingChainMissions(prev => {
          const newPending = { ...prev };
          arcIdsToCleanup.forEach(arcId => delete newPending[arcId]);
          return newPending;
        });
      }
    }
  }, [proceduralMissionsEnabled, missionPool, currentTime, activeMission?.missionId, activeClientIds, reputation, unlockedFeatures]);

  // Cleanup expired missions once their replacements become visible
  useEffect(() => {
    if (!proceduralMissionsEnabled || missionPool.length === 0) return;

    const currentTimeMs = currentTime.getTime();

    // Find expired missions whose replacements are now visible
    const expiredToRemove = missionPool.filter(mission => {
      if (!mission.replacementGeneratedAt) return false;
      // Find the replacement
      const replacement = missionPool.find(m => m.replacesExpiredMissionId === mission.missionId);
      if (!replacement) return true; // Replacement missing, remove expired mission
      // Check if replacement is now visible
      if (!replacement.visibleAt) return true; // No visibleAt means visible immediately
      return new Date(replacement.visibleAt).getTime() <= currentTimeMs;
    });

    if (expiredToRemove.length > 0) {
      const expiredIds = new Set(expiredToRemove.map(m => m.missionId));
      const clientIdsToRemove = new Set(expiredToRemove.map(m => m.clientId));

      setMissionPool(prev => prev
        .filter(m => !expiredIds.has(m.missionId))
        .map(m => {
          // Clear the replacesExpiredMissionId link since expired mission is now removed
          if (m.replacesExpiredMissionId && expiredIds.has(m.replacesExpiredMissionId)) {
            const { replacesExpiredMissionId: _unused, ...rest } = m;
            return rest;
          }
          return m;
        })
      );

      setActiveClientIds(prev => prev.filter(id => !clientIdsToRemove.has(id)));
    }
  }, [proceduralMissionsEnabled, missionPool, currentTime]);

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

  // Handle mission extensions when objectives complete
  useEffect(() => {
    if (!activeMission) return;

    const handleObjectiveComplete = (data) => {
      // Only handle objectives from the current active mission
      if (data.missionId !== activeMission.missionId) return;

      // Get objective progress (excluding verification)
      const { completed, total, isAllRealComplete } = getObjectiveProgress(activeMission.objectives);

      // Check if extension should trigger
      const shouldExtend = shouldTriggerExtension(
        activeMission,
        completed,
        total,
        isAllRealComplete,
        extensionOffers
      );

      if (!shouldExtend) return;

      // Generate the extension
      const extension = generateExtension(activeMission, isAllRealComplete);
      if (!extension) return;

      const missionId = activeMission.missionId || activeMission.id;
      console.log(`🔧 Mission extension triggered for ${missionId} (${isAllRealComplete ? 'post-completion' : 'mid-mission'})`);

      // Mark this mission as extended to prevent double-extension
      setExtensionOffers(prev => ({
        ...prev,
        [missionId]: {
          triggered: true,
          isPostCompletion: extension.isPostCompletion,
          payoutMultiplier: extension.payoutMultiplier
        }
      }));

      // Update the active mission with new objectives and networks
      setActiveMission(prev => {
        if (!prev) return null;

        // Find verification objective index
        const verificationIndex = prev.objectives.findIndex(obj => obj.type === 'verification');

        // Insert new objectives before verification (or at end if no verification)
        let newObjectives;
        if (verificationIndex >= 0) {
          newObjectives = [
            ...prev.objectives.slice(0, verificationIndex),
            ...extension.objectives,
            ...prev.objectives.slice(verificationIndex)
          ];
        } else {
          newObjectives = [...prev.objectives, ...extension.objectives];
        }

        // Update payout
        const newPayout = Math.floor(prev.basePayout * extension.payoutMultiplier);

        return {
          ...prev,
          objectives: newObjectives,
          networks: extension.networks,
          basePayout: newPayout,
          extended: true,
          extensionPayoutMultiplier: extension.payoutMultiplier
        };
      });

      // Send extension message to player
      const templateId = `extension-${extension.messageTemplate}`;
      // Format target files list for message (matching briefing message format)
      const targetFilesList = extension.targetFiles && extension.targetFiles.length > 0
        ? '\n\n📁 Additional files:\n' + extension.targetFiles.map(f => `• ${f}`).join('\n')
        : '';
      const extensionMessage = createMessageFromTemplate(templateId, {
        username,
        clientName: extension.clientName,
        targetFilesList,
        ...(extension.messageData || {})
      });

      if (extensionMessage) {
        // Add NAR attachment if extension requires new network
        if (extension.narAttachment) {
          const narAtt = extension.narAttachment;

          // Register network structure in NetworkRegistry (with accessible: false until NAR activated)
          networkRegistry.registerNetwork({
            networkId: narAtt.networkId,
            networkName: narAtt.networkName,
            address: narAtt.address,
            bandwidth: narAtt.bandwidth,
            accessible: false,
            discovered: true,
          });

          // Register devices and file systems from attachment
          const deviceIps = [];
          if (narAtt.fileSystems && Array.isArray(narAtt.fileSystems)) {
            narAtt.fileSystems.forEach(fs => {
              networkRegistry.registerDevice({
                ip: fs.ip,
                hostname: fs.name,
                networkId: narAtt.networkId,
                fileSystemId: fs.id,
                accessible: false,
                logs: fs.logs || [], // Pass activity logs if present
              });
              deviceIps.push(fs.ip);

              networkRegistry.registerFileSystem({
                id: fs.id,
                files: fs.files || [],
              });
            });
          }

          // Add attachment with deviceIps (stripped of fileSystems to avoid stale data)
          // eslint-disable-next-line no-unused-vars
          const { fileSystems, ...attWithoutFileSystems } = narAtt;
          extensionMessage.attachments = [
            ...(extensionMessage.attachments || []),
            { ...attWithoutFileSystems, deviceIps }
          ];
        }

        // Small delay before sending so player sees objective complete first
        setTimeout(() => {
          setMessages(prev => {
            const isDuplicate = prev.some(m => m.id === extensionMessage.id);
            if (isDuplicate) return prev;
            return [...prev, { ...extensionMessage, timestamp: new Date(currentTime) }];
          });
          // Play notification sound
          try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
          } catch {
            // Audio unavailable
          }
        }, 1500);
      }

      console.log(`📬 Extension message "${templateId}" queued with ${extension.objectives.length} new objectives`);
    };

    const unsubscribe = triggerEventBus.on('objectiveComplete', handleObjectiveComplete);
    return () => unsubscribe();
  }, [activeMission, extensionOffers, username, currentTime]);

  // Download manager - handles progress updates for downloads based on game time
  useDownloadManager(
    downloadQueue,
    setDownloadQueue,
    hardware,
    handleDownloadComplete,
    currentTime,
    gamePhase === 'desktop', // Only run when on desktop
    activeConnections
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
    const connectionSpeed = getNetworkBandwidth(activeConnections);
    const maxBandwidth = Math.min(adapterSpeed, connectionSpeed);
    const activeCount = getActiveBandwidthOperationCount();
    const bandwidthPerOperation = activeCount > 0 ? maxBandwidth / activeCount : maxBandwidth;
    const transferSpeedMBps = calculateTransferSpeed(bandwidthPerOperation);
    // Determine what's limiting speed - only meaningful when connected to VPN
    // (connectionSpeed is Infinity when not connected to any network)
    const limitedBy = connectionSpeed === Infinity
      ? null
      : (adapterSpeed <= connectionSpeed ? 'adapter' : 'network');

    return {
      adapterSpeed,
      maxBandwidth,
      activeOperations: activeCount,
      bandwidthPerOperation,
      transferSpeedMBps,
      usagePercent: Math.min(100, (activeCount / 4) * 100), // Cap visual at 4 ops
      limitedBy,
    };
  }, [hardware, activeConnections, getActiveBandwidthOperationCount]);

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
    const connectionSpeed = getNetworkBandwidth(activeConnections);
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
    // Note: Network registration for NAR attachments is done in acceptMission()
    // when the mission is accepted, before the briefing message is sent
    setMessages((prev) => [...prev, newMessage]);

    // Play notification chime after state update (outside updater)
    playNotificationChime();

    // If this is the first message, schedule second message when it's read
    if (message.id === 'msg-welcome-hr') {
      // Will be handled when message is marked as read
    }
  }, [currentTime, messages, playNotificationChime]);

  // Hardware unlock trigger: when "New Opportunities" message is read
  // Unlocks network-adapters (hardware) and investigation-tooling (software) features
  useEffect(() => {
    const handleMessageRead = (data) => {
      // Check if this is the hardware unlock message being read
      // The message has subject 'New Opportunities - Hardware & Tools'
      const message = messages.find(m => m.id === data.messageId);
      if (message && message.subject && message.subject.includes('New Opportunities')) {
        console.log('🔓 "New Opportunities" message read! Unlocking hardware and investigation features...');

        // Unlock features
        setUnlockedFeatures(prev => {
          const newFeatures = new Set(prev);
          newFeatures.add('network-adapters');
          newFeatures.add('investigation-tooling');
          return Array.from(newFeatures);
        });
      }
    };

    const unsubscribe = triggerEventBus.on('messageRead', handleMessageRead);
    return () => unsubscribe();
  }, [messages]);

  // Hardware unlock message trigger: when "better" message is read AND credits >= 1000
  // Sends the "New Opportunities" message (but doesn't unlock features - that happens when message is read)
  useEffect(() => {
    // Skip if conditions not met or message already sent
    if (!betterMessageRead || hardwareUnlockMessageSent) return;

    const handleCreditsChanged = (data) => {
      const { newBalance } = data;

      // Trigger when player reaches 1000+ credits
      if (newBalance >= 1000) {
        console.log('� Hardware unlock MESSAGE trigger met (credits:', newBalance, ') - sending "New Opportunities" message...');

        // Mark as sent to prevent duplicate
        setHardwareUnlockMessageSent(true);

        // Schedule the hardware unlock message with a small delay
        // NOTE: Features are unlocked when the player READS this message, not when it's sent
        scheduleGameTimeCallback(() => {
          const message = createMessageFromTemplate('hardware-unlock', {
            username,
            managerName,
          });

          if (message) {
            console.log('📧 Sending "New Opportunities" hardware unlock message');
            addMessage(message);
          }
        }, 3000, timeSpeed);
      }
    };

    const unsubscribe = triggerEventBus.on('creditsChanged', handleCreditsChanged);
    return () => unsubscribe();
  }, [betterMessageRead, hardwareUnlockMessageSent, username, managerName, timeSpeed, addMessage]);

  // Decryption tease message trigger: when credits reach the threshold set after completing data-detective mission
  useEffect(() => {
    // Skip if no threshold set or message already sent
    if (creditThresholdForDecryption === null || decryptionMessageSent) return;

    let sent = false;
    const handleCreditsChanged = (data) => {
      if (sent) return;
      const { newBalance } = data;

      // Trigger when player reaches the threshold
      if (newBalance >= creditThresholdForDecryption) {
        sent = true;
        console.log('💰 Decryption tease trigger met (credits:', newBalance, '>= threshold:', creditThresholdForDecryption, ')');

        // Mark as sent to prevent duplicate
        setDecryptionMessageSent(true);

        // Schedule the decryption tease message with a small delay
        scheduleGameTimeCallback(() => {
          const message = createMessageFromTemplate('decryption-tease', {
            username,
            managerName,
          });

          if (message) {
            // Use a fixed ID so the ransomware-recovery mission can trigger on messageRead
            message.id = 'msg-decryption-work';
            console.log('📧 Sending "decryption-tease" message');
            addMessage(message);
          }
        }, 5000, timeSpeed);
      }
    };

    const unsubscribe = triggerEventBus.on('creditsChanged', handleCreditsChanged);
    return () => unsubscribe();
  }, [creditThresholdForDecryption, decryptionMessageSent, username, managerName, timeSpeed, addMessage]);

  // Decryption tooling unlock: when the decryption message is read
  useEffect(() => {
    const handleMessageRead = (data) => {
      const message = messages.find(m => m.id === data.messageId);
      if (message && message.subject && message.subject.includes('Decryption Work')) {
        console.log('🔓 Decryption message read! Unlocking decryption-tooling...');
        setUnlockedFeatures(prev => {
          const newFeatures = new Set(prev);
          newFeatures.add('decryption-tooling');
          return Array.from(newFeatures);
        });
      }
    };

    const unsubscribe = triggerEventBus.on('messageRead', handleMessageRead);
    return () => unsubscribe();
  }, [messages]);

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

    // Add funds to account using helper (emits creditsChanged event)
    const currentBalance = bankAccounts.find(acc => acc.id === accountId).balance;
    const newBalance = currentBalance + chequeAttachment.amount;

    updateBankBalance(accountId, chequeAttachment.amount, 'cheque-deposit');

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
  }, [messages, bankAccounts, updateBankBalance, currentTime, playNotificationChime]);

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

  // Start a passive software (runs in background, no window)
  const startPassiveSoftware = useCallback((softwareId) => {
    let emitted = false;
    setActivePassiveSoftware((prev) => {
      if (prev.includes(softwareId)) return prev;
      const updated = [...prev, softwareId];
      // Emit event after state update via microtask (guard against React Strict Mode double invocation)
      if (!emitted) {
        emitted = true;
        queueMicrotask(() => {
          triggerEventBus.emit('passiveSoftwareStarted', { softwareId });
        });
      }
      return updated;
    });
  }, []);

  // Add file to local SSD (for decryption download step)
  const addFileToLocalSSD = useCallback((file) => {
    setLocalSSDFiles((prev) => [...prev, file]);
  }, []);

  // Remove file from local SSD by name
  const removeFileFromLocalSSD = useCallback((fileName) => {
    setLocalSSDFiles((prev) => prev.filter(f => f.name !== fileName));
  }, []);

  // Replace a file on local SSD (for decryption: replace .enc with decrypted version)
  const replaceFileOnLocalSSD = useCallback((oldName, newFile) => {
    setLocalSSDFiles((prev) => prev.map(f => f.name === oldName ? newFile : f));
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
    // Time only runs during desktop phase and when not paused
    if (isPaused || gamePhase !== 'desktop') {
      return;
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

      // Update balance using helper (emits creditsChanged event)
      const primaryAccountId = bankAccounts[0]?.id;
      if (primaryAccountId) {
        updateBankBalance(primaryAccountId, interest, 'interest');

        // Add transaction
        const newBalance = bankAccounts[0].balance + interest;
        setTransactions((prev) => [
          ...prev,
          {
            id: `txn-interest-${Date.now()}`,
            date: currentTime.toISOString(),
            type: 'expense',
            amount: interest,
            description: 'Overdraft Interest',
            balanceAfter: newBalance,
          },
        ]);
      }

      lastInterestRef.current = currentTime;
    }
  }, [currentTime, isPaused, gamePhase, username, getTotalCredits, bankAccounts, updateBankBalance]);

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
      status: 'active',
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

    // Register network structures in NetworkRegistry BEFORE sending briefing message
    // Networks are registered with accessible: false, discovered: true
    // The player must activate the NAR attachment to grant access
    if (mission.networks && Array.isArray(mission.networks)) {
      mission.networks.forEach(network => {
        // Register network
        networkRegistry.registerNetwork({
          networkId: network.networkId,
          networkName: network.networkName,
          address: network.address,
          bandwidth: network.bandwidth,
          accessible: false,
          discovered: true,
        });

        // Register devices and file systems
        if (network.fileSystems && Array.isArray(network.fileSystems)) {
          // Group file systems by IP (multiple file systems per device)
          const devicesByIp = new Map();

          network.fileSystems.forEach(fs => {
            if (!devicesByIp.has(fs.ip)) {
              devicesByIp.set(fs.ip, {
                ip: fs.ip,
                hostname: fs.name.split('/')[0],  // Base hostname without file system suffix
                fileSystemIds: [],
                logs: []
              });
            }

            const device = devicesByIp.get(fs.ip);
            device.fileSystemIds.push(fs.id);

            // Merge logs from all file systems, converting relative timestamps to absolute
            if (fs.logs && Array.isArray(fs.logs)) {
              const processedLogs = fs.logs.map((log, index) => ({
                ...log,
                id: `mission-log-${fs.id}-${index}`,
                timestamp: typeof log.timestamp === 'number'
                  ? new Date(currentTime.getTime() + log.timestamp * 1000).toISOString()
                  : log.timestamp,
              }));
              device.logs.push(...processedLogs);
            }
          });

          // Register devices (one per unique IP)
          devicesByIp.forEach(device => {
            networkRegistry.registerDevice({
              ip: device.ip,
              hostname: device.hostname,
              networkId: network.networkId,
              fileSystemIds: device.fileSystemIds,  // Array of file system IDs
              accessible: false,
              logs: device.logs
            });

            console.log(`📡 NetworkRegistry: Registered ${device.hostname} (${device.ip}) with ${device.fileSystemIds.length} file systems on ${network.networkName}`);
          });

          // Register individual file systems
          network.fileSystems.forEach(fs => {
            networkRegistry.registerFileSystem({
              id: fs.id,
              files: fs.files || [],
              fileSystemName: fs.fileSystemName
            });
          });
        }
      });
    }

    // Send the briefing message (attachments already have minimal data from generateNarAttachments)
    if (mission.briefingMessage) {
      // Helper to generate random ID segments (e.g., "TF8-99U")
      const generateRandomId = () => {
        return `${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      };

      // Helper to replace all placeholders in text
      const replacePlaceholders = (text) => {
        if (!text) return text;
        return text
          .replace(/\{username\}/g, username)
          .replace(/\{managerName\}/g, managerName || '')
          .replace(/\{clientName\}/g, mission.briefingMessage.fromName || mission.client);
      };

      // Add the briefing message with proper timestamp and placeholder replacement
      const briefingWithTimestamp = {
        id: mission.briefingMessage.id || `msg-briefing-${mission.missionId}-${Date.now()}`,
        from: replacePlaceholders(mission.briefingMessage.from),
        fromId: (mission.briefingMessage.fromId || '').replace(/\{random\}/g, generateRandomId()),
        fromName: replacePlaceholders(mission.briefingMessage.fromName || mission.briefingMessage.from),
        subject: replacePlaceholders(mission.briefingMessage.subject),
        body: replacePlaceholders(mission.briefingMessage.body || ''),
        timestamp: currentTime.toISOString(),
        read: false,
        archived: false,
        attachments: mission.briefingMessage.attachments || [],
      };

      addMessage(briefingWithTimestamp);
    }
  }, [addMessage, currentTime, username, managerName]);

  // Dismiss a procedural mission (removes from pool, frees client, generates replacement)
  const dismissMission = useCallback((mission) => {
    // Only allow dismissing procedural missions
    if (!mission.isProcedurallyGenerated) {
      console.log('⚠️ Cannot dismiss non-procedural mission:', mission.missionId);
      return;
    }

    console.log('🗑️ Dismissing mission:', mission.missionId, mission.title);

    const currentTimeMs = currentTime.getTime();
    const currentPoolConfig = getPoolConfigForProgression(unlockedFeatures);

    // Remove mission from pool
    setMissionPool(prev => prev.filter(m => m.missionId !== mission.missionId));

    // Free the client slot
    setActiveClientIds(prev => prev.filter(id => id !== mission.clientId));

    // If this is an arc mission, remove the entire arc from pending
    if (mission.arcId) {
      console.log('🗑️ Removing arc from pending:', mission.arcId);
      setPendingChainMissions(prev => {
        const newPending = { ...prev };
        delete newPending[mission.arcId];
        return newPending;
      });
    }

    // Generate a replacement mission with visibility delay
    const currentActiveClients = new Set(
      activeClientIds.filter(id => id !== mission.clientId)
    );

    const result = generatePoolMission(reputation, currentTime, currentActiveClients, false, { unlockedSoftware: unlockedFeatures });

    if (result) {
      const visibleAt = new Date(currentTimeMs + currentPoolConfig.regenerationDelayMs).toISOString();
      let newMission;

      if (result.arcId) {
        // Arc - add first mission with expiration and visibleAt, store rest in pending
        newMission = {
          ...addExpirationToMission(result.missions[0], currentTime),
          visibleAt,
        };
        setPendingChainMissions(prev => ({ ...prev, [result.arcId]: result.missions.slice(1) }));
      } else {
        // Single mission - add expiration and visibleAt
        newMission = {
          ...addExpirationToMission(result, currentTime),
          visibleAt,
        };
      }

      console.log(`🔄 Generated replacement mission: "${newMission.title}" - visible at ${visibleAt}`);
      setMissionPool(prev => [...prev, newMission]);
      setActiveClientIds(prev => [...prev, newMission.clientId]);
    } else {
      console.log('⚠️ Failed to generate replacement mission for dismissed mission');
    }

    // Emit event for tracking/debugging
    triggerEventBus.emit('missionDismissed', {
      missionId: mission.missionId,
      title: mission.title,
      clientId: mission.clientId,
      arcId: mission.arcId,
    });
  }, [currentTime, reputation, unlockedFeatures, activeClientIds]);

  // Complete mission objective
  // isPreCompleted: true if this objective was completed before becoming the "current" objective
  const completeMissionObjective = useCallback((objectiveId, isPreCompleted = false) => {
    // Check for active mission before state update (for logging)
    if (!activeMission) {
      console.log(`⚠️ completeMissionObjective: No active mission to update (objective: ${objectiveId})`);
      return;
    }

    // Log before state update (outside updater)
    console.log(`📋 completeMissionObjective: Updating objective ${objectiveId} for mission ${activeMission.missionId}${isPreCompleted ? ' (pre-completed)' : ''}`);

    // Use functional update to get the latest activeMission state
    // This prevents stale closure issues when multiple updates happen quickly
    setActiveMission((currentMission) => {
      if (!currentMission) {
        return null; // Don't set it back if it was already cleared
      }

      const updatedObjectives = currentMission.objectives.map(obj =>
        obj.id === objectiveId ? { ...obj, status: 'complete', preCompleted: isPreCompleted } : obj
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
    setMissionSubmitting(false);

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
      // Failure penalty: Apply immediately using helper (emits creditsChanged event)
      const primaryAccountId = bankAccounts[0]?.id;
      if (primaryAccountId) {
        updateBankBalance(primaryAccountId, payout, 'mission-penalty');
      }
    }

    // Update reputation
    setReputation(prev => Math.max(1, Math.min(11, prev + reputationChange)));

    // Revoke network access and disconnect if mission has networks with revokeOnComplete
    const networksToRevoke = activeMission.networks?.filter(network => network.revokeOnComplete) || [];

    if (networksToRevoke.length > 0) {
      // Revoke access in NetworkRegistry for these networks
      networksToRevoke.forEach(net => {
        const reason = net.revokeReason || 'Mission access expired';
        networkRegistry.revokeNetworkAccess(net.networkId, reason);
      });

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

    // Send failure messages if mission failed
    if (status === 'failed') {
      const consequences = activeMission.consequences?.failure || {};

      // Determine which message variant to use based on failure reason
      let messageVariantKey = 'incomplete';
      if (failureReason === 'deadline') {
        messageVariantKey = 'deadline';
      } else if (failureReason && (failureReason.includes('no longer exist') || failureReason.includes('deleted'))) {
        messageVariantKey = 'filesDeleted';
      }

      // Select appropriate message - prefer messageVariants if available
      let messagesToSend = [];
      if (consequences.messageVariants && consequences.messageVariants[messageVariantKey]) {
        messagesToSend = [consequences.messageVariants[messageVariantKey]];
      } else if (consequences.messages && Array.isArray(consequences.messages) && consequences.messages.length > 0) {
        messagesToSend = consequences.messages;
      }

      // Schedule failure messages
      messagesToSend.forEach(msgConfig => {
        let message;

        if (msgConfig.body) {
          const messageBody = msgConfig.body
            .replace(/\{username\}/g, username)
            .replace(/\{clientName\}/g, msgConfig.fromName || activeMission.client || '');

          message = {
            ...msgConfig,
            body: messageBody,
            timestamp: currentTime.toISOString(),
            read: false,
          };
        }

        if (message) {
          const delay = msgConfig.delay || 0;
          scheduleGameTimeCallback(() => {
            addMessage(message);
          }, delay, timeSpeed);
        }
      });
    }
  }, [activeMission, currentTime, bankAccounts, timeSpeed, username, addMessage]);

  // Submit mission for completion manually (used when optional objectives remain)
  // This triggers the verification process as if all objectives were complete
  const submitMissionForCompletion = useCallback(() => {
    if (!activeMission || missionSubmitting) {
      console.log('⚠️ submitMissionForCompletion: No active mission or already submitting');
      return;
    }

    // Check that all required objectives are complete
    const objectives = activeMission.objectives || [];
    const requiredObjectives = objectives.filter(obj => obj.required !== false && obj.id !== 'obj-verify');
    const allRequiredComplete = requiredObjectives.every(obj => obj.status === 'complete');

    if (!allRequiredComplete) {
      console.log('⚠️ submitMissionForCompletion: Not all required objectives complete');
      return;
    }

    console.log('✅ submitMissionForCompletion: Submitting mission with optional objectives incomplete');
    setMissionSubmitting(true);

    // Mark any incomplete optional objectives as skipped in state
    const optionalObjectiveIds = objectives
      .filter(obj => obj.required === false && obj.status !== 'complete')
      .map(obj => obj.id);

    if (optionalObjectiveIds.length > 0) {
      setActiveMission(prev => {
        if (!prev) return null;
        return {
          ...prev,
          objectives: prev.objectives.map(obj =>
            optionalObjectiveIds.includes(obj.id)
              ? { ...obj, status: 'skipped' }
              : obj
          ),
        };
      });
      optionalObjectiveIds.forEach(id => {
        const obj = objectives.find(o => o.id === id);
        console.log(`  ⏭️ Skipping optional objective: ${obj?.description}`);
      });
    }

    // Delay before completing verification (same delay as auto-verify)
    // This gives the player visual feedback that submission is processing
    scheduleGameTimeCallback(() => {
      completeMissionObjective('obj-verify');
      setMissionSubmitting(false);
    }, VERIFICATION_DELAY_MS, timeSpeed);

    // Emit event for tracking
    triggerEventBus.emit('missionManuallySubmitted', {
      missionId: activeMission.missionId,
      skippedOptionalObjectives: optionalObjectiveIds,
    });
  }, [activeMission, missionSubmitting, completeMissionObjective, timeSpeed]);

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
    setMissionSubmitting(false);

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

    // Update credits (apply penalty using helper - emits creditsChanged event)
    const primaryAccountId = bankAccounts[0]?.id;
    if (primaryAccountId) {
      console.log(`BALANCE_LOG useEffect failed status: applying penalty ${penaltyCredits}`);
      updateBankBalance(primaryAccountId, penaltyCredits, 'mission-penalty');
    }

    // Update reputation
    setReputation(prev => Math.max(1, Math.min(11, prev + reputationChange)));

    console.log(`❌ About to check for failure messages`);
    console.log(`❌ consequences.messages:`, consequences.messages);
    console.log(`❌ consequences.messageVariants:`, consequences.messageVariants);

    // Determine which message to use based on failure reason
    // Map specific failure reasons to message variant keys
    let messageVariantKey = 'incomplete'; // default
    if (failureReason === 'deadline') {
      messageVariantKey = 'deadline';
    } else if (failureReason.includes('no longer exist') || failureReason.includes('deleted')) {
      messageVariantKey = 'filesDeleted';
    }
    console.log(`❌ Using message variant: ${messageVariantKey} (failureReason: ${failureReason})`);

    // Select the appropriate message - prefer messageVariants if available
    let messagesToSend = [];
    if (consequences.messageVariants && consequences.messageVariants[messageVariantKey]) {
      messagesToSend = [consequences.messageVariants[messageVariantKey]];
      console.log(`📧 Using messageVariant for ${messageVariantKey}`);
    } else if (consequences.messages && Array.isArray(consequences.messages) && consequences.messages.length > 0) {
      messagesToSend = consequences.messages;
      console.log(`📧 Using default messages array`);
    }

    // Schedule failure messages (if any)
    if (messagesToSend.length > 0) {
      console.log(`📧 Found ${messagesToSend.length} failure messages to schedule`);

      // Create messages from templates or use direct body
      messagesToSend.forEach(msgConfig => {
        console.log(`📧 Processing message config:`, msgConfig);

        let message;

        if (msgConfig.templateId) {
          // Use template system
          const messageData = {
            username: username,
            managerName: managerName,
          };
          message = createMessageFromTemplate(msgConfig.templateId, messageData);
        } else if (msgConfig.body) {
          // Direct body - replace placeholders
          const messageBody = msgConfig.body
            .replace(/\{username\}/g, username)
            .replace(/\{clientName\}/g, msgConfig.fromName || activeMission?.client || '');

          message = {
            ...msgConfig,
            body: messageBody,
            timestamp: currentTime.toISOString(),
            read: false,
          };
        }

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

  // Unlock investigation missions when data-detective mission is completed successfully
  useEffect(() => {
    const handleMissionComplete = (data) => {
      const { missionId, status } = data;

      // Check if this is the data-detective mission completing successfully
      if (missionId === 'data-detective' && status === 'success') {
        console.log('✅ Data Detective mission completed - unlocking investigation missions');

        // Add 'investigation-missions' to unlocked features
        setUnlockedFeatures(prev => {
          if (prev.includes('investigation-missions')) return prev;
          return [...prev, 'investigation-missions'];
        });

        // Force mission pool refresh to include investigation missions
        // This is done by triggering a refresh check on the next pool tick
        setMissionPool(prev => {
          console.log('🔄 Triggering mission pool refresh for investigation missions');
          return [...prev]; // Trigger re-render which will check shouldRefreshPool
        });
      }
    };

    const unsubscribe = triggerEventBus.on('missionComplete', handleMissionComplete);
    return () => unsubscribe();
  }, []);

  // Set decryption tease threshold when player reads the "Investigation Missions Unlocked" message
  useEffect(() => {
    if (creditThresholdForDecryption !== null) return; // Already set

    const handleMessageRead = (data) => {
      const message = messages.find(m => m.id === data.messageId);
      if (message?.subject?.includes('Investigation Missions Unlocked')) {
        const currentBalance = bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        const threshold = currentBalance + 10000;
        console.log(`💰 Setting decryption message threshold to ${threshold} credits (current: ${currentBalance} + 10000)`);
        setCreditThresholdForDecryption(threshold);
      }
    };

    const unsubscribe = triggerEventBus.on('messageRead', handleMessageRead);
    return () => unsubscribe();
  }, [messages, bankAccounts, creditThresholdForDecryption]);

  // Handle retryable mission failures - schedule mission to reappear after delay
  useEffect(() => {
    const handleMissionFailureRetry = (data) => {
      const { missionId, status } = data;

      // Only handle failures
      if (status !== 'failed') return;

      // Find the mission definition from StoryMissionManager
      const missionDef = storyMissionManager.getMission(missionId);
      if (!missionDef) return;

      // Check if mission is retryable
      const failureConsequences = missionDef.consequences?.failure;
      if (!failureConsequences?.retryable) return;

      const retryDelay = failureConsequences.retryDelay || 60000; // Default 1 minute

      console.log(`🔄 Mission ${missionId} is retryable - scheduling retry in ${retryDelay}ms game time`);

      // Reset network state for retry
      if (missionDef.networks) {
        missionDef.networks.forEach(net => {
          networkRegistry.resetNetworkForRetry(net.networkId, net);
        });
      }

      // Schedule mission to reappear in available missions
      scheduleGameTimeCallback(() => {
        console.log(`🔄 Re-adding retryable mission ${missionId} to available missions`);

        // Re-add to available missions
        setAvailableMissions(prev => {
          // Check if already in list (shouldn't be, but guard against duplicates)
          if (prev.some(m => m.missionId === missionId)) {
            return prev;
          }
          return [...prev, missionDef];
        });

        // Emit event for tracking
        triggerEventBus.emit('missionRetryAvailable', { missionId });
      }, retryDelay, timeSpeed);
    };

    const unsubscribe = triggerEventBus.on('missionComplete', handleMissionFailureRetry);
    return () => unsubscribe();
  }, [timeSpeed]);

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

        // Delete file from all file systems in NetworkRegistry
        const allFileSystems = networkRegistry.getAllFileSystems();
        allFileSystems.forEach(fs => {
          if (fs.files?.some(f => f.name === fileName)) {
            const updatedFiles = fs.files.filter(f => f.name !== fileName);
            networkRegistry.updateFiles(fs.id, updatedFiles);
            console.log(`  🗑️ FS ${fs.id}: Deleted ${fileName} (${fs.files.length} → ${updatedFiles.length} files)`);
          }
        });
      }
    };

    triggerEventBus.on('sabotageFileOperation', handleSabotageFileOperation);

    return () => {
      triggerEventBus.off('sabotageFileOperation', handleSabotageFileOperation);
    };
  }, []); // No dependencies needed - only uses NetworkRegistry singleton

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
      const revokeReason = reason || 'Access credentials revoked by network administrator';
      console.log(`🔐 Revoking network access for ${networkId}`);

      // Revoke access in NetworkRegistry
      networkRegistry.revokeNetworkAccess(networkId, revokeReason);

      // Find and disconnect any active connection to this network
      const connectionToDisconnect = activeConnections.find(conn => conn.networkId === networkId);

      if (connectionToDisconnect) {
        // Disconnect from the revoked network
        setActiveConnections(prev => prev.filter(conn => conn.networkId !== networkId));

        // Emit networkDisconnected event after state update
        queueMicrotask(() => {
          triggerEventBus.emit('networkDisconnected', {
            networkId: networkId,
            networkName: connectionToDisconnect.networkName || networkId,
            reason: revokeReason,
          });
        });
      }
    };

    triggerEventBus.on('revokeNAREntry', handleRevokeNAREntry);

    return () => {
      triggerEventBus.off('revokeNAREntry', handleRevokeNAREntry);
    };
  }, [activeConnections, setActiveConnections]);

  // Listen for mission status changes
  useEffect(() => {
    const handleMissionStatusChanged = (data) => {
      const { status, failureReason } = data;
      console.log(`📋 Mission status changed to: ${status}`);

      if (status === 'success' && activeMission) {
        // Complete obj-verify to trigger normal mission completion flow
        console.log('✅ Mission marked as success via scripted event - completing obj-verify');
        completeMissionObjective('obj-verify');
        return;
      }

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
  }, [activeMission, completeMissionObjective]);

  // Listen for ransomware completion (encryption reached 100%) - forced reboot + lockout
  useEffect(() => {
    if (!activeMission) return;

    const handleRansomwareComplete = () => {
      console.log('💀 Ransomware encryption complete - forced reboot with lockout');
      // Close all windows and disconnect all connections
      setWindows([]);
      setActiveConnections([]);
      // Set ransomware lockout (lock screen after reboot)
      setRansomwareLockout(true);
      // Trigger reboot sequence (mission stays active - NOT failed)
      setIsRebooting(true);
      setIsPaused(true);
      setTimeSpeed(TIME_SPEEDS.NORMAL);
      setGamePhase('rebooting');
    };

    triggerEventBus.on('ransomwareComplete', handleRansomwareComplete);

    return () => {
      triggerEventBus.off('ransomwareComplete', handleRansomwareComplete);
    };
  }, [activeMission]);

  // Listen for mission extension events (adds new objectives and files mid-mission)
  useEffect(() => {
    if (!activeMission) return;

    const handleAddMissionExtension = (data) => {
      const { objectives, files } = data;

      console.log('📋 Adding mission extension:', objectives?.length, 'objectives,', files?.length || 0, 'files');

      // Add new objectives to active mission
      if (objectives && objectives.length > 0) {
        setActiveMission(prev => {
          if (!prev) return prev;
          const newObjectives = objectives.map(obj => ({ ...obj, status: obj.status || 'pending' }));
          const verifyIndex = prev.objectives.findIndex(obj => obj.id === 'obj-verify');
          const before = verifyIndex >= 0 ? prev.objectives.slice(0, verifyIndex) : prev.objectives;
          const after = verifyIndex >= 0 ? prev.objectives.slice(verifyIndex) : [];
          return {
            ...prev,
            objectives: [...before, ...newObjectives, ...after],
          };
        });
      }

      // Add files to file systems
      if (files && files.length > 0) {
        files.forEach(fileConfig => {
          const { fileSystemId, file } = fileConfig;
          if (fileSystemId && file) {
            networkRegistry.addFilesToFileSystem(fileSystemId, [file]);
          }
        });
      }
    };

    triggerEventBus.on('addMissionExtension', handleAddMissionExtension);

    return () => {
      triggerEventBus.off('addMissionExtension', handleAddMissionExtension);
    };
  }, [activeMission]);

  // Listen for file system changes to detect impossible objectives
  // When a mission-critical file is deleted, the mission should fail
  useEffect(() => {
    if (!activeMission) return;

    const handleFileSystemChanged = () => {
      // Check all incomplete fileOperation objectives
      const fileOperationObjectives = activeMission.objectives?.filter(
        obj => obj.type === 'fileOperation' && obj.status !== 'complete'
      ) || [];

      if (fileOperationObjectives.length === 0) return;

      // Check each objective to see if it's now impossible
      for (const objective of fileOperationObjectives) {
        const impossibleResult = checkObjectiveImpossible(
          objective,
          networkRegistry,
          activeMission.networks
        );

        if (impossibleResult) {
          const { missingFiles } = impossibleResult;
          console.log(`❌ Mission objective impossible - required file(s) no longer exist: ${missingFiles.join(', ')}`);

          // Emit mission failed event - this will trigger NAR revocation which disconnects
          // the player and automatically clears the clipboard
          triggerEventBus.emit('missionStatusChanged', {
            status: 'failed',
            failureReason: `Required file(s) no longer exist: ${missingFiles.join(', ')}`,
          });
          return; // Only need to fail once
        }
      }
    };

    triggerEventBus.on('fileSystemChanged', handleFileSystemChanged);

    return () => {
      triggerEventBus.off('fileSystemChanged', handleFileSystemChanged);
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
      // Local SSD files
      localSSDFiles,
      // Hardware unlock system
      betterMessageRead,
      hardwareUnlockMessageSent,
      unlockedFeatures,
      pendingHardwareUpgrades,
      // Future content tease system
      creditThresholdForDecryption,
      decryptionMessageSent,
      // Decryption system
      decryptionAlgorithms,
      missionDecryptionOperations: { decrypted: Array.from(missionDecryptionOperations.decrypted || []) },
      missionUploadOperations: {
        uploaded: Array.from(missionUploadOperations.uploaded || []),
        uploadDestinations: Array.from((missionUploadOperations.uploadDestinations || new Map()).entries()),
      },
      // Passive software system
      activePassiveSoftware,
      // Global Network System
      networkRegistry: networkRegistry.getSnapshot(),
    };

    saveToLocalStorage(username, gameState, saveName);
  }, [username, playerMailId, currentTime, hardware, software, bankAccounts, messages, managerName, windows,
    reputation, reputationCountdown, activeMission, completedMissions, availableMissions, missionCooldowns,
    activeConnections, lastScanResults, discoveredDevices, fileManagerConnections, lastFileOperation,
    downloadQueue, transactions, licensedSoftware, bankruptcyCountdown, lastInterestTime, bankingMessagesSent, reputationMessagesSent,
    proceduralMissionsEnabled, missionPool, pendingChainMissions, activeClientIds, clientStandings, extensionOffers, localSSDFiles,
    betterMessageRead, hardwareUnlockMessageSent, unlockedFeatures, pendingHardwareUpgrades, creditThresholdForDecryption, decryptionMessageSent,
    decryptionAlgorithms, missionDecryptionOperations, missionUploadOperations, activePassiveSoftware]);

  // Reboot system - also applies any pending hardware upgrades
  const rebootSystem = useCallback(() => {
    // Apply pending hardware upgrades if any
    if (Object.keys(pendingHardwareUpgrades).length > 0) {
      const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pendingHardwareUpgrades);
      setHardware(newHardware);
      setLastAppliedHardware(appliedUpgrades);
      setPendingHardwareUpgrades({});
      console.log('🔧 Applied pending hardware upgrades:', appliedUpgrades.map(u => u.item?.name || u.items?.map(i => i.name).join(', ')));
    } else {
      setLastAppliedHardware([]);
    }

    // Close all windows but keep all other state
    setWindows([]);
    // Mark that this is a reboot (for short boot animation)
    setIsRebooting(true);
    // Reset time speed and pause during reboot sequence
    setTimeSpeed(TIME_SPEEDS.NORMAL);
    setIsPaused(true);
    // Go to reboot animation phase
    setGamePhase('rebooting');
  }, [hardware, pendingHardwareUpgrades]);

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
    setMissionSubmitting(false);
    setCompletedMissions([]);
    setAvailableMissions([]);
    setMissionCooldowns({ easy: null, medium: null, hard: null });
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
    // Reset hardware unlock system
    setBetterMessageRead(false);
    setHardwareUnlockMessageSent(false);
    setUnlockedFeatures([]);
    setPendingHardwareUpgrades({});
    setLastAppliedHardware([]);
    // Reset future content tease system
    setCreditThresholdForDecryption(null);
    setDecryptionMessageSent(false);
    // Reset decryption system
    setDecryptionAlgorithms(['aes-128', 'aes-256']);
    setMissionDecryptionOperations({ decrypted: new Set() });
    setMissionUploadOperations({ uploaded: new Set(), uploadDestinations: new Map() });
    // Reset passive software
    setActivePassiveSoftware([]);
    // Reset ransomware lockout
    setRansomwareLockout(false);
    // Reset global network registry
    networkRegistry.clear();

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

  // Apply game state from a saved state object (used by loadGame and loadScenario)
  const applyGameState = useCallback((gameState) => {
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
        console.warn(`⚠️ Removing duplicate message ID '${msg.id}'`);
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

    // Restore local SSD files
    setLocalSSDFiles(gameState.localSSDFiles ?? []);

    // Restore hardware unlock system
    setBetterMessageRead(gameState.betterMessageRead ?? false);
    setHardwareUnlockMessageSent(gameState.hardwareUnlockMessageSent ?? false);
    setUnlockedFeatures(gameState.unlockedFeatures ?? []);
    setPendingHardwareUpgrades(gameState.pendingHardwareUpgrades ?? {});
    setLastAppliedHardware([]); // Don't restore - only set during reboot

    // Restore future content tease system
    setCreditThresholdForDecryption(gameState.creditThresholdForDecryption ?? null);
    setDecryptionMessageSent(gameState.decryptionMessageSent ?? false);

    // Restore decryption system
    setDecryptionAlgorithms(gameState.decryptionAlgorithms ?? ['aes-128', 'aes-256']);
    setMissionDecryptionOperations({
      decrypted: new Set(gameState.missionDecryptionOperations?.decrypted ?? []),
    });
    setMissionUploadOperations({
      uploaded: new Set(gameState.missionUploadOperations?.uploaded ?? []),
      uploadDestinations: new Map(gameState.missionUploadOperations?.uploadDestinations ?? []),
    });

    // Restore passive software
    setActivePassiveSoftware(gameState.activePassiveSoftware ?? []);

    // Restore global network registry
    if (gameState.networkRegistry) {
      networkRegistry.loadSnapshot(gameState.networkRegistry);
    } else {
      // No saved registry - clear it to ensure clean state
      networkRegistry.clear();
    }

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
  }, []);

  // Load game
  const loadGame = useCallback((usernameToLoad, saveIndex = null) => {
    const gameState = loadFromLocalStorage(usernameToLoad, saveIndex);

    if (!gameState) {
      return false;
    }

    applyGameState(gameState);
    return true;
  }, [applyGameState]);

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
    isRebooting,
    setIsRebooting,
    ransomwareLockout,
    setRansomwareLockout,
    hardware,
    setHardware,
    software,
    setSoftware,
    bankAccounts,
    setBankAccounts,
    updateBankBalance,
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
    missionFileOperations,
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
    addFilesToFileSystem,

    // Local SSD
    localSSDFiles,
    setLocalSSDFiles,
    addFileToLocalSSD,
    removeFileFromLocalSSD,
    replaceFileOnLocalSSD,

    // Decryption System
    decryptionAlgorithms,
    setDecryptionAlgorithms,
    missionDecryptionOperations,
    setMissionDecryptionOperations,
    missionUploadOperations,
    setMissionUploadOperations,

    // Passive Software
    activePassiveSoftware,
    startPassiveSoftware,

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

    // Hardware Unlock System
    betterMessageRead,
    setBetterMessageRead,
    hardwareUnlockMessageSent,
    setHardwareUnlockMessageSent,
    unlockedFeatures,
    setUnlockedFeatures,
    pendingHardwareUpgrades,
    setPendingHardwareUpgrades,
    lastAppliedHardware,

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
    dismissMission,
    completeMissionObjective,
    completeMission,
    submitMissionForCompletion,
    missionSubmitting,
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
    applyGameState,
    rebootSystem,
    resetGame,
    generateUsername,
    playAlarmSound,
    // Global Network System
    networkRegistry,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
