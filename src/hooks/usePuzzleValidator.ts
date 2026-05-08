"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const THRESHOLD_CP = 50;
const MULTIPV = 3;
const DEPTH = 15;

export function usePuzzleValidator() {
  const workerRef = useRef<Worker | null>(null);
  const isReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // fen → set of accepted from-to squares (4-char UCI prefix)
  const cacheRef = useRef<Map<string, Set<string>>>(new Map());
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const currentFenRef = useRef<string | null>(null);
  const currentTopRef = useRef<{ move: string; score: number | null }[]>([]);

  const processNext = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || !isReadyRef.current || busyRef.current) return;
    while (queueRef.current.length > 0 && cacheRef.current.has(queueRef.current[0])) {
      queueRef.current.shift();
    }
    if (queueRef.current.length === 0) {
      setIsAnalyzing(false);
      return;
    }
    const fen = queueRef.current.shift()!;
    busyRef.current = true;
    currentFenRef.current = fen;
    currentTopRef.current = [];
    worker.postMessage("stop");
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${DEPTH}`);
  }, []);

  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (line === "uciok") {
        worker.postMessage("isready");
      } else if (line === "readyok") {
        // Set MultiPV once after engine is ready
        worker.postMessage(`setoption name MultiPV value ${MULTIPV}`);
        isReadyRef.current = true;
        setIsReady(true);
        processNext();
      } else if (line.startsWith("info") && currentFenRef.current) {
        const pvMatch = line.match(/\bpv (\S+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const mpvMatch = line.match(/\bmultipv (\d+)/);
        if (pvMatch && mpvMatch) {
          const idx = parseInt(mpvMatch[1]) - 1;
          const score = cpMatch ? parseInt(cpMatch[1]) : mateMatch ? null : undefined;
          if (score !== undefined) {
            currentTopRef.current[idx] = { move: pvMatch[1], score };
          }
        }
      } else if (line.startsWith("bestmove") && currentFenRef.current) {
        const fen = currentFenRef.current;
        const top = [...currentTopRef.current];
        const best = top[0];
        const accepted = new Set<string>();
        if (best) {
          accepted.add(best.move.slice(0, 4));
          for (let i = 1; i < top.length; i++) {
            const m = top[i];
            if (!m) continue;
            if (m.score === null) {
              accepted.add(m.move.slice(0, 4));
            } else if (best.score !== null && best.score - m.score <= THRESHOLD_CP) {
              accepted.add(m.move.slice(0, 4));
            }
          }
        }
        cacheRef.current.set(fen, accepted);
        currentFenRef.current = null;
        busyRef.current = false;
        processNext();
      }
    };

    worker.postMessage("uci");
    workerRef.current = worker;
    return () => worker.terminate();
  }, [processNext]);

  const preanalyze = useCallback(
    (fens: string[]) => {
      const toAdd = fens.filter(
        (f) => !cacheRef.current.has(f) && !queueRef.current.includes(f)
      );
      if (toAdd.length > 0) {
        queueRef.current.unshift(...toAdd);
        setIsAnalyzing(true);
      }
      processNext();
    },
    [processNext]
  );

  // Returns true (accepted alternative), false (rejected), or null (not yet analyzed → strict match)
  const isAccepted = useCallback((fen: string, move: string): boolean | null => {
    const accepted = cacheRef.current.get(fen);
    if (!accepted) return null;
    return accepted.has(move.slice(0, 4));
  }, []);

  return { isReady, isAnalyzing, preanalyze, isAccepted };
}
