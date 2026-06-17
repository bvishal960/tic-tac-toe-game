export class Game {
    constructor() {
        this.board = Array(9).fill("");
        this.currentPlayer = "X"; // Human is always X
        this.aiPlayer = "O";
        this.gameActive = true;
        this.winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
    }

    makeMove(index) {
        if (this.board[index] === "" && this.gameActive) {
            this.board[index] = this.currentPlayer;
            return true;
        }
        return false;
    }

    checkResult() {
        for (let i = 0; i < this.winPatterns.length; i++) {
            const [a, b, c] = this.winPatterns[i];
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                this.gameActive = false;
                return { status: 'win', winner: this.board[a], pattern: [a, b, c] };
            }
        }

        if (!this.board.includes("")) {
            this.gameActive = false;
            return { status: 'draw' };
        }

        return { status: 'ongoing' };
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === "X" ? "O" : "X";
    }

    reset() {
        this.board = Array(9).fill("");
        this.currentPlayer = "X";
        this.gameActive = true;
    }
}
