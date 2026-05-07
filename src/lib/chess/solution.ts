import { Chess } from "chess.js";

export type MoveResult = "incorrect" | "correct" | "solved";

export interface SolutionState {
  game: Chess;
  solutionMoves: string[];
  currentMoveIndex: number;
  setupFen: string;
  setupMove: string;
}

export function initSolution(fen: string, moves: string[]): SolutionState {
  const setupMove = moves[0];
  const game = new Chess(fen);
  game.move({ from: setupMove.slice(0, 2), to: setupMove.slice(2, 4), promotion: setupMove[4] });
  return { game, solutionMoves: moves.slice(1), currentMoveIndex: 0, setupFen: fen, setupMove };
}

// Validates and applies the user's move. Does NOT apply the engine response.
export function applyUserMove(
  state: SolutionState,
  uciMove: string
): { result: MoveResult; state: SolutionState; engineMove?: string } {
  const expected = state.solutionMoves[state.currentMoveIndex];
  if (uciMove !== expected) return { result: "incorrect", state };

  const game = new Chess(state.game.fen());
  game.move({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] });

  const nextIndex = state.currentMoveIndex + 1;
  const newState = { ...state, game, currentMoveIndex: nextIndex };
  const engineMove = state.solutionMoves[nextIndex];

  if (!engineMove) return { result: "solved", state: newState };
  return { result: "correct", state: newState, engineMove };
}

// Applies the engine's response move (call after animationDuration delay).
export function applyEngineMove(state: SolutionState): { state: SolutionState; solved: boolean } {
  const engineMove = state.solutionMoves[state.currentMoveIndex];
  if (!engineMove) return { state, solved: true };

  const game = new Chess(state.game.fen());
  game.move({ from: engineMove.slice(0, 2), to: engineMove.slice(2, 4), promotion: engineMove[4] });

  const nextIndex = state.currentMoveIndex + 1;
  const newState = { ...state, game, currentMoveIndex: nextIndex };
  return { state: newState, solved: nextIndex >= state.solutionMoves.length };
}

export function uciToSquares(uci: string): [string, string] {
  return [uci.slice(0, 2), uci.slice(2, 4)];
}
