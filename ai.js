export const ai = {
    /**
     * Get the next move based on difficulty
     */
    getMove(board, difficulty, aiPlayer, humanPlayer) {
        switch (difficulty) {
            case 'easy':
                return this.getRandomMove(board);
            case 'medium':
                return this.getMediumMove(board, aiPlayer, humanPlayer);
            case 'hard':
                return this.getBestMove(board, aiPlayer, humanPlayer);
            default:
                return this.getRandomMove(board);
        }
    },

    getRandomMove(board) {
        const availableMoves = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    },

    getMediumMove(board, aiPlayer, humanPlayer) {
        // 1. Try to win
        const winningMove = this.findWinningMove(board, aiPlayer);
        if (winningMove !== null) return winningMove;

        // 2. Try to block
        const blockingMove = this.findWinningMove(board, humanPlayer);
        if (blockingMove !== null) return blockingMove;

        // 3. Otherwise random (with some bias toward center)
        if (board[4] === "") return 4;
        return this.getRandomMove(board);
    },

    findWinningMove(board, player) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            const values = [board[a], board[b], board[c]];
            const playerCount = values.filter(v => v === player).length;
            const emptyCount = values.filter(v => v === "").length;

            if (playerCount === 2 && emptyCount === 1) {
                return pattern[values.indexOf("")];
            }
        }
        return null;
    },

    // Minimax Implementation for Hard Mode
    getBestMove(board, aiPlayer, humanPlayer) {
        let bestScore = -Infinity;
        let move;
        
        for (let i = 0; i < 9; i++) {
            if (board[i] === "") {
                board[i] = aiPlayer;
                let score = this.minimax(board, 0, false, aiPlayer, humanPlayer);
                board[i] = "";
                if (score > bestScore) {
                    bestScore = score;
                    move = i;
                }
            }
        }
        return move;
    },

    minimax(board, depth, isMaximizing, aiPlayer, humanPlayer) {
        const result = this.checkWinner(board, aiPlayer, humanPlayer);
        if (result !== null) {
            return result;
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === "") {
                    board[i] = aiPlayer;
                    let score = this.minimax(board, depth + 1, false, aiPlayer, humanPlayer);
                    board[i] = "";
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === "") {
                    board[i] = humanPlayer;
                    let score = this.minimax(board, depth + 1, true, aiPlayer, humanPlayer);
                    board[i] = "";
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    },

    checkWinner(board, aiPlayer, humanPlayer) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a] === aiPlayer ? 10 : -10;
            }
        }

        if (!board.includes("")) return 0;
        return null;
    }
};
