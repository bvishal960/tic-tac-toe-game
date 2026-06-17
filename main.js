import { Game } from './game.js';
import { ai } from './ai.js';
import { storage } from './storage.js';

class App {
    constructor() {
        this.game = new Game();
        this.mode = 'single';
        this.difficulty = storage.getSettings().difficulty;
        this.isSoundOn = storage.getSettings().sound;
        this.audioCtx = null;
        this.initDOM();
        this.bindEvents();
        this.applySettings();
        this.updateScoreboard();
    }

    initDOM() {
        this.cells = document.querySelectorAll('.cell');
        this.statusElement = document.getElementById('status');
        this.modeSelect = document.getElementById('mode-select');
        this.diffSelect = document.getElementById('difficulty-select');
        this.diffGroup = document.getElementById('diff-group');
        this.scoreX = document.getElementById('score-x');
        this.scoreO = document.getElementById('score-o');
        this.scoreDraw = document.getElementById('score-draw');
        this.scoreOLabel = document.getElementById('score-o-label');
        this.restartBtn = document.getElementById('restart-btn');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.resetStatsBtn = document.getElementById('reset-stats-btn');
        this.themeToggle = document.getElementById('theme-toggle');
        this.soundToggle = document.getElementById('sound-toggle');
        this.statsBtn = document.getElementById('stats-btn');
        this.statsModal = document.getElementById('stats-modal');
        this.closeModal = document.querySelector('.close-modal');
        this.resultOverlay = document.getElementById('result-overlay');
        this.resultText = document.getElementById('result-text');
        this.playAgainBtn = document.getElementById('play-again-btn');
    }

    bindEvents() {
        this.cells.forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });

        this.modeSelect.addEventListener('change', (e) => {
            this.mode = e.target.value;
            this.updateModeUI();
            this.restartGame();
        });

        this.diffSelect.addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            storage.saveSetting('difficulty', this.difficulty);
            this.restartGame();
        });

        this.restartBtn.addEventListener('click', () => this.restartGame());
        this.newGameBtn.addEventListener('click', () => this.restartGame());
        this.playAgainBtn.addEventListener('click', () => this.restartGame());
        this.resetStatsBtn.addEventListener('click', () => this.resetStats());

        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.soundToggle.addEventListener('click', () => this.toggleSound());
        this.statsBtn.addEventListener('click', () => this.openStats());
        this.closeModal.addEventListener('click', () => this.statsModal.style.display = 'none');

        window.addEventListener('click', (e) => {
            if (e.target === this.statsModal) this.statsModal.style.display = 'none';
        });
    }

    applySettings() {
        const settings = storage.getSettings();
        if (settings.theme === 'dark') document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
        
        this.isSoundOn = settings.sound;
        this.soundToggle.classList.toggle('muted', !this.isSoundOn);
        this.diffSelect.value = this.difficulty;
        this.updateModeUI();
    }

    updateModeUI() {
        if (this.mode === 'multi') {
            this.scoreOLabel.innerText = 'Player O';
            this.diffGroup.style.display = 'none';
        } else {
            this.scoreOLabel.innerText = 'CPU';
            this.diffGroup.style.display = 'block';
        }
        this.updateScoreboard();
    }

    handleCellClick(e) {
        const index = e.target.dataset.index;
        if (!this.game.gameActive || this.game.board[index] !== "") return;

        // Turn Lock: Only allow move if it's player's turn in single mode
        if (this.mode === 'single' && this.game.currentPlayer !== 'X') return;

        // Player Move
        this.makeMove(index);

        if (this.game.gameActive) {
            if (this.mode === 'single') {
                this.statusElement.innerText = "AI Thinking...";
                setTimeout(() => this.aiMove(), 500);
            } else {
                this.statusElement.innerText = `Player ${this.game.currentPlayer}'s Turn`;
            }
        }
    }

    makeMove(index) {
        const player = this.game.currentPlayer;
        if (this.game.makeMove(index)) {
            const cell = this.cells[index];
            cell.innerText = player;
            cell.classList.add(player.toLowerCase());
            this.playSound('click');
            this.vibrate(10);
            this.processResult();
            
            if (this.game.gameActive) {
                this.game.switchPlayer();
            }
        }
    }

    aiMove() {
        if (!this.game.gameActive) return;
        const move = ai.getMove([...this.game.board], this.difficulty, 'O', 'X');
        if (move !== undefined) {
            this.makeMove(move);
            if (this.game.gameActive) {
                this.statusElement.innerText = "Player X's Turn";
            }
        }
    }

    processResult() {
        const result = this.game.checkResult();
        if (result.status === 'win') {
            const winner = result.winner;
            result.pattern.forEach(idx => this.cells[idx].classList.add('winner'));
            this.playSound('win');
            
            if (this.mode === 'single') {
                storage.updateGameResult(winner === 'X' ? 'win' : 'loss', this.difficulty);
            } else {
                storage.updateGameResult(winner === 'X' ? 'winX' : 'winO', this.difficulty, true);
            }
            this.updateScoreboard();
            this.showResult(this.mode === 'multi' ? `Player ${winner} Wins!` : (winner === 'X' ? 'You Win!' : 'CPU Wins!'));
        } else if (result.status === 'draw') {
            storage.updateGameResult('draw', this.difficulty, this.mode === 'multi');
            this.updateScoreboard();
            this.showResult("It's a Draw!");
        }
    }

    updateScoreboard() {
        const stats = storage.getStats();
        if (this.mode === 'single') {
            this.scoreX.innerText = stats.wins;
            this.scoreO.innerText = stats.losses;
            this.scoreDraw.innerText = stats.draws;
        } else {
            this.scoreX.innerText = stats.multiStats.winsX;
            this.scoreO.innerText = stats.multiStats.winsO;
            this.scoreDraw.innerText = stats.multiStats.draws;
        }
    }

    showResult(text) {
        this.resultText.innerText = text;
        this.statusElement.innerText = "Game Over";
        setTimeout(() => this.resultOverlay.style.display = 'flex', 300);
    }

    restartGame() {
        this.game.reset();
        this.cells.forEach(cell => {
            cell.innerText = "";
            cell.className = 'cell';
        });
        this.resultOverlay.style.display = 'none';
        this.statusElement.innerText = "Player X's Turn";
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        storage.saveSetting('theme', isDark ? 'dark' : 'light');
    }

    toggleSound() {
        this.isSoundOn = !this.isSoundOn;
        storage.saveSetting('sound', this.isSoundOn);
        this.soundToggle.classList.toggle('muted', !this.isSoundOn);
        if (this.isSoundOn) this.initAudio();
    }

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playSound(type) {
        if (!this.isSoundOn) return;
        this.initAudio();
        try {
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            osc.connect(g);
            g.connect(this.audioCtx.destination);
            if (type === 'click') {
                osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
                osc.start(); osc.stop(this.audioCtx.currentTime + 0.1);
            } else {
                osc.frequency.setValueAtTime(500, this.audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.3);
                g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
                osc.start(); osc.stop(this.audioCtx.currentTime + 0.3);
            }
        } catch(e) {}
    }

    vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

    resetStats() {
        if (confirm('Reset all statistics?')) {
            storage.resetStats();
            this.updateScoreboard();
        }
    }

    openStats() {
        const stats = storage.getStats();
        document.getElementById('total-matches').innerText = stats.totalGames;
        const rate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
        document.getElementById('win-rate').innerText = `${rate}%`;
        document.getElementById('best-streak').innerText = stats.bestStreak;

        const list = document.getElementById('diff-stats-list');
        list.innerHTML = '';
        ['easy', 'medium', 'hard'].forEach(d => {
            const s = stats.difficultyStats[d];
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.fontSize = '0.8rem';
            div.style.margin = '5px 0';
            div.innerHTML = `<span style="text-transform:capitalize">${d}</span><span>W:${s.wins} L:${s.losses} D:${s.draws}</span>`;
            list.appendChild(div);
        });
        this.statsModal.style.display = 'flex';
    }
}

document.addEventListener('DOMContentLoaded', () => new App());
