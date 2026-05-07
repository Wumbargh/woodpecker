#!/usr/bin/env node
/**
 * Creates 3 puzzle sets (1200-1500, 1500-1800, 1800-2100) with 500 puzzles each.
 * Usage: npm run setup-sets -- --email your@email.com
 */

import { spawn } from "child_process";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const args = process.argv.slice(2);
const emailIdx = args.indexOf("--email");
const email = emailIdx !== -1 ? args[emailIdx + 1] : null;

const SETS = [
  { name: "Beginner (1200–1500)", min: 1200, max: 1500 },
  { name: "Intermediate (1500–1800)", min: 1500, max: 1800 },
  { name: "Advanced (1800–2100)", min: 1800, max: 2100 },
];
const TARGET = 500;
const BATCH_SIZE = 200;
const CSV_PATH = path.resolve(process.cwd(), "puzzles/lichess_db_puzzle.csv.zst");

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (error || !data?.users?.length) { console.error("No users found."); process.exit(1); }
  if (email) {
    const user = data.users.find(u => u.email === email);
    if (!user) { console.error(`User not found: ${email}`); process.exit(1); }
    return user.id;
  }
  return data.users[0].id;
}

async function upsertPuzzles(rows: object[]): Promise<string[]> {
  const { data, error } = await supabase
    .from("puzzles")
    .upsert(rows, { onConflict: "lichess_id", ignoreDuplicates: true })
    .select("id, lichess_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function run() {
  const userId = await getUserId();
  console.log(`User: ${userId}`);

  // Collect puzzles per bucket in one pass through the CSV
  const buckets: Map<number, object[]>[] = SETS.map(() => new Map());
  const puzzleIds: Map<number, string[]> = new Map(SETS.map((_, i) => [i, []]));

  console.log("Scanning CSV…");
  const zstd = spawn("zstd", ["-d", "-c", CSV_PATH]);
  const rl = readline.createInterface({ input: zstd.stdout, crlfDelay: Infinity });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue;

    const full = SETS.every((_, i) => buckets[i].size >= TARGET);
    if (full) break;

    const cols = line.split(",");
    if (cols.length < 8) continue;
    const rating = parseInt(cols[3]);
    if (isNaN(rating)) continue;

    for (let i = 0; i < SETS.length; i++) {
      const { min, max } = SETS[i];
      if (rating >= min && rating < max && buckets[i].size < TARGET) {
        buckets[i].set(cols[0], {
          lichess_id: cols[0],
          fen: cols[1],
          moves: cols[2].split(" ").filter(Boolean),
          rating,
          themes: cols[7] ? cols[7].split(" ").filter(Boolean) : [],
          source: "lichess",
          created_by: null,
        });
      }
    }

    if (lineNum % 50000 === 0) {
      const counts = SETS.map((s, i) => `${s.name.split(" ")[0]}: ${buckets[i].size}`).join(" · ");
      process.stdout.write(`\r  Line ${lineNum}: ${counts}   `);
    }
  }
  zstd.kill();
  console.log("\nDone scanning.");

  // Insert puzzles and create sets
  for (let i = 0; i < SETS.length; i++) {
    const { name } = SETS[i];
    const rows = [...buckets[i].values()];
    console.log(`\n[${name}] Inserting ${rows.length} puzzles…`);

    const ids: string[] = [];
    for (let j = 0; j < rows.length; j += BATCH_SIZE) {
      const inserted = await upsertPuzzles(rows.slice(j, j + BATCH_SIZE));
      ids.push(...inserted);
      process.stdout.write(`\r  ${ids.length}/${rows.length}`);
    }

    // If upsert returned fewer IDs (duplicates), fetch the rest by lichess_id
    if (ids.length < rows.length) {
      const lichessIds = (rows as { lichess_id: string }[]).map(r => r.lichess_id);
      const { data } = await supabase.from("puzzles").select("id").in("lichess_id", lichessIds);
      ids.length = 0;
      ids.push(...(data ?? []).map((r: { id: string }) => r.id));
    }

    // Create set
    const { data: set, error: setErr } = await supabase
      .from("puzzle_sets")
      .insert({ name, user_id: userId })
      .select("id")
      .single();
    if (setErr) throw new Error(setErr.message);

    // Link puzzles to set
    const links = ids.map(puzzle_id => ({ puzzle_set_id: set.id, puzzle_id }));
    for (let j = 0; j < links.length; j += BATCH_SIZE) {
      await supabase.from("puzzle_set_puzzles").insert(links.slice(j, j + BATCH_SIZE));
    }

    console.log(`\n  Set "${name}" created with ${ids.length} puzzles.`);
  }

  console.log("\nAll done! Open /dashboard to start training.");
}

run().catch(e => { console.error(e); process.exit(1); });
