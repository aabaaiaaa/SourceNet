import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../../contexts/useGame';
import { PASSWORD_HASH_TYPES, CPU_CRACK_MULTIPLIERS } from '../../constants/gameConstants';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../../core/gameTimeScheduler';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import './PasswordCracker.css';

// Common dictionary words for visual scrolling effect
const DICTIONARY_WORDS = [
  'password', '123456', 'qwerty', 'letmein', 'dragon', 'master',
  'monkey', 'shadow', 'sunshine', 'princess', 'football', 'charlie',
  'access', 'welcome', 'login', 'admin', 'passw0rd', 'trustno1',
  'iloveyou', 'batman', 'starwars', 'hello', 'freedom', 'whatever',
];

// Auto-clear delay after successful crack (ms)
const SUCCESS_DISPLAY_MS = 2000;

const PasswordCracker = () => {
  const {
    activeConnections,
    discoveredDevices,
    hardware,
    software,
    timeSpeed,
    currentTime,
    localSSDFiles,
    replaceFileOnLocalSSD,
  } = useGame();

  const [selectedSource, setSelectedSource] = useState('local'); // 'local' or fileSystemId
  const [selectedFile, setSelectedFile] = useState(null);
  const [attackMethod, setAttackMethod] = useState('dictionary');
  const [cracking, setCracking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrollingWords, setScrollingWords] = useState([]);
  const [combinationsTested, setCombinationsTested] = useState(0);
  const [result, setResult] = useState(null); // null | 'success' | 'failed'
  const [statusMessage, setStatusMessage] = useState('');

  const crackTimerRef = useRef(null);
  const wordScrollRef = useRef(null);
  const crackStartGameTimeRef = useRef(null);
  const crackDurationRef = useRef(null);
  const successClearTimerRef = useRef(null);

  // Check which packs are installed
  const hasDictionaryCommon = software.includes('dictionary-pack-common');
  const hasDictionaryExtended = software.includes('dictionary-pack-extended');
  const hasRainbowMd5 = software.includes('rainbow-table-md5');
  const hasRainbowSha256 = software.includes('rainbow-table-sha256');

  // Get CPU multiplier
  const cpuMultiplier = CPU_CRACK_MULTIPLIERS[hardware?.cpu?.id] || 1;

  // Build list of available file system sources (like FileManager)
  const sources = (() => {
    const list = [];

    // Check local SSD for password-protected files
    const localProtected = (localSSDFiles || []).some(f => f.passwordProtected);
    if (localProtected) {
      list.push({ id: 'local', name: 'Local SSD', type: 'local' });
    }

    // Check remote file systems from connected networks
    (activeConnections || []).forEach(conn => {
      const network = networkRegistry.getNetwork(conn.networkId);
      const discoveredData = (discoveredDevices || {})[conn.networkId];
      const discovered = discoveredData instanceof Set ? discoveredData : new Set(discoveredData || []);

      if (network && network.accessible) {
        const accessibleDevices = networkRegistry.getAccessibleDevices(conn.networkId);
        accessibleDevices.forEach(device => {
          // Only show discovered devices
          if (!discovered.has(device.ip)) return;

          // Get file systems for this device
          const deviceFileSystems = networkRegistry.getDeviceFileSystems(device.ip);
          deviceFileSystems.forEach(fs => {
            // Only show file systems with password-protected files
            const hasProtected = (fs.files || []).some(f => f.passwordProtected);
            if (!hasProtected) return;

            list.push({
              id: fs.id,
              name: `${fs.name || device.hostname} (${device.ip})`,
              type: 'remote',
              networkId: conn.networkId,
            });
          });
        });
      }
    });

    return list;
  })();

  // Auto-select first valid source when current selection is invalid (J1)
  useEffect(() => {
    if (sources.length > 0 && !sources.find(s => s.id === selectedSource)) {
      setSelectedSource(sources[0].id);
    }
  }, [sources.length, selectedSource]);

  // Get password-protected files from selected source
  const getAvailableFiles = useCallback(() => {
    const files = [];

    if (selectedSource === 'local') {
      (localSSDFiles || []).forEach(f => {
        if (f.passwordProtected) {
          files.push({ ...f, source: 'local', sourceLabel: 'Local SSD' });
        }
      });
    } else {
      // selectedSource is a fileSystemId
      const fs = networkRegistry.getFileSystem(selectedSource);
      if (fs) {
        (fs.files || []).forEach(f => {
          if (f.passwordProtected) {
            files.push({
              ...f,
              source: 'remote',
              sourceLabel: fs.name || fs.hostname,
              fileSystemId: selectedSource,
            });
          }
        });
      }
    }

    return files;
  }, [selectedSource, localSSDFiles]);

  // Can the selected attack method work on this file?
  const canUseMethod = useCallback((method, file) => {
    if (!file) return false;
    const hashType = PASSWORD_HASH_TYPES[file.hashType];
    if (!hashType) return false;

    switch (method) {
      case 'dictionary':
        return (hasDictionaryCommon || hasDictionaryExtended) && hashType.dictionaryEffective;
      case 'bruteforce':
        return true; // Always available, just slow
      case 'rainbow':
        if (hashType.bruteForceOnly) return false;
        if (file.hashType === 'md5') return hasRainbowMd5;
        if (file.hashType === 'sha256') return hasRainbowSha256;
        return false;
      default:
        return false;
    }
  }, [hasDictionaryCommon, hasDictionaryExtended, hasRainbowMd5, hasRainbowSha256]);

  // Calculate crack duration based on method, hash type, and CPU
  const calculateCrackDuration = useCallback((method, file) => {
    if (!file) return Infinity;
    const hashType = PASSWORD_HASH_TYPES[file.hashType];
    if (!hashType) return Infinity;

    let baseTime = hashType.baseTimeMs;

    switch (method) {
      case 'dictionary':
        baseTime *= 0.3; // Dictionary is fastest
        if (hasDictionaryExtended) baseTime *= 0.5; // Extended dict is even faster
        break;
      case 'bruteforce':
        baseTime *= (hashType.bruteForceOnly ? 3 : 2); // Brute force is slow
        break;
      case 'rainbow':
        baseTime *= 0.1; // Rainbow tables are very fast
        break;
    }

    // CPU multiplier speeds things up
    return Math.max(2000, baseTime / cpuMultiplier);
  }, [cpuMultiplier, hasDictionaryExtended]);

  // Drive progress from game time (synced with game speed changes)
  useEffect(() => {
    if (!cracking || !currentTime || crackStartGameTimeRef.current == null || !crackDurationRef.current) return;
    const elapsed = currentTime.getTime() - crackStartGameTimeRef.current;
    const pct = Math.min(99, (elapsed / crackDurationRef.current) * 100);
    setProgress(pct);
    setCombinationsTested(Math.floor(pct * 1000 * cpuMultiplier));
  }, [cracking, currentTime, cpuMultiplier]);

  // Start cracking
  const startCrack = useCallback(() => {
    if (!selectedFile || cracking) return;

    const duration = calculateCrackDuration(attackMethod, selectedFile);
    setCracking(true);
    setProgress(0);
    setResult(null);
    setCombinationsTested(0);
    crackStartGameTimeRef.current = currentTime.getTime();
    crackDurationRef.current = duration;
    setStatusMessage(`Cracking ${selectedFile.name} using ${attackMethod} attack...`);

    // Visual word scrolling for dictionary attack
    if (attackMethod === 'dictionary') {
      const scrollInterval = setInterval(() => {
        setScrollingWords(prev => {
          const newWord = DICTIONARY_WORDS[Math.floor(Math.random() * DICTIONARY_WORDS.length)];
          const updated = [...prev, newWord].slice(-8);
          return updated;
        });
      }, 100);
      wordScrollRef.current = scrollInterval;
    }

    // Schedule completion via game time
    crackTimerRef.current = scheduleGameTimeCallback(() => {
      setCracking(false);
      setProgress(100);
      setResult('success');
      setStatusMessage(`Password cracked! File unlocked: ${selectedFile.name}`);

      // Clear the word scrolling
      if (wordScrollRef.current) {
        clearInterval(wordScrollRef.current);
        wordScrollRef.current = null;
      }

      // Emit event for mission tracking
      triggerEventBus.emit('passwordCracked', {
        fileName: selectedFile.name,
        hashType: selectedFile.hashType,
        method: attackMethod,
        source: selectedFile.source,
        fileSystemId: selectedFile.fileSystemId,
      });

      // Update the file to remove passwordProtected flag
      if (selectedFile.source === 'local') {
        const unlockedFile = { ...selectedFile, passwordProtected: false };
        delete unlockedFile.source;
        delete unlockedFile.sourceLabel;
        replaceFileOnLocalSSD(selectedFile.name, unlockedFile);
      } else if (selectedFile.fileSystemId) {
        // Update remote file system
        const fsData = networkRegistry.getFileSystem(selectedFile.fileSystemId);
        if (fsData) {
          const updatedFiles = fsData.files.map(f =>
            f.name === selectedFile.name ? { ...f, passwordProtected: false } : f
          );
          networkRegistry.updateFiles(selectedFile.fileSystemId, updatedFiles);
        }
      }

      // Auto-clear after success display (E2: no "Crack Another File" button)
      successClearTimerRef.current = setTimeout(() => {
        setSelectedFile(null);
        setResult(null);
        setProgress(0);
        setStatusMessage('');
      }, SUCCESS_DISPLAY_MS);
    }, duration, timeSpeed);
  }, [selectedFile, cracking, attackMethod, calculateCrackDuration, timeSpeed, currentTime, cpuMultiplier, replaceFileOnLocalSSD]);

  // Cancel cracking
  const cancelCrack = useCallback(() => {
    if (crackTimerRef.current) {
      clearGameTimeCallback(crackTimerRef.current);
      crackTimerRef.current = null;
    }
    if (wordScrollRef.current) {
      clearInterval(wordScrollRef.current);
      wordScrollRef.current = null;
    }
    crackStartGameTimeRef.current = null;
    crackDurationRef.current = null;
    setCracking(false);
    setProgress(0);
    setCombinationsTested(0);
    setResult(null);
    setStatusMessage('Crack cancelled.');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (crackTimerRef.current) clearGameTimeCallback(crackTimerRef.current);
      if (wordScrollRef.current) clearInterval(wordScrollRef.current);
      if (successClearTimerRef.current) clearTimeout(successClearTimerRef.current);
    };
  }, []);

  const availableFiles = getAvailableFiles();

  return (
    <div className="password-cracker">
      <div className="pc-header">
        <h2>Password Cracker</h2>
        <p className="pc-subtitle">Crack password-protected files</p>
      </div>

      {/* Source Selection */}
      <div className="pc-section">
        <h3>File Source</h3>
        {sources.length > 0 ? (
          <select
            className="pc-dropdown"
            value={selectedSource}
            onChange={(e) => {
              setSelectedSource(e.target.value);
              setSelectedFile(null);
              setResult(null);
            }}
            disabled={cracking}
          >
            {sources.map(src => (
              <option key={src.id} value={src.id}>{src.name}</option>
            ))}
          </select>
        ) : (
          <div className="pc-empty">No sources with password-protected files available.</div>
        )}
      </div>

      {/* File Selection */}
      <div className="pc-section">
        <h3>Target File</h3>
        {availableFiles.length > 0 ? (
          <div className="pc-file-list">
            {availableFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className={`pc-file-item ${selectedFile?.name === file.name ? 'selected' : ''}`}
                onClick={() => !cracking && setSelectedFile(file)}
              >
                <span className="pc-file-name">{file.name}</span>
                <span className="pc-file-hash">{PASSWORD_HASH_TYPES[file.hashType]?.name || file.hashType}</span>
                <span className="pc-file-size">{file.size}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="pc-empty">No password-protected files found in this source.</div>
        )}
      </div>

      {/* Attack Method */}
      {selectedFile && (
        <div className="pc-section">
          <h3>Attack Method</h3>
          <div className="pc-methods">
            <button
              className={`pc-method-btn ${attackMethod === 'dictionary' ? 'active' : ''}`}
              onClick={() => setAttackMethod('dictionary')}
              disabled={cracking || !canUseMethod('dictionary', selectedFile)}
              title={!canUseMethod('dictionary', selectedFile) ? 'Requires dictionary pack and weak hash type' : 'Fast, works on weak passwords'}
            >
              Dictionary
              {!canUseMethod('dictionary', selectedFile) && <span className="pc-method-locked">N/A</span>}
            </button>
            <button
              className={`pc-method-btn ${attackMethod === 'bruteforce' ? 'active' : ''}`}
              onClick={() => setAttackMethod('bruteforce')}
              disabled={cracking}
              title="Slow but guaranteed. CPU-dependent."
            >
              Brute Force
            </button>
            <button
              className={`pc-method-btn ${attackMethod === 'rainbow' ? 'active' : ''}`}
              onClick={() => setAttackMethod('rainbow')}
              disabled={cracking || !canUseMethod('rainbow', selectedFile)}
              title={!canUseMethod('rainbow', selectedFile) ? 'Requires matching rainbow table' : 'Very fast lookup'}
            >
              Rainbow Table
              {!canUseMethod('rainbow', selectedFile) && <span className="pc-method-locked">N/A</span>}
            </button>
          </div>
        </div>
      )}

      {/* Crack Progress */}
      {(cracking || result) && (
        <div className="pc-section pc-progress-section">
          <h3>Progress</h3>

          {/* Dictionary word scrolling */}
          {cracking && attackMethod === 'dictionary' && (
            <div className="pc-word-scroll">
              {scrollingWords.map((word, i) => (
                <span key={i} className="pc-scroll-word">{word}</span>
              ))}
            </div>
          )}

          {/* Brute force counter */}
          {cracking && attackMethod === 'bruteforce' && (
            <div className="pc-combinations">
              Combinations tested: {combinationsTested.toLocaleString()}
            </div>
          )}

          {/* Rainbow table lookup */}
          {cracking && attackMethod === 'rainbow' && (
            <div className="pc-rainbow-status">
              Looking up hash in rainbow table...
            </div>
          )}

          {/* Progress bar */}
          <div className="pc-progress-bar">
            <div
              className={`pc-progress-fill ${result === 'success' ? 'success' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="pc-progress-text">{Math.floor(progress)}%</div>

          {/* Status */}
          <div className={`pc-status ${result === 'success' ? 'success' : ''}`}>
            {statusMessage}
          </div>

          {/* CPU info */}
          <div className="pc-cpu-info">
            CPU: {hardware?.cpu?.name || 'Unknown'} ({cpuMultiplier}x speed)
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pc-actions">
        {!cracking && !result && selectedFile && (
          <button
            className="pc-start-btn"
            onClick={startCrack}
            disabled={!canUseMethod(attackMethod, selectedFile) && attackMethod !== 'bruteforce'}
          >
            Start Crack
          </button>
        )}
        {cracking && (
          <button className="pc-cancel-btn" onClick={cancelCrack}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default PasswordCracker;
