import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import { formatDateTime } from '../../utils/helpers';
import networkRegistry from '../../systems/NetworkRegistry';
import triggerEventBus from '../../core/triggerEventBus';
import './SNetMail.css';

const SNetMail = () => {
  const { playerMailId, messages, markMessageAsRead, archiveMessage, initiateChequeDeposit, activateLicense, software, updateMessage } = useGame();
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
    console.log('🔵 handleNetworkAddressClick called', { attachment });

    // Check if attachment already activated (one-time use)
    if (attachment.activated) {
      console.log('⚠️ Network attachment already used - cannot reactivate');
      return;
    }

    // Only add if NAR is installed
    const narInstalled = software?.some(s => (typeof s === 'string' ? s === 'network-address-register' : s.id === 'network-address-register'));

    if (!narInstalled) {
      console.log('⚠️ NAR not installed - cannot add network address');
      return;
    }

    // Network structure was already registered in NetworkRegistry when message was delivered
    // Now we just grant access to the network and specified devices
    const networkId = attachment.networkId;

    // Get device IPs - prefer deviceIps but fallback to fileSystems for backwards compatibility
    let deviceIps = attachment.deviceIps || [];
    if (deviceIps.length === 0 && attachment.fileSystems) {
      deviceIps = attachment.fileSystems.map(fs => fs.ip).filter(Boolean);
    }

    // Grant access via NetworkRegistry (single source of truth)
    // This sets network.accessible = true and device.accessible = true for specified devices
    const success = networkRegistry.grantNetworkAccess(networkId, deviceIps);

    if (success) {
      console.log(`✅ NAR activated: Granted access to ${attachment.networkName} (${deviceIps.length} devices)`);

      // Emit narEntryAdded event for objective tracking
      triggerEventBus.emit('narEntryAdded', {
        networkId,
        networkName: attachment.networkName,
      });

      // Merge files from attachment into existing filesystems
      // This allows mission updates to add new files while preserving old ones
      if (attachment.fileSystems) {
        attachment.fileSystems.forEach(fs => {
          if (fs.files && fs.files.length > 0) {
            const existingFs = networkRegistry.getFileSystem(fs.id);
            if (existingFs) {
              // Merge files - add new files that don't exist
              const existingFileNames = new Set(existingFs.files.map(f => f.name));
              const newFiles = fs.files.filter(f => !existingFileNames.has(f.name));
              if (newFiles.length > 0) {
                networkRegistry.registerFileSystem({
                  id: fs.id,
                  files: [...existingFs.files, ...newFiles],
                });
                console.log(`📁 Merged ${newFiles.length} new files into ${fs.id}`);
              }
            }
          }
        });
      }
    } else {
      console.warn(`⚠️ Failed to grant access to ${networkId} - network may not be registered`);
    }

    // Mark attachment as activated (one-time use)
    updateMessage(message.id, {
      attachments: message.attachments?.map(att => {
        if (att.type === 'networkAddress' && att.networkId === networkId) {
          return { ...att, activated: true };
        }
        return att;
      })
    });
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
                    // Network data is now embedded directly in the attachment
                    const networkData = attachment;

                    const narInstalled = software?.some(s => (typeof s === 'string' ? s === 'network-address-register' : s.id === 'network-address-register'));
                    const existingNetwork = networkRegistry.getNetwork(networkData.networkId);
                    const alreadyUsed = attachment.activated;

                    let statusText;
                    let isClickable = true;
                    if (alreadyUsed) {
                      statusText = '✓ Network credentials used';
                      isClickable = false;
                    } else if (existingNetwork && !existingNetwork.accessible && existingNetwork.revokedReason) {
                      // Network was previously accessible but got revoked - show "updated" since player had it before
                      statusText = 'Click to add updated network credentials to NAR';
                      isClickable = narInstalled;
                    } else if (existingNetwork && existingNetwork.accessible) {
                      // Network is already accessible - allow merging new devices/files
                      statusText = 'Click to add updated network credentials to NAR';
                      isClickable = narInstalled;
                    } else if (!narInstalled) {
                      statusText = 'Install Network Address Register to use this attachment';
                      isClickable = false;
                    } else {
                      // First time adding this network (either no existing entry, or exists but never activated)
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
