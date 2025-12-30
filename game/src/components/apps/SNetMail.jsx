import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { formatDateTime } from '../../utils/helpers';
import './SNetMail.css';

const SNetMail = () => {
  const { playerMailId, messages, markMessageAsRead, archiveMessage, initiateChequeDeposit } = useGame();
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
    if (message.attachment && !message.attachment.deposited) {
      initiateChequeDeposit(message.id);
    }
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
                  {msg.attachment && (
                    <div className="message-has-attachment">📎</div>
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
            {selectedMessage.attachment && (
              <div className="message-attachment">
                <div className="attachment-header">Attachment:</div>
                <div
                  className={`attachment-item ${
                    selectedMessage.attachment.deposited ? 'deposited' : ''
                  }`}
                  onClick={() => handleChequeClick(selectedMessage)}
                >
                  <div className="attachment-icon">💰</div>
                  <div className="attachment-details">
                    <div className="attachment-name">
                      Digital Cheque - {selectedMessage.attachment.amount} credits
                    </div>
                    <div className="attachment-status">
                      {selectedMessage.attachment.deposited
                        ? '✓ Deposited'
                        : 'Click to deposit'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SNetMail;
