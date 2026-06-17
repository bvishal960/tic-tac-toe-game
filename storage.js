const STORAGE_KEY = 'tictactoe_stats';

const defaultStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayed: null,
    difficultyStats: {
        easy: { wins: 0, losses: 0, draws: 0 },
        medium: { wins: 0, losses: 0, draws: 0 },
        hard: { wins: 0, losses: 0, draws: 0 }
    }
};

export const storage = {
    getStats() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return { ...defaultStats };
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse stats, resetting to default', e);
            return { ...defaultStats };
        }
    },

    saveStats(stats) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    },

    updateGameResult(result, difficulty, isMulti = false) {
        const stats = this.getStats();
        stats.totalGames++;
        stats.lastPlayed = new Date().toISOString();

        if (isMulti) {
            if (result === 'winX') stats.multiStats.winsX++;
            else if (result === 'winO') stats.multiStats.winsO++;
            else stats.multiStats.draws++;
        } else {
            if (result === 'win') {
                stats.wins++;
                stats.currentStreak++;
                stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
                stats.difficultyStats[difficulty].wins++;
            } else if (result === 'loss') {
                stats.losses++;
                stats.currentStreak = 0;
                stats.difficultyStats[difficulty].losses++;
            } else {
                stats.draws++;
                stats.difficultyStats[difficulty].draws++;
            }
        }

        this.saveStats(stats);
        return stats;
    },

    resetStats() {
        this.saveStats(defaultStats);
        return { ...defaultStats };
    },

    getSettings() {
        return {
            theme: localStorage.getItem('tictactoe_theme') || 'dark',
            difficulty: localStorage.getItem('tictactoe_difficulty') || 'medium',
            sound: localStorage.getItem('tictactoe_sound') !== 'false'
        };
    },

    saveSetting(key, value) {
        localStorage.setItem(`tictactoe_${key}`, value);
    }
};
