import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameProvider, useGame } from '../../contexts/GameContext';
import SNetMail from '../../components/apps/SNetMail';
import BankingApp from '../../components/apps/BankingApp';
import TopBar from '../../components/ui/TopBar';
import {
  createMessage,
  createBankAccount,
  createCompleteSaveState,
  setSaveInLocalStorage,
} from '../helpers/testData';

// Helper component to load game state on mount
const GameLoader = ({ username }) => {
  const { loadGame } = useGame();

  useEffect(() => {
    loadGame(username);
  }, [loadGame, username]);

  return null;
};

describe('Cheque Deposit Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should complete full cheque deposit flow', async () => {
    const user = userEvent.setup();

    // Setup: Create save state with a message containing a 500 credit cheque
    const message = createMessage({
      id: 'msg-cheque-1',
      from: 'HR Department',
      subject: 'Welcome Bonus',
      body: 'Please find attached your welcome bonus.',
      chequeAmount: 500,
      chequeDeposited: false,
    });

    const bankAccount = createBankAccount({
      id: 'acc-1',
      bankName: 'Test Bank',
      balance: 1000,
    });

    const saveState = createCompleteSaveState({
      username: 'test_user',
      messages: [message],
      bankAccounts: [bankAccount],
    });

    setSaveInLocalStorage('test_user', saveState);

    // Render components
    render(
      <GameProvider>
        <GameLoader username="test_user" />
        <TopBar />
        <SNetMail />
        <BankingApp />
      </GameProvider>
    );

    // Wait for game to load
    await waitFor(() => {
      const topBarCredits = screen.getByTitle('Click to open Banking App');
      expect(topBarCredits).toHaveTextContent(/1000\s+credits/);
    });

    // Step 2: Click the message in the mail list to open it
    const messageItem = screen.getByText(/Welcome Bonus/i);
    await user.click(messageItem);

    // Step 3: Verify cheque attachment is visible
    await waitFor(() => {
      expect(screen.getByText(/Click to deposit/i)).toBeInTheDocument();
    });

    // Step 4: Click the cheque attachment
    const chequeAttachment = screen.getByText(/Digital Cheque - 500 credits/i);
    await user.click(chequeAttachment);

    // Step 5: Verify deposit prompt appears
    await waitFor(() => {
      expect(screen.getByText(/💰 Cheque Deposit/i)).toBeInTheDocument();
    });

    // Step 6: Click the account button to deposit
    const accountButton = screen.getByRole('button', { name: /Test Bank/i });
    await user.click(accountButton);

    // Step 7: Verify cheque shows as deposited
    await waitFor(() => {
      expect(screen.getByText(/✓ Deposited/i)).toBeInTheDocument();
    });

    // Step 8: Verify balance updated in TopBar (1000 + 500 = 1500)
    await waitFor(() => {
      const topBarCredits = screen.getByTitle('Click to open Banking App');
      expect(topBarCredits).toHaveTextContent(/1500\s+credits/);
    });

    // Step 9: Verify deposit prompt is gone
    expect(screen.queryByText(/💰 Cheque Deposit/i)).not.toBeInTheDocument();

    // Step 10: Verify balance in banking app shows 1500 (check account-balance-large)
    const accountCards = screen.getAllByText(/^1500\s+credits$/);
    expect(accountCards.length).toBeGreaterThan(0);
  });

  it('should handle cancel cheque deposit flow', async () => {
    const user = userEvent.setup();

    // Setup: Create save state with a message containing a 500 credit cheque
    const message = createMessage({
      id: 'msg-cheque-2',
      from: 'Finance Department',
      subject: 'Payment',
      body: 'Your payment is attached.',
      chequeAmount: 500,
      chequeDeposited: false,
    });

    const bankAccount = createBankAccount({
      id: 'acc-1',
      bankName: 'Test Bank',
      balance: 1000,
    });

    const saveState = createCompleteSaveState({
      username: 'test_user',
      messages: [message],
      bankAccounts: [bankAccount],
    });

    setSaveInLocalStorage('test_user', saveState);

    // Render components
    render(
      <GameProvider>
        <GameLoader username="test_user" />
        <TopBar />
        <SNetMail />
        <BankingApp />
      </GameProvider>
    );

    // Wait for game to load
    await waitFor(() => {
      const topBarCredits = screen.getByTitle('Click to open Banking App');
      expect(topBarCredits).toHaveTextContent(/1000\s+credits/);
    });

    // Step 2: Click the message to open it
    const messageItem = screen.getByText(/Payment/i);
    await user.click(messageItem);

    // Step 3: Click the cheque attachment to trigger deposit prompt
    const chequeAttachment = screen.getByText(/Digital Cheque - 500 credits/i);
    await user.click(chequeAttachment);

    // Step 4: Verify deposit prompt appears
    await waitFor(() => {
      expect(screen.getByText(/💰 Cheque Deposit/i)).toBeInTheDocument();
    });

    // Step 5: Click the cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    // Step 6: Verify prompt disappears
    await waitFor(() => {
      expect(screen.queryByText(/💰 Cheque Deposit/i)).not.toBeInTheDocument();
    });

    // Step 7: Verify cheque still shows "Click to deposit" (not deposited)
    expect(screen.getByText(/Click to deposit/i)).toBeInTheDocument();

    // Step 8: Verify balance unchanged in TopBar
    const topBarCredits = screen.getByTitle('Click to open Banking App');
    expect(topBarCredits).toHaveTextContent(/1000\s+credits/);

    // Step 9: Verify balance unchanged in banking app
    const accountBalances = screen.getAllByText(/^1000\s+credits$/);
    expect(accountBalances.length).toBeGreaterThan(0);
  });

  it('should not allow depositing an already-deposited cheque', async () => {
    const user = userEvent.setup();

    // Setup: Create save state with a message containing an ALREADY DEPOSITED cheque
    const message = createMessage({
      id: 'msg-cheque-3',
      from: 'Accounting',
      subject: 'Already Deposited',
      body: 'This cheque was already deposited.',
      chequeAmount: 500,
      chequeDeposited: true, // Already deposited!
    });

    const bankAccount = createBankAccount({
      id: 'acc-1',
      bankName: 'Test Bank',
      balance: 1500, // Already includes the 500 from previous deposit
    });

    const saveState = createCompleteSaveState({
      username: 'test_user',
      messages: [message],
      bankAccounts: [bankAccount],
    });

    setSaveInLocalStorage('test_user', saveState);

    // Render components
    render(
      <GameProvider>
        <GameLoader username="test_user" />
        <TopBar />
        <SNetMail />
        <BankingApp />
      </GameProvider>
    );

    // Wait for game to load
    await waitFor(() => {
      const topBarCredits = screen.getByTitle('Click to open Banking App');
      expect(topBarCredits).toHaveTextContent(/1500\s+credits/);
    });

    // Step 1: Click the message to open it
    const messageItem = screen.getByText(/Already Deposited/i);
    await user.click(messageItem);

    // Step 2: Verify cheque shows as deposited
    await waitFor(() => {
      expect(screen.getByText(/✓ Deposited/i)).toBeInTheDocument();
    });

    // Step 3: Click the deposited cheque attachment
    const chequeAttachment = screen.getByText(/Digital Cheque - 500 credits/i);
    await user.click(chequeAttachment);

    // Step 4: Verify NO deposit prompt appears
    expect(screen.queryByText(/💰 Cheque Deposit/i)).not.toBeInTheDocument();

    // Step 5: Verify balance remains unchanged at 1500
    const topBarCredits = screen.getByTitle('Click to open Banking App');
    expect(topBarCredits).toHaveTextContent(/1500\s+credits/);
  });
});
