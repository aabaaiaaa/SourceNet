/**
 * Debug Scenarios - Pre-configured game states for testing
 *
 * 9 scenarios covering different game states from fresh start to high performer
 */

import { isDebugMode } from './debugSystem';

export const DEBUG_SCENARIOS = {
  freshStart: {
    name: 'Fresh Start',
    description: '1,000 credits, Superb rep, no missions',
    state: {
      credits: 1000,
      reputation: 9,
      software: ['osnet', 'portal', 'mail', 'banking'],
      activeMission: null,
      completedMissions: [],
      transactions: [],
      time: '2020-03-25T09:00:00.000Z',
    },
  },

  tutorialPart1Failed: {
    name: 'Tutorial Part 1 Failed',
    description: '-9,000 credits, Accident Prone, Tutorial Part 2 available',
    state: {
      credits: -9000,
      reputation: 3,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      activeMission: null,
      completedMissions: [
        {
          id: 'tutorial-part-1',
          title: 'Log File Repair',
          status: 'failed',
          payout: -10000,
          reputationChange: -6,
        },
      ],
      transactions: [
        { type: 'income', amount: 1000, description: 'Welcome Bonus' },
        { type: 'expense', amount: -10000, description: 'Mission Failure Penalty' },
      ],
      time: '2020-03-25T11:30:00.000Z',
    },
  },

  postTutorial: {
    name: 'Post-Tutorial (In Debt)',
    description: '-8,000 credits, Accident Prone, missions available',
    state: {
      credits: -8000,
      reputation: 3,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      completedMissions: [
        { id: 'tutorial-part-1', status: 'failed', payout: -10000 },
        { id: 'tutorial-part-2', status: 'success', payout: 1000 },
      ],
      time: '2020-03-25T12:00:00.000Z',
    },
  },

  midGameRecovering: {
    name: 'Mid-Game (Recovering)',
    description: '-2,000 credits, Can Work With Help, progressing',
    state: {
      credits: -2000,
      reputation: 4,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      completedMissions: Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `mission-${i}`,
          status: 'success',
          payout: 1000,
        })),
      time: '2020-03-26T10:00:00.000Z',
    },
  },

  outOfDebt: {
    name: 'Out of Debt',
    description: '+5,000 credits, Reliable, missions completed',
    state: {
      credits: 5000,
      reputation: 7,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      completedMissions: Array(15)
        .fill(null)
        .map((_, i) => ({
          id: `mission-${i}`,
          status: 'success',
        })),
      time: '2020-03-28T14:00:00.000Z',
    },
  },

  highPerformer: {
    name: 'High Performer',
    description: '+50,000 credits, Ace Agent, many missions completed',
    state: {
      credits: 50000,
      reputation: 10,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      completedMissions: Array(25)
        .fill(null)
        .map((_, i) => ({
          id: `mission-${i}`,
          status: 'success',
        })),
      time: '2020-04-10T16:00:00.000Z',
    },
  },

  nearBankruptcy: {
    name: 'Near Bankruptcy',
    description: '-10,500 credits, countdown active, 2 mins remaining',
    state: {
      credits: -10500,
      reputation: 3,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      bankruptcyCountdown: {
        startTime: '2020-03-25T15:00:00.000Z',
        endTime: '2020-03-25T15:05:00.000Z',
        remaining: 120,
      },
      time: '2020-03-25T15:03:00.000Z',
    },
  },

  nearTermination: {
    name: 'Near Termination',
    description: 'Should Be Let Go (Tier 1), 5 mins remaining',
    state: {
      credits: 500,
      reputation: 1,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      reputationCountdown: {
        startTime: '2020-03-26T09:00:00.000Z',
        endTime: '2020-03-26T09:10:00.000Z',
        remaining: 300,
      },
      time: '2020-03-26T09:05:00.000Z',
    },
  },

  starEmployee: {
    name: 'Star Employee',
    description: '+100,000 credits, Star Employee (Tier 11), elite status',
    state: {
      credits: 100000,
      reputation: 11,
      software: [
        'osnet',
        'portal',
        'mail',
        'banking',
        'mission-board',
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
      ],
      completedMissions: Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `mission-${i}`,
          status: 'success',
        })),
      time: '2020-05-15T10:00:00.000Z',
    },
  },
};

/**
 * Load a debug scenario
 * @param {string} scenarioId - Scenario ID (key from DEBUG_SCENARIOS)
 * @param {object} gameContext - Game context with setters
 */
export const loadScenario = (scenarioId, gameContext) => {
  if (!isDebugMode()) {
    console.warn('Debug system only available in development mode');
    return;
  }

  const scenario = DEBUG_SCENARIOS[scenarioId];
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioId}`);
    return;
  }

  console.log(`🔧 Loading debug scenario: ${scenario.name}`);

  // Apply scenario state
  const { state } = scenario;

  // Update bank accounts
  if (state.credits !== undefined) {
    const newAccounts = [...gameContext.bankAccounts];
    if (newAccounts[0]) {
      newAccounts[0].balance = state.credits;
    }
    gameContext.setBankAccounts(newAccounts);
  }

  // Update other state
  if (state.reputation !== undefined) gameContext.setReputation(state.reputation);
  if (state.software !== undefined) gameContext.setSoftware(state.software);
  if (state.activeMission !== undefined) gameContext.setActiveMission(state.activeMission);
  if (state.completedMissions !== undefined) gameContext.setCompletedMissions(state.completedMissions);
  if (state.transactions !== undefined) gameContext.setTransactions(state.transactions);
  if (state.bankruptcyCountdown !== undefined) gameContext.setBankruptcyCountdown(state.bankruptcyCountdown);
  if (state.reputationCountdown !== undefined) gameContext.setReputationCountdown(state.reputationCountdown);
  if (state.time !== undefined) gameContext.setCurrentTime(new Date(state.time));

  console.log(`✅ Debug scenario loaded: ${scenario.name}`);
};

// Expose to window for browser console access (dev mode only)
if (isDebugMode()) {
  window.debugLoadScenario = (scenarioId, gameContext) => loadScenario(scenarioId, gameContext);
  window.debugScenarios = DEBUG_SCENARIOS;
}

export default { isDebugMode, setGameState, loadScenario, DEBUG_SCENARIOS };
