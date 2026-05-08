import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

interface CycleStat {
  cycle: number;
  accuracy: number;
  avgTimeSec: number;
  totalTimeSec: number;
  completedAt: string;
}

function fmtTotal(sec: number) {
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default async function SetsPage() {
  const supabase = await createClient();

  const [{ data: sets }, { data: sessions }] = await Promise.all([
    supabase
      .from("puzzle_sets")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("training_sessions")
      .select("id, puzzle_set_id, cycle_number, completed_at, puzzle_attempts(solved_correctly, time_taken_ms)")
      .not("completed_at", "is", null)
      .order("cycle_number", { ascending: true }),
  ]);

  const statsBySet = new Map<string, CycleStat[]>();
  for (const session of sessions ?? []) {
    const attempts = (session.puzzle_attempts ?? []) as { solved_correctly: boolean; time_taken_ms: number | null }[];
    if (attempts.length === 0) continue;

    const correct = attempts.filter((a) => a.solved_correctly).length;
    const totalMs = attempts.reduce((sum, a) => sum + (a.time_taken_ms ?? 0), 0);

    const stat: CycleStat = {
      cycle: session.cycle_number,
      accuracy: Math.round((correct / attempts.length) * 100),
      avgTimeSec: Math.round(totalMs / attempts.length / 1000),
      totalTimeSec: Math.round(totalMs / 1000),
      completedAt: session.completed_at!,
    };

    const list = statsBySet.get(session.puzzle_set_id) ?? [];
    list.push(stat);
    statsBySet.set(session.puzzle_set_id, list);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Aufgaben-Sets</h1>
        <Link href="/sets/new" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium">
          Neues Set
        </Link>
      </div>

      <ul className="space-y-3">
        {sets?.map((set) => {
          const stats = statsBySet.get(set.id) ?? [];
          return (
            <li key={set.id} className="bg-gray-900 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{set.name}</p>
                  {set.description && <p className="text-sm text-gray-400">{set.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/sets/${set.id}`} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                    Verwalten
                  </Link>
                  <Link href={`/train/${set.id}`} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm">
                    Trainieren
                  </Link>
                </div>
              </div>

              {stats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-gray-400">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left pb-1 font-normal">Zyklus</th>
                        <th className="text-right pb-1 font-normal">Genauigkeit</th>
                        <th className="text-right pb-1 font-normal">Ø Zeit</th>
                        <th className="text-right pb-1 font-normal">Gesamt</th>
                        <th className="text-right pb-1 font-normal">Abgeschlossen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s) => (
                        <tr key={s.cycle} className="border-b border-gray-800/50 last:border-0">
                          <td className="py-1">{s.cycle}</td>
                          <td className="py-1 text-right">
                            <span className={s.accuracy >= 80 ? "text-green-400" : s.accuracy >= 60 ? "text-yellow-400" : "text-red-400"}>
                              {s.accuracy}%
                            </span>
                          </td>
                          <td className="py-1 text-right">{s.avgTimeSec}s</td>
                          <td className="py-1 text-right tabular-nums">{fmtTotal(s.totalTimeSec)}</td>
                          <td className="py-1 text-right">
                            {new Date(s.completedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
