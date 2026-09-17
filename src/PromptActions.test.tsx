import { screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { fakePlatform, fixtureCollection, fixtureWord, memoryProgressStore } from "./test/fakes";
import { renderApp, settleNavigation } from "./test/renderApp";

const abandon = fixtureWord({
  id: "fx:abandon",
  lemma: "abandon",
  pos: "verb",
  rank: 1,
  definition: "to leave someone or something you are responsible for and not return",
});

const ACTIONS = ["Example sentences", "Teach me inside out", "Compare with similar words"] as const;

async function renderCard(words = [abandon], progressStore = memoryProgressStore()) {
  const platform = fakePlatform({ isStandalone: true });
  window.location.hash = `#/words/${words[0]!.id}`;
  await settleNavigation();
  const view = await renderApp({ collection: fixtureCollection({ words }), platform, progressStore });
  return { ...view, platform, progressStore };
}

function promptActions() {
  return within(screen.getByRole("group", { name: "Ask ChatGPT" }));
}

afterEach(async () => {
  window.location.hash = "";
  await settleNavigation();
});

describe("ChatGPT prompt actions", () => {
  it("opens plain ChatGPT with a full English-only prompt naming lemma, part of speech and definition, copied to the clipboard", async () => {
    const user = userEvent.setup();
    const { platform } = await renderCard();

    for (const action of ACTIONS) {
      await user.click(promptActions().getByRole("button", { name: action }));
    }

    expect(platform.clipboard).toHaveLength(3);
    expect(platform.opened).toHaveLength(3);
    platform.clipboard.forEach((prompt, i) => {
      expect(prompt).toContain('"abandon"');
      expect(prompt).toContain("(verb)");
      expect(prompt).toContain("to leave someone or something you are responsible for and not return");
      expect(prompt).toMatch(/English only/);
      expect(platform.opened[i]).toBe(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`);
    });
    expect(platform.clipboard[0]).toMatch(/example sentences/i);
    expect(platform.clipboard[1]).toMatch(/collocations/i);
    expect(platform.clipboard[2]).toMatch(/near-synonyms|similar words/i);
    expect(new Set(platform.clipboard).size).toBe(3);
  });

  it("targets the custom GPT with a compact prompt once its URL is set in Settings, and remembers it", async () => {
    const user = userEvent.setup();
    const { platform, progressStore, unmount } = await renderCard();
    const gptUrl = "https://chatgpt.com/g/g-abc123XYZ-hordbook-tutor";

    window.location.hash = "#/settings";
    await settleNavigation();
    const field = await screen.findByRole("textbox", { name: "Custom GPT URL" });
    await user.type(field, gptUrl);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    window.location.hash = "#/words/fx:abandon";
    await settleNavigation();
    await screen.findByRole("article", { name: "abandon" });
    await user.click(promptActions().getByRole("button", { name: "Example sentences" }));

    const compact = "examples: abandon (verb) — to leave someone or something you are responsible for and not return";
    expect(platform.clipboard).toEqual([compact]);
    expect(platform.opened).toEqual([`${gptUrl}?q=${encodeURIComponent(compact)}`]);
    unmount();

    await renderCard([abandon], progressStore);
    window.location.hash = "#/settings";
    await settleNavigation();
    expect(await screen.findByRole("textbox", { name: "Custom GPT URL" })).toHaveValue(gptUrl);
  });

  it("rejects a URL that is not a chatgpt.com GPT link and keeps using plain ChatGPT; clearing the field also does", async () => {
    const user = userEvent.setup();
    const { platform } = await renderCard();

    window.location.hash = "#/settings";
    await settleNavigation();
    const field = await screen.findByRole("textbox", { name: "Custom GPT URL" });
    await user.type(field, "https://example.com/g/g-abc");
    expect(screen.getByRole("alert")).toHaveTextContent(/chatgpt\.com\/g\//);

    window.location.hash = "#/words/fx:abandon";
    await settleNavigation();
    await screen.findByRole("article", { name: "abandon" });
    await user.click(promptActions().getByRole("button", { name: "Example sentences" }));
    expect(platform.opened[0]).toMatch(/^https:\/\/chatgpt\.com\/\?q=/);

    window.location.hash = "#/settings";
    await settleNavigation();
    const again = await screen.findByRole("textbox", { name: "Custom GPT URL" });
    await user.clear(again);
    await user.type(again, "https://chatgpt.com/g/g-abc123-tutor");
    await user.clear(again);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    window.location.hash = "#/words/fx:abandon";
    await settleNavigation();
    await screen.findByRole("article", { name: "abandon" });
    await user.click(promptActions().getByRole("button", { name: "Teach me inside out" }));
    expect(platform.opened[1]).toMatch(/^https:\/\/chatgpt\.com\/\?q=/);
  });

  it("keeps every prompt URL under 2,000 characters even for a very long definition", async () => {
    const user = userEvent.setup();
    const verbose = fixtureWord({
      id: "fx:verbose",
      lemma: "verbose",
      pos: "adj",
      rank: 1,
      definition: "using far more words than are needed, ".repeat(120).trim(),
    });
    const { platform } = await renderCard([verbose]);

    for (const action of ACTIONS) {
      await user.click(promptActions().getByRole("button", { name: action }));
    }

    expect(platform.opened).toHaveLength(3);
    for (const url of platform.opened) {
      expect(url.length).toBeLessThanOrEqual(2000);
      expect(url.length).toBeGreaterThan(1500);
      expect(decodeURIComponent(url.slice("https://chatgpt.com/?q=".length))).toContain('"verbose" (adjective)');
    }
  });
});
