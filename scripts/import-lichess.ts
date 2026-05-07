#!/usr/bin/env node
/**
 * Import Lichess puzzles from the compressed CSV.
 * Usage: npx tsx scripts/import-lichess.ts [--min-rating 1000] [--max-rating 2000] [--count 5000]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { spawn } from "child_process";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag: string, fallback: number): number {
  const i = args.indexOf(flag);
  return i !== -1 ? parseInt(args[i + 1]) : fallback;
}

const MIN_RATING = getArg("--min-rating", 0);
const MAX_RATING = getArg("--max-rating", 9999);
const MIN_POPULARITY = getArg("--min-popularity", 0);
const MAX_COUNT = getArg("--count", 5000);
const BATCH_SIZE = 200;

const CSV_PATH = path.resolve(process.cwd(), "puzzles/lichess_db_puzzle.csv.zst");

if (!fs.existsSync(CSV_PATH)) {
  console.error(`File not found: ${CSV_PATH}`);
  process.exit(1);
}

async function insertBatch(batch: object[]): Promise<number> {
  const { data, error } = await supabase
    .from("puzzles")
    .upsert(batch, { onConflict: "lichess_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function run() {
  console.log(`Importing up to ${MAX_COUNT} puzzles (rating ${MIN_RATING}–${MAX_RATING})…`);

  const zstd = spawn("zstd", ["-d", "-c", CSV_PATH]);
  const rl = readline.createInterface({ input: zstd.stdout, crlfDelay: Infinity });

  let lineNum = 0;
  let collected = 0;
  let imported = 0;
  let skipped = 0;
  let batch: object[] = [];

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // header

    if (collected >= MAX_COUNT) break;

    const cols = line.split(",");
    if (cols.length < 8) continue;

    const rating = parseInt(cols[3]);
    const popularity = parseInt(cols[5]);
    if (isNaN(rating) || isNaN(popularity)) continue;
    if (rating < MIN_RATING || rating > MAX_RATING) continue;
    if (popularity < MIN_POPULARITY) continue;

    batch.push({
      lichess_id: cols[0],
      fen: cols[1],
      moves: cols[2].split(" ").filter(Boolean),
      rating,
      popularity,
      themes: cols[7] ? cols[7].split(" ").filter(Boolean) : [],
      source: "lichess",
      created_by: null,
    });
    collected++;

    if (batch.length >= BATCH_SIZE) {
      const n = await insertBatch(batch);
      imported += n;
      skipped += batch.length - n;
      batch = [];
      process.stdout.write(`\r  ${collected} parsed · ${imported} imported · ${skipped} skipped`);
    }
  }

  if (batch.length > 0) {
    const n = await insertBatch(batch);
    imported += n;
    skipped += batch.length - n;
  }

  zstd.kill();
  console.log(`\nDone. ${imported} imported, ${skipped} already existed.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
