"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { nextPuzzle, onAttempt, type QueueState } from "@/lib/training/queue";
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
  // Setup phase: show opponent's last move before puzzle starts
  const [setupPhase, setSetupPhase] = useState(false);

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

    // Show setup move (opponent's last move) for 900ms before puzzle starts
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

    if (result === "incorrect" || result === "solved") {
      const correct = result === "solved";
      await recordAttempt(currentPuzzleId, correct);
      const newQueueState = onAttempt(queueState, currentPuzzleId, correct);
      await persistQueueState(newQueueState);
      setQueueState(newQueueState);

      if (result === "solved") {
        setTimeout(() => loadNextPuzzle(newQueueState), 800);
      }
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

  // During setup phase: show the board before the opponent's move, with an arrow
  const boardFen = setupPhase && solutionState
    ? solutionState.setupFen
    : solutionState?.game.fen();

  const arrow: [string, string] | undefined = setupPhase && solutionState
    ? uciToSquares(solutionState.setupMove)
    : undefined;

  const puzzle = currentPuzzleId ? puzzleMap.get(currentPuzzleId) : null;

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
          interactive={!setupPhase}
        />
      )}

      {setupPhase && (
        <p className="text-center text-sm text-gray-500">Opponent&apos;s last move…</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleGiveUp}
          disabled={setupPhase}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-40"
        >
          Give up
        </button>
        {puzzle?.rating && (
          <span className="ml-auto text-sm text-gray-500">Rating: {puzzle.rating}</span>
        )}
      </div>
    </div>
  );
}
