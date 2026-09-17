import { screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fakePlatform, fixtureCollection, fixtureWord } from "./test/fakes";
import { renderApp } from "./test/renderApp";

const words = [
  fixtureWord({ id: "fx:be", lemma: "be", pos: "verb", rank: 2 }),
  fixtureWord({ id: "fx:the", lemma: "the", pos: "det", rank: 1 }),
  fixtureWord({ id: "fx:ability", lemma: "ability", pos: "noun", rank: 5 }),
  fixtureWord({ id: "fx:of", lemma: "of", pos: "prep", rank: 4 }),
  fixtureWord({ id: "fx:and", lemma: "and", pos: "conj", rank: 3 }),
  fixtureWord({ id: "fx:abandon", lemma: "abandon", pos: "verb", rank: 6 }),
  fixtureWord({ id: "fx:able", lemma: "able", pos: "adj", rank: 7 }),
];

async function renderWordList() {
  // Standalone: no first-launch hint competing for headings.
  return renderApp({
    collection: fixtureCollection({ words, levelSize: 3 }),
    platform: fakePlatform({ isStandalone: true }),
  });
}

function rowTexts() {
  return screen.getAllByRole("listitem").map((row) => row.textContent);
}

describe("Word list", () => {
  it("shows every word in rank order with rank, lemma and part of speech", async () => {
    await renderWordList();

    expect(rowTexts()).toEqual([
      "1 the det.",
      "2 be verb",
      "3 and conj.",
      "4 of prep.",
      "5 ability noun",
      "6 abandon verb",
      "7 able adj.",
    ]);
  });

  it("groups words into levels of the collection's level size, the last level taking the remainder", async () => {
    await renderWordList();

    const levels = screen.getAllByRole("region", { name: /^Level \d/ });
    expect(levels.map((level) => within(level).getByRole("heading", { level: 2 }).textContent)).toEqual([
      "Level 1",
      "Level 2",
    ]);
    expect(within(levels[0]!).getByText("Ranks 1–3")).toBeInTheDocument();
    expect(within(levels[1]!).getByText("Ranks 4–7")).toBeInTheDocument();
    expect(within(levels[1]!).getAllByRole("listitem")).toHaveLength(4);
  });

  it("filters to words whose lemma starts with the search text, as it is typed", async () => {
    const user = userEvent.setup();
    await renderWordList();

    await user.type(screen.getByRole("searchbox", { name: "Search words" }), "ab");

    expect(rowTexts()).toEqual(["5 ability noun", "6 abandon verb", "7 able adj."]);
    expect(screen.queryByRole("region", { name: "Level 1" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search words" }), "L");
    expect(rowTexts()).toEqual(["7 able adj."]);
  });

  it("restricts the list to one part of speech, combined with the search", async () => {
    const user = userEvent.setup();
    await renderWordList();
    const posFilter = screen.getByRole("combobox", { name: "Part of speech" });

    expect(within(posFilter).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All parts of speech",
      "Noun",
      "Verb",
      "Adjective",
      "Preposition",
      "Conjunction",
      "Determiner",
    ]);

    await user.selectOptions(posFilter, "Verb");
    expect(rowTexts()).toEqual(["2 be verb", "6 abandon verb"]);

    await user.type(screen.getByRole("searchbox", { name: "Search words" }), "ab");
    expect(rowTexts()).toEqual(["6 abandon verb"]);

    await user.selectOptions(posFilter, "All parts of speech");
    expect(rowTexts()).toEqual(["5 ability noun", "6 abandon verb", "7 able adj."]);
  });

  it("shows an empty state when nothing matches, and recovers when the search is cleared", async () => {
    const user = userEvent.setup();
    await renderWordList();
    const search = screen.getByRole("searchbox", { name: "Search words" });

    await user.type(search, "zzz");

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No words match “zzz”.");

    await user.clear(search);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});
