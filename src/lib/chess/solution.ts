import { Chess } from "chess.js";

export type MoveResult = "correct" | "incorrect" | "solved";

export interface SolutionState {
  game: Chess;          // current board position (after setup move)
  solutionMoves: string[]; // moves[1..] — what the user needs to play
  currentMoveIndex: number;
  setupFen: string;     // original FEN (before opponent's last move)
  setupMove: string;    // moves[0] — opponent's last move, shown as animation
}

export function initSolution(fen: string, moves: string[]): SolutionState {
  // moves[0] is the opponent's last move that set up the puzzle
  const setupMove = moves[0];
  const game = new Chess(fen);
  game.move({ from: setupMove.slice(0, 2), to: setupMove.slice(2, 4), promotion: setupMove[4] });

  return {
    game,
    solutionMoves: moves.slice(1),
    currentMoveIndex: 0,
    setupFen: fen,
    setupMove,
  };
}

export function applyMove(
  state: SolutionState,
  uciMove: string
): { result: MoveResult; state: SolutionState } {
  const expected = state.solutionMoves[state.currentMoveIndex];

  if (uciMove !== expected) {
    return { result: "incorrect", state };
  }

  const game = new Chess(state.game.fen());
  game.move({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] });

  const nextIndex = state.currentMoveIndex + 1;
  const engineMove = state.solutionMoves[nextIndex];

  if (!engineMove) {
    return { result: "solved", state: { ...state, game, currentMoveIndex: nextIndex } };
  }

  // Apply engine response automatically
  const afterEngine = new Chess(game.fen());
  afterEngine.move({ from: engineMove.slice(0, 2), to: engineMove.slice(2, 4), promotion: engineMove[4] });

  const isLastUserMove = nextIndex + 1 >= state.solutionMoves.length;
  return {
    result: isLastUserMove ? "solved" : "correct",
    state: { ...state, game: afterEngine, currentMoveIndex: nextIndex + 1 },
  };
}

export function uciToSquares(uci: string): [string, string] {
  return [uci.slice(0, 2), uci.slice(2, 4)];
}
