import { Game } from './game.js';
import { ai } from './ai.js';
import { storage } from './storage.js';
import { firebaseService } from './firebase-service.js';

class App {
    constructor() {
        this.game = new Game();
        this.mode = 'single';
        this.difficulty = storage.getSettings().difficulty;
        this.isSoundOn = storage.getSettings().sound;
        this.audioCtx = null;
        this.roomId = null;
        this.playerSymbol = null;
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
        this.roomModal = document.getElementById('room-modal');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
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
        
        this.bindRoomEvents();

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
        } else if (this.mode === 'online') {
            this.scoreOLabel.innerText = 'Opponent';
            this.diffGroup.style.display = 'none';
            this.openRoomModal();
        } else {
            this.scoreOLabel.innerText = 'CPU';
            this.diffGroup.style.display = 'block';
        }
        this.updateScoreboard();
    }

    openRoomModal() {
        this.roomModal.style.display = 'flex';
    }

    bindRoomEvents() {
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
    }

    async createRoom() {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.roomId = roomCode;
        this.playerSymbol = 'X';
        this.roomModal.style.display = 'none';
        
        await firebaseService.set(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), {
            board: this.game.board,
            currentPlayer: 'X',
            status: 'waiting'
        });
        
        this.listenToRoom();
        this.statusElement.innerText = `Room: ${this.roomId}. Waiting for opponent...`;
    }

    async joinRoom() {
        const roomCode = this.roomCodeInput.value.toUpperCase();
        if (!roomCode) return;
        this.roomId = roomCode;
        this.playerSymbol = 'O';
        this.roomModal.style.display = 'none';
        
        this.listenToRoom();
        this.statusElement.innerText = `Joined room ${this.roomId}`;
    }

    listenToRoom() {
        firebaseService.onValue(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            this.game.board = data.board;
            this.game.currentPlayer = data.currentPlayer;
            this.game.gameActive = data.status === 'playing';
            
            this.updateBoardUI();
            
            if (data.status === 'waiting') {
                this.statusElement.innerText = `Room: ${this.roomId}. Waiting for opponent...`;
            } else if (data.status === 'playing') {
                this.statusElement.innerText = this.game.currentPlayer === this.playerSymbol ? "Your Turn" : "Opponent's Turn";
            }
            
            if (data.winner) {
                this.processResult({ status: 'win', winner: data.winner, pattern: data.winningPattern || [] });
            } else if (data.status === 'draw') {
                this.processResult({ status: 'draw' });
            }
        });
    }

    updateBoardUI() {
        this.game.board.forEach((val, index) => {
            const cell = this.cells[index];
            cell.innerText = val;
            cell.className = 'cell' + (val ? ' ' + val.toLowerCase() : '');
        });
    }

    handleCellClick(e) {
        const index = e.target.dataset.index;
        if (!this.game.gameActive || this.game.board[index] !== "") return;

        // Turn Lock: Only allow move if it's player's turn in single mode
        if (this.mode === 'single' && this.game.currentPlayer !== 'X') return;

        // Player Move
        this.makeMove(index);
//test
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
            
            // Apply haptic touch depression micro-animation
            cell.classList.add('haptic-tap');
            
            const result = this.game.checkResult();
            
            if (result.status === 'win') {
                // High-energy feedback for the winning move itself
                cell.classList.add('winning-move');
                this.vibrate([15, 30, 20]);
                this.playSound('win-move');
            } else if (result.status === 'draw') {
                // Feedback for draw move
                this.vibrate([35, 60, 35]);
            } else {
                // Crisp click haptic for standard tap
                this.vibrate(12);
                this.playSound('click');
            }

            this.processResult(result);
            
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

    processResult(result) {
        if (!result) result = this.game.checkResult();
        
        if (result.status === 'win') {
            const winner = result.winner;
            
            // Apply winning pattern visual highlight
            result.pattern.forEach(idx => this.cells[idx].classList.add('winner'));
            
            // Add board-level win pulse animation
            const board = document.getElementById('board');
            if (board) {
                board.classList.add('win-pulse');
            }
            
            // Play luxurious celebratory arpeggio sound
            this.playSound('win');
            
            // Celebratory game-win rhythmic haptic sequence
            setTimeout(() => {
                this.vibrate([25, 40, 25, 40, 50, 40, 70]);
            }, 100);
            
            if (this.mode === 'single') {
                storage.updateGameResult(winner === 'X' ? 'win' : 'loss', this.difficulty);
            } else {
                storage.updateGameResult(winner === 'X' ? 'winX' : 'winO', this.difficulty, true);
            }
            this.updateScoreboard();
            this.showResult(this.mode === 'multi' ? `Player ${winner} Wins!` : (winner === 'X' ? 'You Win!' : 'CPU Wins!'));
        } else if (result.status === 'draw') {
            // Shake the board for visual "no" response
            const board = document.getElementById('board');
            if (board) {
                board.classList.add('draw-shake');
            }
            
            // Elegant fade for draw state
            this.cells.forEach(c => {
                if (c.innerText === "") {
                    c.classList.add('draw-empty-fade');
                } else {
                    c.classList.add('draw-fade');
                }
            });
            
            // Play descending soft sigh sound
            this.playSound('draw');
            
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
        
        // Remove board-level animation classes
        const board = document.getElementById('board');
        if (board) {
            board.className = 'game-board';
        }
        
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
            const now = this.audioCtx.currentTime;
            
            if (type === 'click') {
                const osc = this.audioCtx.createOscillator();
                const g = this.audioCtx.createGain();
                osc.connect(g);
                g.connect(this.audioCtx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
                
                g.gain.setValueAtTime(0.15, now);
                g.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                
                osc.start(now);
                osc.stop(now + 0.08);
            } 
            else if (type === 'win-move') {
                // A sparkling rising perfect 5th interval
                const osc = this.audioCtx.createOscillator();
                const g = this.audioCtx.createGain();
                osc.connect(g);
                g.connect(this.audioCtx.destination);
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
                
                g.gain.setValueAtTime(0.1, now);
                g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                
                osc.start(now);
                osc.stop(now + 0.15);
            }
            else if (type === 'win') {
                // Rhythmic major chord arpeggio (C5 - E5 - G5 - C6)
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, index) => {
                    const osc = this.audioCtx.createOscillator();
                    const g = this.audioCtx.createGain();
                    osc.connect(g);
                    g.connect(this.audioCtx.destination);
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + index * 0.08);
                    
                    g.gain.setValueAtTime(0, now + index * 0.08);
                    g.gain.linearRampToValueAtTime(0.15, now + index * 0.08 + 0.02);
                    g.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.3);
                    
                    osc.start(now + index * 0.08);
                    osc.stop(now + index * 0.08 + 0.3);
                });
            } 
            else if (type === 'draw') {
                // A descending soft "sigh"
                const osc = this.audioCtx.createOscillator();
                const g = this.audioCtx.createGain();
                osc.connect(g);
                g.connect(this.audioCtx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(350, now);
                osc.frequency.linearRampToValueAtTime(180, now + 0.35);
                
                g.gain.setValueAtTime(0.12, now);
                g.gain.linearRampToValueAtTime(0.04, now + 0.15);
                g.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
                
                osc.start(now);
                osc.stop(now + 0.35);
            }
        } catch(e) {
            console.warn('Audio feedback failed:', e);
        }
    }

    vibrate(pattern) {
        if (navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Graceful degradation for unsupported/sandboxed contexts
            }
        }
    }

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
