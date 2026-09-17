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

/** The learner's per-word status. `unseen` is the default and is never stored. */
export type ProgressState = "unseen" | "learning" | "known";

/**
 * Per-word progress, keyed by word ID. A record exists only for words the
 * learner has marked; absence means `unseen`. The spaced-repetition fields
 * are reserved so that review scheduling can be added without a migration:
 *
 * - `firstSeen`: ISO timestamp of the first time the word was marked.
 * - `lastReviewed`: ISO timestamp of the most recent state change.
 * - `interval`: days until the next review; always `0` in v1 (no scheduling).
 */
export interface ProgressRecord {
  wordId: string;
  state: Exclude<ProgressState, "unseen">;
  firstSeen: string;
  lastReviewed: string;
  interval: number;
}

/** On-device persistence: small settings plus one record per marked word. */
export interface ProgressStore {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  /** Every stored record; the app keeps them in memory afterwards. */
  getAllRecords(): Promise<ProgressRecord[]>;
  putRecord(record: ProgressRecord): Promise<void>;
  deleteRecord(wordId: string): Promise<void>;
}

/** The two English accents the learner can choose between. */
export type SpeechLocale = "en-US" | "en-GB";

/**
 * How natural an installed voice sounds. iOS ships a compact voice per
 * language; enhanced and premium voices are downloads the learner makes in
 * Settings › Accessibility › Spoken Content.
 */
export type VoiceQuality = "premium" | "enhanced" | "compact" | "other";

export interface Voice {
  name: string;
  /** BCP 47 tag as reported by the device, e.g. `en-US`. */
  lang: string;
  quality: VoiceQuality;
}

/** Device capabilities the app touches. */
export interface Platform {
  /** True when running as an installed home-screen app rather than in a browser tab. */
  isStandalone: boolean;
  openUrl(url: string): void;
  /** Pronounces `text` with the best installed voice for `locale`. */
  speak(text: string, locale: SpeechLocale): void;
  /** Installed text-to-speech voices; may be empty where speech is unavailable. */
  voices(): Promise<Voice[]>;
  /** Puts text on the system clipboard (the fallback if a ChatGPT link does not prefill). */
  writeClipboard(text: string): void;
}

export interface Ports {
  collection: Collection;
  progressStore: ProgressStore;
  platform: Platform;
  build: BuildInfo;
}

/** What was built: shown in About and used to link docs at the matching commit. */
export interface BuildInfo {
  /** package.json version. */
  version: string;
  /** Full git commit the build came from; null for local builds. */
  commit: string | null;
}
