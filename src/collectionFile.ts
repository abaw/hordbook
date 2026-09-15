import type { Collection, PartOfSpeech, Word } from "./ports";

/** Shape of `collections/*.json` as written by the data pipeline (schema version 1). */
export interface CollectionFile {
  schema_version: number;
  id: string;
  name: string;
  source: { name: string; version: string; urls: string[] };
  license: { spdx: string; name: string; url: string };
  attribution: string;
  built_at: string;
  sort_key: string;
  level_size: number;
  gloss_language: string;
  word_count: number;
  words: Array<{
    id: string;
    lemma: string;
    pos: string | null;
    rank: number;
    ipa: string | null;
    definition: string;
    gloss: string;
  }>;
}

const SUPPORTED_SCHEMA_VERSION = 1;

export function collectionFromFile(file: CollectionFile): Collection {
  if (file.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`unsupported collection schema version ${file.schema_version}`);
  }
  if (file.word_count !== file.words.length) {
    throw new Error(`collection word_count ${file.word_count} does not match ${file.words.length} words`);
  }
  if (file.sort_key !== "rank") {
    throw new Error(`unsupported sort key ${file.sort_key}`);
  }
  return {
    schemaVersion: file.schema_version,
    id: file.id,
    name: file.name,
    source: file.source,
    license: file.license,
    attribution: file.attribution,
    builtAt: file.built_at,
    sortKey: "rank",
    levelSize: file.level_size,
    glossLanguage: file.gloss_language,
    words: file.words.map(wordFromFile),
  };
}

function wordFromFile(word: CollectionFile["words"][number]): Word {
  return {
    id: word.id,
    lemma: word.lemma,
    pos: word.pos as PartOfSpeech | null,
    rank: word.rank,
    ipa: word.ipa,
    definition: word.definition,
    gloss: word.gloss,
  };
}
