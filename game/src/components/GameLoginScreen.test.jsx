import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameProvider } from '../contexts/GameContext';
import GameLoginScreen from './GameLoginScreen';

describe('GameLoginScreen', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should render the login screen with title', () => {
        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        expect(screen.getByText('SOURCENET')).toBeInTheDocument();
        expect(screen.getByText(/select a saved game/i)).toBeInTheDocument();
    });

    it('should show new game button', () => {
        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        expect(screen.getByText('+ New Game')).toBeInTheDocument();
    });

    it('should display saved games', () => {
        // Create a save using the correct format
        const saves = {
            TestPlayer: {
                username: 'TestPlayer',
                currentTime: new Date().toISOString(),
                reputation: 5,
            },
        };
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));

        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        expect(screen.getByText('TestPlayer')).toBeInTheDocument();
        expect(screen.getByText('Load')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should show empty saves list when no saves exist', () => {
        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        const savesList = document.querySelector('.saves-list');
        expect(savesList.children.length).toBe(0);
    });

    it('should handle delete save with confirmation', () => {
        // Mock window.confirm and window.location.reload
        global.confirm = vi.fn(() => true);
        global.location = { ...global.location, reload: vi.fn() };

        const saves = {
            TestPlayer: {
                username: 'TestPlayer',
                currentTime: new Date().toISOString(),
            },
        };
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));

        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);

        expect(global.confirm).toHaveBeenCalledWith('Delete save for TestPlayer?');
        const updatedSaves = JSON.parse(localStorage.getItem('sourcenet_saves'));
        expect(updatedSaves.TestPlayer).toBeUndefined();
        expect(global.location.reload).toHaveBeenCalled();
    });

    it('should display multiple saves', () => {
        const saves = {
            Player1: { username: 'Player1' },
            Player2: { username: 'Player2' },
        };
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));

        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        expect(screen.getByText('Player1')).toBeInTheDocument();
        expect(screen.getByText('Player2')).toBeInTheDocument();
    });
});
