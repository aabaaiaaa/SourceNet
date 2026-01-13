import { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/useGame';
import storyMissionManager from '../../missions/StoryMissionManager';
import './SleepOverlay.css';

const SleepOverlay = () => {
    const {
        activeConnections,
        setActiveConnections,
        saveGame,
        setGamePhase,
    } = useGame();

    const [networksToDisconnect, setNetworksToDisconnect] = useState([]);
    const [disconnectedNetworks, setDisconnectedNetworks] = useState([]);
    const [currentStatus, setCurrentStatus] = useState('Preparing to sleep...');
    const [isComplete, setIsComplete] = useState(false);
    const initialConnectionsRef = useRef(null);

    // Capture initial connections on mount
    useEffect(() => {
        if (initialConnectionsRef.current === null) {
            initialConnectionsRef.current = [...(activeConnections || [])];
            setNetworksToDisconnect([...(activeConnections || [])]);
        }
    }, [activeConnections]);

    // Handle sequential disconnection
    useEffect(() => {
        if (networksToDisconnect.length === 0 && initialConnectionsRef.current !== null) {
            if (initialConnectionsRef.current.length === 0) {
                // No networks to disconnect, proceed after minimum delay
                setCurrentStatus('Saving game state...');
                const timer = setTimeout(() => completeSleep(), 3500);
                return () => clearTimeout(timer);
            } else if (disconnectedNetworks.length === initialConnectionsRef.current.length) {
                // All done disconnecting
                setCurrentStatus('Saving game state...');
                const timer = setTimeout(() => completeSleep(), 500);
                return () => clearTimeout(timer);
            }
            return;
        }

        if (networksToDisconnect.length > 0) {
            const nextNetwork = networksToDisconnect[0];
            setCurrentStatus(`Disconnecting from ${nextNetwork.networkName || nextNetwork.networkId}...`);

            const timer = setTimeout(() => {
                // Remove from active connections
                setActiveConnections((prev) =>
                    prev.filter((conn) => conn.networkId !== nextNetwork.networkId)
                );

                // Mark as disconnected
                setDisconnectedNetworks((prev) => [...prev, nextNetwork]);

                // Remove from pending list
                setNetworksToDisconnect((prev) => prev.slice(1));
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [networksToDisconnect, disconnectedNetworks, setActiveConnections]);

    const completeSleep = () => {
        setIsComplete(true);
        setCurrentStatus('Game saved');

        // Save game (connections are now cleared)
        saveGame(null);

        // Clear pending story events (they will be restored from save on next load)
        storyMissionManager.clearPendingEvents();

        // Brief delay to show "Saved" then go to login
        setTimeout(() => {
            setGamePhase('login');
        }, 500);
    };

    return (
        <div className="sleep-overlay">
            <div className="sleep-content">
                <div className="sleep-watermark">SLEEPING</div>

                <div className="sleep-status">{currentStatus}</div>

                {initialConnectionsRef.current && initialConnectionsRef.current.length > 0 && (
                    <div className="sleep-network-list">
                        {initialConnectionsRef.current.map((network) => {
                            const isDisconnected = disconnectedNetworks.some(
                                (n) => n.networkId === network.networkId
                            );
                            const isDisconnecting =
                                networksToDisconnect[0]?.networkId === network.networkId;

                            return (
                                <div
                                    key={network.networkId}
                                    className={`sleep-network-item ${isDisconnected ? 'disconnected' : ''} ${isDisconnecting ? 'disconnecting' : ''}`}
                                >
                                    <span className="network-name">
                                        {network.networkName || network.networkId}
                                    </span>
                                    <span className="network-status">
                                        {isDisconnected ? '✓ Disconnected' : isDisconnecting ? '...' : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {isComplete && <div className="sleep-saved">✓ Game saved</div>}
            </div>
        </div>
    );
};

export default SleepOverlay;
