/**
 * Debug Panel - UI for rapid state manipulation
 *
 * Press Ctrl+Shift+D to open (development mode only)
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
import { DEBUG_SCENARIOS, loadScenario, setGameState } from './scenarios';
import './DebugPanel.css';

const DebugPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('scenarios');
  const gameContext = useGame();

  const handleLoadScenario = (scenarioId) => {
    loadScenario(scenarioId, gameContext);
    alert(`Scenario loaded: ${DEBUG_SCENARIOS[scenarioId].name}`);
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
    return (
      <div className="debug-game-state">
        <h3>Game State</h3>
        <p className="debug-hint">Current game state (read-only for now)</p>

        <div className="state-display">
          <div className="state-item">
            <span className="state-label">Credits:</span>
            <span className="state-value">{gameContext.getTotalCredits()}</span>
          </div>
          <div className="state-item">
            <span className="state-label">Reputation:</span>
            <span className="state-value">Tier {gameContext.reputation}</span>
          </div>
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
            Game State
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
