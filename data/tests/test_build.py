"""Seam-1 tests: the pipeline's build-collection boundary.

Inputs are fixture slices shaped like the official NGSL 1.2 downloads; the
assertions are on the produced collection document only.
"""

from __future__ import annotations

import json
from pathlib import Path

import openpyxl
import pytest

from pipeline.build import BuildError, build_collection, same_content
from pipeline.sources import read_definitions_xlsx, read_stats_csv
from pipeline.wiktionary import extract_ipa, extract_pos_candidates

FIXTURES = Path(__file__).parent / "fixtures"

STATS_HEADER = "Lemma,SFI Rank,SFI,Adjusted Frequency per Million (U)\n"


def write_stats_csv(path: Path, rows: list[tuple[str, int]]) -> Path:
    body = "".join(f"{lemma},{rank},50.0,100\n" for lemma, rank in rows)
    path.write_text("\ufeff" + STATS_HEADER + body, encoding="utf-8")
    return path


def write_definitions_xlsx(path: Path, rows: list[tuple[str, str]]) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Word", "Definitons"])  # header typo is faithful to the official file
    for lemma, definition in rows:
        ws.append([lemma, definition])
    wb.save(path)
    return path


@pytest.fixture
def five_word_sources(tmp_path: Path) -> tuple[Path, Path]:
    stats = write_stats_csv(
        tmp_path / "stats.csv",
        [("the", 1), ("be", 2), ("abandon", 5), ("TRUE", 3), ("email", 4)],
    )
    defs = write_definitions_xlsx(
        tmp_path / "defs.xlsx",
        [
            ("abandon", "to leave someone or something you are responsible for and not return"),
            ("the", "used before a noun to refer to a specific thing"),
            ("be", "to exist"),
            ("true", "agreeing with the facts; not false; real or actual"),
            ("e-mail", "a system for sending messages electronically"),
        ],
    )
    return stats, defs


def build_from(stats: Path, defs: Path, **overrides):
    ipa = overrides.pop("ipa", {})
    return build_collection(
        stats=read_stats_csv(stats),
        definitions=read_definitions_xlsx(defs),
        ipa=ipa,
        glosses=overrides.pop("glosses", {}),
        pos=overrides.pop("pos", {}),
        built_at=overrides.pop("built_at", "2026-09-11"),
        **overrides,
    )


class TestJoin:
    def test_one_entry_per_lemma_sorted_by_rank(self, five_word_sources):
        doc = build_from(*five_word_sources)
        assert [w["lemma"] for w in doc["words"]] == ["the", "be", "true", "email", "abandon"]
        assert [w["rank"] for w in doc["words"]] == [1, 2, 3, 4, 5]
        assert doc["word_count"] == 5

    def test_excel_boolean_artifacts_and_email_alias_are_normalised(self, five_word_sources):
        doc = build_from(*five_word_sources)
        by_lemma = {w["lemma"]: w for w in doc["words"]}
        assert by_lemma["true"]["definition"].startswith("agreeing with the facts")
        assert by_lemma["email"]["definition"].startswith("a system for sending")
        assert "TRUE" not in by_lemma and "e-mail" not in by_lemma

    def test_word_ids_are_namespaced_by_collection_and_lemma(self, five_word_sources):
        doc = build_from(*five_word_sources)
        assert {w["id"] for w in doc["words"]} == {
            "ngsl:the", "ngsl:be", "ngsl:true", "ngsl:email", "ngsl:abandon",
        }

    def test_missing_definition_fails_the_build(self, tmp_path):
        stats = write_stats_csv(tmp_path / "s.csv", [("the", 1), ("be", 2)])
        defs = write_definitions_xlsx(tmp_path / "d.xlsx", [("the", "def")])
        with pytest.raises(BuildError, match="be"):
            build_from(stats, defs)

    def test_definition_without_ranked_lemma_fails_the_build(self, tmp_path):
        stats = write_stats_csv(tmp_path / "s.csv", [("the", 1)])
        defs = write_definitions_xlsx(tmp_path / "d.xlsx", [("the", "def"), ("ghost", "x")])
        with pytest.raises(BuildError, match="ghost"):
            build_from(stats, defs)

    def test_duplicate_lemma_in_stats_fails_the_build(self, tmp_path):
        stats = write_stats_csv(tmp_path / "s.csv", [("the", 1), ("the", 2)])
        defs = write_definitions_xlsx(tmp_path / "d.xlsx", [("the", "def")])
        with pytest.raises(BuildError, match="duplicate"):
            build_from(stats, defs)

    def test_ranks_must_be_unique_and_contiguous_from_one(self, tmp_path):
        stats = write_stats_csv(tmp_path / "s.csv", [("the", 1), ("be", 3)])
        defs = write_definitions_xlsx(tmp_path / "d.xlsx", [("the", "d1"), ("be", "d2")])
        with pytest.raises(BuildError, match="contiguous"):
            build_from(stats, defs)

    def test_empty_definition_fails_the_build(self, tmp_path):
        stats = write_stats_csv(tmp_path / "s.csv", [("the", 1)])
        defs = write_definitions_xlsx(tmp_path / "d.xlsx", [("the", "   ")])
        with pytest.raises(BuildError, match="definition"):
            build_from(stats, defs)


class TestMetadata:
    def test_collection_metadata_is_present(self, five_word_sources):
        doc = build_from(*five_word_sources)
        assert doc["schema_version"] == 1
        assert doc["id"] == "ngsl"
        assert doc["name"]
        assert doc["source"]["name"] == "New General Service List"
        assert doc["source"]["version"] == "1.2"
        assert all(u.startswith("https://") for u in doc["source"]["urls"])
        assert doc["license"]["spdx"] == "CC-BY-SA-4.0"
        assert doc["license"]["url"].startswith("https://creativecommons.org/licenses/by-sa/4.0")
        assert "Browne" in doc["attribution"] and "Culligan" in doc["attribution"]
        assert doc["built_at"] == "2026-09-11"
        assert doc["sort_key"] == "rank"
        assert doc["level_size"] == 400
        assert doc["gloss_language"] == "zh-Hant-TW"

    def test_word_entry_has_exactly_the_contract_fields(self, five_word_sources):
        doc = build_from(*five_word_sources, ipa={"abandon": "/əˈbændən/"})
        word = next(w for w in doc["words"] if w["lemma"] == "abandon")
        assert set(word) == {"id", "lemma", "pos", "rank", "ipa", "definition", "gloss"}
        assert word["pos"] is None
        assert word["ipa"] == "/əˈbændən/"
        assert word["gloss"] == ""

    def test_missing_ipa_is_null_not_omitted(self, five_word_sources):
        doc = build_from(*five_word_sources, ipa={"abandon": "/əˈbændən/"})
        word = next(w for w in doc["words"] if w["lemma"] == "the")
        assert "ipa" in word and word["ipa"] is None

    def test_glosses_are_attached_when_provided(self, five_word_sources):
        doc = build_from(*five_word_sources, glosses={"abandon": "遺棄；拋棄"})
        word = next(w for w in doc["words"] if w["lemma"] == "abandon")
        assert word["gloss"] == "遺棄；拋棄"

    def test_pos_is_attached_when_provided(self, five_word_sources):
        doc = build_from(*five_word_sources, pos={"abandon": "verb"})
        by_lemma = {w["lemma"]: w for w in doc["words"]}
        assert by_lemma["abandon"]["pos"] == "verb"
        assert by_lemma["the"]["pos"] is None

    def test_pos_outside_vocabulary_fails_the_build(self, five_word_sources):
        with pytest.raises(BuildError, match="article"):
            build_from(*five_word_sources, pos={"abandon": "article"})

    def test_pos_for_unknown_lemma_fails_the_build(self, five_word_sources):
        with pytest.raises(BuildError, match="ghost"):
            build_from(*five_word_sources, pos={"ghost": "noun"})

    def test_gloss_for_unknown_lemma_fails_the_build(self, five_word_sources):
        with pytest.raises(BuildError, match="ghost"):
            build_from(*five_word_sources, glosses={"ghost": "鬼"})

    def test_ipa_for_unknown_lemma_fails_the_build(self, five_word_sources):
        with pytest.raises(BuildError, match="ghost"):
            build_from(*five_word_sources, ipa={"ghost": "/x/"})


class TestDeterminism:
    def test_identical_inputs_produce_byte_identical_output(self, five_word_sources):
        a = json.dumps(build_from(*five_word_sources), ensure_ascii=False, sort_keys=True)
        b = json.dumps(build_from(*five_word_sources), ensure_ascii=False, sort_keys=True)
        assert a == b

    def test_same_content_ignores_only_the_build_date(self, five_word_sources):
        today = build_from(*five_word_sources)
        later = build_from(*five_word_sources, built_at="2030-01-01")
        assert same_content(today, later)
        changed = build_from(*five_word_sources, glosses={"abandon": "遺棄"})
        assert not same_content(today, changed)

    def test_input_order_does_not_matter(self, tmp_path):
        stats_a = write_stats_csv(tmp_path / "a.csv", [("the", 1), ("be", 2)])
        stats_b = write_stats_csv(tmp_path / "b.csv", [("be", 2), ("the", 1)])
        defs = write_definitions_xlsx(tmp_path / "d.xlsx", [("be", "d2"), ("the", "d1")])
        assert build_from(stats_a, defs) == build_from(stats_b, defs)


class TestWiktionaryExtraction:
    """Extraction from kaikki.org per-word JSONL (Wiktionary, CC BY-SA 4.0)."""

    def entries(self, name: str) -> list[dict]:
        text = (FIXTURES / name).read_text(encoding="utf-8")
        return [json.loads(line) for line in text.splitlines() if line.strip()]

    def test_prefers_us_tagged_broad_transcription(self):
        assert extract_ipa(self.entries("kaikki_abandon.jsonl")) == "/əˈbæn.dən/"

    def test_skips_letter_and_symbol_senses(self):
        # 'a' as a letter is /æ/ or /eɪ/; the article/determiner reading is what learners want
        assert extract_ipa(self.entries("kaikki_a.jsonl")) == "/ə/"

    def test_falls_back_to_any_broad_transcription_when_no_us_tag(self):
        assert extract_ipa(self.entries("kaikki_untagged.jsonl")) == "/tɹuː/"

    def test_falls_back_to_us_tagged_narrow_transcription_when_no_broad_exists(self):
        assert extract_ipa(self.entries("kaikki_narrow_only.jsonl")) == "[ˈsi.zn̩]"

    def test_returns_none_when_no_ipa_present(self):
        assert extract_ipa(self.entries("kaikki_noipa.jsonl")) is None

    def test_pos_candidates_are_deduplicated_and_exclude_letter_senses(self):
        assert extract_pos_candidates(self.entries("kaikki_a.jsonl")) == ["article", "prep", "verb", "pron", "adv", "adj"]
