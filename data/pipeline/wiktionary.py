"""Extraction from Wiktionary data via kaikki.org per-word JSONL extracts.

Wiktionary content is CC BY-SA 4.0, compatible with the collection licence.
Only pronunciation (IPA) and part-of-speech candidates are taken.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError
from urllib.request import Request, urlopen

Entry = dict[str, Any]

# Senses that describe the written character or a proper name rather than the
# everyday word; their pronunciations and PoS are not what a learner wants.
NON_LEXICAL_POS = frozenset({"character", "symbol", "name", "punct", "letter"})

US_TAGS = frozenset({"US", "General-American", "GenAm", "GA"})
MANDARIN_CODES = frozenset({"cmn", "zh"})


def kaikki_url(lemma: str) -> str:
    return f"https://kaikki.org/dictionary/English/meaning/{lemma[0]}/{lemma[:2]}/{lemma}.jsonl"


def fetch_entries(lemma: str, cache_dir: Path, *, network: bool = True) -> list[Entry]:
    """Return kaikki entries for ``lemma``, caching the raw JSONL on disk.

    A missing word is cached as an empty file so it is not re-requested.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = cache_dir / f"{lemma}.jsonl"
    if not cached.exists():
        if not network:
            return []
        cached.write_text(_download(kaikki_url(lemma)), encoding="utf-8")
    return parse_entries(cached.read_text(encoding="utf-8"))


def _download(url: str) -> str:
    request = Request(url, headers={"User-Agent": "hordbook-pipeline (personal vocabulary app)"})
    try:
        with urlopen(request, timeout=30) as response:
            body: bytes = response.read()
            return body.decode("utf-8")
    except HTTPError as error:
        if error.code == 404:
            return ""
        raise


def parse_entries(text: str) -> list[Entry]:
    entries: list[Entry] = [json.loads(line) for line in text.splitlines() if line.strip()]
    return entries


def _lexical(entries: Iterable[Entry]) -> list[Entry]:
    return [e for e in entries if e.get("pos") not in NON_LEXICAL_POS]


def _transcriptions(entry: Entry, *, opening: str) -> list[tuple[str, frozenset[str]]]:
    """IPA strings in ``entry`` that start with ``opening`` ('/' broad, '[' narrow)."""
    out: list[tuple[str, frozenset[str]]] = []
    for sound in entry.get("sounds", []) or []:
        ipa = sound.get("ipa")
        if ipa and ipa.startswith(opening):
            out.append((ipa, frozenset(sound.get("tags", []) or [])))
    return out


def extract_ipa(entries: list[Entry]) -> str | None:
    """Pick one IPA transcription for the everyday reading of a word.

    Preference ladder, over lexical senses only:
    1. a US-tagged broad transcription ``/…/``
    2. any broad transcription
    3. a US-tagged narrow transcription ``[…]``
    4. any narrow transcription
    """
    lexical = _lexical(entries)
    for opening in ("/", "["):
        for entry in lexical:
            for ipa, tags in _transcriptions(entry, opening=opening):
                if tags & US_TAGS:
                    return ipa
        for entry in lexical:
            found = _transcriptions(entry, opening=opening)
            if found:
                return found[0][0]
    return None


def extract_pos_candidates(entries: list[Entry]) -> list[str]:
    """Distinct parts of speech Wiktionary lists for the word, in source order."""
    seen: list[str] = []
    for entry in _lexical(entries):
        pos = entry.get("pos")
        if pos and pos not in seen:
            seen.append(pos)
    return seen


def extract_zh_translations(entries: list[Entry]) -> list[str]:
    """Mandarin translation forms from kaikki entries, both scripts, deduplicated.

    kaikki writes paired forms as ``"放棄 /放弃"``; some entries list the
    scripts as separate translations instead. Both shapes are handled.
    """
    forms: list[str] = []
    for entry in _lexical(entries):
        for translation in entry.get("translations", []) or []:
            if translation.get("code") not in MANDARIN_CODES:
                continue
            for form in str(translation.get("word", "")).split("/"):
                form = form.strip()
                if form and form not in forms:
                    forms.append(form)
    return forms
