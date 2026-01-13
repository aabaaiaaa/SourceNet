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
        // Create a save using the correct array format
        const saves = {
            TestPlayer: [{
                username: 'TestPlayer',
                currentTime: new Date().toISOString(),
                reputation: 5,
                savedAt: new Date().toISOString(),
                saveName: 'Test Save',
            }],
        };
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));

        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        expect(screen.getByText('TestPlayer')).toBeInTheDocument();
        expect(screen.getByText('Load Latest')).toBeInTheDocument();
        expect(screen.getByText('Delete All')).toBeInTheDocument();
    });

    it('should show empty saves list when no saves exist', () => {
        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        const savesList = document.querySelector('.saves-list');
        // When no saves, there's a "no saves" message
        expect(savesList.children.length).toBe(1);
        expect(screen.getByText(/no saved games found/i)).toBeInTheDocument();
    });

    it('should handle delete save with confirmation', () => {
        // Mock window.confirm and window.location.reload
        global.confirm = vi.fn(() => true);
        global.location = { ...global.location, reload: vi.fn() };

        const saves = {
            TestPlayer: [{
                username: 'TestPlayer',
                currentTime: new Date().toISOString(),
                savedAt: new Date().toISOString(),
                saveName: 'Test Save',
            }],
        };
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));

        render(
            <GameProvider>
                <GameLoginScreen />
            </GameProvider>
        );

        const deleteButton = screen.getByText('Delete All');
        fireEvent.click(deleteButton);

        expect(global.confirm).toHaveBeenCalledWith('Delete ALL saves for TestPlayer?');
        const updatedSaves = JSON.parse(localStorage.getItem('sourcenet_saves'));
        expect(updatedSaves.TestPlayer).toBeUndefined();
        expect(global.location.reload).toHaveBeenCalled();
    });

    it('should display multiple saves', () => {
        const saves = {
            Player1: [{ username: 'Player1', savedAt: new Date().toISOString(), saveName: 'Save 1' }],
            Player2: [{ username: 'Player2', savedAt: new Date().toISOString(), saveName: 'Save 2' }],
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
