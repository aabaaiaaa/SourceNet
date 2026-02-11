import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import './BootSequence.css';

const BootSequence = () => {
  const { setGamePhase, hardware, username, isRebooting, setIsRebooting, setIsPaused, lastAppliedHardware, setLastAppliedHardware, ransomwareLockout } = useGame();
  const [bootLines, setBootLines] = useState([]);
  const [bootComplete, setBootComplete] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Determine boot type based on context:
    // - Rebooting → short boot (system already set up)
    // - Loading save (username exists) → short boot (OS already installed in save)
    // - New game (no username) → long boot (fresh OS installation)
    const isFirstBoot = !isRebooting && !username;

    // Clear reboot flag immediately (consumed)
    if (isRebooting) {
      setIsRebooting(false);
    }

    // Check if new hardware was just applied
    const hasNewHardware = lastAppliedHardware && Object.keys(lastAppliedHardware).length > 0;

    // Clear the last applied hardware after we've consumed it
    if (hasNewHardware) {
      // Delay clearing so we can show the message
      setTimeout(() => setLastAppliedHardware({}), 100);
    }

    console.log('[BootSequence] isRebooting:', isRebooting, 'username:', username, 'isFirstBoot:', isFirstBoot, 'hasNewHardware:', hasNewHardware);

    // Build new hardware detection lines
    const newHardwareLines = [];
    if (hasNewHardware) {
      newHardwareLines.push('');
      newHardwareLines.push('╔══════════════════════════════════════════╗');
      newHardwareLines.push('║      ★★★ NEW HARDWARE DETECTED ★★★      ║');
      newHardwareLines.push('╚══════════════════════════════════════════╝');
      newHardwareLines.push('');

      // List each new component by category
      for (const [category, item] of Object.entries(lastAppliedHardware)) {
        const categoryLabels = {
          processors: 'CPU',
          memory: 'Memory',
          storage: 'Storage',
          motherboards: 'Motherboard',
          powerSupplies: 'Power Supply',
          network: 'Network Adapter'
        };
        const label = categoryLabels[category] || category;
        newHardwareLines.push(`  Installing: ${label} - ${item.name}`);
      }
      newHardwareLines.push('');
      newHardwareLines.push('Hardware installation complete!');
      newHardwareLines.push('');
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
      ...newHardwareLines,
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
  }, [hardware, username, isRebooting, setIsRebooting, lastAppliedHardware, setLastAppliedHardware]);

  useEffect(() => {
    if (bootComplete) {
      setTimeout(() => {
        // Unpause the game when boot completes
        setIsPaused(false);

        // If ransomware lockout, go to lock screen instead of desktop
        if (ransomwareLockout) {
          setGamePhase('gameOver-ransomware');
        } else if (username) {
          // If username already exists (loading a save), go to desktop
          setGamePhase('desktop');
        } else {
          // Otherwise go to username selection (new game)
          setGamePhase('username');
        }
      }, 2000);
    }
  }, [bootComplete, setGamePhase, username, setIsPaused, ransomwareLockout]);

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
