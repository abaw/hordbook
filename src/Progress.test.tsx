import { screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakePlatform, fixtureCollection, fixtureWord, memoryProgressStore } from "./test/fakes";
import { renderApp, settleNavigation } from "./test/renderApp";

const words = [
  fixtureWord({ id: "fx:the", lemma: "the", pos: "det", rank: 1 }),
  fixtureWord({ id: "fx:be", lemma: "be", pos: "verb", rank: 2 }),
  fixtureWord({ id: "fx:abandon", lemma: "abandon", pos: "verb", rank: 3 }),
  fixtureWord({ id: "fx:able", lemma: "able", pos: "adj", rank: 4 }),
];

async function renderWords(progressStore = memoryProgressStore()) {
  const view = await renderApp({
    collection: fixtureCollection({ words, levelSize: 2 }),
    platform: fakePlatform({ isStandalone: true }),
    progressStore,
  });
  return { ...view, progressStore };
}

/** The state control of a row or card is a button named "<lemma>: <state>". */
function stateButton(lemma: string) {
  return screen.getByRole("button", { name: new RegExp(`^${lemma}: `) });
}

afterEach(async () => {
  window.location.hash = "";
  await settleNavigation();
});

describe("Progress state", () => {
  it("cycles unseen → learning → known → unseen from a row, storing a record only while marked", async () => {
    const user = userEvent.setup();
    const { progressStore } = await renderWords();
    await screen.findByRole("button", { name: "abandon: unseen" });

    await user.click(stateButton("abandon"));
    expect(screen.getByRole("button", { name: "abandon: learning" })).toBeInTheDocument();
    expect(progressStore.records.get("fx:abandon")).toMatchObject({ wordId: "fx:abandon", state: "learning", interval: 0 });

    await user.click(stateButton("abandon"));
    expect(screen.getByRole("button", { name: "abandon: known" })).toBeInTheDocument();
    expect(progressStore.records.get("fx:abandon")?.state).toBe("known");

    await user.click(stateButton("abandon"));
    expect(screen.getByRole("button", { name: "abandon: unseen" })).toBeInTheDocument();
    expect(progressStore.records.has("fx:abandon")).toBe(false);
    // Other words were never touched.
    expect(progressStore.records.size).toBe(0);
  });

  it("shows persisted states when rendered again with the same store", async () => {
    const user = userEvent.setup();
    const { progressStore, unmount } = await renderWords();
    await screen.findByRole("button", { name: "the: unseen" });
    await user.click(stateButton("the"));
    await user.click(stateButton("be"));
    await user.click(stateButton("be"));
    unmount();

    await renderWords(progressStore);

    expect(await screen.findByRole("button", { name: "the: learning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "be: known" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "abandon: unseen" })).toBeInTheDocument();
  });

  it("cycles the state from the word card and the row reflects it on return", async () => {
    const user = userEvent.setup();
    await renderWords();
    await screen.findByRole("link", { name: "3 abandon verb" });
    await user.click(screen.getByRole("link", { name: "3 abandon verb" }));
    const card = await screen.findByRole("article", { name: "abandon" });

    await user.click(within(card).getByRole("button", { name: "abandon: unseen" }));
    expect(within(card).getByRole("button", { name: "abandon: learning" })).toHaveTextContent("Learning");

    await user.click(screen.getByRole("link", { name: "Words" }));
    expect(await screen.findByRole("button", { name: "abandon: learning" })).toBeInTheDocument();
  });

  it("filters the list by progress state, combined with the other filters", async () => {
    const user = userEvent.setup();
    await renderWords();
    await screen.findByRole("button", { name: "the: unseen" });
    await user.click(stateButton("the")); // learning
    await user.click(stateButton("be")); // learning
    await user.click(stateButton("be")); // known
    const filter = screen.getByRole("combobox", { name: "Progress" });
    const rows = () => screen.getAllByRole("listitem").map((r) => within(r).getByRole("link").textContent);

    await user.selectOptions(filter, "Learning");
    expect(rows()).toEqual(["1 the det."]);

    await user.selectOptions(filter, "Known");
    expect(rows()).toEqual(["2 be verb"]);

    await user.selectOptions(filter, "Unseen");
    expect(rows()).toEqual(["3 abandon verb", "4 able adj."]);

    await user.selectOptions(screen.getByRole("combobox", { name: "Part of speech" }), "Verb");
    expect(rows()).toEqual(["3 abandon verb"]);

    // Marking a word while filtered removes it from the current view.
    await user.click(stateButton("abandon"));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No words match");
  });

  it("shows known and learning counts for the whole collection and per level", async () => {
    const user = userEvent.setup();
    await renderWords();
    await screen.findByRole("button", { name: "the: unseen" });

    const overall = screen.getByRole("progressbar", { name: /collection progress/i });
    expect(overall).toHaveAccessibleName("Collection progress: 0 known, 0 learning of 4");

    await user.click(stateButton("the")); // learning (level 1)
    await user.click(stateButton("be")); // learning (level 1)
    await user.click(stateButton("be")); // known (level 1)
    await user.click(stateButton("able")); // learning (level 2)

    expect(screen.getByRole("progressbar", { name: /collection progress/i })).toHaveAccessibleName(
      "Collection progress: 1 known, 2 learning of 4",
    );
    const level1 = screen.getByRole("region", { name: "Level 1" });
    const level2 = screen.getByRole("region", { name: "Level 2" });
    expect(within(level1).getByRole("progressbar")).toHaveAccessibleName("Level 1 progress: 1 known, 1 learning of 2");
    expect(within(level2).getByRole("progressbar")).toHaveAccessibleName("Level 2 progress: 0 known, 1 learning of 2");
    expect(within(level1).getByText("1 known · 1 learning")).toBeInTheDocument();
    expect(overall).toHaveAttribute("aria-valuenow", "1");
    expect(overall).toHaveAttribute("aria-valuemax", "4");
  });

  it("reopens the list at the last viewed word", async () => {
    const user = userEvent.setup();
    const scrolled: string[] = [];
    const scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this.textContent ?? "");
    });
    Element.prototype.scrollIntoView = scrollIntoView;

    const { progressStore, unmount } = await renderWords();
    await user.click(screen.getByRole("link", { name: "4 able adj." }));
    await screen.findByRole("article", { name: "able" });
    unmount();
    window.location.hash = "";
    await settleNavigation();

    // A fresh launch: no fragment, same device store.
    await renderWords(progressStore);

    expect(screen.getByRole("searchbox", { name: "Search words" })).toBeInTheDocument();
    await waitFor(() => expect(scrolled).toEqual(["4 able adj."]));
  });
});
