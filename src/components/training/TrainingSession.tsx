"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { nextPuzzle, onAttempt, onAttemptWithHint, type QueueState } from "@/lib/training/queue";
import { initSolution, applyMove, uciToSquares, type SolutionState } from "@/lib/chess/solution";
import PuzzleBoard from "@/components/board/PuzzleBoard";

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number | null;
  themes: string[] | null;
}

interface Session {
  id: string;
  cycle_number: number;
  queue_state: QueueState;
}

interface Props {
  session: Session;
  puzzles: Puzzle[];
}

export default function TrainingSession({ session, puzzles }: Props) {
  const supabase = createClient();

  const puzzleMap = useMemo(
    () => new Map(puzzles.map((p) => [p.id, p])),
    [puzzles]
  );

  const [queueState, setQueueState] = useState<QueueState>(session.queue_state as QueueState);
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string | null>(null);
  const [solutionState, setSolutionState] = useState<SolutionState | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "solved" | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [setupPhase, setSetupPhase] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [hintsUsed, setHintsUsed] = useState(0); // 0 = none, 1 = themes shown, 2 = piece shown

  const markSessionComplete = useCallback(async () => {
    await supabase
      .from("training_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", session.id);
  }, [supabase, session.id]);

  const loadNextPuzzle = useCallback((state: QueueState) => {
    const { puzzleId, state: newQueueState } = nextPuzzle(state);
    if (!puzzleId) {
      setSessionDone(true);
      markSessionComplete();
      return;
    }
    const puzzle = puzzleMap.get(puzzleId);
    if (!puzzle) {
      loadNextPuzzle(newQueueState);
      return;
    }

    const sol = initSolution(puzzle.fen, puzzle.moves);
    setCurrentPuzzleId(puzzleId);
    setQueueState(newQueueState);
    setSolutionState(sol);
    setFeedback(null);
    setHintsUsed(0);
    setBoardOrientation(sol.game.turn() === "w" ? "white" : "black");

    setSetupPhase(true);
    setTimeout(() => {
      setSetupPhase(false);
      setStartTime(Date.now());
    }, 900);
  }, [puzzleMap, markSessionComplete]);

  useEffect(() => {
    loadNextPuzzle(session.queue_state as QueueState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function persistQueueState(state: QueueState) {
    await supabase
      .from("training_sessions")
      .update({ queue_state: state })
      .eq("id", session.id);
  }

  async function recordAttempt(puzzleId: string, correct: boolean) {
    await supabase.from("puzzle_attempts").insert({
      session_id: session.id,
      puzzle_id: puzzleId,
      solved_correctly: correct,
      time_taken_ms: Date.now() - startTime,
    });
  }

  async function handleMove(uciMove: string) {
    if (!solutionState || !currentPuzzleId || setupPhase) return;

    const { result, state: newSolutionState } = applyMove(solutionState, uciMove);
    setSolutionState(newSolutionState);
    setFeedback(result === "incorrect" ? "incorrect" : result === "solved" ? "solved" : "correct");

    if (result === "incorrect") {
      await recordAttempt(currentPuzzleId, false);
      const newQueueState = onAttempt(queueState, currentPuzzleId, false);
      await persistQueueState(newQueueState);
      setQueueState(newQueueState);
    }

    if (result === "solved") {
      let newQueueState: QueueState;
      if (hintsUsed > 0) {
        await recordAttempt(currentPuzzleId, false);
        newQueueState = onAttemptWithHint(queueState, currentPuzzleId);
      } else {
        await recordAttempt(currentPuzzleId, true);
        newQueueState = onAttempt(queueState, currentPuzzleId, true);
      }
      await persistQueueState(newQueueState);
      setQueueState(newQueueState);
      setTimeout(() => loadNextPuzzle(newQueueState), 800);
    }
  }

  async function handleGiveUp() {
    if (!currentPuzzleId || setupPhase) return;
    await recordAttempt(currentPuzzleId, false);
    const newQueueState = onAttempt(queueState, currentPuzzleId, false);
    await persistQueueState(newQueueState);
    setQueueState(newQueueState);
    loadNextPuzzle(newQueueState);
  }

  if (sessionDone) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 mt-20">
        <h2 className="text-2xl font-bold">Cycle {session.cycle_number} complete!</h2>
        <p className="text-gray-400">Well done. Start the next cycle when you&apos;re ready.</p>
        <a href="/dashboard" className="inline-block px-4 py-2 bg-blue-600 rounded font-medium">
          Back to dashboard
        </a>
      </div>
    );
  }

  const remaining = queueState.mainQueue.length - queueState.mainIndex;
  const puzzle = currentPuzzleId ? puzzleMap.get(currentPuzzleId) : null;

  const boardFen = setupPhase && solutionState
    ? solutionState.setupFen
    : solutionState?.game.fen();

  const arrow: [string, string] | undefined = setupPhase && solutionState
    ? uciToSquares(solutionState.setupMove)
    : undefined;

  // Hint 2: highlight the from-square of the next expected move
  const highlightSquare = !setupPhase && hintsUsed >= 2 && solutionState
    ? solutionState.solutionMoves[solutionState.currentMoveIndex]?.slice(0, 2)
    : undefined;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Cycle {session.cycle_number}</span>
        <span>
          {remaining} remaining
          {queueState.reviewQueue.length > 0 && ` · ${queueState.reviewQueue.length} in review`}
        </span>
      </div>

      {boardFen && (
        <PuzzleBoard
          fen={boardFen}
          onMove={handleMove}
          feedback={setupPhase ? null : feedback}
          arrow={arrow}
          highlightSquare={highlightSquare}
          interactive={!setupPhase}
          boardOrientation={boardOrientation}
        />
      )}

      {setupPhase && (
        <p className="text-center text-sm text-gray-500">Opponent&apos;s last move…</p>
      )}

      {/* Hint 1: themes */}
      {hintsUsed >= 1 && puzzle?.themes && puzzle.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {puzzle.themes.map((t) => (
            <span key={t} className="px-2 py-0.5 bg-yellow-900/50 text-yellow-300 rounded text-xs">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleGiveUp}
          disabled={setupPhase}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-40"
        >
          Give up
        </button>

        {hintsUsed < 1 && (
          <button
            onClick={() => setHintsUsed(1)}
            disabled={setupPhase}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-yellow-400 rounded text-sm disabled:opacity-40"
          >
            Tipp 1 (Thema)
          </button>
        )}

        {hintsUsed === 1 && (
          <button
            onClick={() => setHintsUsed(2)}
            disabled={setupPhase}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-yellow-400 rounded text-sm disabled:opacity-40"
          >
            Tipp 2 (Figur)
          </button>
        )}

        {puzzle?.rating && (
          <span className="ml-auto self-center text-sm text-gray-500">
            Rating: {puzzle.rating}
          </span>
        )}
      </div>
    </div>
  );
}
