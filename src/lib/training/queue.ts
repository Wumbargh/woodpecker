const REVIEW_INTERVAL = 9; // inject one review puzzle every N main puzzles

export interface QueueState {
  mainQueue: string[];   // puzzle IDs
  mainIndex: number;
  reviewQueue: string[]; // puzzle IDs waiting for review
  reviewCounter: number; // counts main puzzles since last review injection
}

export function buildInitialQueue(puzzleIds: string[], seed: number): QueueState {
  return {
    mainQueue: shuffle(puzzleIds, seed),
    mainIndex: 0,
    reviewQueue: [],
    reviewCounter: 0,
  };
}

export function nextPuzzle(state: QueueState): { puzzleId: string | null; state: QueueState } {
  const shouldInjectReview =
    state.reviewQueue.length > 0 && state.reviewCounter >= REVIEW_INTERVAL;

  if (shouldInjectReview) {
    const [puzzleId, ...rest] = state.reviewQueue;
    return {
      puzzleId,
      state: { ...state, reviewQueue: rest, reviewCounter: 0 },
    };
  }

  if (state.mainIndex >= state.mainQueue.length) {
    // Main queue exhausted — drain remaining review queue
    if (state.reviewQueue.length === 0) return { puzzleId: null, state };
    const [puzzleId, ...rest] = state.reviewQueue;
    return { puzzleId, state: { ...state, reviewQueue: rest } };
  }

  const puzzleId = state.mainQueue[state.mainIndex];
  return {
    puzzleId,
    state: { ...state, mainIndex: state.mainIndex + 1, reviewCounter: state.reviewCounter + 1 },
  };
}

export function onAttempt(state: QueueState, puzzleId: string, correct: boolean): QueueState {
  if (correct) return state;
  return { ...state, reviewQueue: [...state.reviewQueue, puzzleId] };
}

// Build a weighted main queue for a new cycle based on previous attempt history.
// puzzleErrors: map of puzzleId -> number of incorrect attempts in last cycle
export function buildWeightedQueue(
  puzzleIds: string[],
  puzzleErrors: Map<string, number>,
  seed: number
): QueueState {
  const weighted: string[] = [];
  for (const id of puzzleIds) {
    const errors = puzzleErrors.get(id) ?? 0;
    const copies = errors >= 2 ? 3 : errors === 1 ? 2 : 1;
    for (let i = 0; i < copies; i++) weighted.push(id);
  }
  return buildInitialQueue(weighted, seed);
}

function shuffle(arr: string[], seed: number): string[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
