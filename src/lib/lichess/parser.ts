export interface LichessPuzzleRow {
  lichess_id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

export interface ParseOptions {
  minRating?: number;
  maxRating?: number;
  maxCount?: number;
}

// Lichess CSV columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
export function parseLichessCSV(text: string, options: ParseOptions = {}): LichessPuzzleRow[] {
  const { minRating, maxRating, maxCount = 10_000 } = options;
  const lines = text.split("\n");
  const results: LichessPuzzleRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (results.length >= maxCount) break;
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",");
    if (cols.length < 8) continue;

    const rating = parseInt(cols[3]);
    if (isNaN(rating)) continue;
    if (minRating !== undefined && rating < minRating) continue;
    if (maxRating !== undefined && rating > maxRating) continue;

    results.push({
      lichess_id: cols[0],
      fen: cols[1],
      moves: cols[2].split(" ").filter(Boolean),
      rating,
      themes: cols[7] ? cols[7].split(" ").filter(Boolean) : [],
    });
  }

  return results;
}
