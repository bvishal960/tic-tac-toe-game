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
        this.opponentId = null;
        this.disconnectTimer = null;
        this.pendingRequest = null;
        this.initDOM();
        this.bindEvents();
        this.applySettings();
        this.updateScoreboard();

        // Auto-reconnect check
        const savedRoom = storage.getRoomState();
        if (savedRoom) {
            this.roomId = savedRoom.roomId;
            this.playerSymbol = savedRoom.playerSymbol;
            this.mode = 'online';
            this.updateModeUI();
            this.displayRoomCode.innerText = this.roomId;
            this.roomDisplay.style.display = 'block';
            this.listenToRoom();
        }
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
        this.requestModal = document.getElementById('request-modal');
        this.requestText = document.getElementById('request-text');
        this.acceptRequestBtn = document.getElementById('accept-request-btn');
        this.declineRequestBtn = document.getElementById('decline-request-btn');
        this.roomDisplay = document.getElementById('room-display');
        this.displayRoomCode = document.getElementById('display-room-code');
        this.copyRoomBtn = document.getElementById('copy-room-btn');
        this.exitRoomBtn = document.getElementById('exit-room-btn');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.disconnectModal = document.getElementById('disconnect-modal');
        this.newGameDisconnectedBtn = document.getElementById('new-game-disconnected-btn');
        this.homeBtn = document.getElementById('home-btn');
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

        this.restartBtn.addEventListener('click', () => this.handleAction('restart'));
        this.newGameBtn.addEventListener('click', () => this.handleAction('newGame'));
        this.playAgainBtn.addEventListener('click', () => {
            if (this.mode === 'online') {
                this.requestRematch();
            } else {
                this.restartGame();
            }
        });
        this.resetStatsBtn.addEventListener('click', () => this.resetStats());

        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.soundToggle.addEventListener('click', () => this.toggleSound());
        this.statsBtn.addEventListener('click', () => this.openStats());
        this.closeModal.addEventListener('click', () => this.statsModal.style.display = 'none');
        this.newGameDisconnectedBtn.addEventListener('click', () => { this.disconnectModal.style.display = 'none'; this.handleAction('newGame'); });
        this.homeBtn.addEventListener('click', () => location.reload());
        
        this.acceptRequestBtn.addEventListener('click', () => this.respondToRequest(true));
        this.declineRequestBtn.addEventListener('click', () => this.respondToRequest(false));
        
        this.copyRoomBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.roomId);
            alert('Room code copied: ' + this.roomId);
        });
        
        this.exitRoomBtn.addEventListener('click', () => this.exitRoom());
        
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
        
        storage.saveRoomState({ roomId: this.roomId, playerSymbol: this.playerSymbol });
        
        console.log('Room Created:', this.roomId);
        
        try {
            await firebaseService.set(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), {
                board: this.game.board,
                currentPlayer: 'X',
                status: 'waiting'
            });
            console.log('Firebase Write Success: Room initialized');
            
            this.displayRoomCode.innerText = this.roomId;
            this.roomDisplay.style.display = 'block';
            
            this.listenToRoom();
            this.statusElement.innerText = `Waiting for opponent...`;
        } catch (error) {
            console.error('Error creating room:', error);
            this.statusElement.innerText = "Error creating room.";
        }
    }

    async joinRoom() {
        const roomCode = this.roomCodeInput.value.toUpperCase();
        if (!roomCode) return;
        this.roomId = roomCode;
        this.playerSymbol = 'O';
        this.roomModal.style.display = 'none';
        
        storage.saveRoomState({ roomId: this.roomId, playerSymbol: this.playerSymbol });
        
        console.log('Attempting to join room:', this.roomId);
        
        try {
            // Update room status to playing
            await firebaseService.update(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), {
                status: 'playing'
            });
            console.log('Firebase Write Success: Room updated to playing');
            
            this.listenToRoom();
            this.statusElement.innerText = `Joined room ${this.roomId}`;
            console.log('Room Joined:', this.roomId);
        } catch (error) {
            console.error('Error joining room:', error);
            this.statusElement.innerText = "Error joining room.";
        }
    }

    exitRoom() {
        if (!confirm('Are you sure you want to leave the room?')) return;
        
        storage.clearRoomState();
        location.reload();
    }

    handleAction(action) {
        if (this.mode === 'online' && this.roomId) {
            const requestData = {
                type: action,
                sender: this.playerSymbol,
                status: 'pending'
            };
            firebaseService.update(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), {
                pendingRequest: requestData
            });
            this.statusElement.innerText = "Request sent. Waiting...";
        } else {
            this.restartGame();
        }
    }

    respondToRequest(accepted) {
        if (this.mode === 'online' && this.roomId) {
            if (accepted) {
                const resetData = {
                    board: Array(9).fill(""),
                    currentPlayer: 'X',
                    status: 'playing',
                    winner: null,
                    winningPattern: null,
                    rematchX: null,
                    rematchO: null,
                    pendingRequest: null
                };
                firebaseService.update(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), resetData);
            } else {
                firebaseService.update(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), {
                    pendingRequest: null
                });
            }
        } else {
            if (accepted) {
                this.restartGame();
            }
        }
        this.requestModal.style.display = 'none';
    }

    requestRematch() {
        if (!this.roomId) return;
        const rematchField = this.playerSymbol === 'X' ? 'rematchX' : 'rematchO';
        firebaseService.update(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), {
            [rematchField]: true
        });
        this.playAgainBtn.innerText = "Waiting for opponent...";
        this.playAgainBtn.disabled = true;
    }

    listenToRoom() {
        const roomRef = firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId);
        
        // Handle disconnect: update status to disconnected
        firebaseService.onDisconnect(roomRef).update({ 
            [this.playerSymbol === 'X' ? 'playerXOnline' : 'playerOOnline']: false,
            disconnectedAt: firebaseService.serverTimestamp()
        });
        
        // Mark current player as online
        firebaseService.update(roomRef, { 
            [this.playerSymbol === 'X' ? 'playerXOnline' : 'playerOOnline']: true 
        });

        firebaseService.onValue(roomRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            // Opponent disconnect handling
            const opponentOnline = this.playerSymbol === 'X' ? data.playerOOnline : data.playerXOnline;
            
            if (opponentOnline === false) {
                this.statusElement.innerText = "Opponent Offline";
                this.disconnectModal.style.display = 'flex';
                // Start 60s timer
                if (!this.disconnectTimer) {
                    this.disconnectTimer = setTimeout(() => this.handleAbandonment(), 60000);
                }
            } else {
                this.statusElement.innerText = this.game.currentPlayer === this.playerSymbol ? "Your Turn" : "Opponent's Turn";
                this.disconnectModal.style.display = 'none';
                clearTimeout(this.disconnectTimer);
                this.disconnectTimer = null;
            }

            // Rematch Synchronization: If both players clicked Rematch, automatically start a new match.
            if (this.mode === 'online' && data.rematchX && data.rematchO) {
                if (this.playerSymbol === 'X') {
                    const resetData = {
                        board: Array(9).fill(""),
                        currentPlayer: 'X',
                        status: 'playing',
                        winner: null,
                        winningPattern: null,
                        rematchX: null,
                        rematchO: null,
                        pendingRequest: null
                    };
                    firebaseService.update(roomRef, resetData);
                }
            }

            // Request Handling
            if (data.pendingRequest && data.pendingRequest.sender !== this.playerSymbol) {
                this.pendingRequest = data.pendingRequest;
                if (this.pendingRequest.type === 'newGame') {
                    this.requestText.innerText = `Player ${this.pendingRequest.sender} wants to start a new game.`;
                } else {
                    this.requestText.innerText = `Player ${this.pendingRequest.sender} wants to ${this.pendingRequest.type} the match.`;
                }
                this.requestModal.style.display = 'flex';
            } else {
                this.requestModal.style.display = 'none';
            }

            this.game.board = data.board;
            this.game.currentPlayer = data.currentPlayer;
            this.game.gameActive = data.status === 'playing';
            
            this.updateBoardUI();
            
            if (data.status === 'playing') {
                // Clear any leftover result state & hide result overlay
                this.resultOverlay.style.display = 'none';
                const board = document.getElementById('board');
                if (board) {
                    board.className = 'game-board';
                }
                this.playAgainBtn.innerText = this.mode === 'online' ? "Rematch" : "Play Again";
                this.playAgainBtn.disabled = false;
            }

            if (data.winner) {
                this.processResult({ status: 'win', winner: data.winner, pattern: data.winningPattern || [] });
            } else if (data.status === 'draw') {
                this.processResult({ status: 'draw' });
            }

            // Keep Rematch Button State perfectly synchronized with database
            if (this.mode === 'online' && (data.status === 'finished' || data.status === 'draw')) {
                const myRematch = this.playerSymbol === 'X' ? data.rematchX : data.rematchO;
                if (myRematch) {
                    this.playAgainBtn.innerText = "Waiting for opponent...";
                    this.playAgainBtn.disabled = true;
                } else {
                    this.playAgainBtn.innerText = "Rematch";
                    this.playAgainBtn.disabled = false;
                }
            }
        });
    }

    handleAbandonment() {
        firebaseService.update(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), { status: 'abandoned' });
        this.statusElement.innerText = "Match Abandoned";
        document.getElementById('disconnect-msg').innerText = "Opponent did not reconnect.";
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

        // Turn Lock: Only allow move if it's player's turn in single or online mode
        if (this.mode === 'single' && this.game.currentPlayer !== 'X') return;
        if (this.mode === 'online' && this.game.currentPlayer !== this.playerSymbol) return;

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
            
            // Apply haptic touch depression micro-animation
            cell.classList.add('haptic-tap');
            
            const result = this.game.checkResult();
            
            if (this.mode === 'online') {
                const updateData = {
                    board: this.game.board,
                    currentPlayer: this.game.currentPlayer === 'X' ? 'O' : 'X',
                    status: 'playing'
                };
                if (result.status === 'win') {
                    updateData.winner = result.winner;
                    updateData.winningPattern = result.pattern;
                    updateData.status = 'finished';
                } else if (result.status === 'draw') {
                    updateData.status = 'draw';
                }
                
                firebaseService.update(firebaseService.ref(firebaseService.db, 'rooms/' + this.roomId), updateData);
            }
            
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
                this.showResult(winner === 'X' ? 'You Win!' : 'CPU Wins!');
            } else if (this.mode === 'online') {
                // For online, both players update their local stats based on THEIR perspective
                const amIWinner = winner === this.playerSymbol;
                storage.updateGameResult(amIWinner ? (this.playerSymbol === 'X' ? 'winX' : 'winO') : (this.playerSymbol === 'X' ? 'winO' : 'winX'), this.difficulty, true);
                this.showResult(amIWinner ? 'You Win!' : 'You Lose!');
            } else {
                storage.updateGameResult(winner === 'X' ? 'winX' : 'winO', this.difficulty, true);
                this.showResult(`Player ${winner} Wins!`);
            }
            this.updateScoreboard();
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
        // Ensure stats and multiStats exist to prevent crashes
        const safeStats = stats || {};
        const multiStats = safeStats.multiStats || { winsX: 0, winsO: 0, draws: 0 };

        if (this.mode === 'single') {
            this.scoreX.innerText = safeStats.wins || 0;
            this.scoreO.innerText = safeStats.losses || 0;
            this.scoreDraw.innerText = safeStats.draws || 0;
        } else {
            this.scoreX.innerText = multiStats.winsX || 0;
            this.scoreO.innerText = multiStats.winsO || 0;
            this.scoreDraw.innerText = multiStats.draws || 0;
        }
    }

    showResult(text) {
        this.resultText.innerText = text;
        this.statusElement.innerText = "Game Over";
        if (this.mode === 'online') {
            this.playAgainBtn.innerText = "Rematch";
        } else {
            this.playAgainBtn.innerText = "Play Again";
        }
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
