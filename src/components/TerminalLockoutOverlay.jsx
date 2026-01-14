/**
 * Terminal Lockout Overlay
 * 
 * Blocks all player interaction during scripted events (e.g., sabotage).
 * Shows red pulsing border and warning text when visuals are active.
 * Overlay remains active (blocking interaction) even when visuals hidden during delay period.
 */

import React from 'react';
import './TerminalLockoutOverlay.css';

const TerminalLockoutOverlay = ({ isVisible, showVisuals }) => {
    if (!isVisible) {
        return null;
    }

    return (
        <div className="terminal-lockout-overlay">
            {showVisuals && (
                <>
                    <div className="lockout-border-pulse" />
                    <div className="lockout-message">
                        <div className="lockout-text">SYSTEM COMPROMISED</div>
                        <div className="lockout-subtext">Loss of terminal control - Restarting control systems...</div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TerminalLockoutOverlay;
