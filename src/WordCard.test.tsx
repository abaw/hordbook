import { screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakePlatform, fixtureCollection, fixtureWord } from "./test/fakes";
import { renderApp, settleNavigation } from "./test/renderApp";

const words = [
  fixtureWord({ id: "fx:the", lemma: "the", pos: "det", rank: 1, ipa: "/ðə/", definition: "used before a noun", gloss: "這；那" }),
  fixtureWord({ id: "fx:be", lemma: "be", pos: "verb", rank: 2, ipa: "/biː/", definition: "to exist", gloss: "是" }),
  fixtureWord({
    id: "fx:abandon",
    lemma: "abandon",
    pos: "verb",
    rank: 3,
    ipa: "/əˈbæn.dən/",
    definition: "to leave someone or something you are responsible for and not return",
    gloss: "遺棄；拋棄",
  }),
  fixtureWord({ id: "fx:able", lemma: "able", pos: "adj", rank: 4, ipa: null, definition: "having the skill to do something", gloss: "" }),
];

async function renderWords() {
  const platform = fakePlatform({ isStandalone: true });
  const view = await renderApp({ collection: fixtureCollection({ words, levelSize: 2 }), platform });
  return { ...view, platform };
}

afterEach(async () => {
  window.location.hash = "";
  await settleNavigation();
});

describe("Word card", () => {
  it("opens from a row and shows rank, level, lemma, IPA, part of speech, definition and gloss", async () => {
    const user = userEvent.setup();
    await renderWords();

    await user.click(screen.getByRole("link", { name: "3 abandon verb" }));

    const card = await screen.findByRole("article", { name: "abandon" });
    expect(window.location.hash).toBe("#/words/fx:abandon");
    expect(within(card).getByRole("heading", { level: 1, name: "abandon" })).toBeInTheDocument();
    expect(within(card).getByText("Rank 3 · Level 2")).toBeInTheDocument();
    expect(within(card).getByText("/əˈbæn.dən/")).toBeInTheDocument();
    expect(within(card).getByText("Verb")).toBeInTheDocument();
    expect(within(card).getByText("to leave someone or something you are responsible for and not return")).toBeInTheDocument();
    const gloss = within(card).getByText("遺棄；拋棄");
    expect(gloss).toHaveAttribute("lang", "zh-Hant-TW");
    // The list is not shown alongside the card.
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("moves to the previous and next word by rank and stops at the ends", async () => {
    const user = userEvent.setup();
    await renderWords();
    await user.click(screen.getByRole("link", { name: "2 be verb" }));
    await screen.findByRole("article", { name: "be" });

    await user.click(screen.getByRole("link", { name: "Next: abandon" }));
    await screen.findByRole("article", { name: "abandon" });

    await user.click(screen.getByRole("link", { name: "Next: able" }));
    await screen.findByRole("article", { name: "able" });
    expect(screen.queryByRole("link", { name: /^Next/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Previous: abandon" }));
    await screen.findByRole("article", { name: "abandon" });
    await user.click(screen.getByRole("link", { name: "Previous: be" }));
    await screen.findByRole("article", { name: "be" });
    await user.click(screen.getByRole("link", { name: "Previous: the" }));
    await screen.findByRole("article", { name: "the" });
    expect(screen.queryByRole("link", { name: /^Previous/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next: be" })).toBeInTheDocument();
  });

  it("opens Youglish and Longman for the lemma through the openUrl port", async () => {
    const user = userEvent.setup();
    const { platform } = await renderWords();
    await user.click(screen.getByRole("link", { name: "3 abandon verb" }));
    const card = await screen.findByRole("article", { name: "abandon" });

    const youglish = within(card).getByRole("link", { name: "Youglish" });
    const longman = within(card).getByRole("link", { name: "Longman" });
    expect(youglish).toHaveAttribute("href", "https://youglish.com/pronounce/abandon/english");
    expect(longman).toHaveAttribute("href", "https://www.ldoceonline.com/dictionary/abandon");

    await user.click(youglish);
    await user.click(longman);

    expect(platform.opened).toEqual([
      "https://youglish.com/pronounce/abandon/english",
      "https://www.ldoceonline.com/dictionary/abandon",
    ]);
    // Still on the card: the links did not navigate the app itself.
    expect(screen.getByRole("article", { name: "abandon" })).toBeInTheDocument();
  });

  it("hides IPA and gloss when the collection has none, without placeholder text", async () => {
    const user = userEvent.setup();
    await renderWords();
    await user.click(screen.getByRole("link", { name: "4 able adj." }));
    const card = await screen.findByRole("article", { name: "able" });

    expect(within(card).getByText("having the skill to do something")).toBeInTheDocument();
    expect(within(card).getByText("Adjective")).toBeInTheDocument();
    expect(card.querySelector("[lang]")).toBeNull();
    expect(within(card).queryByText(/^[\/—–-]+$|n\/a|unknown|none/i)).not.toBeInTheDocument();
  });

  it("returns to the list with the search, filter and scroll position it left", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    await renderWords();

    await user.type(screen.getByRole("searchbox", { name: "Search words" }), "ab");
    await user.selectOptions(screen.getByRole("combobox", { name: "Part of speech" }), "Verb");
    expect(screen.getAllByRole("listitem").map((r) => r.textContent)).toEqual(["3 abandon verb"]);
    Object.defineProperty(window, "scrollY", { value: 1234, configurable: true });

    await user.click(screen.getByRole("link", { name: "3 abandon verb" }));
    await screen.findByRole("article", { name: "abandon" });
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);

    await user.click(screen.getByRole("link", { name: "Words" }));

    expect(await screen.findByRole("searchbox", { name: "Search words" })).toHaveValue("ab");
    expect(screen.getByRole("combobox", { name: "Part of speech" })).toHaveValue("verb");
    expect(screen.getAllByRole("listitem").map((r) => r.textContent)).toEqual(["3 abandon verb"]);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 1234);
    scrollTo.mockRestore();
  });
});
