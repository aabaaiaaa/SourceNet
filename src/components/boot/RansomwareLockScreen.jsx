import { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import '../ui/GameOverOverlay.css';
import './RansomwareLockScreen.css';

const LOCK_SCREEN_LINES = [
  '',
  '    ██████╗  █████╗ ███╗   ██╗███████╗ ██████╗ ███╗   ███╗',
  '    ██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔═══██╗████╗ ████║',
  '    ██████╔╝███████║██╔██╗ ██║███████╗██║   ██║██╔████╔██║',
  '    ██╔══██╗██╔══██║██║╚██╗██║╚════██║██║   ██║██║╚██╔╝██║',
  '    ██║  ██║██║  ██║██║ ╚████║███████║╚██████╔╝██║ ╚═╝ ██║',
  '    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝',
  '',
  '         ╔═══════════════════════════════════════╗',
  '         ║      ☠  YOUR SYSTEM IS LOCKED  ☠      ║',
  '         ╚═══════════════════════════════════════╝',
  '',
  '  ┌─────────────────────────────────────────────────┐',
  '  │  ENCRYPTION DETAILS                              │',
  '  │                                                  │',
  '  │  Algorithm:    AES-256-CBC                       │',
  '  │  Files locked: ALL (90 GB)                       │',
  '  │  Status:       COMPLETE                          │',
  '  └─────────────────────────────────────────────────┘',
  '',
  '  All files on this workstation have been encrypted.',
  '  Your operating system has been locked.',
  '',
  '  To recover your files, transfer 5,000,000 credits to:',
  '  Sender ID: PHANTOM-X-4F2A',
  '',
  '  ─────────────────────────────────────────────────',
];

const RansomwareLockScreen = ({ onLoadSave, onNewGame }) => {
  const { setRansomwareLockout, setGamePhase, setIsPaused } = useGame();
  const [visibleLines, setVisibleLines] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [showError, setShowError] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [textComplete, setTextComplete] = useState(false);
  const inputRef = useRef(null);
  const gameOverTimerRef = useRef(null);

  // Typewriter effect - render lines ~80ms per line (real time)
  useEffect(() => {
    if (visibleLines >= LOCK_SCREEN_LINES.length) {
      setTextComplete(true);
      return;
    }

    const timer = setTimeout(() => {
      setVisibleLines(prev => prev + 1);
    }, 80);

    return () => clearTimeout(timer);
  }, [visibleLines]);

  // Show game over modal 3 real seconds after text completes
  useEffect(() => {
    if (!textComplete) return;

    gameOverTimerRef.current = setTimeout(() => {
      setShowGameOver(true);
    }, 3000);

    return () => {
      if (gameOverTimerRef.current) {
        clearTimeout(gameOverTimerRef.current);
      }
    };
  }, [textComplete]);

  // Focus input when it appears
  useEffect(() => {
    if (textComplete && inputRef.current) {
      inputRef.current.focus();
    }
  }, [textComplete]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (inputValue.trim().toLowerCase() === 'rosebud') {
      // Correct key - clear lockout, unpause, and go to desktop
      setRansomwareLockout(false);
      setIsPaused(false);
      triggerEventBus.emit('ransomwareDecrypted', {});
      setGamePhase('desktop');
    } else {
      // Wrong key - shake animation + error message
      setShakeInput(true);
      setShowError(true);
      setInputValue('');

      setTimeout(() => {
        setShakeInput(false);
      }, 500);

      setTimeout(() => {
        setShowError(false);
      }, 1500);
    }
  };

  return (
    <div className="ransomware-lock-screen">
      <div className="lock-screen-content">
        {LOCK_SCREEN_LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} className="lock-screen-line">
            {line || '\u00A0'}
          </div>
        ))}

        {textComplete && (
          <form onSubmit={handleSubmit} className="lock-screen-terminal">
            <div className={`terminal-input-row ${shakeInput ? 'shake' : ''}`}>
              <span className="terminal-prompt">ENTER DECRYPTION KEY: </span>
              <input
                ref={inputRef}
                type="text"
                className="terminal-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            {showError && (
              <div className="terminal-error">INVALID KEY</div>
            )}
          </form>
        )}
      </div>

      {showGameOver && (
        <div className="ransomware-game-over-overlay">
          <div className="ransomware-game-over-modal game-over-modal">
            <div className="game-over-header">
              <h1>SYSTEM COMPROMISED</h1>
            </div>
            <div className="game-over-content">
              <p>
                Your workstation has been fully encrypted by ransomware.
                All files and system access have been locked.
                The attack was triggered by a trap file planted by the original attackers.
              </p>
            </div>
            <div className="game-over-actions">
              <button className="game-over-btn primary-btn" onClick={onLoadSave}>
                Load Previous Save
              </button>
              <button className="game-over-btn secondary-btn" onClick={onNewGame}>
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RansomwareLockScreen;
