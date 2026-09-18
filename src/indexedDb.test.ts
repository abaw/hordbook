/**
 * Adapter test: jsdom has no IndexedDB, so the production store is exercised
 * against fake-indexeddb here. This sits below seam 2 on purpose: it is the
 * one piece of production wiring the app-root tests cannot reach.
 */
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import { indexedDbProgressStore } from "./indexedDb";
import type { ProgressRecord } from "./ports";

const record = (wordId: string, state: ProgressRecord["state"]): ProgressRecord => ({
  wordId,
  state,
  firstSeen: "2026-09-17T00:00:00.000Z",
  lastReviewed: "2026-09-17T00:00:00.000Z",
  interval: 0,
});

describe("IndexedDB progress store", () => {
  it("persists settings and records across store instances on the same database", async () => {
    const factory = new IDBFactory();
    const first = indexedDbProgressStore(factory);

    expect(await first.getSetting("lastWordId")).toBeNull();
    await first.setSetting("lastWordId", "ngsl:abandon");
    await first.putRecord(record("ngsl:abandon", "learning"));
    await first.putRecord(record("ngsl:able", "known"));
    await first.putRecord({ ...record("ngsl:abandon", "known"), interval: 3 });
    await first.deleteRecord("ngsl:able");

    const second = indexedDbProgressStore(factory);
    expect(await second.getSetting("lastWordId")).toBe("ngsl:abandon");
    expect(await second.getAllRecords()).toEqual([{ ...record("ngsl:abandon", "known"), interval: 3 }]);

    await second.clearRecords();
    expect(await second.getAllRecords()).toEqual([]);
    expect(await second.getSetting("lastWordId")).toBe("ngsl:abandon");
  });
});
