"use client";

import { Chessboard } from "react-chessboard";

interface Props {
  fen: string;
  onMove: (uciMove: string) => void;
  feedback: "correct" | "incorrect" | "solved" | null;
}

export default function PuzzleBoard({ fen, onMove, feedback }: Props) {
  function onDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
    const promotion = piece[1]?.toLowerCase() === "p" &&
      (targetSquare[1] === "8" || targetSquare[1] === "1")
      ? "q"
      : undefined;
    onMove(sourceSquare + targetSquare + (promotion ?? ""));
    return true;
  }

  const borderColor =
    feedback === "correct" ? "border-green-500"
    : feedback === "solved" ? "border-green-400"
    : feedback === "incorrect" ? "border-red-500"
    : "border-gray-700";

  return (
    <div className={`border-4 rounded-lg overflow-hidden transition-colors duration-200 ${borderColor}`}>
      <Chessboard
        position={fen}
        onPieceDrop={onDrop}
        boardWidth={480}
        customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
        customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
      />
    </div>
  );
}
