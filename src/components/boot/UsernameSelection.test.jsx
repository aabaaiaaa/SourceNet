import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import UsernameSelection from './UsernameSelection';

// Mock initializePlayer
const mockInitializePlayer = vi.fn();
const mockGenerateUsername = vi.fn(() => 'GeneratedUser');

vi.mock('../../contexts/useGame', () => ({
  useGame: vi.fn(() => ({
    initializePlayer: mockInitializePlayer,
    generateUsername: mockGenerateUsername,
  })),
}));

import { useGame } from '../../contexts/useGame';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

const renderComponent = () => {
  return render(<UsernameSelection />);
};

describe('UsernameSelection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateUsername.mockReturnValue('GeneratedUser');
  });

  // ========================================================================
  // Rendering
  // ========================================================================

  describe('rendering', () => {
    it('should render username selection screen', () => {
      renderComponent();
      expect(screen.getByText(/Welcome to OSNet/i)).toBeInTheDocument();
    });

    it('should have username input', () => {
      renderComponent();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should have continue button', () => {
      renderComponent();
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('should display maximum character hint', () => {
      renderComponent();
      expect(screen.getByText(/Maximum 15 characters/i)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Pre-population
  // ========================================================================

  describe('pre-population', () => {
    it('should pre-populate with generated username', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      expect(input.value).toBe('GeneratedUser');
    });

    it('should call generateUsername on mount', () => {
      renderComponent();

      expect(mockGenerateUsername).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Input validation
  // ========================================================================

  describe('input validation', () => {
    it('should not submit empty username', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Continue');

      // Clear the input
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(button);

      expect(mockInitializePlayer).not.toHaveBeenCalled();
    });

    it('should not submit whitespace-only username', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Continue');

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(button);

      expect(mockInitializePlayer).not.toHaveBeenCalled();
    });

    it('should have maxLength attribute of 15', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      expect(input.maxLength).toBe(15);
    });

    it('should allow usernames up to 15 characters', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Continue');

      fireEvent.change(input, { target: { value: 'FifteenCharName' } }); // Exactly 15
      fireEvent.click(button);

      expect(mockInitializePlayer).toHaveBeenCalledWith('FifteenCharName');
    });
  });

  // ========================================================================
  // Whitespace trimming
  // ========================================================================

  describe('whitespace trimming', () => {
    it('should trim leading whitespace from username', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Continue');

      fireEvent.change(input, { target: { value: '  LeadingSpace' } });
      fireEvent.click(button);

      expect(mockInitializePlayer).toHaveBeenCalledWith('LeadingSpace');
    });

    it('should trim trailing whitespace from username', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Continue');

      fireEvent.change(input, { target: { value: 'TrailingSpace  ' } });
      fireEvent.click(button);

      expect(mockInitializePlayer).toHaveBeenCalledWith('TrailingSpace');
    });

    it('should trim both leading and trailing whitespace', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Continue');

      fireEvent.change(input, { target: { value: '  Both  ' } });
      fireEvent.click(button);

      expect(mockInitializePlayer).toHaveBeenCalledWith('Both');
    });
  });

  // ========================================================================
  // Submission
  // ========================================================================

  describe('submission', () => {
    it('should call initializePlayer on valid submit', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Continue');

      fireEvent.change(input, { target: { value: 'TestUser' } });
      fireEvent.click(button);

      expect(mockInitializePlayer).toHaveBeenCalledWith('TestUser');
    });

    it('should submit on form submit (enter key)', () => {
      renderComponent();

      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'EnterUser' } });
      fireEvent.submit(input.closest('form'));

      expect(mockInitializePlayer).toHaveBeenCalledWith('EnterUser');
    });

    it('should only call initializePlayer once per submit', () => {
      renderComponent();

      const button = screen.getByText('Continue');

      fireEvent.click(button);

      expect(mockInitializePlayer).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // Input interaction
  // ========================================================================

  describe('input interaction', () => {
    it('should update input value on change', () => {
      renderComponent();

      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'NewValue' } });

      expect(input.value).toBe('NewValue');
    });

    it('should have autofocus on input', () => {
      renderComponent();

      const input = screen.getByRole('textbox');
      // React renders autoFocus as the HTML attribute autofocus (lowercase)
      expect(input).toHaveFocus();
    });
  });
});
