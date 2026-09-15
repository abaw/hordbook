import type { Collection, License, Platform, ProgressStore, Word } from "../ports";

export const CC_BY_SA_4: License = {
  spdx: "CC-BY-SA-4.0",
  name: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export function fixtureWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "fx:abandon",
    lemma: "abandon",
    pos: "verb",
    rank: 1,
    ipa: "/əˈbæn.dən/",
    definition: "to leave someone or something you are responsible for and not return",
    gloss: "遺棄；拋棄",
    ...overrides,
  };
}

export function fixtureCollection(
  overrides: Partial<Omit<Collection, "words">> & { wordCount?: number; words?: Word[] } = {},
): Collection {
  const { wordCount, words, ...rest } = overrides;
  const generated: Word[] =
    words ??
    Array.from({ length: wordCount ?? 3 }, (_, index) =>
      fixtureWord({ id: `fx:w${index + 1}`, lemma: `w${index + 1}`, rank: index + 1 }),
    );
  return {
    schemaVersion: 1,
    id: "fx",
    name: "Fixture Collection",
    source: { name: "Fixture", version: "0", urls: ["https://example.test/"] },
    license: CC_BY_SA_4,
    attribution: "Fixture attribution",
    builtAt: "2026-01-01",
    sortKey: "rank",
    levelSize: 400,
    glossLanguage: "zh-Hant-TW",
    words: generated,
    ...rest,
  };
}

/** In-memory progress store; a fresh instance is an empty device. */
export function memoryProgressStore(): ProgressStore {
  const settings = new Map<string, string>();
  return {
    async getSetting(key) {
      return settings.get(key) ?? null;
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
  };
}

export function fakePlatform(overrides: Partial<Platform> = {}): Platform & { opened: string[] } {
  const opened: string[] = [];
  return {
    isStandalone: false,
    openUrl(url) {
      opened.push(url);
    },
    ...overrides,
    opened,
  };
}
