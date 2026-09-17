import type { Word } from "../ports";
import { type ProgressRecords, stateOf } from "../progress";

export interface ProgressCounts {
  known: number;
  learning: number;
  total: number;
}

export function countProgress(words: Word[], records: ProgressRecords): ProgressCounts {
  let known = 0;
  let learning = 0;
  for (const word of words) {
    const state = stateOf(records, word.id);
    if (state === "known") known += 1;
    else if (state === "learning") learning += 1;
  }
  return { known, learning, total: words.length };
}

interface ProgressBarProps {
  /** What the bar measures, e.g. "Collection" or "Level 3". */
  subject: string;
  counts: ProgressCounts;
}

/**
 * Stacked bar: known fills from the left, learning follows it. The
 * progressbar value is the known count; the accessible name carries both.
 */
export function ProgressBar({ subject, counts }: ProgressBarProps) {
  const { known, learning, total } = counts;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  return (
    <div class="progress">
      <div
        class="progress__bar"
        role="progressbar"
        aria-label={`${subject} progress: ${known} known, ${learning} learning of ${total}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={known}
      >
        <span class="progress__known" style={{ width: `${pct(known)}%` }} />
        <span class="progress__learning" style={{ width: `${pct(learning)}%` }} />
      </div>
      <p class="progress__counts muted">
        {known} known · {learning} learning
      </p>
    </div>
  );
}
