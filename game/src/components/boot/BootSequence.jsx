import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import './BootSequence.css';

const BootSequence = () => {
  const { setGamePhase, hardware, username } = useGame();
  const [bootLines, setBootLines] = useState([]);
  const [bootComplete, setBootComplete] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check if OS is already installed (subsequent boot)
    // Also check if any saves exist - if no saves AND no OS, definitely first boot
    const osInstalled = localStorage.getItem('osnet_installed') === 'true';
    const hasSaves = localStorage.getItem('sourcenet_saves') !== null;

    // If no saves exist, this is a brand new game - show full installation
    // Even if osnet_installed flag exists (might be from tests)
    const isFirstBoot = !hasSaves || !osInstalled;

    // Mark OS as installed for future boots
    if (isFirstBoot) {
      localStorage.setItem('osnet_installed', 'true');
    }

    const baseLines = [
      'OSNet BIOS v1.0',
      '==========================================',
      '',
      'Initializing hardware...',
      '',
      // Motherboard FIRST - everything else slots into it
      `Motherboard: ${hardware.motherboard.name} detected`,
      '',
      `CPU: ${hardware.cpu.name} detected`,
      `Memory: ${hardware.memory.map((m) => m.capacity).join(', ')} detected`,
      `Storage: ${hardware.storage.map((s) => s.capacity).join(', ')} detected`,
      `Power Supply: ${hardware.powerSupply.wattage}W`,
      `Network: ${hardware.network.name}`,
      '',
      'Performing checksum validation...',
      'Checksum: OK',
      '',
      'Power consumption check...',
      'Power: OK',
      '',
      'Network connection test...',
      `Speed: ${hardware.network.speed}Mb/s`,
      '',
    ];

    const osInstallationLines = [
      'Searching for operating system...',
      'No OS found on local storage.',
      '',
      'Searching network for available OS...',
      'Found: OSNet v1.0',
      '',
      'Beginning OS installation...',
      '',
      // Logo will be shown separately as full screen
      'SHOW_LOGO',  // Special marker
      '',
      'Installation complete!',
      'System will now continue to username setup...',
    ];

    const subsequentBootLines = [
      'Searching for operating system...',
      'OSNet v1.0 found.',
      '',
      'Loading OSNet...',
      'OSNet loaded successfully.',
      '',
    ];

    // Build complete boot sequence
    const lines = isFirstBoot
      ? [...baseLines, ...osInstallationLines]
      : [...baseLines, ...subsequentBootLines];

    // Timing: 300ms per line for first boot (~15s), 150ms for subsequent (~4s)
    const lineDelay = isFirstBoot ? 300 : 150;

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < lines.length) {
        const line = lines[currentIndex];

        // Check for logo marker
        if (line === 'SHOW_LOGO') {
          // Clear screen and show logo
          setBootLines([]);
          setShowLogo(true);

          // Start progress bar animation
          const progressInterval = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 100) {
                clearInterval(progressInterval);
                // Hide logo after progress complete
                setTimeout(() => {
                  setShowLogo(false);
                  setBootLines([]);
                }, 500);
                return 100;
              }
              return prev + 2; // Increment by 2% every interval
            });
          }, 50); // Update every 50ms for smooth animation
        } else {
          setBootLines((prev) => [...prev, line]);
        }

        currentIndex++;
      } else {
        setBootComplete(true);
        clearInterval(interval);
      }
    }, lineDelay);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bootComplete) {
      setTimeout(() => {
        // If username already exists (loading a save), go to desktop
        // Otherwise go to username selection (new game)
        setGamePhase(username ? 'desktop' : 'username');
      }, 2000);
    }
  }, [bootComplete, setGamePhase, username]);

  return (
    <div className="boot-screen">
      {showLogo ? (
        <div className="osnet-logo-screen">
          <div className="osnet-logo-large">
            <div className="logo-line">  ___  ____  _   _      _   </div>
            <div className="logo-line"> / _ \/ ___|| \ | | ___| |_ </div>
            <div className="logo-line">| | | \___ \|  \| |/ _ \ __|</div>
            <div className="logo-line">| |_| |___) | |\  |  __/ |_ </div>
            <div className="logo-line"> \___/|____/|_| \_|\___|\___|</div>
          </div>
          <div className="osnet-title">SourceNet Operating System</div>
          <div className="progress-bar-container">
            <div className="progress-bar-label">Installing...</div>
            <div className="progress-bar-outer">
              <div
                className="progress-bar-inner"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-bar-percent">{progress}%</div>
          </div>
        </div>
      ) : (
        bootLines.map((line, index) => (
          <div key={index} className="boot-line">
            {line}
          </div>
        ))
      )}
    </div>
  );
};

export default BootSequence;
