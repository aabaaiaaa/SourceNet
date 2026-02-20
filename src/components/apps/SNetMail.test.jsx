import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithGame, renderWithGameContext } from '../../test/helpers/renderHelpers';
import SNetMail from './SNetMail';

const createMessage = (overrides = {}) => ({
  id: 'msg-1',
  from: 'Test Sender <sender@test.local>',
  fromId: 'sender@test.local',
  to: 'user@sourcenet.local',
  subject: 'Test Subject',
  body: 'This is a test message body.',
  timestamp: '2020-03-25T09:00:00.000Z',
  read: false,
  archived: false,
  attachments: [],
  ...overrides,
});

describe('SNetMail Component', () => {
  it('should render mail ID', () => {
    renderWithGame(<SNetMail />);
    expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
  });

  it('should render inbox and archive tabs', () => {
    renderWithGame(<SNetMail />);
    expect(screen.getByText(/Inbox/)).toBeInTheDocument();
    expect(screen.getByText(/Archive/)).toBeInTheDocument();
  });

  it('should show empty state when no messages', () => {
    renderWithGame(<SNetMail />);
    expect(screen.getByText(/No messages in inbox/)).toBeInTheDocument();
  });

  it('should switch between inbox and archive tabs', () => {
    renderWithGame(<SNetMail />);

    const archiveTab = screen.getByText(/Archive/);
    fireEvent.click(archiveTab);

    expect(screen.getByText(/No messages in archive/)).toBeInTheDocument();
  });

  describe('message list', () => {
    it('should display messages with subject and sender', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ subject: 'Important Update' })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      expect(screen.getByText('Important Update')).toBeInTheDocument();
      expect(screen.getByText('Test Sender <sender@test.local>')).toBeInTheDocument();
    });

    it('should show unread styling for unread messages', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ read: false, subject: 'Unread Message' })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      const messageItem = screen.getByText('Unread Message').closest('.message-item');
      expect(messageItem).toHaveClass('unread');
    });

    it('should show read styling for read messages', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ read: true, subject: 'Read Message' })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      const messageItem = screen.getByText('Read Message').closest('.message-item');
      expect(messageItem).toHaveClass('read');
    });

    it('should show attachment indicator for messages with attachments', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          attachments: [{ type: 'cheque', amount: 100, deposited: false }],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      expect(screen.getByText('📎')).toBeInTheDocument();
    });

    it('should show count for multiple attachments', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          attachments: [
            { type: 'cheque', amount: 100, deposited: false },
            { type: 'cheque', amount: 200, deposited: false },
          ],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      expect(screen.getByText('📎 (2)')).toBeInTheDocument();
    });

    it('should sort messages by newest first', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [
          createMessage({ id: 'msg-old', subject: 'Old Message', timestamp: '2020-03-25T08:00:00Z' }),
          createMessage({ id: 'msg-new', subject: 'New Message', timestamp: '2020-03-25T10:00:00Z' }),
        ],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      const subjects = screen.getAllByText(/Message/).filter(el => el.classList.contains('message-subject'));
      expect(subjects[0].textContent).toBe('New Message');
      expect(subjects[1].textContent).toBe('Old Message');
    });
  });

  describe('message detail view', () => {
    it('should show message details when clicked', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ subject: 'Click Me', body: 'Detailed body content here.' })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('Click Me'));

      expect(screen.getByText('Detailed body content here.')).toBeInTheDocument();
      expect(screen.getByText(/From:/)).toBeInTheDocument();
      expect(screen.getByText(/Subject:/)).toBeInTheDocument();
      expect(screen.getByText(/Date:/)).toBeInTheDocument();
    });

    it('should call markMessageAsRead when unread message is clicked', () => {
      const mockMarkRead = vi.fn();
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ id: 'msg-unread', read: false, subject: 'Unread' })],
        markMessageAsRead: mockMarkRead,
        archiveMessage: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('Unread'));
      expect(mockMarkRead).toHaveBeenCalledWith('msg-unread');
    });

    it('should not call markMessageAsRead for already-read messages', () => {
      const mockMarkRead = vi.fn();
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ read: true, subject: 'Already Read' })],
        markMessageAsRead: mockMarkRead,
        archiveMessage: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('Already Read'));
      expect(mockMarkRead).not.toHaveBeenCalled();
    });

    it('should go back to inbox when Back button is clicked', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ subject: 'Test Back' })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('Test Back'));
      expect(screen.getByText(/Back to inbox/)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Back to inbox/));
      expect(screen.getByText('Test Back')).toBeInTheDocument(); // Back in list
    });
  });

  describe('archive functionality', () => {
    it('should show Archive button in message detail view', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ subject: 'Archive Me' })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('Archive Me'));
      expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('should call archiveMessage and clear selection when Archive is clicked', () => {
      const mockArchive = vi.fn();
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({ id: 'msg-archive', subject: 'To Archive' })],
        markMessageAsRead: vi.fn(),
        archiveMessage: mockArchive,
        software: [],
      });

      fireEvent.click(screen.getByText('To Archive'));
      fireEvent.click(screen.getByText('Archive'));
      expect(mockArchive).toHaveBeenCalledWith('msg-archive');
    });
  });

  describe('cheque attachment', () => {
    it('should render cheque attachment with amount', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          subject: 'Payment',
          attachments: [{ type: 'cheque', amount: 750, deposited: false }],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        initiateChequeDeposit: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('Payment'));
      expect(screen.getByText('Digital Cheque - 750 credits')).toBeInTheDocument();
      expect(screen.getByText('Click to deposit')).toBeInTheDocument();
    });

    it('should show deposited status for deposited cheques', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          subject: 'Old Payment',
          attachments: [{ type: 'cheque', amount: 500, deposited: true }],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('Old Payment'));
      expect(screen.getByText('✓ Deposited')).toBeInTheDocument();
    });

    it('should call initiateChequeDeposit when cheque is clicked', () => {
      const mockDeposit = vi.fn();
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          id: 'msg-cheque',
          subject: 'Payment',
          attachments: [{ type: 'cheque', amount: 500, deposited: false }],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        initiateChequeDeposit: mockDeposit,
        software: [],
      });

      fireEvent.click(screen.getByText('Payment'));
      fireEvent.click(screen.getByText('Click to deposit'));
      expect(mockDeposit).toHaveBeenCalledWith('msg-cheque');
    });
  });

  describe('software license attachment', () => {
    it('should render license attachment with software name', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          subject: 'License',
          attachments: [{
            type: 'softwareLicense',
            softwareId: 'test-sw',
            softwareName: 'Test Software',
            price: 200,
            activated: false,
          }],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        activateLicense: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('License'));
      expect(screen.getByText('Software License: Test Software')).toBeInTheDocument();
      expect(screen.getByText(/\$200 value/)).toBeInTheDocument();
    });

    it('should show activated status for activated licenses', () => {
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          subject: 'License',
          attachments: [{
            type: 'softwareLicense',
            softwareId: 'test-sw',
            softwareName: 'Test Software',
            price: 200,
            activated: true,
          }],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        software: [],
      });

      fireEvent.click(screen.getByText('License'));
      expect(screen.getByText('✓ Activated')).toBeInTheDocument();
    });

    it('should call activateLicense when license is clicked', () => {
      const mockActivate = vi.fn();
      renderWithGameContext(<SNetMail />, {
        playerMailId: 'user@sourcenet.local',
        messages: [createMessage({
          id: 'msg-lic',
          subject: 'License',
          attachments: [{
            type: 'softwareLicense',
            softwareId: 'mission-board',
            softwareName: 'Mission Board',
            price: 250,
            activated: false,
          }],
        })],
        markMessageAsRead: vi.fn(),
        archiveMessage: vi.fn(),
        activateLicense: mockActivate,
        software: [],
      });

      fireEvent.click(screen.getByText('License'));
      fireEvent.click(screen.getByText(/Click to add to Portal/));
      expect(mockActivate).toHaveBeenCalledWith('msg-lic', 'mission-board');
    });
  });
});
