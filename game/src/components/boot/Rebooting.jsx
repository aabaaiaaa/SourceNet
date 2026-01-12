import { useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import './Rebooting.css';

const Rebooting = () => {
  const { setGamePhase } = useGame();

  useEffect(() => {
    // Check for skipBoot parameter (E2E tests)
    const urlParams = new URLSearchParams(window.location.search);
    const skipBoot = urlParams.get('skipBoot') === 'true';

    if (skipBoot) {
      // Skip straight to desktop on reboot (E2E tests)
      setGamePhase('desktop');
      return;
    }

    // Show "Rebooting..." for 2 seconds
    const timer = setTimeout(() => {
      // Fade to black for 1 second, then start boot
      setGamePhase('boot');
    }, 2000);

    return () => clearTimeout(timer);
  }, [setGamePhase]);

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
