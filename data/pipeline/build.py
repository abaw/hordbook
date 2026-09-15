"""The build-collection boundary (seam 1).

``build_collection`` turns the parsed official sources plus optional
enrichments (IPA, glosses) into the NGSL collection document. It is pure: no
I/O, deterministic for identical inputs, and it fails loudly on any
inconsistency rather than emitting a partial collection.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Mapping

from .glosses import NGSL_POS
from .sources import RankedLemma

Collection = dict[str, Any]

SCHEMA_VERSION = 1

COLLECTION_ID = "ngsl"
COLLECTION_NAME = "New General Service List 1.2"
LEVEL_SIZE = 400
GLOSS_LANGUAGE = "zh-Hant-TW"

SOURCE = {
    "name": "New General Service List",
    "version": "1.2",
    "urls": [
        "https://www.newgeneralservicelist.com/new-general-service-list",
        "https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv",
        "https://www.newgeneralservicelist.com/s/NGSL_12_with_English_definitions.xlsx",
    ],
}

LICENSE = {
    "spdx": "CC-BY-SA-4.0",
    "name": "Creative Commons Attribution-ShareAlike 4.0 International",
    "url": "https://creativecommons.org/licenses/by-sa/4.0/",
}

ATTRIBUTION = (
    "Words, frequency ranks and English definitions: New General Service List 1.2 "
    "by Charles Browne, Brent Culligan and Joseph Phillips (newgeneralservicelist.com), "
    "licensed under CC BY-SA 4.0. "
    "Pronunciations: Wiktionary contributors via kaikki.org, CC BY-SA 4.0. "
    "Traditional Chinese glosses: generated for the Hordbook project and released under "
    "CC BY-SA 4.0. This collection file is a derivative work under the same licence."
)

# The only field allowed to differ between two builds of identical inputs.
BUILD_DATE_FIELD = "built_at"


class BuildError(ValueError):
    """The sources are inconsistent; no collection is produced."""


def build_collection(
    *,
    stats: list[RankedLemma],
    definitions: Mapping[str, str],
    ipa: Mapping[str, str],
    glosses: Mapping[str, str],
    pos: Mapping[str, str],
    built_at: str,
) -> Collection:
    lemmas = [entry.lemma for entry in stats]
    _reject_duplicates(lemmas)
    _reject_non_contiguous_ranks([entry.rank for entry in stats])
    ranked = set(lemmas)
    _reject_unranked(ranked, set(definitions), what="definitions")
    _reject_missing(ranked, set(definitions), what="definitions")
    _reject_unranked(ranked, set(ipa), what="ipa")
    _reject_unranked(ranked, set(glosses), what="glosses")
    _reject_unranked(ranked, set(pos), what="pos")
    _reject_unknown_pos(pos)

    words: list[dict[str, Any]] = []
    for entry in sorted(stats, key=lambda e: e.rank):
        definition = definitions[entry.lemma]
        if not definition:
            raise BuildError(f"empty definition for '{entry.lemma}'")
        words.append(
            {
                "id": f"{COLLECTION_ID}:{entry.lemma}",
                "lemma": entry.lemma,
                "pos": pos.get(entry.lemma),
                "rank": entry.rank,
                "ipa": ipa.get(entry.lemma),
                "definition": definition,
                "gloss": glosses.get(entry.lemma, ""),
            }
        )

    return {
        "schema_version": SCHEMA_VERSION,
        "id": COLLECTION_ID,
        "name": COLLECTION_NAME,
        "source": SOURCE,
        "license": LICENSE,
        "attribution": ATTRIBUTION,
        BUILD_DATE_FIELD: built_at,
        "sort_key": "rank",
        "level_size": LEVEL_SIZE,
        "gloss_language": GLOSS_LANGUAGE,
        "word_count": len(words),
        "words": words,
    }


def same_content(a: Collection, b: Collection) -> bool:
    """True when two collections differ at most in their build date.

    Used by the runner to leave the committed file untouched when a rebuild
    from identical inputs would only bump ``built_at``.
    """
    return _without_build_date(a) == _without_build_date(b)


def _without_build_date(collection: Collection) -> Collection:
    return {key: value for key, value in collection.items() if key != BUILD_DATE_FIELD}


def _reject_duplicates(lemmas: list[str]) -> None:
    duplicates = sorted(lemma for lemma, count in Counter(lemmas).items() if count > 1)
    if duplicates:
        raise BuildError(f"duplicate lemma(s) in stats: {', '.join(duplicates)}")


def _reject_non_contiguous_ranks(ranks: list[int]) -> None:
    if sorted(ranks) != list(range(1, len(ranks) + 1)):
        raise BuildError("ranks must be unique and contiguous from 1")


def _reject_unknown_pos(pos: Mapping[str, str]) -> None:
    bad = sorted(f"{lemma}={value}" for lemma, value in pos.items() if value not in NGSL_POS)
    if bad:
        raise BuildError(f"pos outside the NGSL vocabulary: {', '.join(bad)}")


def _reject_missing(ranked: set[str], other: set[str], *, what: str) -> None:
    missing = sorted(ranked - other)
    if missing:
        raise BuildError(f"ranked lemmas without {what}: {', '.join(missing)}")


def _reject_unranked(ranked: set[str], other: set[str], *, what: str) -> None:
    extra = sorted(other - ranked)
    if extra:
        raise BuildError(f"{what} for unranked lemmas: {', '.join(extra)}")
