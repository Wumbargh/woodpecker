"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface StockfishEval {
  type: "cp" | "mate";
  value: number; // centipawns or mate-in-N, always from side-to-move perspective
}

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<StockfishEval | null>(null);

  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (line === "uciok") {
        worker.postMessage("isready");
      } else if (line === "readyok") {
        setIsReady(true);
      } else if (line.startsWith("info") && line.includes("score")) {
        const mateMatch = line.match(/score mate (-?\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        if (mateMatch) setEvaluation({ type: "mate", value: parseInt(mateMatch[1]) });
        else if (cpMatch) setEvaluation({ type: "cp", value: parseInt(cpMatch[1]) });
      } else if (line.startsWith("bestmove")) {
        const move = line.split(" ")[1];
        if (move && move !== "(none)") setBestMove(move);
        setIsThinking(false);
      }
    };

    worker.postMessage("uci");
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const analyze = useCallback(
    (fen: string) => {
      const worker = workerRef.current;
      if (!worker || !isReady) return;
      setBestMove(null);
      setEvaluation(null);
      setIsThinking(true);
      worker.postMessage("stop");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage("go depth 16");
    },
    [isReady]
  );

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop");
    setIsThinking(false);
  }, []);

  return { isReady, isThinking, bestMove, evaluation, analyze, stop };
}
