import { Chess } from "chess.js";

export type MoveResult = "correct" | "incorrect" | "solved";

export interface SolutionState {
  game: Chess;
  solutionMoves: string[];
  currentMoveIndex: number;
}

export function initSolution(fen: string, moves: string[]): SolutionState {
  return { game: new Chess(fen), solutionMoves: moves, currentMoveIndex: 0 };
}

export function applyMove(
  state: SolutionState,
  uciMove: string
): { result: MoveResult; state: SolutionState; engineMove?: string } {
  const expected = state.solutionMoves[state.currentMoveIndex];

  if (uciMove !== expected) {
    return { result: "incorrect", state };
  }

  const game = new Chess(state.game.fen());
  game.move({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] });

  const nextIndex = state.currentMoveIndex + 1;

  // Check if there's an engine response move
  const engineMove = state.solutionMoves[nextIndex];
  if (!engineMove) {
    return { result: "solved", state: { ...state, game, currentMoveIndex: nextIndex } };
  }

  // Apply engine response automatically
  const afterEngine = new Chess(game.fen());
  afterEngine.move({ from: engineMove.slice(0, 2), to: engineMove.slice(2, 4), promotion: engineMove[4] });

  const newState: SolutionState = {
    game: afterEngine,
    solutionMoves: state.solutionMoves,
    currentMoveIndex: nextIndex + 1,
  };

  const isLastUserMove = nextIndex + 1 >= state.solutionMoves.length;
  return {
    result: isLastUserMove ? "solved" : "correct",
    state: newState,
    engineMove,
  };
}
