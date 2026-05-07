const REVIEW_INTERVAL = 9;       // normal wrong answers: back every ~9 main puzzles
const HINT_REVIEW_INTERVAL = 20; // hint-used answers: back every ~20 main puzzles

export interface QueueState {
  mainQueue: string[];
  mainIndex: number;
  reviewQueue: string[];      // wrong answers
  reviewCounter: number;
  hintReviewQueue: string[];  // hint-used but solved — longer delay
  hintReviewCounter: number;
}

export function buildInitialQueue(puzzleIds: string[], seed: number): QueueState {
  return {
    mainQueue: shuffle(puzzleIds, seed),
    mainIndex: 0,
    reviewQueue: [],
    reviewCounter: 0,
    hintReviewQueue: [],
    hintReviewCounter: 0,
  };
}

function normalize(state: QueueState): QueueState {
  return {
    ...state,
    hintReviewQueue: state.hintReviewQueue ?? [],
    hintReviewCounter: state.hintReviewCounter ?? 0,
  };
}

export function nextPuzzle(raw: QueueState): { puzzleId: string | null; state: QueueState } {
  const state = normalize(raw);
  // Normal review takes priority over hint review
  if (state.reviewQueue.length > 0 && state.reviewCounter >= REVIEW_INTERVAL) {
    const [puzzleId, ...rest] = state.reviewQueue;
    return { puzzleId, state: { ...state, reviewQueue: rest, reviewCounter: 0 } };
  }

  if (state.hintReviewQueue.length > 0 && state.hintReviewCounter >= HINT_REVIEW_INTERVAL) {
    const [puzzleId, ...rest] = state.hintReviewQueue;
    return { puzzleId, state: { ...state, hintReviewQueue: rest, hintReviewCounter: 0 } };
  }

  if (state.mainIndex >= state.mainQueue.length) {
    // Main exhausted — drain review queues (normal first, then hint)
    if (state.reviewQueue.length > 0) {
      const [puzzleId, ...rest] = state.reviewQueue;
      return { puzzleId, state: { ...state, reviewQueue: rest } };
    }
    if (state.hintReviewQueue.length > 0) {
      const [puzzleId, ...rest] = state.hintReviewQueue;
      return { puzzleId, state: { ...state, hintReviewQueue: rest } };
    }
    return { puzzleId: null, state };
  }

  const puzzleId = state.mainQueue[state.mainIndex];
  return {
    puzzleId,
    state: {
      ...state,
      mainIndex: state.mainIndex + 1,
      reviewCounter: state.reviewCounter + 1,
      hintReviewCounter: state.hintReviewCounter + 1,
    },
  };
}

export function onAttempt(state: QueueState, puzzleId: string, correct: boolean): QueueState {
  if (correct) return state;
  return { ...state, reviewQueue: [...state.reviewQueue, puzzleId] };
}

export function onAttemptWithHint(state: QueueState, puzzleId: string): QueueState {
  const s = normalize(state);
  return { ...s, hintReviewQueue: [...s.hintReviewQueue, puzzleId] };
}

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
