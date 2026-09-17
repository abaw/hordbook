import { PARTS_OF_SPEECH, type Collection, type PartOfSpeech, type ProgressState, type Word } from "./ports";

/** Display labels for the collection file's part-of-speech codes. */
export const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, { short: string; name: string }> = {
  noun: { short: "noun", name: "Noun" },
  verb: { short: "verb", name: "Verb" },
  adj: { short: "adj.", name: "Adjective" },
  adv: { short: "adv.", name: "Adverb" },
  prep: { short: "prep.", name: "Preposition" },
  pron: { short: "pron.", name: "Pronoun" },
  conj: { short: "conj.", name: "Conjunction" },
  det: { short: "det.", name: "Determiner" },
  aux: { short: "aux.", name: "Auxiliary verb" },
  intj: { short: "interj.", name: "Interjection" },
  num: { short: "num.", name: "Numeral" },
};

export interface Level {
  /** 1-based level number. */
  number: number;
  firstRank: number;
  lastRank: number;
  words: Word[];
}

/**
 * Splits the collection into consecutive levels of `levelSize` ranks. The
 * number of levels is rounded, so a small remainder joins the last level
 * (NGSL: 2,809 words in seven levels, the last covering 2401–2809).
 */
export function levelsOf(collection: Collection): Level[] {
  const sorted = sortedByRank(collection);
  const { levelSize } = collection;
  const count = levelCount(collection);
  return Array.from({ length: count }, (_, index) => {
    const firstRank = index * levelSize + 1;
    const isLast = index === count - 1;
    const words = sorted.filter((w) => w.rank >= firstRank && (isLast || w.rank <= firstRank + levelSize - 1));
    return {
      number: index + 1,
      firstRank,
      lastRank: isLast ? (words.at(-1)?.rank ?? firstRank) : firstRank + levelSize - 1,
      words,
    };
  });
}

export interface WordFilter {
  /** Case-insensitive prefix of the lemma; empty matches everything. */
  search: string;
  /** Restrict to one part of speech; null matches everything. */
  pos: PartOfSpeech | null;
  /** Restrict to one progress state; null matches everything. */
  state: ProgressState | null;
}

/** Keeps the words matching the filter; levels left empty are dropped. */
export function filterLevels(levels: Level[], filter: WordFilter, stateOf: (wordId: string) => ProgressState): Level[] {
  const prefix = filter.search.trim().toLocaleLowerCase("en");
  if (prefix === "" && filter.pos === null && filter.state === null) return levels;
  const matches = (w: Word) =>
    (filter.pos === null || w.pos === filter.pos) &&
    (filter.state === null || stateOf(w.id) === filter.state) &&
    w.lemma.toLocaleLowerCase("en").startsWith(prefix);
  return levels
    .map((level) => ({ ...level, words: level.words.filter(matches) }))
    .filter((level) => level.words.length > 0);
}

/** Parts of speech that occur in the collection, in the canonical order. */
export function partsOfSpeechIn(collection: Collection): PartOfSpeech[] {
  const present = new Set(collection.words.map((w) => w.pos));
  return PARTS_OF_SPEECH.filter((pos) => present.has(pos));
}

function sortedByRank(collection: Collection): Word[] {
  return [...collection.words].sort((a, b) => a.rank - b.rank);
}

/** Rounded, so a small remainder joins the last level rather than forming its own. */
function levelCount(collection: Collection): number {
  return Math.max(1, Math.round(collection.words.length / collection.levelSize));
}

/** The level a rank belongs to. */
export function levelNumberOf(collection: Collection, rank: number): number {
  return Math.min(levelCount(collection), Math.ceil(rank / collection.levelSize));
}

export interface WordPosition {
  word: Word;
  /** The word one rank earlier, if any. */
  previous: Word | null;
  /** The word one rank later, if any. */
  next: Word | null;
}

/** Locates a word by ID together with its neighbours in rank order. */
export function locateWord(collection: Collection, wordId: string): WordPosition | null {
  const sorted = sortedByRank(collection);
  const index = sorted.findIndex((w) => w.id === wordId);
  if (index === -1) return null;
  return { word: sorted[index]!, previous: sorted[index - 1] ?? null, next: sorted[index + 1] ?? null };
}
