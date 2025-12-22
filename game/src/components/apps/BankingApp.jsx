import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import './BankingApp.css';

const BankingApp = () => {
  const { bankAccounts, messages, depositCheque } = useGame();
  const [pendingCheque, setPendingCheque] = useState(null);

  useEffect(() => {
    // Check if there's a pending cheque to deposit
    const undeposited = messages.find(
      (m) => m.attachment && !m.attachment.deposited
    );
    if (undeposited) {
      setPendingCheque({
        messageId: undeposited.id,
        amount: undeposited.attachment.amount,
      });
    }
  }, [messages]);

  const handleDeposit = (accountId) => {
    if (pendingCheque) {
      depositCheque(pendingCheque.messageId, accountId);
      setPendingCheque(null);
    }
  };

  return (
    <div className="banking-app">
      <div className="banking-header">
        <h2>SNet Banking App</h2>
        <p className="banking-subtitle">Manage your accounts securely</p>
      </div>

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
    </div>
  );
};

export default BankingApp;
