import type {
  Collection,
  License,
  Platform,
  ProgressRecord,
  ProgressStore,
  SpeechLocale,
  TextFile,
  Voice,
  Word,
} from "../ports";

export const CC_BY_SA_4: License = {
  spdx: "CC-BY-SA-4.0",
  name: "Creative Commons Attribution-ShareAlike 4.0 International",
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
export function memoryProgressStore(): ProgressStore & { records: Map<string, ProgressRecord> } {
  const settings = new Map<string, string>();
  const records = new Map<string, ProgressRecord>();
  return {
    records,
    async getSetting(key) {
      return settings.get(key) ?? null;
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
    async getAllRecords() {
      return [...records.values()];
    },
    async putRecord(record) {
      records.set(record.wordId, record);
    },
    async deleteRecord(wordId) {
      records.delete(wordId);
    },
    async clearRecords() {
      records.clear();
    },
  };
}

export interface FakePlatform extends Platform {
  opened: string[];
  spoken: Array<{ text: string; locale: SpeechLocale }>;
  clipboard: string[];
  /** Files handed to shareFile. */
  shared: TextFile[];
  /** What the next pickFile calls resolve to; push before the tap. */
  pickQueue: Array<TextFile | null>;
}

export function fakePlatform(overrides: Partial<Platform> & { installedVoices?: Voice[] } = {}): FakePlatform {
  const { installedVoices = [], ...rest } = overrides;
  const opened: string[] = [];
  const spoken: FakePlatform["spoken"] = [];
  const clipboard: string[] = [];
  const shared: TextFile[] = [];
  const pickQueue: Array<TextFile | null> = [];
  return {
    isStandalone: false,
    openUrl(url) {
      opened.push(url);
    },
    speak(text, locale) {
      spoken.push({ text, locale });
    },
    async voices() {
      return installedVoices;
    },
    writeClipboard(text) {
      clipboard.push(text);
    },
    async shareFile(file) {
      shared.push(file);
    },
    async pickFile() {
      return pickQueue.shift() ?? null;
    },
    ...rest,
    opened,
    spoken,
    clipboard,
    shared,
    pickQueue,
  };
}
