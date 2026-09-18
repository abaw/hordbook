import { useCallback, useEffect, useState } from "preact/hooks";

import type { ProgressRecord, ProgressState, ProgressStore } from "./ports";

export const PROGRESS_STATES: ProgressState[] = ["unseen", "learning", "known"];

export function isProgressState(value: unknown): value is ProgressState {
  return typeof value === "string" && (PROGRESS_STATES as string[]).includes(value);
}

export const PROGRESS_STATE_LABELS: Record<ProgressState, string> = {
  unseen: "Unseen",
  learning: "Learning",
  known: "Known",
};

/** All progress records the device holds, by word ID. */
export type ProgressRecords = ReadonlyMap<string, ProgressRecord>;

export function stateOf(records: ProgressRecords, wordId: string): ProgressState {
  return records.get(wordId)?.state ?? "unseen";
}

/** The next state when the learner taps the control: unseen → learning → known → unseen. */
export function nextState(state: ProgressState): ProgressState {
  return PROGRESS_STATES[(PROGRESS_STATES.indexOf(state) + 1) % PROGRESS_STATES.length]!;
}

/**
 * The record to store after a state change, or `null` when the word goes
 * back to `unseen` (its record is deleted; absence means unseen).
 */
export function recordAfter(
  wordId: string,
  current: ProgressRecord | undefined,
  state: ProgressState,
  now: Date,
): ProgressRecord | null {
  if (state === "unseen") return null;
  const timestamp = now.toISOString();
  return {
    wordId,
    state,
    firstSeen: current?.firstSeen ?? timestamp,
    lastReviewed: timestamp,
    interval: current?.interval ?? 0,
  };
}

export interface Progress {
  /** Null until the store has been read. */
  records: ProgressRecords | null;
  cycleState(wordId: string): void;
  /** Stores the given records (already merged by the caller) and returns how many were written. */
  putRecords(records: Iterable<ProgressRecord>): number;
  /** Deletes every record. */
  resetAll(): void;
}

/** Mirrors the store in memory and writes every change through immediately. */
export function useProgress(store: ProgressStore): Progress {
  const [records, setRecords] = useState<Map<string, ProgressRecord> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    void store.getAllRecords().then((all) => {
      if (!cancelled) setRecords(new Map(all.map((r) => [r.wordId, r])));
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const cycleState = useCallback(
    (wordId: string) => {
      setRecords((current) => {
        if (current === null) return current;
        const record = recordAfter(wordId, current.get(wordId), nextState(stateOf(current, wordId)), new Date());
        const updated = new Map(current);
        if (record === null) {
          updated.delete(wordId);
          void store.deleteRecord(wordId);
        } else {
          updated.set(wordId, record);
          void store.putRecord(record);
        }
        return updated;
      });
    },
    [store],
  );

  const putRecords = useCallback(
    (incoming: Iterable<ProgressRecord>) => {
      const list = [...incoming];
      setRecords((current) => {
        if (current === null) return current;
        const updated = new Map(current);
        for (const record of list) updated.set(record.wordId, record);
        return updated;
      });
      for (const record of list) void store.putRecord(record);
      return list.length;
    },
    [store],
  );

  const resetAll = useCallback(() => {
    setRecords((current) => (current === null ? current : new Map()));
    void store.clearRecords();
  }, [store]);

  return { records, cycleState, putRecords, resetAll };
}

const LAST_WORD_KEY = "lastWordId";

export interface LastPosition {
  /** Undefined while loading; null when the learner has not opened a word yet. */
  wordId: string | null | undefined;
  remember(wordId: string): void;
}

/** Where the learner stopped: the word whose card was opened most recently. */
export function useLastPosition(store: ProgressStore): LastPosition {
  const [wordId, setWordId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setWordId(undefined);
    void store.getSetting(LAST_WORD_KEY).then((value) => {
      if (!cancelled) setWordId(value);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const remember = useCallback(
    (id: string) => {
      setWordId(id);
      void store.setSetting(LAST_WORD_KEY, id);
    },
    [store],
  );

  return { wordId, remember };
}
