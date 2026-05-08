"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { PromotionPieceOption } from "react-chessboard/dist/chessboard/types";

interface Props {
  fen: string;
  onMove: (uciMove: string) => void;
  feedback: "correct" | "incorrect" | "solved" | null;
  arrow?: [string, string];
  highlightSquare?: string;
  interactive?: boolean;
  boardOrientation?: "white" | "black";
}

export default function PuzzleBoard({
  fen, onMove, feedback, arrow, highlightSquare,
  interactive = true, boardOrientation = "white",
}: Props) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [clickPromotion, setClickPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  const [animationDuration, setAnimationDuration] = useState(200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBoardWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Clear selection on wrong move or when the position changes (engine move / new puzzle)
  useEffect(() => {
    setSelectedSquare(null);
    setClickPromotion(null);
  }, [fen, feedback]);

  const playerColor = boardOrientation === "white" ? "w" : "b";

  function isPromotionMove(from: Square, to: Square): boolean {
    const piece = new Chess(fen).get(from);
    return piece?.type === "p" && (to[1] === "8" || to[1] === "1");
  }

  function attemptMove(from: Square, to: Square) {
    setSelectedSquare(null);
    if (isPromotionMove(from, to)) {
      setClickPromotion({ from, to });
    } else {
      onMove(from + to);
    }
  }

  function onSquareClick(square: Square) {
    if (!interactive) return;

    // If there's already a selected square, try to move
    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null);
        return;
      }
      // Allow re-selecting own piece
      const piece = new Chess(fen).get(square);
      if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        return;
      }
      attemptMove(selectedSquare, square);
      return;
    }

    // Select a piece of the player's color
    const piece = new Chess(fen).get(square);
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
    }
  }

  const onPieceDragBegin = useCallback(() => {
    setAnimationDuration(0);
  }, []);

  function onDrop(from: string, to: string): boolean {
    onMove(from + to);
    // Restore click animation after the FEN update has rendered
    setTimeout(() => setAnimationDuration(200), 50);
    return false;
  }

  function onPromotionPieceSelect(
    piece?: PromotionPieceOption,
    from?: Square,
    to?: Square
  ): boolean {
    // Called for both drag-drop promotions (from/to provided by library)
    // and click-to-move promotions (from/to come from clickPromotion state)
    const f = from ?? clickPromotion?.from;
    const t = to ?? clickPromotion?.to;
    if (!piece || !f || !t) {
      setClickPromotion(null);
      return false;
    }
    const promotionPiece = piece[1].toLowerCase(); // "wQ" → "q"
    onMove(f + t + promotionPiece);
    setClickPromotion(null);
    setTimeout(() => setAnimationDuration(200), 50); // restore for next click move
    return false; // prevent library from calling onPieceDrop again
  }

  const borderColor =
    feedback === "correct" ? "border-green-500"
    : feedback === "solved" ? "border-green-400"
    : feedback === "incorrect" ? "border-red-500"
    : "border-gray-700";

  const squareStyles: Record<string, React.CSSProperties> = {};

  // Legal move dots for selected piece (Lichess style)
  if (selectedSquare && interactive) {
    const chess = new Chess(fen);
    for (const move of chess.moves({ square: selectedSquare, verbose: true })) {
      const isOccupied = !!chess.get(move.to as Square);
      squareStyles[move.to] = isOccupied
        ? { background: "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)" }
        : { background: "radial-gradient(circle, rgba(0,0,0,0.22) 28%, transparent 28%)" };
    }
  }

  if (highlightSquare) {
    squareStyles[highlightSquare] = { backgroundColor: "rgba(250, 204, 21, 0.55)" };
  }
  if (selectedSquare) {
    squareStyles[selectedSquare] = { backgroundColor: "rgba(96, 165, 250, 0.6)" };
  }

  return (
    <div ref={containerRef} className={`border-4 rounded-lg transition-colors duration-200 ${borderColor}`}>
      <Chessboard
        position={fen}
        onPieceDrop={onDrop}
        onSquareClick={onSquareClick}
        onPromotionCheck={(from, to, piece) =>
          piece[1].toLowerCase() === "p" && (to[1] === "8" || to[1] === "1")
        }
        onPromotionPieceSelect={onPromotionPieceSelect}
        showPromotionDialog={clickPromotion !== null}
        promotionToSquare={clickPromotion?.to ?? null}
        arePiecesDraggable={interactive}
        isDraggablePiece={({ piece }) => interactive && piece[0] === playerColor}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        onPieceDragBegin={onPieceDragBegin}
        animationDuration={animationDuration}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customArrows={arrow ? [[arrow[0] as any, arrow[1] as any, "#f59e0b"]] : []}
        customSquareStyles={squareStyles}
        customDarkSquareStyle={{ backgroundColor: "#b58863" }}
        customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
      />
    </div>
  );
}
