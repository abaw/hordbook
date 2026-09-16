import { PARTS_OF_SPEECH, type Collection, type PartOfSpeech, type Word } from "./ports";

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
  const sorted = [...collection.words].sort((a, b) => a.rank - b.rank);
  const { levelSize } = collection;
  const count = Math.max(1, Math.round(sorted.length / levelSize));
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
}

/** Keeps the words matching the filter; levels left empty are dropped. */
export function filterLevels(levels: Level[], filter: WordFilter): Level[] {
  const prefix = filter.search.trim().toLocaleLowerCase("en");
  if (prefix === "" && filter.pos === null) return levels;
  const matches = (w: Word) =>
    (filter.pos === null || w.pos === filter.pos) && w.lemma.toLocaleLowerCase("en").startsWith(prefix);
  return levels
    .map((level) => ({ ...level, words: level.words.filter(matches) }))
    .filter((level) => level.words.length > 0);
}

/** Parts of speech that occur in the collection, in the canonical order. */
export function partsOfSpeechIn(collection: Collection): PartOfSpeech[] {
  const present = new Set(collection.words.map((w) => w.pos));
  return PARTS_OF_SPEECH.filter((pos) => present.has(pos));
}
