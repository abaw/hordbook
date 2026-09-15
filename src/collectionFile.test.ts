import { describe, expect, it } from "vitest";

import { collectionFromFile } from "./collectionFile";
import { CC_BY_SA_4 } from "./test/fakes";

const file = {
  schema_version: 1,
  id: "ngsl",
  name: "New General Service List 1.2",
  source: { name: "New General Service List", version: "1.2", urls: ["https://example.test/"] },
  license: CC_BY_SA_4,
  attribution: "attribution text",
  built_at: "2026-09-11",
  sort_key: "rank",
  level_size: 400,
  gloss_language: "zh-Hant-TW",
  word_count: 2,
  words: [
    { id: "ngsl:the", lemma: "the", pos: "det", rank: 1, ipa: "/ðə/", definition: "used to refer", gloss: "指已提及的人或事物" },
    { id: "ngsl:zone", lemma: "zone", pos: null, rank: 2, ipa: null, definition: "area", gloss: "" },
  ],
};

describe("collectionFromFile", () => {
  it("maps the pipeline's file shape onto the Collection port", () => {
    const collection = collectionFromFile(file);
    expect(collection.schemaVersion).toBe(1);
    expect(collection.name).toBe("New General Service List 1.2");
    expect(collection.builtAt).toBe("2026-09-11");
    expect(collection.sortKey).toBe("rank");
    expect(collection.levelSize).toBe(400);
    expect(collection.glossLanguage).toBe("zh-Hant-TW");
    expect(collection.words).toHaveLength(2);
    expect(collection.words[1]).toEqual({
      id: "ngsl:zone",
      lemma: "zone",
      pos: null,
      rank: 2,
      ipa: null,
      definition: "area",
      gloss: "",
    });
  });

  it("rejects a file whose schema version it does not understand", () => {
    expect(() => collectionFromFile({ ...file, schema_version: 2 })).toThrow(/schema version 2/);
  });

  it("rejects a word whose part of speech is outside the vocabulary", () => {
    const words = [{ ...file.words[0]!, pos: "article" }, file.words[1]!];
    expect(() => collectionFromFile({ ...file, words, word_count: 2 })).toThrow(/pos "article".*ngsl:the/);
  });

  it("rejects a file whose word count disagrees with its words", () => {
    expect(() => collectionFromFile({ ...file, word_count: 5 })).toThrow(/word_count/);
  });
});
