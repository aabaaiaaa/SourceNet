import { useGame } from '../../contexts/GameContext';
import TopBar from './TopBar';
import Window from './Window';
import MinimizedWindowBar from './MinimizedWindowBar';
import './Desktop.css';

const Desktop = () => {
  const { windows } = useGame();

  return (
    <div className="desktop">
      <TopBar />

      <div className="desktop-content">
        {/* OSNet logo watermark will be in CSS background */}
        {windows
          .filter((w) => !w.minimized)
          .map((window) => (
            <Window key={window.appId} window={window} />
          ))}
      </div>

      <MinimizedWindowBar />
    </div>
  );
};

export default Desktop;
