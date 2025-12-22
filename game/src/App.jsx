import { GameProvider } from './contexts/GameContext';
import GameRoot from './components/GameRoot';
import './styles/main.css';

function App() {
  return (
    <GameProvider>
      <GameRoot />
    </GameProvider>
  );
}

export default App;
