import type { ProgressState } from "../ports";
import { PROGRESS_STATE_LABELS } from "../progress";

interface StateButtonProps {
  lemma: string;
  state: ProgressState;
  onCycle(): void;
  /** Larger variant for the word card. */
  size?: "row" | "card";
}

/**
 * One-tap progress control. Its accessible name reads "<lemma>: <state>" so
 * a screen reader hears the current state; tapping cycles to the next one.
 */
export function StateButton({ lemma, state, onCycle, size = "row" }: StateButtonProps) {
  const label = PROGRESS_STATE_LABELS[state];
  return (
    <button
      type="button"
      class={`state state--${state} state--${size}`}
      aria-label={`${lemma}: ${label.toLocaleLowerCase("en")}`}
      onClick={onCycle}
    >
      <span class="state__dot" aria-hidden="true" />
      {size === "card" ? label : null}
    </button>
  );
}
