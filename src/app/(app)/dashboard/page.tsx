import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: sets } = await supabase
    .from("puzzle_sets")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Deine Aufgaben-Sets</h1>
        <Link
          href="/sets/new"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          Neues Set
        </Link>
      </div>

      {!sets?.length && (
        <p className="text-gray-400 text-sm">Noch keine Sets. Erstell eines, um loszulegen.</p>
      )}

      <ul className="space-y-3">
        {sets?.map((set) => (
          <li key={set.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{set.name}</p>
              {set.description && (
                <p className="text-sm text-gray-400">{set.description}</p>
              )}
            </div>
            <Link
              href={`/train/${set.id}`}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm font-medium"
            >
              Trainieren
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
