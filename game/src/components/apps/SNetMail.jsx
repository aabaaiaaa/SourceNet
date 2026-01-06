import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { formatDateTime } from '../../utils/helpers';
import './SNetMail.css';

const SNetMail = () => {
  const { playerMailId, messages, markMessageAsRead, archiveMessage, initiateChequeDeposit, activateLicense, narEntries, setNarEntries, software } = useGame();
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

  const displayMessages = activeTab === 'inbox' ? inboxMessages : archivedMessages;

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

    // Only add if NAR is installed and network not already added
    const narInstalled = software?.some(s => (typeof s === 'string' ? s === 'network-address-register' : s.id === 'network-address-register'));

    if (!narInstalled) {
      console.log('⚠️ NAR not installed - cannot add network address');
      return;
    }

    // Use functional update to avoid stale closure issues
    setNarEntries((currentEntries) => {
      console.log('🔵 setNarEntries called with currentEntries:', currentEntries);
      const alreadyAdded = currentEntries?.some(entry => entry.networkId === attachment.networkId);
      if (alreadyAdded) {
        console.log('⚠️ Network already in NAR');
        return currentEntries;
      }

      // Add network entry to NAR
      const newEntry = {
        id: `nar-${Date.now()}`,
        networkId: attachment.networkId,
        networkName: attachment.networkName,
        address: attachment.address || '10.0.0.0/8',
        status: 'active',
        dateAdded: new Date().toISOString(),
      };

      console.log('✅ Network added to NAR:', attachment.networkName, newEntry);
      return [...currentEntries, newEntry];
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
                    const narInstalled = software?.some(s => (typeof s === 'string' ? s === 'network-address-register' : s.id === 'network-address-register'));
                    const alreadyAdded = narEntries?.some(entry => entry.networkId === attachment.networkId);

                    let statusText;
                    let isClickable = true;
                    if (alreadyAdded) {
                      statusText = '✓ Added to NAR';
                    } else if (!narInstalled) {
                      statusText = 'Install Network Address Register to use this attachment';
                      isClickable = false;
                    } else {
                      statusText = 'Click to add to Network Address Register';
                    }

                    return (
                      <div
                        key={index}
                        className={`attachment-item ${alreadyAdded ? 'activated' : ''} ${!isClickable ? 'disabled' : ''}`}
                        onClick={isClickable ? () => handleNetworkAddressClick(selectedMessage, attachment) : undefined}
                        data-testid={`network-attachment-${attachment.networkId}`}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="attachment-icon">🔒</div>
                        <div className="attachment-details">
                          <div className="attachment-name">
                            Network Credentials: {attachment.networkName}
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
