"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { useStockfish } from "@/hooks/useStockfish";
import type { StockfishEval } from "@/hooks/useStockfish";

interface Props {
  initialFen: string;
  boardOrientation: "white" | "black";
  onClose: () => void;
}

function formatEval(ev: StockfishEval | null, turn: "w" | "b"): string {
  if (!ev) return "…";
  // Normalize to white's perspective
  const sign = turn === "w" ? 1 : -1;
  if (ev.type === "mate") {
    const m = ev.value * sign;
    return m > 0 ? `M${Math.abs(ev.value)}` : `-M${Math.abs(ev.value)}`;
  }
  const pawns = (ev.value * sign) / 100;
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

export default function AnalysisBoard({ initialFen, boardOrientation, onClose }: Props) {
  const [chess, setChess] = useState(() => new Chess(initialFen));
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  const { isReady, isThinking, bestMove, evaluation, analyze } = useStockfish();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBoardWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Re-analyze whenever position changes
  useEffect(() => {
    if (isReady) analyze(chess.fen());
  }, [chess, isReady, analyze]);

  function makeMove(from: string, to: string, promotion?: string): boolean {
    const next = new Chess(chess.fen());
    const move = next.move({ from, to, promotion: promotion ?? "q" });
    if (!move) return false;
    setChess(next);
    setSelectedSquare(null);
    return false; // always control position via prop
  }

  function onSquareClick(square: Square) {
    if (selectedSquare) {
      if (square === selectedSquare) { setSelectedSquare(null); return; }
      if (makeMove(selectedSquare, square) === false && chess.get(square)) {
        // try re-selecting if it's a piece
        setSelectedSquare(chess.get(square) ? square : null);
      }
      return;
    }
    if (chess.get(square)) setSelectedSquare(square);
  }

  function onDrop(from: string, to: string): boolean {
    return makeMove(from, to);
  }

  function onPromotionPieceSelect(
    piece?: string, from?: Square, to?: Square
  ): boolean {
    if (!piece || !from || !to) return false;
    makeMove(from, to, piece[1].toLowerCase());
    return false;
  }

  const evalText = formatEval(evaluation, chess.turn());
  const evalColor =
    evaluation?.type === "mate" ? "text-purple-400"
    : !evaluation ? "text-gray-500"
    : evaluation.type === "cp" && evaluation.value * (chess.turn() === "w" ? 1 : -1) > 50 ? "text-green-400"
    : evaluation.type === "cp" && evaluation.value * (chess.turn() === "w" ? 1 : -1) < -50 ? "text-red-400"
    : "text-gray-300";

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) squareStyles[selectedSquare] = { backgroundColor: "rgba(96, 165, 250, 0.6)" };

  const engineArrow: [string, string, string][] = bestMove
    ? [[bestMove.slice(0, 2), bestMove.slice(2, 4), "#22c55e"]]
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Analyse</span>
        <span className={`tabular-nums font-medium ${evalColor}`}>
          {isThinking && !evaluation ? "…" : evalText}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => { setChess(new Chess(initialFen)); setSelectedSquare(null); }}
            className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
          >
            ↩ Reset
          </button>
          <button
            onClick={onClose}
            className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
          >
            ✕ Schließen
          </button>
        </div>
      </div>

      <div ref={containerRef} className="rounded-lg overflow-hidden border-2 border-gray-700">
        <Chessboard
          position={chess.fen()}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          onPromotionCheck={(from, to, piece) =>
            piece[1].toLowerCase() === "p" && (to[1] === "8" || to[1] === "1")
          }
          onPromotionPieceSelect={onPromotionPieceSelect}
          boardOrientation={boardOrientation}
          boardWidth={boardWidth}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customArrows={engineArrow as any}
          customSquareStyles={squareStyles}
          customDarkSquareStyle={{ backgroundColor: "#b58863" }}
          customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
        />
      </div>

      {!isReady && (
        <p className="text-xs text-gray-600 text-center">Engine wird geladen…</p>
      )}
    </div>
  );
}
