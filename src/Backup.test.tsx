import { screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { ProgressRecord } from "./ports";
import { fakePlatform, fixtureCollection, fixtureWord, memoryProgressStore } from "./test/fakes";
import { renderApp, settleNavigation } from "./test/renderApp";

const words = [
  fixtureWord({ id: "fx:the", lemma: "the", pos: "det", rank: 1 }),
  fixtureWord({ id: "fx:be", lemma: "be", pos: "verb", rank: 2 }),
  fixtureWord({ id: "fx:abandon", lemma: "abandon", pos: "verb", rank: 3 }),
];

function record(wordId: string, state: ProgressRecord["state"], lastReviewed: string): ProgressRecord {
  return { wordId, state, firstSeen: "2026-09-01T00:00:00.000Z", lastReviewed, interval: 0 };
}

async function renderSettings(progressStore = memoryProgressStore()) {
  const platform = fakePlatform({ isStandalone: true });
  window.location.hash = "#/settings";
  await settleNavigation();
  const view = await renderApp({
    collection: fixtureCollection({ words }),
    platform,
    progressStore,
    build: { version: "0.1.0", commit: "abc1234def" },
  });
  return { ...view, platform, progressStore };
}

function backup() {
  return within(screen.getByRole("region", { name: "Backup" }));
}

afterEach(async () => {
  window.location.hash = "";
  await settleNavigation();
});

describe("Export, Import and Reset", () => {
  it("exports a dated JSON file carrying schema version, app version, timestamp, collections, records and settings", async () => {
    const user = userEvent.setup();
    const progressStore = memoryProgressStore();
    progressStore.records.set("fx:the", record("fx:the", "known", "2026-09-10T08:00:00.000Z"));
    progressStore.records.set("fx:be", record("fx:be", "learning", "2026-09-11T08:00:00.000Z"));
    await progressStore.setSetting("voiceLocale", "en-GB");
    const { platform } = await renderSettings(progressStore);

    await user.click(backup().getByRole("button", { name: "Export progress" }));

    expect(platform.shared).toHaveLength(1);
    const file = platform.shared[0]!;
    const today = new Date().toISOString().slice(0, 10);
    expect(file.name).toBe(`hordbook-progress-${today}.json`);
    expect(file.type).toBe("application/json");
    const doc = JSON.parse(file.content);
    expect(doc).toMatchObject({
      app: "hordbook",
      schemaVersion: 1,
      appVersion: "0.1.0 (abc1234)",
      collections: ["fx"],
      settings: { voiceLocale: "en-GB" },
    });
    expect(doc.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(doc.records).toEqual([
      record("fx:the", "known", "2026-09-10T08:00:00.000Z"),
      record("fx:be", "learning", "2026-09-11T08:00:00.000Z"),
    ]);
    expect(backup().getByRole("status")).toHaveTextContent(/2 records/);
  });

  it("imports after showing a summary and confirming, keeping the newest record per word", async () => {
    const user = userEvent.setup();
    const progressStore = memoryProgressStore();
    progressStore.records.set("fx:the", record("fx:the", "known", "2026-09-10T08:00:00.000Z")); // newer locally
    progressStore.records.set("fx:be", record("fx:be", "learning", "2026-09-05T08:00:00.000Z")); // older locally
    const { platform } = await renderSettings(progressStore);
    const exported = {
      app: "hordbook",
      schemaVersion: 1,
      appVersion: "0.1.0",
      exportedAt: "2026-09-12T09:30:00.000Z",
      collections: ["fx"],
      records: [
        record("fx:the", "learning", "2026-09-01T08:00:00.000Z"), // older than local: ignored
        record("fx:be", "known", "2026-09-12T08:00:00.000Z"), // newer than local: wins
        record("fx:abandon", "learning", "2026-09-12T08:00:00.000Z"), // new locally
      ],
      settings: { voiceLocale: "en-GB" },
    };
    platform.pickQueue.push({ name: "hordbook-progress-2026-09-12.json", type: "application/json", content: JSON.stringify(exported) });

    await user.click(backup().getByRole("button", { name: "Import…" }));

    const dialog = await screen.findByRole("dialog", { name: "Import this file?" });
    expect(dialog).toHaveTextContent(/3 records/);
    expect(dialog).toHaveTextContent(/Sep 12, 2026/);
    expect(dialog).toHaveTextContent(/collection fx/);
    // Nothing changes until confirmed.
    expect(progressStore.records.get("fx:be")?.state).toBe("learning");

    await user.click(within(dialog).getByRole("button", { name: "Import" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(backup().getByRole("status")).toHaveTextContent(/Imported 2 records \(1 were already up to date\)/);
    expect(progressStore.records.get("fx:the")).toEqual(record("fx:the", "known", "2026-09-10T08:00:00.000Z"));
    expect(progressStore.records.get("fx:be")).toEqual(record("fx:be", "known", "2026-09-12T08:00:00.000Z"));
    expect(progressStore.records.get("fx:abandon")).toEqual(record("fx:abandon", "learning", "2026-09-12T08:00:00.000Z"));
    expect(screen.getByRole("radio", { name: "UK English" })).toBeChecked();
  });

  it("rejects files that are not Hordbook exports or come from a newer format, and does nothing when the picker is cancelled", async () => {
    const user = userEvent.setup();
    const { platform, progressStore } = await renderSettings();
    progressStore.records.set("fx:the", record("fx:the", "known", "2026-09-10T08:00:00.000Z"));

    platform.pickQueue.push({ name: "notes.txt", type: "text/plain", content: "hello" });
    await user.click(backup().getByRole("button", { name: "Import…" }));
    expect(await backup().findByRole("alert")).toHaveTextContent(/not a Hordbook export/);

    platform.pickQueue.push({ name: "x.json", type: "application/json", content: JSON.stringify({ app: "other", schemaVersion: 1, records: [] }) });
    await user.click(backup().getByRole("button", { name: "Import…" }));
    expect(await backup().findByRole("alert")).toHaveTextContent(/not a Hordbook export/);

    platform.pickQueue.push({
      name: "future.json",
      type: "application/json",
      content: JSON.stringify({ app: "hordbook", schemaVersion: 2, records: [] }),
    });
    await user.click(backup().getByRole("button", { name: "Import…" }));
    expect(await backup().findByRole("alert")).toHaveTextContent(/newer Hordbook.*Update the app/);

    platform.pickQueue.push(null);
    await user.click(backup().getByRole("button", { name: "Import…" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(progressStore.records.size).toBe(1);
  });

  it("resets all progress only after confirmation; cancelling keeps everything", async () => {
    const user = userEvent.setup();
    const progressStore = memoryProgressStore();
    progressStore.records.set("fx:the", record("fx:the", "known", "2026-09-10T08:00:00.000Z"));
    progressStore.records.set("fx:be", record("fx:be", "learning", "2026-09-11T08:00:00.000Z"));
    await renderSettings(progressStore);

    await user.click(backup().getByRole("button", { name: "Reset progress…" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete all progress?" });
    expect(dialog).toHaveTextContent(/2 records/);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(progressStore.records.size).toBe(2);

    await user.click(backup().getByRole("button", { name: "Reset progress…" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete everything" }));

    expect(progressStore.records.size).toBe(0);
    expect(backup().getByRole("status")).toHaveTextContent(/Progress reset/);

    // The list reflects it: every word unseen again.
    window.location.hash = "#/";
    await settleNavigation();
    expect(await screen.findByRole("button", { name: "the: unseen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "be: unseen" })).toBeInTheDocument();
  });
});
