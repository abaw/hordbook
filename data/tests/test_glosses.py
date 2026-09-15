"""Seam-1 tests: the gloss/PoS step of the pipeline.

Everything here is pure: prompts in, model text out, checks on the parsed
records. The kiro-cli call itself is outside the seam.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.glosses import (
    NGSL_POS,
    GlossRecord,
    ParseError,
    WordInput,
    allowed_pos,
    assemble,
    check_record,
    extract_zh_translations,
    make_batches,
    parse_response,
    render_prompt,
)

FIXTURES = Path(__file__).parent / "fixtures"


def word(lemma: str, definition: str = "def", candidates: list[str] | None = None) -> WordInput:
    return WordInput(lemma=lemma, definition=definition, pos_candidates=candidates or [])


class TestBatches:
    def test_batches_preserve_order_and_size(self):
        words = [word(f"w{i}") for i in range(7)]
        batches = make_batches(words, size=3)
        assert [[w.lemma for w in b] for b in batches] == [["w0", "w1", "w2"], ["w3", "w4", "w5"], ["w6"]]


class TestPrompt:
    def test_prompt_carries_lemma_definition_and_allowed_pos(self):
        prompt = render_prompt([word("record", "a written account", ["noun", "verb"])])
        assert "record" in prompt
        assert "a written account" in prompt
        assert "noun" in prompt and "verb" in prompt
        assert "Traditional Chinese" in prompt and "Taiwan" in prompt
        assert "JSON" in prompt

    def test_prompt_offers_full_pos_vocabulary_when_wiktionary_has_no_candidates(self):
        prompt = render_prompt([word("zzz", "something", [])])
        for pos in NGSL_POS:
            assert pos in prompt


class TestParse:
    def test_parses_plain_json_array(self):
        text = json.dumps([{"lemma": "abandon", "pos": "verb", "gloss": "遺棄；拋棄"}])
        records = parse_response(text, expected=["abandon"])
        assert records["abandon"] == GlossRecord(lemma="abandon", pos="verb", gloss="遺棄；拋棄")

    def test_tolerates_markdown_fences_and_surrounding_prose(self):
        text = 'Here you go:\n```json\n[{"lemma": "a", "pos": "det", "gloss": "一"}]\n```\n'
        assert parse_response(text, expected=["a"])["a"].gloss == "一"

    def test_strips_whitespace_from_fields(self):
        text = json.dumps([{"lemma": " a ", "pos": " det", "gloss": " 一 "}])
        assert parse_response(text, expected=["a"])["a"] == GlossRecord("a", "det", "一")

    def test_missing_lemma_is_a_parse_error(self):
        text = json.dumps([{"lemma": "a", "pos": "det", "gloss": "一"}])
        with pytest.raises(ParseError, match="missing.*abandon"):
            parse_response(text, expected=["a", "abandon"])

    def test_unexpected_lemma_is_a_parse_error(self):
        text = json.dumps([{"lemma": "ghost", "pos": "noun", "gloss": "鬼"}])
        with pytest.raises(ParseError, match="unexpected.*ghost"):
            parse_response(text, expected=["a"])

    def test_invalid_json_is_a_parse_error(self):
        with pytest.raises(ParseError, match="JSON"):
            parse_response("not json at all", expected=["a"])

    def test_non_string_field_is_a_parse_error(self):
        text = json.dumps([{"lemma": "a", "pos": None, "gloss": "一"}])
        with pytest.raises(ParseError, match="pos"):
            parse_response(text, expected=["a"])


class TestChecks:
    def ok(self, **kw) -> GlossRecord:
        base = {"lemma": "abandon", "pos": "verb", "gloss": "遺棄；拋棄"}
        return GlossRecord(**{**base, **kw})

    def test_clean_record_has_no_problems(self):
        assert check_record(self.ok(), candidates=["verb", "noun"], translations=["放棄", "遺棄"]) == []

    def test_empty_gloss_is_rejected(self):
        assert "empty-gloss" in check_record(self.ok(gloss="   "), candidates=[], translations=[])

    def test_simplified_only_characters_are_rejected(self):
        assert "simplified-characters" in check_record(self.ok(gloss="离弃；抛弃"), candidates=[], translations=[])

    def test_shared_characters_are_not_flagged_as_simplified(self):
        # 能力 and 一 are identical in both scripts
        assert "simplified-characters" not in check_record(self.ok(gloss="能力"), candidates=[], translations=[])

    @pytest.mark.parametrize("gloss", ["允許；准許", "公開宣布", "一束；一群", "床；床鋪", "臨床的", "裡；裏"])
    def test_legitimate_taiwan_characters_are_not_flagged(self, gloss):
        assert "simplified-characters" not in check_record(self.ok(gloss=gloss), candidates=[], translations=[])

    @pytest.mark.parametrize("gloss", ["地区", "软件", "抛弃"])
    def test_each_simplified_only_character_is_caught(self, gloss):
        assert "simplified-characters" in check_record(self.ok(gloss=gloss), candidates=[], translations=[])

    def test_gloss_without_cjk_is_rejected(self):
        assert "no-cjk" in check_record(self.ok(gloss="abandon"), candidates=[], translations=[])

    def test_overlong_gloss_is_flagged(self):
        assert "gloss-too-long" in check_record(self.ok(gloss="這" * 40), candidates=[], translations=[])

    def test_pos_outside_ngsl_vocabulary_is_rejected(self):
        assert "pos-not-allowed" in check_record(self.ok(pos="article"), candidates=[], translations=[])

    def test_pos_outside_wiktionary_candidates_is_flagged(self):
        problems = check_record(self.ok(pos="noun"), candidates=["verb"], translations=[])
        assert "pos-not-in-wiktionary" in problems

    def test_pos_check_is_skipped_when_wiktionary_has_no_candidates(self):
        assert "pos-not-in-wiktionary" not in check_record(self.ok(pos="noun"), candidates=[], translations=[])

    def test_no_character_overlap_with_wiktionary_is_flagged(self):
        problems = check_record(self.ok(gloss="能力"), candidates=[], translations=["放棄", "遺棄"])
        assert "no-wiktionary-overlap" in problems

    def test_overlap_check_is_skipped_for_function_words(self):
        # grammatical words get descriptive glosses that never share characters with particles
        record = GlossRecord("the", "det", "指已提及的人或事物")
        assert "no-wiktionary-overlap" not in check_record(record, candidates=["det"], translations=["這", "那"])

    def test_overlap_check_is_skipped_without_translations(self):
        assert "no-wiktionary-overlap" not in check_record(self.ok(), candidates=[], translations=[])


class TestAllowedPos:
    def test_wiktionary_names_map_onto_ngsl_vocabulary(self):
        assert allowed_pos(["article", "noun", "particle"]) == ["det", "noun"]

    def test_verb_candidates_also_allow_aux(self):
        assert allowed_pos(["verb"]) == ["verb", "aux"]

    def test_no_candidates_means_full_vocabulary(self):
        assert allowed_pos([]) == list(NGSL_POS)


class TestWiktionaryTranslations:
    def test_extracts_both_scripts_from_mandarin_translations(self):
        entries = [
            json.loads(line)
            for line in (FIXTURES / "kaikki_abandon_translations.jsonl").read_text("utf-8").splitlines()
            if line.strip()
        ]
        assert extract_zh_translations(entries) == ["放棄", "放弃", "遺棄", "遗弃", "丟棄"]


class TestAssemble:
    def test_clean_records_become_glosses_and_flagged_records_join_the_queue(self):
        records = {
            "abandon": GlossRecord("abandon", "verb", "遺棄；拋棄"),
            "zone": GlossRecord("zone", "noun", "地区"),
        }
        glosses, queue = assemble(
            records,
            candidates={"abandon": ["verb"], "zone": ["noun"]},
            translations={"abandon": ["遺棄"], "zone": ["區域"]},
            overrides={},
        )
        assert glosses == {"abandon": {"pos": "verb", "gloss": "遺棄；拋棄"}}
        assert queue == [
            {"lemma": "zone", "pos": "noun", "gloss": "地区", "problems": ["simplified-characters", "no-wiktionary-overlap"]}
        ]

    def test_override_resolves_a_flagged_record_and_is_recorded(self):
        records = {"zone": GlossRecord("zone", "noun", "地区")}
        glosses, queue = assemble(
            records,
            candidates={"zone": ["noun"]},
            translations={"zone": ["地區"]},
            overrides={"zone": {"pos": "noun", "gloss": "地區", "note": "fixed script"}},
        )
        assert glosses == {"zone": {"pos": "noun", "gloss": "地區"}}
        assert queue == []

    def test_override_can_waive_a_reviewed_problem_without_changing_the_gloss(self):
        records = {"doctor": GlossRecord("doctor", "noun", "醫師；醫生")}
        glosses, queue = assemble(
            records,
            candidates={"doctor": ["noun"]},
            translations={"doctor": ["博士"]},
            overrides={"doctor": {"waive": ["no-wiktionary-overlap"], "note": "NGSL sense is medical"}},
        )
        assert glosses == {"doctor": {"pos": "noun", "gloss": "醫師；醫生"}}
        assert queue == []

    def test_waiver_does_not_cover_other_problems(self):
        records = {"zone": GlossRecord("zone", "noun", "地区")}
        _, queue = assemble(
            records,
            candidates={"zone": ["noun"]},
            translations={"zone": ["區域"]},
            overrides={"zone": {"waive": ["no-wiktionary-overlap"]}},
        )
        assert queue[0]["problems"] == ["simplified-characters"]

    def test_override_that_still_fails_checks_stays_in_queue(self):
        records = {"zone": GlossRecord("zone", "noun", "地区")}
        _, queue = assemble(
            records,
            candidates={"zone": ["noun"]},
            translations={"zone": ["地區"]},
            overrides={"zone": {"pos": "noun", "gloss": "地区"}},
        )
        assert queue and queue[0]["lemma"] == "zone"
