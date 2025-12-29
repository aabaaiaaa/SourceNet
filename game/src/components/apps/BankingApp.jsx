import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import './BankingApp.css';

const BankingApp = () => {
  const { bankAccounts, messages, depositCheque, cancelChequeDeposit, pendingChequeDeposit, transactions } = useGame();
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' or 'transactions'

  // Get pending cheque info if one is set
  const pendingCheque = pendingChequeDeposit ? (() => {
    const message = messages.find(m => m.id === pendingChequeDeposit);
    return message?.attachment && !message.attachment.deposited
      ? { messageId: message.id, amount: message.attachment.amount }
      : null;
  })() : null;

  const handleDeposit = (accountId) => {
    if (pendingCheque) {
      depositCheque(pendingCheque.messageId, accountId);
    }
  };

  const handleCancel = () => {
    cancelChequeDeposit();
  };

  const renderTransactionHistory = () => {
    if (!transactions || transactions.length === 0) {
      return (
        <div className="empty-state">
          <p>No transactions yet.</p>
        </div>
      );
    }

    return (
      <div className="transactions-list">
        {transactions.slice().reverse().map((txn) => (
          <div key={txn.id} className={`transaction-item transaction-${txn.type}`}>
            <div className="transaction-date">
              {new Date(txn.date).toLocaleString()}
            </div>
            <div className="transaction-description">{txn.description}</div>
            <div className={`transaction-amount ${txn.amount >= 0 ? 'amount-positive' : 'amount-negative'}`}>
              {txn.amount >= 0 ? '+' : ''}{txn.amount} credits
            </div>
            <div className="transaction-balance">
              Balance: {txn.balanceAfter} credits
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="banking-app">
      <div className="banking-header">
        <h2>SNet Banking App</h2>
        <p className="banking-subtitle">Manage your accounts securely</p>
      </div>

      {/* Tabs */}
      <div className="banking-tabs">
        <button
          className={`tab ${activeTab === 'accounts' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          Accounts
        </button>
        <button
          className={`tab ${activeTab === 'transactions' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transaction History
          {transactions && transactions.length > 0 && (
            <span className="tab-badge">{transactions.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'accounts' && (
        <>
          {pendingCheque && (
        <div className="cheque-deposit-prompt">
          <div className="prompt-header">💰 Cheque Deposit</div>
          <p>You have a cheque for {pendingCheque.amount} credits.</p>
          <p>Select an account to deposit into:</p>
          <div className="account-selection">
            {bankAccounts.map((account) => (
              <button
                key={account.id}
                className="account-select-btn"
                onClick={() => handleDeposit(account.id)}
              >
                <div className="account-name">{account.bankName}</div>
                <div className="account-balance">
                  Current: {account.balance} credits
                </div>
              </button>
            ))}
          </div>
          <button className="cancel-deposit-btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}

      <div className="accounts-list">
        <h3>Your Accounts</h3>
        {bankAccounts.map((account) => (
          <div key={account.id} className="account-card">
            <div className="account-card-header">
              <div className="bank-name">{account.bankName}</div>
              <div className="account-id">Account: {account.id}</div>
            </div>
            <div className="account-balance-large">{account.balance} credits</div>
          </div>
        ))}
      </div>

          <div className="banking-footer">
            <p>Total across all accounts: <strong>{bankAccounts.reduce((sum, acc) => sum + acc.balance, 0)} credits</strong></p>
          </div>
        </>
      )}

      {activeTab === 'transactions' && renderTransactionHistory()}
    </div>
  );
};

export default BankingApp;
