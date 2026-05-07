import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PuzzlesPage() {
  const supabase = await createClient();
  const { data: puzzles } = await supabase
    .from("puzzles")
    .select("id, fen, rating, themes, source, lichess_id")
    .order("rating", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Aufgaben</h1>
        <div className="flex gap-2">
          <Link href="/puzzles/import" className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
            Von Lichess importieren
          </Link>
          <Link href="/puzzles/new" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">
            Eigene hinzufügen
          </Link>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-gray-800">
            <th className="pb-2">Rating</th>
            <th className="pb-2">Themen</th>
            <th className="pb-2">Quelle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {puzzles?.map((p) => (
            <tr key={p.id} className="py-2">
              <td className="py-2">{p.rating ?? "—"}</td>
              <td className="py-2 text-gray-400">{p.themes?.slice(0, 3).join(", ") ?? "—"}</td>
              <td className="py-2 text-gray-500">{p.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
