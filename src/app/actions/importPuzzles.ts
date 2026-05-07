"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LichessPuzzleRow } from "@/lib/lichess/parser";

const BATCH_SIZE = 200;

export async function importPuzzles(
  puzzles: LichessPuzzleRow[]
): Promise<{ imported: number; skipped: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { imported: 0, skipped: 0, error: "Not authenticated" };

  const admin = createAdminClient();
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < puzzles.length; i += BATCH_SIZE) {
    const batch = puzzles.slice(i, i + BATCH_SIZE).map((p) => ({
      fen: p.fen,
      moves: p.moves,
      source: "lichess",
      lichess_id: p.lichess_id,
      rating: p.rating,
      popularity: p.popularity,
      themes: p.themes,
      created_by: null,
    }));

    const { data, error } = await admin
      .from("puzzles")
      .upsert(batch, { onConflict: "lichess_id", ignoreDuplicates: true })
      .select("id");

    if (error) return { imported, skipped, error: error.message };
    imported += data?.length ?? 0;
    skipped += batch.length - (data?.length ?? 0);
  }

  return { imported, skipped };
}
