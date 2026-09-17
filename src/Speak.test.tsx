import { screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { Voice } from "./ports";
import { fakePlatform, fixtureCollection, fixtureWord, memoryProgressStore } from "./test/fakes";
import { renderApp, settleNavigation } from "./test/renderApp";

const words = [
  fixtureWord({ id: "fx:abandon", lemma: "abandon", pos: "verb", rank: 1 }),
  fixtureWord({ id: "fx:ability", lemma: "ability", pos: "noun", rank: 2 }),
  fixtureWord({ id: "fx:able", lemma: "able", pos: "adj", rank: 3 }),
  fixtureWord({ id: "fx:I", lemma: "I", pos: "pron", rank: 4 }),
];

async function renderWords(options: { installedVoices?: Voice[]; progressStore?: ReturnType<typeof memoryProgressStore> } = {}) {
  const platform = fakePlatform({ isStandalone: true, installedVoices: options.installedVoices ?? [] });
  const progressStore = options.progressStore ?? memoryProgressStore();
  const view = await renderApp({ collection: fixtureCollection({ words }), platform, progressStore });
  return { ...view, platform, progressStore };
}

async function openCardAndSpeak(user: ReturnType<typeof userEvent.setup>, rowName: string, lemma: string) {
  await user.click(screen.getByRole("link", { name: rowName }));
  await screen.findByRole("article", { name: lemma });
  await user.click(screen.getByRole("button", { name: "Speak" }));
}

afterEach(async () => {
  window.location.hash = "";
  await settleNavigation();
});

describe("Speak", () => {
  it("speaks a carrier phrase chosen by part of speech, in US English by default", async () => {
    const user = userEvent.setup();
    const { platform } = await renderWords();

    await openCardAndSpeak(user, "1 abandon verb", "abandon");
    await user.click(screen.getByRole("link", { name: "Next: ability" }));
    await user.click(screen.getByRole("button", { name: "Speak" }));
    await user.click(screen.getByRole("link", { name: "Next: able" }));
    await user.click(screen.getByRole("button", { name: "Speak" }));
    await user.click(screen.getByRole("link", { name: "Next: I" }));
    await user.click(screen.getByRole("button", { name: "Speak" }));

    expect(platform.spoken).toEqual([
      { text: "to abandon", locale: "en-US" },
      { text: "the ability", locale: "en-US" },
      { text: "able", locale: "en-US" },
      { text: "I", locale: "en-US" },
    ]);
  });

  it("speaks in UK English after the accent is switched in Settings, and remembers the choice", async () => {
    const user = userEvent.setup();
    const { platform, progressStore, unmount } = await renderWords();

    await user.click(screen.getByRole("link", { name: "Settings" }));
    const group = await screen.findByRole("radiogroup", { name: "Voice accent" });
    expect(screen.getByRole("radio", { name: "US English" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "UK English" }));
    expect(group).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Home" }));
    await screen.findByRole("link", { name: "1 abandon verb" });
    await openCardAndSpeak(user, "1 abandon verb", "abandon");
    expect(platform.spoken).toEqual([{ text: "to abandon", locale: "en-GB" }]);
    unmount();

    window.location.hash = "#/settings";
    await settleNavigation();
    await renderWords({ progressStore });
    expect(screen.getByRole("radio", { name: "UK English" })).toBeChecked();
  });

  const compactOnly: Voice[] = [
    { name: "Samantha", lang: "en-US", quality: "compact" },
    { name: "Daniel", lang: "en-GB", quality: "compact" },
    { name: "Eddy", lang: "en-US", quality: "other" },
  ];

  it("hints once about downloading an enhanced voice when only compact voices are installed", async () => {
    const user = userEvent.setup();
    const { progressStore, unmount } = await renderWords({ installedVoices: compactOnly });

    await openCardAndSpeak(user, "1 abandon verb", "abandon");
    const hint = await screen.findByRole("note", { name: /enhanced voice/i });
    expect(hint).toHaveTextContent(/Settings › Accessibility › Spoken Content › Voices › English/);
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("note", { name: /enhanced voice/i })).not.toBeInTheDocument();
    unmount();
    window.location.hash = "";
    await settleNavigation();

    await renderWords({ installedVoices: compactOnly, progressStore });
    await openCardAndSpeak(user, "1 abandon verb", "abandon");
    await user.click(screen.getByRole("button", { name: "Speak" }));
    expect(screen.queryByRole("note", { name: /enhanced voice/i })).not.toBeInTheDocument();
  });

  it("does not hint when an enhanced voice for the accent is installed, or when no voices are reported", async () => {
    const user = userEvent.setup();
    const { unmount } = await renderWords({
      installedVoices: [...compactOnly, { name: "Samantha (Enhanced)", lang: "en-US", quality: "enhanced" }],
    });
    await openCardAndSpeak(user, "1 abandon verb", "abandon");
    await user.click(screen.getByRole("button", { name: "Speak" }));
    expect(screen.queryByRole("note", { name: /enhanced voice/i })).not.toBeInTheDocument();
    unmount();
    window.location.hash = "";
    await settleNavigation();

    await renderWords({ installedVoices: [] });
    await openCardAndSpeak(user, "1 abandon verb", "abandon");
    expect(screen.queryByRole("note", { name: /enhanced voice/i })).not.toBeInTheDocument();
  });
});
