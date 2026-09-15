"""The gloss/PoS step (seam 1, second boundary).

Pure functions around the LLM call: build prompts for batches of words, parse
the model's JSON, and run the automatic checks that decide whether a record is
accepted or lands in the review queue. Calling the model is done by the runner.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Iterable, Mapping


# Part-of-speech vocabulary used by the NGSL learning materials.
NGSL_POS: tuple[str, ...] = (
    "noun", "verb", "adj", "adv", "prep", "pron", "conj", "det", "aux", "intj", "num",
)

# Wiktionary part-of-speech names that map onto the NGSL vocabulary.
WIKTIONARY_TO_NGSL: dict[str, str] = {
    "noun": "noun",
    "verb": "verb",
    "adj": "adj",
    "adv": "adv",
    "prep": "prep",
    "pron": "pron",
    "conj": "conj",
    "det": "det",
    "article": "det",
    "intj": "intj",
    "num": "num",
}

# Parts of speech whose glosses are expected to overlap with dictionary
# translations. Function words get descriptive glosses instead.
CONTENT_POS = frozenset({"noun", "verb", "adj", "adv", "num", "intj"})
MAX_GLOSS_LENGTH = 24

_CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.S)


@dataclass(frozen=True)
class WordInput:
    lemma: str
    definition: str
    pos_candidates: list[str]


@dataclass(frozen=True)
class GlossRecord:
    lemma: str
    pos: str
    gloss: str


class ParseError(ValueError):
    """The model's reply cannot be used for this batch."""


def make_batches(words: list[WordInput], *, size: int) -> list[list[WordInput]]:
    return [words[i : i + size] for i in range(0, len(words), size)]


def allowed_pos(candidates: Iterable[str]) -> list[str]:
    """NGSL parts of speech compatible with Wiktionary's candidates.

    Wiktionary files auxiliaries under ``verb``, so a verb candidate also
    admits ``aux``. No candidates means the whole vocabulary is allowed.
    """
    mapped: list[str] = []
    for candidate in candidates:
        pos = WIKTIONARY_TO_NGSL.get(candidate)
        if pos and pos not in mapped:
            mapped.append(pos)
    if "verb" in mapped and "aux" not in mapped:
        mapped.append("aux")
    return mapped or list(NGSL_POS)


def render_prompt(batch: list[WordInput]) -> str:
    lines = [
        "For each English word below, give (1) its part of speech for the sense in the",
        "definition and (2) a short gloss in Traditional Chinese as used in Taiwan.",
        "",
        "Rules:",
        "- The gloss renders the sense of the given definition, not other senses.",
        "- Use Traditional Chinese characters only (Taiwan usage and vocabulary; never",
        "  Simplified characters, never mainland-only terms).",
        "- Keep the gloss short: one to three terms separated by '；', at most",
        f"  {MAX_GLOSS_LENGTH} characters, no explanations, no pinyin, no Latin letters.",
        "- Choose pos only from the allowed list given for that word.",
        "- Answer with a JSON array only, one object per word, in the same order,",
        '  each object exactly {"lemma": ..., "pos": ..., "gloss": ...}. No prose,',
        "  no markdown fences.",
        "",
        "Words:",
    ]
    for entry in batch:
        allowed = ", ".join(allowed_pos(entry.pos_candidates))
        lines.append(f"- lemma: {entry.lemma} | allowed pos: {allowed} | definition: {entry.definition}")
    return "\n".join(lines)


def parse_response(text: str, *, expected: list[str]) -> dict[str, GlossRecord]:
    payload = extract_json_array(text)
    records: dict[str, GlossRecord] = {}
    for item in payload:
        record = record_from_item(item)
        records[record.lemma] = record
    missing = sorted(set(expected) - set(records))
    unexpected = sorted(set(records) - set(expected))
    problems = []
    if missing:
        problems.append(f"missing lemma(s): {', '.join(missing)}")
    if unexpected:
        problems.append(f"unexpected lemma(s): {', '.join(unexpected)}")
    if problems:
        raise ParseError("; ".join(problems))
    return records


def extract_json_array(text: str) -> list[Any]:
    """The first JSON array in ``text``, tolerating markdown fences and prose."""
    fenced = _FENCE.search(text)
    candidate = fenced.group(1) if fenced else text
    start, end = candidate.find("["), candidate.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ParseError("no JSON array found in reply")
    try:
        payload = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError as error:
        raise ParseError(f"invalid JSON: {error}") from error
    if not isinstance(payload, list):
        raise ParseError("JSON payload is not an array")
    return payload


def record_from_item(item: Any) -> GlossRecord:
    """The one place a decoded JSON item becomes a :class:`GlossRecord`."""
    if not isinstance(item, dict):
        raise ParseError(f"array item is not an object: {item!r}")
    return GlossRecord(
        lemma=_string_field(item, "lemma"),
        pos=_string_field(item, "pos"),
        gloss=_string_field(item, "gloss"),
    )


def _string_field(item: dict[str, Any], key: str) -> str:
    value = item.get(key)
    if not isinstance(value, str):
        raise ParseError(f"field '{key}' is missing or not a string in {item!r}")
    return value.strip()


def check_record(record: GlossRecord, *, candidates: list[str], translations: list[str]) -> list[str]:
    """Automatic checks; the returned problem codes are stable identifiers."""
    problems: list[str] = []
    gloss = record.gloss.strip()
    if not gloss:
        problems.append("empty-gloss")
    else:
        if not _CJK.search(gloss):
            problems.append("no-cjk")
        if _simplified_only_characters(gloss):
            problems.append("simplified-characters")
        if len(gloss) > MAX_GLOSS_LENGTH:
            problems.append("gloss-too-long")
    if record.pos not in NGSL_POS:
        problems.append("pos-not-allowed")
    elif candidates and record.pos not in allowed_pos(candidates):
        problems.append("pos-not-in-wiktionary")
    if (
        record.pos in CONTENT_POS
        and translations
        and gloss
        and not _shares_cjk_character(gloss, translations)
    ):
        problems.append("no-wiktionary-overlap")
    return problems


def _simplified_only_characters(text: str) -> list[str]:
    """CJK characters with no Big5-HKSCS code point.

    Big5 is the Traditional Chinese character set used in Taiwan; Simplified-only
    characters (区, 软, 弃 …) are absent from it, while legitimate Taiwan forms
    that OpenCC would "correct" (准, 布, 群, 床 …) are present. Some rare
    variants (爲) are also absent, which is acceptable: they are not Taiwan usage.
    """
    return [c for c in _CJK.findall(text) if not c.encode("big5hkscs", "ignore")]


def _shares_cjk_character(gloss: str, translations: list[str]) -> bool:
    gloss_chars = set(_CJK.findall(gloss))
    return any(gloss_chars & set(_CJK.findall(t)) for t in translations)


def assemble(
    records: Mapping[str, GlossRecord],
    *,
    candidates: Mapping[str, list[str]],
    translations: Mapping[str, list[str]],
    overrides: Mapping[str, Mapping[str, Any]],
) -> tuple[dict[str, dict[str, str]], list[dict[str, Any]]]:
    """Split records into accepted glosses and a review queue.

    An override is a human resolution for one lemma. It may replace ``pos`` and
    ``gloss`` (both required together), and/or ``waive`` a list of problem codes
    that were reviewed and judged to be false positives. Overrides are subject
    to the same checks; a record is accepted only when no unwaived problem remains.
    """
    glosses: dict[str, dict[str, str]] = {}
    queue: list[dict[str, Any]] = []
    for lemma in records:
        record = records[lemma]
        override = overrides.get(lemma, {})
        if "gloss" in override or "pos" in override:
            if not ("gloss" in override and "pos" in override):
                raise ValueError(f"override for '{lemma}' must set both pos and gloss")
            record = GlossRecord(lemma=lemma, pos=str(override["pos"]), gloss=str(override["gloss"]))
        waived = set(override.get("waive", []))
        problems = [
            problem
            for problem in check_record(
                record,
                candidates=list(candidates.get(lemma, [])),
                translations=list(translations.get(lemma, [])),
            )
            if problem not in waived
        ]
        if problems:
            queue.append({"lemma": lemma, "pos": record.pos, "gloss": record.gloss, "problems": problems})
        else:
            glosses[lemma] = {"pos": record.pos, "gloss": record.gloss}
    return glosses, queue
