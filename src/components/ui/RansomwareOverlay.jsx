import { useState, useRef, useEffect, useCallback } from 'react';
import './RansomwareOverlay.css';

const RansomwareOverlay = ({
  duration = 60000,
  capacity = 90,
  paused = false,
  cleaning = false,
  cleanupProgress = 0,
  onComplete,
  onCleanupComplete,
  _timeSpeed = 1,
  currentTime,
  pausedZIndex,
}) => {
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState({ x: 200, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [fading, setFading] = useState(false);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const startTimeRef = useRef(null);
  const animationRef = useRef(null);
  const currentTimeRef = useRef(currentTime);
  const completedRef = useRef(false);

  // Keep currentTimeRef up to date
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Initialize start time
  useEffect(() => {
    if (currentTime && !startTimeRef.current) {
      startTimeRef.current = currentTime.getTime();
    }
  }, [currentTime]);

  // Animate progress
  useEffect(() => {
    if (paused || !startTimeRef.current || completedRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = () => {
      const now = currentTimeRef.current.getTime();
      const elapsed = now - startTimeRef.current;
      const newProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(newProgress);

      if (newProgress >= 100 && !completedRef.current) {
        completedRef.current = true;
        if (onComplete) onComplete();
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [paused, duration, onComplete]);

  // Handle cleanup completion -> fade out
  const fadeTimerRef = useRef(null);
  useEffect(() => {
    if (cleaning && cleanupProgress >= 100 && !fading) {
      setFading(true);
      // Use ref to prevent cleanup from canceling the timer on re-render
      fadeTimerRef.current = setTimeout(() => {
        fadeTimerRef.current = null;
        if (onCleanupComplete) onCleanupComplete();
      }, 1000);
    }
    // Only clean up on unmount, not on re-render
  }, [cleaning, cleanupProgress, fading, onCleanupComplete]);

  // Dragging
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('button')) return;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      const maxX = globalThis.innerWidth - 500;
      const maxY = globalThis.innerHeight - 300;
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const encryptedGB = ((progress / 100) * capacity).toFixed(1);

  return (
    <div
      className={`ransomware-overlay ${paused ? 'paused' : ''} ${fading ? 'fading' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default',
        ...(paused && pausedZIndex != null ? { zIndex: pausedZIndex } : {}),
      }}
    >
      <div
        className="ransomware-header"
        onMouseDown={handleMouseDown}
      >
        <span className="ransomware-title">
          {paused ? 'ENCRYPTION HALTED' : 'ENCRYPTING WORKSTATION'}
        </span>
        <span className="ransomware-skull">☠️</span>
      </div>

      <div className="ransomware-body">
        <div className="ransomware-status">
          {paused
            ? 'THREAT DETECTED — ENCRYPTION HALTED'
            : 'YOUR FILES ARE BEING ENCRYPTED'}
        </div>

        <div className="ransomware-percentage">
          {Math.floor(progress)}%
        </div>

        <div className="ransomware-progress-container">
          <div className="ransomware-progress-bar">
            <div
              className="ransomware-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="ransomware-progress-text">
            <span>{encryptedGB} / {capacity} GB encrypted</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RansomwareOverlay;
