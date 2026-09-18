import { screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import ngslFile from "../collections/ngsl.json";
import { collectionFromFile, type CollectionFile } from "./collectionFile";
import type { Collection } from "./ports";
import { fakePlatform, fixtureCollection, fixtureWord } from "./test/fakes";
import { renderApp, settleNavigation } from "./test/renderApp";

const abandon = fixtureWord({
  id: "fx:abandon",
  lemma: "abandon",
  pos: "verb",
  rank: 1,
  definition: "to leave someone or something you are responsible for and not return",
});

const ACTIONS = ["Example sentences", "Teach me inside out", "Compare with similar words"] as const;
const PLAIN = "https://chatgpt.com/?q=";

async function renderCard(collection: Collection, wordId: string) {
  const platform = fakePlatform({ isStandalone: true });
  window.location.hash = `#/words/${wordId}`;
  await settleNavigation();
  const view = await renderApp({ collection, platform });
  return { ...view, platform };
}

async function fireAllActions(user: ReturnType<typeof userEvent.setup>) {
  const group = within(screen.getByRole("group", { name: "Ask ChatGPT" }));
  for (const action of ACTIONS) {
    await user.click(group.getByRole("button", { name: action }));
  }
}

afterEach(async () => {
  window.location.hash = "";
  await settleNavigation();
});

describe("ChatGPT prompt actions", () => {
  it("opens ChatGPT with a structured English-only prompt naming lemma, part of speech and definition, copied to the clipboard", async () => {
    const user = userEvent.setup();
    const { platform } = await renderCard(fixtureCollection({ words: [abandon] }), abandon.id);

    await fireAllActions(user);

    expect(platform.clipboard).toHaveLength(3);
    expect(platform.opened).toHaveLength(3);
    platform.clipboard.forEach((prompt, i) => {
      expect(prompt).toContain('"abandon" (verb)');
      expect(prompt).toContain("to leave someone or something you are responsible for and not return");
      expect(prompt).toMatch(/English only/);
      expect(platform.opened[i]).toBe(`${PLAIN}${encodeURIComponent(prompt)}`);
    });
    expect(platform.clipboard[0]).toMatch(/8 example sentences/);
    expect(platform.clipboard[1]).toMatch(/collocations/);
    expect(platform.clipboard[1]).toMatch(/memory hook/);
    expect(platform.clipboard[2]).toMatch(/near-synonyms/);
    expect(new Set(platform.clipboard).size).toBe(3);
  });

  it("carries the longest NGSL definition in full and still stays under 2,000 characters", async () => {
    const user = userEvent.setup();
    const collection = collectionFromFile(ngslFile as CollectionFile);
    const longest = collection.words.reduce((a, b) => (b.definition.length > a.definition.length ? b : a));
    const { platform } = await renderCard(collection, longest.id);

    await fireAllActions(user);

    for (const [i, url] of platform.opened.entries()) {
      expect(url.length).toBeLessThanOrEqual(2000);
      expect(platform.clipboard[i]).toContain(longest.definition);
    }
  });

  it("shortens an absurdly long definition rather than exceeding the URL bound", async () => {
    const user = userEvent.setup();
    const verbose = fixtureWord({
      id: "fx:verbose",
      lemma: "verbose",
      pos: "adj",
      rank: 1,
      definition: "using far more words than are needed, ".repeat(120).trim(),
    });
    const { platform } = await renderCard(fixtureCollection({ words: [verbose] }), verbose.id);

    await fireAllActions(user);

    for (const url of platform.opened) {
      expect(url.length).toBeLessThanOrEqual(2000);
      expect(url.length).toBeGreaterThan(1500);
      expect(decodeURIComponent(url.slice(PLAIN.length))).toContain('"verbose" (adjective)');
    }
  });
});
