"""Command-line entry point: generate Traditional Chinese glosses and parts of speech.

    python -m pipeline.gloss_ngsl            # run missing batches with the cheap model
    python -m pipeline.gloss_ngsl --review   # re-run queued lemmas with the stronger model
    python -m pipeline.gloss_ngsl --assemble-only

Inputs: ``../collections/ngsl.json`` (lemmas, definitions), Wiktionary PoS
candidates and cached kaikki extracts (translations for the overlap check).

Artefacts under ``glosses/``:
- ``raw/batch-NNN.txt``  raw model replies, committed; a batch is skipped when
  its reply exists and parses, which makes the run resumable.
- ``raw/review-NNN.txt`` raw replies from the review model; these take
  precedence over the initial replies for the lemmas they cover.
- ``overrides.json``     human resolutions ``{lemma: {pos, gloss, note}}``,
  applied last and subject to the same checks.
- ``ngsl.json``          accepted ``{lemma: {pos, gloss}}`` consumed by build_ngsl.
- ``review-queue.json``  records that failed a check, with problem codes.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from .build_ngsl import CACHE_DIR, DATA_DIR, DERIVED_DIR, OUTPUT_FILE, write_json
from .glosses import (
    GlossRecord,
    ParseError,
    WordInput,
    assemble,
    extract_json_array,
    make_batches,
    parse_response,
    record_from_item,
    render_prompt,
)
from .wiktionary import extract_zh_translations, fetch_entries

GLOSSES_DIR = DATA_DIR / "glosses"
RAW_DIR = GLOSSES_DIR / "raw"
OVERRIDES_FILE = GLOSSES_DIR / "overrides.json"
ACCEPTED_FILE = GLOSSES_DIR / "ngsl.json"
QUEUE_FILE = GLOSSES_DIR / "review-queue.json"

BATCH_SIZE = 100
GENERATE_AGENT = "glosser"
REVIEW_AGENT = "glosser-review"
CALL_TIMEOUT_SECONDS = 600


def load_words() -> list[WordInput]:
    collection = json.loads(OUTPUT_FILE.read_text("utf-8"))
    candidates = json.loads((DERIVED_DIR / "wiktionary_pos_candidates.json").read_text("utf-8"))
    return [
        WordInput(lemma=w["lemma"], definition=w["definition"], pos_candidates=list(candidates.get(w["lemma"], [])))
        for w in collection["words"]
    ]


def load_translations(lemmas: list[str]) -> dict[str, list[str]]:
    return {lemma: extract_zh_translations(fetch_entries(lemma, CACHE_DIR, network=False)) for lemma in lemmas}


def load_overrides() -> dict[str, dict[str, Any]]:
    if not OVERRIDES_FILE.exists():
        return {}
    data: dict[str, dict[str, Any]] = json.loads(OVERRIDES_FILE.read_text("utf-8"))
    return data


def ask_model(prompt: str, *, agent: str) -> str:
    """Run one non-interactive kiro-cli chat with a tool-less agent and return its reply."""
    result = subprocess.run(
        ["kiro-cli", "chat", "--no-interactive", "--trust-tools=", "--wrap", "never", "--agent", agent, prompt],
        cwd=DATA_DIR,
        capture_output=True,
        text=True,
        timeout=CALL_TIMEOUT_SECONDS,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"kiro-cli exited {result.returncode}: {result.stderr.strip()[:500]}")
    return result.stdout


def run_batch(
    batch: list[WordInput], raw_file: Path, *, agent: str, call_model: bool = True
) -> dict[str, GlossRecord]:
    """Return parsed records for ``batch``, calling the model unless a usable reply is cached.

    With ``call_model=False`` a missing or unusable reply yields no records.
    """
    expected = [w.lemma for w in batch]
    if raw_file.exists():
        try:
            return parse_response(raw_file.read_text("utf-8"), expected=expected)
        except ParseError as error:
            print(f"  {raw_file.name}: cached reply unusable ({error})")
            if call_model:
                raw_file.rename(raw_file.with_suffix(".unusable.txt"))
    if not call_model:
        return {}
    reply = ask_model(render_prompt(batch), agent=agent)
    records = parse_response(reply, expected=expected)  # raise before caching a bad reply
    raw_file.parent.mkdir(parents=True, exist_ok=True)
    raw_file.write_text(reply, encoding="utf-8")
    return records


def run_batches(
    batches: list[list[WordInput]], *, prefix: str, agent: str, workers: int, call_model: bool = True
) -> dict[str, GlossRecord]:
    def one(item: tuple[int, list[WordInput]]) -> dict[str, GlossRecord]:
        index, batch = item
        raw_file = RAW_DIR / f"{prefix}-{index:03d}.txt"
        records = run_batch(batch, raw_file, agent=agent, call_model=call_model)
        print(f"  {raw_file.name}: {len(records)} records")
        return records

    merged: dict[str, GlossRecord] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for records in pool.map(one, enumerate(batches, 1)):
            merged.update(records)
    return merged


def load_cached_review_records(words_by_lemma: dict[str, WordInput]) -> dict[str, GlossRecord]:
    """Records from earlier review runs; lemma sets are taken from the replies themselves."""
    merged: dict[str, GlossRecord] = {}
    for raw_file in sorted(RAW_DIR.glob("review-*.txt")):
        if raw_file.name.endswith(".unusable.txt"):
            continue
        try:
            payload = extract_json_array(raw_file.read_text("utf-8"))
        except ParseError:
            continue
        for item in payload:
            try:
                record = record_from_item(item)
            except ParseError:
                continue
            if record.lemma in words_by_lemma:
                merged[record.lemma] = record
    return merged


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate glosses and parts of speech for the NGSL collection.")
    parser.add_argument("--review", action="store_true", help="re-run queued lemmas with the review model")
    parser.add_argument("--assemble-only", action="store_true", help="do not call the model; re-run checks only")
    parser.add_argument("--workers", type=int, default=3, help="parallel model calls")
    args = parser.parse_args(argv)

    words = load_words()
    words_by_lemma = {w.lemma: w for w in words}
    candidates = {w.lemma: w.pos_candidates for w in words}
    translations = load_translations([w.lemma for w in words])
    overrides = load_overrides()

    batches = make_batches(words, size=BATCH_SIZE)
    print(f"{len(words)} words in {len(batches)} batches")
    try:
        records = run_batches(
            batches,
            prefix="batch",
            agent=GENERATE_AGENT,
            workers=args.workers,
            call_model=not args.assemble_only,
        )
    except (ParseError, RuntimeError) as error:
        print(f"generation failed: {error}", file=sys.stderr)
        return 1

    records.update(load_cached_review_records(words_by_lemma))
    glosses, queue = assemble(records, candidates=candidates, translations=translations, overrides=overrides)

    if args.review and queue:
        review_words = [words_by_lemma[item["lemma"]] for item in queue if item["lemma"] not in overrides]
        review_batches = make_batches(review_words, size=BATCH_SIZE)
        existing = len(list(RAW_DIR.glob("review-*.txt")))
        print(f"reviewing {len(review_words)} queued lemmas in {len(review_batches)} batches with {REVIEW_AGENT}")
        try:
            for offset, batch in enumerate(review_batches, existing + 1):
                raw_file = RAW_DIR / f"review-{offset:03d}.txt"
                reviewed = run_batch(batch, raw_file, agent=REVIEW_AGENT)
                records.update(reviewed)
                print(f"  {raw_file.name}: {len(reviewed)} records")
        except (ParseError, RuntimeError) as error:
            print(f"review failed: {error}", file=sys.stderr)
            return 1
        glosses, queue = assemble(records, candidates=candidates, translations=translations, overrides=overrides)

    write_json(ACCEPTED_FILE, dict(sorted(glosses.items())))
    write_json(QUEUE_FILE, sorted(queue, key=lambda item: str(item["lemma"])))
    print(f"accepted {len(glosses)}/{len(words)}; review queue {len(queue)} -> {QUEUE_FILE.relative_to(DATA_DIR)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
