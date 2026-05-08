"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPuzzlesToSet(
  setId: string,
  options: { minRating?: number; maxRating?: number; minNbPlays?: number; count: number; themes?: string[] }
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

  // Get existing puzzle IDs in this set and user's hidden list to exclude them
  const [{ data: existing }, { data: hidden }] = await Promise.all([
    supabase.from("puzzle_set_puzzles").select("puzzle_id").eq("puzzle_set_id", setId),
    supabase.from("user_hidden_puzzles").select("puzzle_id").eq("user_id", user.id),
  ]);
  const existingIds = new Set(existing?.map((r) => r.puzzle_id) ?? []);
  const hiddenIds = new Set(hidden?.map((r) => r.puzzle_id) ?? []);

  // Query puzzles matching criteria
  let query = supabase.from("puzzles").select("id").limit(options.count * 3);
  if (options.minRating) query = query.gte("rating", options.minRating);
  if (options.maxRating) query = query.lte("rating", options.maxRating);
  if (options.minNbPlays) query = query.gte("nb_plays", options.minNbPlays);
  if (options.themes?.length) query = query.overlaps("themes", options.themes);

  const { data: candidates } = await query;

  const toAdd = (candidates ?? [])
    .filter((p) => !existingIds.has(p.id) && !hiddenIds.has(p.id))
    .slice(0, options.count)
    .map((p) => ({ puzzle_set_id: setId, puzzle_id: p.id }));

  if (toAdd.length === 0) return { added: 0 };

  const { error } = await supabase.from("puzzle_set_puzzles").insert(toAdd);
  if (error) return { added: 0, error: error.message };

  revalidatePath(`/sets/${setId}`);
  return { added: toAdd.length };
}

export async function hidePuzzleForUser(puzzleId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_hidden_puzzles")
    .upsert({ user_id: user.id, puzzle_id: puzzleId });

  return error ? { error: error.message } : {};
}

export async function removePuzzleFromSet(setId: string, puzzleId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: set } = await supabase
    .from("puzzle_sets")
    .select("id")
    .eq("id", setId)
    .eq("user_id", user.id)
    .single();
  if (!set) return { error: "Set not found" };

  const { error } = await supabase
    .from("puzzle_set_puzzles")
    .delete()
    .eq("puzzle_set_id", setId)
    .eq("puzzle_id", puzzleId);

  return error ? { error: error.message } : {};
}

export async function deleteSet(setId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: set } = await supabase
    .from("puzzle_sets")
    .select("id")
    .eq("id", setId)
    .eq("user_id", user.id)
    .single();
  if (!set) return { error: "Set not found" };

  // Delete in dependency order
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("puzzle_set_id", setId);
  const sessionIds = sessions?.map((s) => s.id) ?? [];

  if (sessionIds.length > 0) {
    await supabase.from("puzzle_attempts").delete().in("session_id", sessionIds);
    await supabase.from("training_sessions").delete().in("id", sessionIds);
  }

  await supabase.from("puzzle_set_puzzles").delete().eq("puzzle_set_id", setId);
  const { error } = await supabase.from("puzzle_sets").delete().eq("id", setId);

  if (error) return { error: error.message };

  revalidatePath("/sets");
  return {};
}
