"use client";

import { useState, useRef } from "react";
import { parseLichessCSV } from "@/lib/lichess/parser";
import { importPuzzles } from "@/app/actions/importPuzzles";

type Status = "idle" | "parsing" | "importing" | "done" | "error";

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [minPopularity, setMinPopularity] = useState(80);
  const [maxCount, setMaxCount] = useState(1000);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setStatus("parsing");
    setError(null);
    setResult(null);
    setProgress(0);

    const text = await file.text();
    const puzzles = parseLichessCSV(text, { minRating, maxRating, minPopularity, maxCount });

    if (puzzles.length === 0) {
      setError("Keine Aufgaben gefunden, die den Filterkriterien entsprechen.");
      setStatus("error");
      return;
    }

    setStatus("importing");

    const chunkSize = 500;
    let totalImported = 0;
    let totalSkipped = 0;

    for (let i = 0; i < puzzles.length; i += chunkSize) {
      const chunk = puzzles.slice(i, i + chunkSize);
      const res = await importPuzzles(chunk);

      if (res.error) {
        setError(res.error);
        setStatus("error");
        return;
      }

      totalImported += res.imported;
      totalSkipped += res.skipped;
      setProgress(Math.round(((i + chunk.length) / puzzles.length) * 100));
    }

    setResult({ imported: totalImported, skipped: totalSkipped });
    setStatus("done");
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Von Lichess importieren</h1>

      <p className="text-sm text-gray-400">
        Lade die Aufgaben-CSV von{" "}
        <a
          href="https://database.lichess.org/#puzzles"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          database.lichess.org
        </a>{" "}
        herunter und lade sie hier hoch.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">CSV-Datei</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="w-full text-sm text-gray-300 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Min. Rating</label>
            <input
              type="number"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max. Rating</label>
            <input
              type="number"
              value={maxRating}
              onChange={(e) => setMaxRating(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Min. Popularität (−100 bis 100, empfohlen: ≥ 80)
          </label>
          <input
            type="number"
            value={minPopularity}
            onChange={(e) => setMinPopularity(Number(e.target.value))}
            min={-100}
            max={100}
            className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Max. Aufgaben importieren</label>
          <input
            type="number"
            value={maxCount}
            onChange={(e) => setMaxCount(Number(e.target.value))}
            min={1}
            max={50000}
            className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={status === "parsing" || status === "importing"}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50"
        >
          {status === "parsing"
            ? "CSV wird verarbeitet…"
            : status === "importing"
            ? `Importiere… ${progress}%`
            : "Importieren"}
        </button>
      </div>

      {status === "importing" && (
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {status === "done" && result && (
        <div className="bg-green-900/40 border border-green-700 rounded p-4 text-sm">
          <p className="font-medium text-green-400">Import abgeschlossen</p>
          <p className="text-gray-300 mt-1">
            {result.imported} Aufgaben importiert · {result.skipped} bereits vorhanden
          </p>
        </div>
      )}

      {status === "error" && error && (
        <div className="bg-red-900/40 border border-red-700 rounded p-4 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
