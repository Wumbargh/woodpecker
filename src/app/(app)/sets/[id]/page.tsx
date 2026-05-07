import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AddPuzzlesToSet from "@/components/sets/AddPuzzlesToSet";

export default async function SetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: set } = await supabase
    .from("puzzle_sets")
    .select("id, name, description")
    .eq("id", id)
    .single();

  if (!set) notFound();

  const { data: setPuzzles } = await supabase
    .from("puzzle_set_puzzles")
    .select("puzzle_id, puzzles(id, rating, themes)")
    .eq("puzzle_set_id", id);

  const { count: totalPuzzles } = await supabase
    .from("puzzles")
    .select("id", { count: "exact", head: true });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{set.name}</h1>
        {set.description && <p className="text-sm text-gray-400 mt-1">{set.description}</p>}
      </div>

      <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-400">
        {setPuzzles?.length ?? 0} Aufgaben in diesem Set · {totalPuzzles ?? 0} insgesamt verfügbar
      </div>

      <AddPuzzlesToSet setId={id} currentCount={setPuzzles?.length ?? 0} />
    </div>
  );
}
