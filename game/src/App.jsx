import { GameProvider } from './contexts/GameContext';
import './styles/main.css';

function App() {
  return (
    <GameProvider>
      <div className="game-container">
        <h1>SourceNet - Phase 1</h1>
        <p>Game infrastructure is being built...</p>
        <p>Core systems implemented:</p>
        <ul>
          <li>✓ Game state management (GameContext)</li>
          <li>✓ Time system (1x/10x speeds)</li>
          <li>✓ Save/load system (localStorage)</li>
          <li>✓ Window management logic</li>
          <li>✓ Message system</li>
          <li>✓ Banking system with cheque deposits</li>
        </ul>
        <p>Next: UI components, Boot sequence, Applications</p>
      </div>
    </GameProvider>
  );
}

export default App;
