import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: sets } = await supabase
    .from("puzzle_sets")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Aufgaben-Sets</h1>
        <Link href="/sets/new" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium">
          Neues Set
        </Link>
      </div>
      <ul className="space-y-3">
        {sets?.map((set) => (
          <li key={set.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{set.name}</p>
              {set.description && <p className="text-sm text-gray-400">{set.description}</p>}
            </div>
            <div className="flex gap-2">
              <Link href={`/sets/${set.id}`} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                Verwalten
              </Link>
              <Link href={`/train/${set.id}`} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm">
                Trainieren
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
