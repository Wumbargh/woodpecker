import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TrainingSession from "@/components/training/TrainingSession";
import { buildInitialQueue, buildWeightedQueue } from "@/lib/training/queue";

export default async function TrainPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load puzzle IDs in this set
  const { data: setPuzzles } = await supabase
    .from("puzzle_set_puzzles")
    .select("puzzle_id")
    .eq("puzzle_set_id", setId);

  if (!setPuzzles?.length) {
    return <p className="text-gray-400">This set has no puzzles yet.</p>;
  }

  const puzzleIds = setPuzzles.map((r) => r.puzzle_id);

  // Resume existing incomplete session, or create a new one
  let { data: session } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("puzzle_set_id", setId)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    // Determine cycle number and build weighted queue based on previous cycle errors
    const { data: lastSession } = await supabase
      .from("training_sessions")
      .select("id, cycle_number")
      .eq("puzzle_set_id", setId)
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("cycle_number", { ascending: false })
      .limit(1)
      .single();

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

  // Load all puzzles for this set (client component needs them for display)
  const { data: puzzles } = await supabase
    .from("puzzles")
    .select("id, fen, moves, rating, themes")
    .in("id", puzzleIds);

  return (
    <TrainingSession
      session={session}
      puzzles={puzzles ?? []}
    />
  );
}
