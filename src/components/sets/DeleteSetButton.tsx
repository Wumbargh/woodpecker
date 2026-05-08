"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSet } from "@/app/actions/manageSets";

export default function DeleteSetButton({ setId, setName }: { setId: string; setName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    const res = await deleteSet(setId);
    if (res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/sets");
    }
  }

  if (confirming) {
    return (
      <div className="border border-red-800 rounded-lg p-4 space-y-3 bg-red-950/30">
        <p className="text-sm font-medium text-red-300">&bdquo;{setName}&ldquo; wirklich löschen?</p>
        <p className="text-xs text-gray-400">
          Dabei werden alle Trainingssitzungen, Versuche und Statistiken zu diesem Set unwiderruflich gelöscht.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Wird gelöscht…" : "Ja, löschen"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 text-red-400 hover:text-red-300 rounded text-sm transition-colors"
    >
      Set löschen
    </button>
  );
}
