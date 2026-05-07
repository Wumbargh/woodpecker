import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TrainingSession from "@/components/training/TrainingSession";
import { buildInitialQueue, buildWeightedQueue } from "@/lib/training/queue";

export default async function TrainPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load puzzles via join — avoids .in() URL length limits with large sets
  const { data: setPuzzleRows } = await supabase
    .from("puzzle_set_puzzles")
    .select("puzzle_id, puzzles!inner(id, fen, moves, rating, themes)")
    .eq("puzzle_set_id", setId);

  if (!setPuzzleRows?.length) {
    return <p className="text-gray-400">This set has no puzzles yet.</p>;
  }

  const puzzleIds = setPuzzleRows.map((r) => r.puzzle_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puzzles = setPuzzleRows.map((r) => (r as any).puzzles);

  // Resume existing incomplete session, or create a new one
  let { data: session } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("puzzle_set_id", setId)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    const { data: lastSession } = await supabase
      .from("training_sessions")
      .select("id, cycle_number")
      .eq("puzzle_set_id", setId)
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("cycle_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cycleNumber = (lastSession?.cycle_number ?? 0) + 1;
    const seed = Date.now();

    let queueState;
    if (lastSession) {
      const { data: attempts } = await supabase
        .from("puzzle_attempts")
        .select("puzzle_id, solved_correctly")
        .eq("session_id", lastSession.id)
        .eq("solved_correctly", false);

      const errorMap = new Map<string, number>();
      for (const a of attempts ?? []) {
        errorMap.set(a.puzzle_id, (errorMap.get(a.puzzle_id) ?? 0) + 1);
      }
      queueState = buildWeightedQueue(puzzleIds, errorMap, seed);
    } else {
      queueState = buildInitialQueue(puzzleIds, seed);
    }

    const { data: newSession, error } = await supabase
      .from("training_sessions")
      .insert({ user_id: user.id, puzzle_set_id: setId, cycle_number: cycleNumber, queue_state: queueState })
      .select()
      .single();

    if (error || !newSession) {
      return <p className="text-red-400">Failed to start session.</p>;
    }
    session = newSession;
  }

  return <TrainingSession session={session} puzzles={puzzles} />;
}
