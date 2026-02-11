import { useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import './Rebooting.css';

const Rebooting = () => {
  const { setGamePhase, ransomwareLockout } = useGame();

  useEffect(() => {
    // Check for skipBoot parameter or scenario (E2E tests)
    const urlParams = new URLSearchParams(window.location.search);
    const skipBoot = urlParams.get('skipBoot') === 'true';
    const hasScenario = urlParams.get('scenario');

    if (skipBoot || hasScenario) {
      // If ransomware lockout, go to lock screen instead of desktop
      if (ransomwareLockout) {
        setGamePhase('gameOver-ransomware');
      } else {
        setGamePhase('desktop');
      }
      return;
    }

    // Show "Rebooting..." for 2 seconds
    const timer = setTimeout(() => {
      // Fade to black for 1 second, then start boot
      setGamePhase('boot');
    }, 2000);

    return () => clearTimeout(timer);
  }, [setGamePhase, ransomwareLockout]);

  return (
    <div className="rebooting-screen">
      <div className="rebooting-message">
        <div className="rebooting-text">Rebooting</div>
        <div className="rebooting-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </div>
      </div>
    </div>
  );
};

export default Rebooting;
