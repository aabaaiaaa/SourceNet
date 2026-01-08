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

import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { DEBUG_SCENARIOS, loadScenario } from './scenarios';
import './DebugPanel.css';

const DebugPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('scenarios');
  const [creditsInput, setCreditsInput] = useState('');
  const [reputationInput, setReputationInput] = useState('');
  const gameContext = useGame();

  const handleLoadScenario = (scenarioId) => {
    loadScenario(scenarioId, gameContext);
    alert(`Scenario loaded: ${DEBUG_SCENARIOS[scenarioId].name}`);
  };

  // Set credits by updating bank account balance (triggers banking message system)
  const handleSetCredits = () => {
    const newCredits = parseInt(creditsInput, 10);
    if (isNaN(newCredits)) return;

    const newAccounts = [...gameContext.bankAccounts];
    if (newAccounts[0]) {
      newAccounts[0].balance = newCredits;
    }
    gameContext.setBankAccounts(newAccounts);
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

  const renderScenariosTab = () => {
    return (
      <div className="debug-scenarios">
        <h3>Quick Load Scenarios</h3>
        <p className="debug-hint">Load pre-configured game states for testing</p>

        <div className="scenarios-grid">
          {Object.keys(DEBUG_SCENARIOS).map((key) => {
            const scenario = DEBUG_SCENARIOS[key];
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

  return (
    <div className="debug-panel-overlay">
      <div className="debug-panel">
        <div className="debug-header">
          <h2>🔧 Debug Panel</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

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
        </div>

        <div className="debug-content">
          {activeTab === 'scenarios' && renderScenariosTab()}
          {activeTab === 'state' && renderGameStateTab()}
        </div>

        <div className="debug-footer">
          <p className="debug-warning">⚠️ Development Mode Only - Changes not saved unless you use Save Game</p>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;
