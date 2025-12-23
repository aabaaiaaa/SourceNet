import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import './BootSequence.css';

const BootSequence = () => {
  const { setGamePhase, hardware } = useGame();
  const [bootLines, setBootLines] = useState([]);
  const [bootComplete, setBootComplete] = useState(false);

  useEffect(() => {
    // Check if OS is already installed (subsequent boot)
    const osInstalled = localStorage.getItem('osnet_installed') === 'true';
    const isFirstBoot = !osInstalled;

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
      `CPU: ${hardware.cpu.name} detected`,
      `Memory: ${hardware.memory.map((m) => m.capacity).join(', ')} detected`,
      `Storage: ${hardware.storage.map((s) => s.capacity).join(', ')} detected`,
      `Motherboard: ${hardware.motherboard.name}`,
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
      '  ___  ____  _   _      _   ',
      ' / _ \\/ ___|| \\ | | ___| |_ ',
      '| | | \\___ \\|  \\| |/ _ \\ __|',
      '| |_| |___) | |\\  |  __/ |_ ',
      ' \\___/|____/|_| \\_|\\___|\\__|',
      '',
      'SourceNet Operating System',
      '',
      'Installing... [##########] 100%',
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
        setBootLines((prev) => [...prev, lines[currentIndex]]);
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
        setGamePhase('username');
      }, 2000);
    }
  }, [bootComplete]);

  return (
    <div className="boot-screen">
      {bootLines.map((line, index) => (
        <div key={index} className="boot-line">
          {line}
        </div>
      ))}
    </div>
  );
};

export default BootSequence;
