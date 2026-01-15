import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import { formatDateTime } from '../../utils/helpers';
import { getMissionById } from '../../missions/missionData';
import triggerEventBus from '../../core/triggerEventBus';
import './SNetMail.css';

const SNetMail = () => {
  const { playerMailId, messages, markMessageAsRead, archiveMessage, initiateChequeDeposit, activateLicense, narEntries, setNarEntries, software, updateMessage } = useGame();
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Update selectedMessage when messages change (e.g., when cheque is deposited)
  useEffect(() => {
    if (selectedMessage) {
      const updatedMessage = messages.find(m => m.id === selectedMessage.id);
      if (updatedMessage && updatedMessage !== selectedMessage) {
        setSelectedMessage(updatedMessage);
      }
    }
  }, [messages]); // Remove selectedMessage from deps to avoid cascade

  const inboxMessages = messages.filter((m) => !m.archived);
  const archivedMessages = messages.filter((m) => m.archived);

  // Sort messages by timestamp descending (newest first)
  const sortByNewest = (msgs) => [...msgs].sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  const displayMessages = sortByNewest(activeTab === 'inbox' ? inboxMessages : archivedMessages);

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
    if (!message.read) {
      markMessageAsRead(message.id);
    }
  };

  const handleArchive = (messageId) => {
    archiveMessage(messageId);
    if (selectedMessage && selectedMessage.id === messageId) {
      setSelectedMessage(null);
    }
  };

  const handleChequeClick = (message) => {
    // Find first non-deposited cheque in attachments
    const cheque = message.attachments?.find(
      (att) => att.type === 'cheque' && !att.deposited
    );
    if (cheque) {
      initiateChequeDeposit(message.id);
    }
  };

  const handleLicenseClick = (message, attachment) => {
    // Only activate if not already activated
    if (!attachment.activated) {
      activateLicense(message.id, attachment.softwareId);
    }
  };

  const handleNetworkAddressClick = (message, attachment) => {
    console.log('🔵 handleNetworkAddressClick called', { attachment, narEntries, software });

    // Check if attachment already activated (one-time use)
    if (attachment.activated) {
      console.log('⚠️ Network attachment already used - cannot reactivate');
      return;
    }

    // Only add if NAR is installed and network not already added
    const narInstalled = software?.some(s => (typeof s === 'string' ? s === 'network-address-register' : s.id === 'network-address-register'));

    if (!narInstalled) {
      console.log('⚠️ NAR not installed - cannot add network address');
      return;
    }

    // Resolve network data - either from attachment directly or from mission lookup
    let networkData = attachment;

    // If attachment references a mission, look up the mission's network definition
    if (attachment.missionId && !attachment.networkId) {
      const mission = getMissionById(attachment.missionId);
      if (mission && mission.networks && mission.networks.length > 0) {
        networkData = mission.networks[0];
        console.log('🔍 Resolved network data from mission:', attachment.missionId);
      } else {
        console.error('⚠️ Could not resolve mission network:', attachment.missionId);
        return;
      }
    }

    // Use functional update to avoid stale closure issues
    setNarEntries((currentEntries) => {
      console.log('🔵 setNarEntries called with currentEntries:', currentEntries);
      const existingEntry = currentEntries?.find(entry => entry.networkId === networkData.networkId);

      if (existingEntry) {
        console.log('🔄 Network already in NAR, merging file systems');

        // Merge file systems - update existing ones, add new ones
        const existingFileSystems = existingEntry.fileSystems || [];
        const newFileSystems = networkData.fileSystems || [];
        const mergedFileSystems = [...existingFileSystems];

        newFileSystems.forEach(newFs => {
          const existingFsIndex = mergedFileSystems.findIndex(fs => fs.id === newFs.id);
          if (existingFsIndex >= 0) {
            // Update existing file system
            mergedFileSystems[existingFsIndex] = {
              id: newFs.id,
              ip: newFs.ip,
              name: newFs.name,
              files: newFs.files || [],
            };
            console.log(`  📝 Updated file system: ${newFs.name}`);
          } else {
            // Add new file system
            mergedFileSystems.push({
              id: newFs.id,
              ip: newFs.ip,
              name: newFs.name,
              files: newFs.files || [],
            });
            console.log(`  ➕ Added file system: ${newFs.name}`);
          }
        });

        // Update the existing NAR entry
        // If entry was revoked, re-authorize it (new credentials from fresh attachment)
        return currentEntries.map(entry =>
          entry.networkId === networkData.networkId
            ? { ...entry, fileSystems: mergedFileSystems, authorized: true, revokedReason: undefined }
            : entry
        );
      }

      // Add network entry to NAR
      const newEntry = {
        id: `nar-${Date.now()}`,
        networkId: networkData.networkId,
        networkName: networkData.networkName,
        address: networkData.address || '10.0.0.0/8',
        bandwidth: networkData.bandwidth || 50,
        status: 'active',
        authorized: true,
        dateAdded: new Date().toISOString(),
        // Include file systems if provided (for mission-critical networks)
        ...(networkData.fileSystems && {
          fileSystems: networkData.fileSystems.map(fs => ({
            id: fs.id,
            ip: fs.ip,
            name: fs.name,
            files: fs.files || [],
          })),
        }),
      };

      console.log('✅ Network added to NAR:', networkData.networkName, newEntry);

      // Emit event for objective tracking (deferred to allow state to update and re-render)
      queueMicrotask(() => {
        triggerEventBus.emit('narEntryAdded', {
          networkId: networkData.networkId,
          networkName: networkData.networkName,
          entry: newEntry
        });
      });

      return [...currentEntries, newEntry];
    });

    // Mark attachment as activated (one-time use)
    updateMessage(message.id, {
      attachments: message.attachments?.map(att => {
        if (att.type === 'networkAddress' && att.networkId === networkData.networkId) {
          return { ...att, activated: true };
        }
        if (att.type === 'networkAddress' && att.missionId === attachment.missionId) {
          return { ...att, activated: true };
        }
        return att;
      })
    });
  };

  // Helper to resolve network data for display (from mission if needed)
  const resolveNetworkData = (attachment) => {
    if (attachment.missionId && !attachment.networkId) {
      const mission = getMissionById(attachment.missionId);
      return mission?.networks?.[0] || attachment;
    }
    return attachment;
  };

  return (
    <div className="snet-mail">
      <div className="mail-header">
        <div className="mail-id">Your Mail ID: {playerMailId}</div>
        <div className="mail-tabs">
          <button
            className={`tab ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('inbox');
              setSelectedMessage(null);
            }}
          >
            Inbox ({inboxMessages.length})
          </button>
          <button
            className={`tab ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('archive');
              setSelectedMessage(null);
            }}
          >
            Archive ({archivedMessages.length})
          </button>
        </div>
      </div>

      <div className="mail-body">
        {!selectedMessage ? (
          <div className="message-list">
            {displayMessages.length === 0 ? (
              <div className="empty-state">No messages in {activeTab}</div>
            ) : (
              displayMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message-item ${msg.read ? 'read' : 'unread'}`}
                  onClick={() => handleMessageClick(msg)}
                >
                  <div className="message-from">
                    <strong>{msg.from}</strong>
                    <span className="message-from-id">{msg.fromId}</span>
                  </div>
                  <div className="message-subject">{msg.subject}</div>
                  <div className="message-date">
                    {msg.timestamp && formatDateTime(msg.timestamp)}
                  </div>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="message-has-attachment">
                      📎{msg.attachments.length > 1 ? ` (${msg.attachments.length})` : ''}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="message-view">
            <div className="message-view-header">
              <button
                className="back-button"
                onClick={() => setSelectedMessage(null)}
              >
                ← Back to {activeTab}
              </button>
              {activeTab === 'inbox' && (
                <button
                  className="archive-button"
                  onClick={() => handleArchive(selectedMessage.id)}
                >
                  Archive
                </button>
              )}
            </div>
            <div className="message-details">
              <div className="detail-row">
                <span className="detail-label">From:</span>
                <span>
                  {selectedMessage.from} ({selectedMessage.fromId})
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Subject:</span>
                <span>{selectedMessage.subject}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span>
                  {selectedMessage.timestamp &&
                    formatDateTime(selectedMessage.timestamp)}
                </span>
              </div>
            </div>
            <div className="message-body">
              <pre>{selectedMessage.body}</pre>
            </div>
            {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
              <div className="message-attachment">
                <div className="attachment-header">
                  {selectedMessage.attachments.length > 1 ? 'Attachments:' : 'Attachment:'}
                </div>
                {selectedMessage.attachments.map((attachment, index) => {
                  if (attachment.type === 'cheque') {
                    return (
                      <div
                        key={index}
                        className={`attachment-item ${attachment.deposited ? 'deposited' : ''}`}
                        onClick={() => handleChequeClick(selectedMessage)}
                      >
                        <div className="attachment-icon">💰</div>
                        <div className="attachment-details">
                          <div className="attachment-name">
                            Digital Cheque - {attachment.amount} credits
                          </div>
                          <div className="attachment-status">
                            {attachment.deposited ? '✓ Deposited' : 'Click to deposit'}
                          </div>
                        </div>
                      </div>
                    );
                  } else if (attachment.type === 'softwareLicense') {
                    return (
                      <div
                        key={index}
                        className={`attachment-item ${attachment.activated ? 'activated' : ''}`}
                        onClick={() => handleLicenseClick(selectedMessage, attachment)}
                      >
                        <div className="attachment-icon">📦</div>
                        <div className="attachment-details">
                          <div className="attachment-name">
                            Software License: {attachment.softwareName}
                          </div>
                          <div className="attachment-status">
                            {attachment.activated ? '✓ Activated' : `$${attachment.price} value - Click to add to Portal`}
                          </div>
                        </div>
                      </div>
                    );
                  } else if (attachment.type === 'networkAddress') {
                    // Resolve network data (from mission if needed)
                    const networkData = resolveNetworkData(attachment);

                    const narInstalled = software?.some(s => (typeof s === 'string' ? s === 'network-address-register' : s.id === 'network-address-register'));
                    const existingEntry = narEntries?.find(entry => entry.networkId === networkData.networkId);
                    const alreadyUsed = attachment.activated;

                    let statusText;
                    let isClickable = true;
                    if (alreadyUsed) {
                      statusText = '✓ Network credentials used';
                      isClickable = false;
                    } else if (existingEntry && existingEntry.authorized === false) {
                      // Entry exists and is revoked, but attachment is fresh - allow using new credentials
                      statusText = 'Click to add updated network credentials to NAR';
                      isClickable = narInstalled;
                    } else if (existingEntry && existingEntry.authorized !== false) {
                      statusText = '✓ Already in NAR';
                      isClickable = false;
                    } else if (!narInstalled) {
                      statusText = 'Install Network Address Register to use this attachment';
                      isClickable = false;
                    } else {
                      statusText = 'Click to add to Network Address Register';
                    }

                    return (
                      <div
                        key={index}
                        className={`attachment-item ${alreadyUsed ? 'activated' : ''} ${!isClickable ? 'disabled' : ''}`}
                        onClick={isClickable ? () => handleNetworkAddressClick(selectedMessage, attachment) : undefined}
                        data-testid={`network-attachment-${networkData.networkId}`}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="attachment-icon">🔒</div>
                        <div className="attachment-details">
                          <div className="attachment-name">
                            Network Credentials: {networkData.networkName}
                          </div>
                          <div className="attachment-status">
                            {statusText}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SNetMail;
