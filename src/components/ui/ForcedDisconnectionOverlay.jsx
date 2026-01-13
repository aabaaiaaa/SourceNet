import './ForcedDisconnectionOverlay.css';

const ForcedDisconnectionOverlay = ({ networkName, reason, administratorMessage, onAcknowledge }) => {
    return (
        <div className="forced-disconnect-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="forced-disconnect-modal">
                <div className="forced-disconnect-warning-icon">⚠️</div>

                <div className="forced-disconnect-header">
                    <h1>FORCED DISCONNECTION</h1>
                </div>

                <div className="forced-disconnect-content">
                    <div className="forced-disconnect-network">
                        <span className="network-label">Network:</span>
                        <span className="network-name">{networkName}</span>
                    </div>

                    {administratorMessage && (
                        <div className="forced-disconnect-admin-message">
                            <div className="admin-message-header">Administrator Message:</div>
                            <div className="admin-message-content">{administratorMessage}</div>
                        </div>
                    )}

                    <div className="forced-disconnect-reason">
                        <span className="reason-label">Reason:</span>
                        <span className="reason-text">{reason}</span>
                    </div>
                </div>

                <div className="forced-disconnect-actions">
                    <button className="acknowledge-btn" onClick={onAcknowledge}>
                        Acknowledge
                    </button>
                </div>

                <div className="forced-disconnect-footer">
                    <p>Your connection has been terminated by the network administrator.</p>
                    <p>All active sessions on this network have been closed.</p>
                </div>
            </div>
        </div>
    );
};

export default ForcedDisconnectionOverlay;
