"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { nextPuzzle, onAttempt, onAttemptWithHint, type QueueState } from "@/lib/training/queue";
import { removePuzzleFromSet, hidePuzzleForUser } from "@/app/actions/manageSets";
import { initSolution, applyUserMove, applyEngineMove, uciToSquares, type SolutionState } from "@/lib/chess/solution";
import PuzzleBoard from "@/components/board/PuzzleBoard";
import dynamic from "next/dynamic";
const AnalysisBoard = dynamic(() => import("@/components/training/AnalysisBoard"), { ssr: false });

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number | null;
  themes: string[] | null;
}

interface Session {
  id: string;
  user_id: string;
  puzzle_set_id: string;
  cycle_number: number;
  queue_state: QueueState;
}

interface Props {
  session: Session;
  puzzles: Puzzle[];
  totalMsBase: number;
}

export default function TrainingSession({ session, puzzles, totalMsBase }: Props) {
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
  const [pendingNextQueue, setPendingNextQueue] = useState<QueueState | null>(null);
  const [showingSolution, setShowingSolution] = useState(false);
  const [removedFromSet, setRemovedFromSet] = useState(false);
  const [hiddenGlobally, setHiddenGlobally] = useState(false);
  const [analysisMode, setAnalysisMode] = useState(false);
  const totalMsRef = useRef(totalMsBase);
  const puzzleTimeFrozenRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
    setPendingNextQueue(null);
    setShowingSolution(false);
    setRemovedFromSet(false);
    setHiddenGlobally(false);
    setAnalysisMode(false);
    puzzleTimeFrozenRef.current = null;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ queue_state: state as any })
      .eq("id", session.id);
  }

  async function recordAttempt(puzzleId: string, correct: boolean) {
    await supabase.from("puzzle_attempts").insert({
      session_id: session.id,
      puzzle_id: puzzleId,
      user_id: session.user_id,
      solved_correctly: correct,
      time_taken_ms: Date.now() - startTime,
    });
  }

  async function handleMove(uciMove: string) {
    if (!solutionState || !currentPuzzleId || setupPhase) return;

    const { result, state: afterUser, engineMove } = applyUserMove(solutionState, uciMove);

    // Update board to show user's move immediately (animates via animationDuration)
    setSolutionState(afterUser);
    setFeedback(result === "incorrect" ? "incorrect" : result === "solved" ? "solved" : "correct");

    if (result === "incorrect") {
      await recordAttempt(currentPuzzleId, false);
      const newQueueState = onAttempt(queueState, currentPuzzleId, false);
      await persistQueueState(newQueueState);
      setQueueState(newQueueState);
      return;
    }

    // Animate engine response after user move animation completes
    if (engineMove) {
      setTimeout(() => {
        const { state: afterEngine, solved } = applyEngineMove(afterUser);
        setSolutionState(afterEngine);
        if (solved) markPuzzleSolved();
      }, 250);
    }

    if (result === "solved") {
      markPuzzleSolved();
    }
  }

  async function markPuzzleSolved() {
    if (!currentPuzzleId) return;
    puzzleTimeFrozenRef.current = Date.now() - startTime;
    totalMsRef.current += puzzleTimeFrozenRef.current;
    setFeedback("solved");
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
    setPendingNextQueue(newQueueState);
  }

  async function handleShowSolution() {
    if (!currentPuzzleId || !solutionState || setupPhase) return;
    puzzleTimeFrozenRef.current = Date.now() - startTime;
    await recordAttempt(currentPuzzleId, false);
    const newQueueState = onAttemptWithHint(queueState, currentPuzzleId);
    await persistQueueState(newQueueState);
    setQueueState(newQueueState);

    totalMsRef.current += puzzleTimeFrozenRef.current!;
    setShowingSolution(true);
    setFeedback(null);

    let state = solutionState;
    const remaining = state.solutionMoves.slice(state.currentMoveIndex);
    for (const move of remaining) {
      await new Promise<void>((resolve) => setTimeout(resolve, 600));
      const { Chess } = await import("chess.js");
      const game = new Chess(state.game.fen());
      game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      state = { ...state, game, currentMoveIndex: state.currentMoveIndex + 1 };
      setSolutionState({ ...state });
    }

    setShowingSolution(false);
    setFeedback("solved");
    setPendingNextQueue(newQueueState);
  }

  if (sessionDone) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 mt-20">
        <h2 className="text-2xl font-bold">Zyklus {session.cycle_number} abgeschlossen!</h2>
        <p className="text-gray-400">Gut gemacht. Starte den nächsten Zyklus, wenn du bereit bist.</p>
        <a href="/dashboard" className="inline-block px-4 py-2 bg-blue-600 rounded font-medium">
          Zur Übersicht
        </a>
      </div>
    );
  }

  function fmtTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  }

  const puzzleElapsedMs = puzzleTimeFrozenRef.current ?? (now - startTime);
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
    <div className="max-w-xl mx-auto space-y-4 px-2 sm:px-0">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Zyklus {session.cycle_number}</span>
        <span className="text-xs tabular-nums text-gray-600 select-none">
          {!setupPhase && `${fmtTime(puzzleElapsedMs)} · `}
          {fmtTime(puzzleTimeFrozenRef.current !== null
            ? totalMsRef.current
            : totalMsRef.current + (setupPhase ? 0 : now - startTime))}
        </span>
        <span>
          {remaining} verbleibend
          {queueState.reviewQueue.length > 0 && ` · ${queueState.reviewQueue.length} zur Wiederholung`}
        </span>
      </div>

      {analysisMode && puzzle ? (
        <AnalysisBoard
          puzzleFen={puzzle.fen}
          puzzleMoves={puzzle.moves}
          boardOrientation={boardOrientation}
          onClose={() => setAnalysisMode(false)}
        />
      ) : boardFen ? (
        <PuzzleBoard
          fen={boardFen}
          onMove={handleMove}
          feedback={setupPhase ? null : feedback}
          arrow={arrow}
          highlightSquare={highlightSquare}
          interactive={!setupPhase && !showingSolution}
          boardOrientation={boardOrientation}
        />
      ) : null}

      {setupPhase && (
        <p className="text-center text-sm text-gray-500">Letzter Zug des Gegners…</p>
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
        {pendingNextQueue ? (
          <>
            <button
              onClick={() => loadNextPuzzle(pendingNextQueue)}
              className="px-4 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm font-medium"
            >
              Nächste Aufgabe →
            </button>
            <button
              onClick={() => setAnalysisMode((m) => !m)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${analysisMode ? "bg-blue-700 text-white" : "bg-gray-800 hover:bg-gray-700 text-blue-400"}`}
            >
              Analysieren
            </button>
            {currentPuzzleId && (
              <span className="self-center flex gap-3 text-xs">
                {hiddenGlobally ? (
                  <span className="text-gray-600">Gesperrt</span>
                ) : removedFromSet ? (
                  <>
                    <span className="text-gray-600">Aus Set entfernt</span>
                    <button
                      onClick={async () => {
                        await hidePuzzleForUser(currentPuzzleId);
                        setHiddenGlobally(true);
                      }}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Nie mehr zeigen
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        await removePuzzleFromSet(session.puzzle_set_id, currentPuzzleId);
                        setRemovedFromSet(true);
                      }}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Aus Set entfernen
                    </button>
                    <button
                      onClick={async () => {
                        await Promise.all([
                          removePuzzleFromSet(session.puzzle_set_id, currentPuzzleId),
                          hidePuzzleForUser(currentPuzzleId),
                        ]);
                        setRemovedFromSet(true);
                        setHiddenGlobally(true);
                      }}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Nie mehr zeigen
                    </button>
                  </>
                )}
              </span>
            )}
          </>
        ) : !showingSolution && (
          <>
            {hintsUsed === 0 && (
              <button
                onClick={() => setHintsUsed(1)}
                disabled={setupPhase}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-yellow-400 rounded text-sm disabled:opacity-40"
              >
                Tipp (Thema)
              </button>
            )}
            {hintsUsed === 1 && (
              <button
                onClick={() => setHintsUsed(2)}
                disabled={setupPhase}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-yellow-400 rounded text-sm disabled:opacity-40"
              >
                Tipp (Figur)
              </button>
            )}
            {hintsUsed === 2 && (
              <button
                onClick={handleShowSolution}
                disabled={setupPhase}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-orange-400 rounded text-sm disabled:opacity-40"
              >
                Lösung zeigen
              </button>
            )}
          </>
        )}

        {puzzle?.rating && (
          <span className="ml-auto self-center text-sm text-gray-500">
            Rating {puzzle.rating}
          </span>
        )}
      </div>

    </div>
  );
}
