"use client";

import { useState } from "react";
import { addPuzzlesToSet } from "@/app/actions/manageSets";

const COMMON_THEMES = [
  "fork", "pin", "skewer", "discoveredAttack", "doubleCheck",
  "mateIn1", "mateIn2", "mateIn3", "hangingPiece", "backRankMate",
  "crushing", "endgame", "middlegame", "opening",
];

interface Props {
  setId: string;
  currentCount: number;
}

export default function AddPuzzlesToSet({ setId, currentCount }: Props) {
  const [minRating, setMinRating] = useState(1000);
  const [maxRating, setMaxRating] = useState(2000);
  const [count, setCount] = useState(500);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleTheme(theme: string) {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    );
  }

  async function handleAdd() {
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await addPuzzlesToSet(setId, {
      minRating,
      maxRating,
      count,
      themes: selectedThemes.length > 0 ? selectedThemes : undefined,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setResult(`Added ${res.added} puzzles. Set now has ${currentCount + res.added} puzzles.`);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-medium">Add puzzles</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Min rating</label>
          <input
            type="number"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Max rating</label>
          <input
            type="number"
            value={maxRating}
            onChange={(e) => setMaxRating(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Number of puzzles</label>
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          min={1}
          max={5000}
          className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Filter by theme (optional)</label>
        <div className="flex flex-wrap gap-2">
          {COMMON_THEMES.map((theme) => (
            <button
              key={theme}
              onClick={() => toggleTheme(theme)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedThemes.includes(theme)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleAdd}
        disabled={loading}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50"
      >
        {loading ? "Adding…" : "Add puzzles"}
      </button>

      {result && (
        <p className="text-sm text-green-400">{result}</p>
      )}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
