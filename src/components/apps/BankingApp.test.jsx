import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithGame, renderWithGameContext } from '../../test/helpers/renderHelpers';
import BankingApp from './BankingApp';

describe('BankingApp Component', () => {
  it('should render app title', () => {
    renderWithGame(<BankingApp />);
    expect(screen.getByText('SNet Banking App')).toBeInTheDocument();
  });

  it('should display starting account', () => {
    renderWithGame(<BankingApp />);
    expect(screen.getByText('First Bank Ltd')).toBeInTheDocument();
  });

  it('should show Your Accounts section', () => {
    renderWithGame(<BankingApp />);
    expect(screen.getByText('Your Accounts')).toBeInTheDocument();
  });

  it('should display account balance', () => {
    renderWithGame(<BankingApp />);
    const balances = screen.getAllByText(/0 credits/);
    expect(balances.length).toBeGreaterThan(0);
  });

  describe('tab switching', () => {
    it('should switch to Transaction History tab', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 500 }],
        transactions: [],
        messages: [],
      });

      fireEvent.click(screen.getByText('Transaction History'));
      expect(screen.getByText('No transactions yet.')).toBeInTheDocument();
    });

    it('should switch back to Accounts tab', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 500 }],
        transactions: [],
        messages: [],
      });

      fireEvent.click(screen.getByText('Transaction History'));
      fireEvent.click(screen.getByText('Accounts'));
      expect(screen.getByText('Your Accounts')).toBeInTheDocument();
    });

    it('should show transaction count badge when transactions exist', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 500 }],
        transactions: [
          { id: 'txn-1', date: '2020-03-25T10:00:00Z', description: 'Deposit', amount: 1000, type: 'deposit', balanceAfter: 1000 },
          { id: 'txn-2', date: '2020-03-25T11:00:00Z', description: 'Payment', amount: -500, type: 'payment', balanceAfter: 500 },
        ],
        messages: [],
      });

      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('transaction history', () => {
    it('should display transactions in reverse order (newest first)', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 500 }],
        transactions: [
          { id: 'txn-1', date: '2020-03-25T10:00:00Z', description: 'First Deposit', amount: 1000, type: 'deposit', balanceAfter: 1000 },
          { id: 'txn-2', date: '2020-03-25T11:00:00Z', description: 'Payment Received', amount: -500, type: 'payment', balanceAfter: 500 },
        ],
        messages: [],
      });

      fireEvent.click(screen.getByText('Transaction History'));

      // Both transactions visible
      expect(screen.getByText('First Deposit')).toBeInTheDocument();
      expect(screen.getByText('Payment Received')).toBeInTheDocument();

      // Check newest first by DOM order
      const items = screen.getAllByText(/Deposit|Payment Received/);
      expect(items[0].textContent).toBe('Payment Received');
      expect(items[1].textContent).toBe('First Deposit');
    });

    it('should show positive amounts with + prefix', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 1000 }],
        transactions: [
          { id: 'txn-1', date: '2020-03-25T10:00:00Z', description: 'Deposit', amount: 1000, type: 'deposit', balanceAfter: 1000 },
        ],
        messages: [],
      });

      fireEvent.click(screen.getByText('Transaction History'));
      expect(screen.getByText('+1000 credits')).toBeInTheDocument();
    });

    it('should show negative amounts without + prefix', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 500 }],
        transactions: [
          { id: 'txn-1', date: '2020-03-25T10:00:00Z', description: 'Payment', amount: -500, type: 'payment', balanceAfter: 500 },
        ],
        messages: [],
      });

      fireEvent.click(screen.getByText('Transaction History'));
      expect(screen.getByText('-500 credits')).toBeInTheDocument();
    });

    it('should show balance after each transaction', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 1500 }],
        transactions: [
          { id: 'txn-1', date: '2020-03-25T10:00:00Z', description: 'Deposit', amount: 1000, type: 'deposit', balanceAfter: 1500 },
        ],
        messages: [],
      });

      fireEvent.click(screen.getByText('Transaction History'));
      expect(screen.getByText('Balance: 1500 credits')).toBeInTheDocument();
    });
  });

  describe('cheque deposit prompt', () => {
    it('should show deposit prompt when pendingChequeDeposit is set', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 0 }],
        pendingChequeDeposit: 'msg-1',
        messages: [
          {
            id: 'msg-1',
            attachments: [{ type: 'cheque', amount: 500, deposited: false }],
          },
        ],
        depositCheque: vi.fn(),
        cancelChequeDeposit: vi.fn(),
        transactions: [],
      });

      expect(screen.getByText('💰 Cheque Deposit')).toBeInTheDocument();
      expect(screen.getByText(/500 credits/)).toBeInTheDocument();
    });

    it('should call depositCheque when account is selected', () => {
      const mockDeposit = vi.fn();
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 0 }],
        pendingChequeDeposit: 'msg-1',
        messages: [
          {
            id: 'msg-1',
            attachments: [{ type: 'cheque', amount: 500, deposited: false }],
          },
        ],
        depositCheque: mockDeposit,
        cancelChequeDeposit: vi.fn(),
        transactions: [],
      });

      const selectBtn = screen.getByRole('button', { name: /Test Bank/ });
      fireEvent.click(selectBtn);
      expect(mockDeposit).toHaveBeenCalledWith('msg-1', 'acc-1');
    });

    it('should call cancelChequeDeposit when cancel is clicked', () => {
      const mockCancel = vi.fn();
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [{ id: 'acc-1', bankName: 'Test Bank', balance: 0 }],
        pendingChequeDeposit: 'msg-1',
        messages: [
          {
            id: 'msg-1',
            attachments: [{ type: 'cheque', amount: 500, deposited: false }],
          },
        ],
        depositCheque: vi.fn(),
        cancelChequeDeposit: mockCancel,
        transactions: [],
      });

      fireEvent.click(screen.getByText('Cancel'));
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('multiple accounts', () => {
    it('should show total balance across all accounts', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [
          { id: 'acc-1', bankName: 'Bank A', balance: 300 },
          { id: 'acc-2', bankName: 'Bank B', balance: 700 },
        ],
        messages: [],
        transactions: [],
      });

      expect(screen.getByText(/1000 credits/)).toBeInTheDocument();
    });

    it('should display all accounts', () => {
      renderWithGameContext(<BankingApp />, {
        bankAccounts: [
          { id: 'acc-1', bankName: 'Bank A', balance: 300 },
          { id: 'acc-2', bankName: 'Bank B', balance: 700 },
        ],
        messages: [],
        transactions: [],
      });

      expect(screen.getByText('Bank A')).toBeInTheDocument();
      expect(screen.getByText('Bank B')).toBeInTheDocument();
    });
  });
});
