/**
 * useNetworkDisconnection - Shared hook for handling network disconnection events.
 *
 * Subscribes to 'networkDisconnected' event, calls onDisconnect when the
 * watched network disconnects, and manages a 3-second auto-clearing message.
 *
 * @param {string} watchedNetworkId - The network ID to watch for disconnection
 * @param {function} onDisconnect - Callback with (data) when disconnection occurs.
 *   data: { networkId, networkName, reason }
 * @returns {{ disconnectionMessage: string|null }}
 */

import { useState, useEffect, useRef } from 'react';
import triggerEventBus from '../core/triggerEventBus';

export function useNetworkDisconnection(watchedNetworkId, onDisconnect) {
  const [disconnectionMessage, setDisconnectionMessage] = useState(null);
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;

  useEffect(() => {
    const handleDisconnect = (data) => {
      if (watchedNetworkId === data.networkId) {
        onDisconnectRef.current?.(data);
        setDisconnectionMessage(`Disconnected from ${data.networkName}`);
      }
    };

    triggerEventBus.on('networkDisconnected', handleDisconnect);
    return () => triggerEventBus.off('networkDisconnected', handleDisconnect);
  }, [watchedNetworkId]);

  // Auto-clear after 3 seconds
  useEffect(() => {
    if (disconnectionMessage) {
      const timer = setTimeout(() => setDisconnectionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [disconnectionMessage]);

  return { disconnectionMessage };
}

export default useNetworkDisconnection;
