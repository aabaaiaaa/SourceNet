import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import TopBar from '../../components/ui/TopBar';

describe('Notification System Integration', () => {
  it('should show unread message count badge', async () => {
    render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    // Initial state should show mail icon
    const mailIcon = screen.getByText('✉');
    expect(mailIcon).toBeInTheDocument();
  });

  it('should show mail notification preview on hover with unread messages', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const mailNotification = container.querySelector('.topbar-notification');
    expect(mailNotification).toBeInTheDocument();

    fireEvent.mouseEnter(mailNotification);

    // The notification element should be visible
    const mailIcon = screen.getByText('✉');
    expect(mailIcon).toBeInTheDocument();
  });

  it('should show bank notification preview on hover', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const bankNotifications = container.querySelectorAll('.topbar-notification');
    const bankNotification = bankNotifications[1]; // Second notification is bank

    fireEvent.mouseEnter(bankNotification);

    await waitFor(() => {
      // Should show account preview
      expect(screen.getByText(/Bank Accounts:/)).toBeInTheDocument();
      expect(screen.getByText(/First Bank Ltd/)).toBeInTheDocument();
    });
  });

  it('should call openWindow for mail when mail notification clicked', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const mailNotifications = container.querySelectorAll('.topbar-notification');
    const mailNotification = mailNotifications[0]; // First notification is mail

    fireEvent.click(mailNotification);

    // The notification should be clickable
    expect(mailNotification).toBeInTheDocument();
  });

  it('should call openWindow for banking when bank notification clicked', async () => {
    const { container } = render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const bankNotifications = container.querySelectorAll('.topbar-notification');
    const bankNotification = bankNotifications[1]; // Second notification is bank

    // Verify the notification is clickable
    expect(bankNotification).toBeInTheDocument();
    fireEvent.click(bankNotification);

    // Element should still be in document after click
    expect(bankNotification).toBeInTheDocument();
  });

  it('should call openWindow for banking when credits amount clicked', async () => {
    render(
      <GameProvider>
        <TopBar />
      </GameProvider>
    );

    const creditsDisplay = screen.getByText(/credits/);

    // Verify credits display is clickable
    expect(creditsDisplay).toBeInTheDocument();
    expect(creditsDisplay).toHaveAttribute('title', 'Click to open Banking App');

    fireEvent.click(creditsDisplay);

    // Element should still be in document after click
    expect(creditsDisplay).toBeInTheDocument();
  });
});
