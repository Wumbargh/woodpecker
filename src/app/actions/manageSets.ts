"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPuzzlesToSet(
  setId: string,
  options: { minRating?: number; maxRating?: number; count: number; themes?: string[] }
): Promise<{ added: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { added: 0, error: "Not authenticated" };

  // Verify the set belongs to this user
  const { data: set } = await supabase
    .from("puzzle_sets")
    .select("id")
    .eq("id", setId)
    .eq("user_id", user.id)
    .single();
  if (!set) return { added: 0, error: "Set not found" };

  // Get existing puzzle IDs in this set to exclude them
  const { data: existing } = await supabase
    .from("puzzle_set_puzzles")
    .select("puzzle_id")
    .eq("puzzle_set_id", setId);
  const existingIds = new Set(existing?.map((r) => r.puzzle_id) ?? []);

  // Query puzzles matching criteria
  let query = supabase.from("puzzles").select("id").limit(options.count * 3);
  if (options.minRating) query = query.gte("rating", options.minRating);
  if (options.maxRating) query = query.lte("rating", options.maxRating);
  if (options.themes?.length) query = query.overlaps("themes", options.themes);

  const { data: candidates } = await query;

  const toAdd = (candidates ?? [])
    .filter((p) => !existingIds.has(p.id))
    .slice(0, options.count)
    .map((p) => ({ puzzle_set_id: setId, puzzle_id: p.id }));

  if (toAdd.length === 0) return { added: 0 };

  const { error } = await supabase.from("puzzle_set_puzzles").insert(toAdd);
  if (error) return { added: 0, error: error.message };

  revalidatePath(`/sets/${setId}`);
  return { added: toAdd.length };
}
