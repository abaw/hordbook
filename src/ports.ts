/**
 * Ports: everything the app root needs from the outside world.
 *
 * Production wires real implementations (bundled collection, IndexedDB,
 * browser APIs); tests wire fakes. Nothing below the app root reaches for a
 * global that is represented here.
 */

/** The NGSL part-of-speech vocabulary used by collection files. */
export const PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "adj",
  "adv",
  "prep",
  "pron",
  "conj",
  "det",
  "aux",
  "intj",
  "num",
] as const;

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export function isPartOfSpeech(value: unknown): value is PartOfSpeech {
  return typeof value === "string" && (PARTS_OF_SPEECH as readonly string[]).includes(value);
}

/** Where a collection's words came from. */
export interface Source {
  name: string;
  version: string;
  urls: string[];
}

/** The licence a collection's data is redistributed under. */
export interface License {
  spdx: string;
  name: string;
  url: string;
}

export interface Word {
  /** Stable, collection-namespaced identifier, e.g. `ngsl:abandon`. */
  id: string;
  lemma: string;
  pos: PartOfSpeech | null;
  /** Position in the collection's study order; 1 is first. */
  rank: number;
  ipa: string | null;
  definition: string;
  /** Traditional Chinese gloss; empty when not yet available. */
  gloss: string;
}

export interface Collection {
  schemaVersion: number;
  id: string;
  name: string;
  source: Source;
  license: License;
  attribution: string;
  builtAt: string;
  sortKey: "rank";
  levelSize: number;
  glossLanguage: string;
  words: Word[];
}

/** On-device persistence. Word-level progress records are added by later tickets. */
export interface ProgressStore {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

/** Device capabilities the app touches. */
export interface Platform {
  /** True when running as an installed home-screen app rather than in a browser tab. */
  isStandalone: boolean;
  openUrl(url: string): void;
}

export interface Ports {
  collection: Collection;
  progressStore: ProgressStore;
  platform: Platform;
  /** Build identifier shown in About, e.g. `0.1.0 (62a4df3)`. */
  appVersion: string;
}
