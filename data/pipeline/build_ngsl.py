"""Command-line entry point: build the NGSL collection file.

    python -m pipeline.build_ngsl [--no-network] [--workers N]

Steps:
1. Ensure the two official NGSL 1.2 downloads are present under ``sources/``.
2. Fetch (or reuse cached) Wiktionary extracts per lemma from kaikki.org.
3. Attach glosses from ``glosses/ngsl.json`` when that file exists (ticket #4).
4. Build the collection and write ``../collections/ngsl.json`` plus derived
   artefacts used by later pipeline steps.
"""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

from .build import BuildError, build_collection, same_content
from .sources import read_definitions_xlsx, read_stats_csv
from .wiktionary import extract_ipa, extract_pos_candidates, fetch_entries

DATA_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = DATA_DIR.parent
SOURCES_DIR = DATA_DIR / "sources"
CACHE_DIR = DATA_DIR / "cache" / "kaikki"
DERIVED_DIR = DATA_DIR / "derived"
GLOSSES_FILE = DATA_DIR / "glosses" / "ngsl.json"
OUTPUT_FILE = REPO_DIR / "collections" / "ngsl.json"

OFFICIAL_DOWNLOADS = {
    "NGSL_12_stats.csv": "https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv",
    "NGSL_12_with_English_definitions.xlsx": (
        "https://www.newgeneralservicelist.com/s/NGSL_12_with_English_definitions.xlsx"
    ),
}


def ensure_sources(network: bool) -> None:
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in OFFICIAL_DOWNLOADS.items():
        target = SOURCES_DIR / name
        if target.exists():
            continue
        if not network:
            raise SystemExit(f"missing source {target} and --no-network given")
        print(f"downloading {url}")
        request = Request(url, headers={"User-Agent": "hordbook-pipeline"})
        with urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())


def load_glosses() -> dict[str, str]:
    if not GLOSSES_FILE.exists():
        return {}
    data = json.loads(GLOSSES_FILE.read_text(encoding="utf-8"))
    return {str(k): str(v) for k, v in data.items()}


def enrich_from_wiktionary(
    lemmas: list[str], *, network: bool, workers: int
) -> tuple[dict[str, str], dict[str, list[str]]]:
    def one(lemma: str) -> tuple[str, str | None, list[str]]:
        entries = fetch_entries(lemma, CACHE_DIR, network=network)
        return lemma, extract_ipa(entries), extract_pos_candidates(entries)

    ipa: dict[str, str] = {}
    pos_candidates: dict[str, list[str]] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for index, (lemma, transcription, candidates) in enumerate(pool.map(one, lemmas), 1):
            if transcription:
                ipa[lemma] = transcription
            pos_candidates[lemma] = candidates
            if index % 250 == 0:
                print(f"  wiktionary {index}/{len(lemmas)}")
    return ipa, pos_candidates


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the NGSL collection file.")
    parser.add_argument("--no-network", action="store_true", help="fail instead of downloading")
    parser.add_argument("--workers", type=int, default=4, help="parallel Wiktionary fetches")
    args = parser.parse_args(argv)
    network = not args.no_network

    ensure_sources(network)
    stats = read_stats_csv(SOURCES_DIR / "NGSL_12_stats.csv")
    definitions = read_definitions_xlsx(SOURCES_DIR / "NGSL_12_with_English_definitions.xlsx")
    lemmas = [entry.lemma for entry in stats]

    print(f"fetching Wiktionary extracts for {len(lemmas)} lemmas (cache: {CACHE_DIR})")
    ipa, pos_candidates = enrich_from_wiktionary(lemmas, network=network, workers=args.workers)

    try:
        collection = build_collection(
            stats=stats,
            definitions=definitions,
            ipa=ipa,
            glosses=load_glosses(),
            built_at=date.today().isoformat(),
        )
    except BuildError as error:
        print(f"build failed: {error}", file=sys.stderr)
        return 1

    if OUTPUT_FILE.exists() and same_content(json.loads(OUTPUT_FILE.read_text("utf-8")), collection):
        outcome = "unchanged (existing build date kept)"
    else:
        write_json(OUTPUT_FILE, collection)
        outcome = "written"
    write_json(DERIVED_DIR / "wiktionary_pos_candidates.json", pos_candidates)

    glossed = sum(1 for w in collection["words"] if w["gloss"])
    print(
        f"{OUTPUT_FILE.relative_to(REPO_DIR)} {outcome}: {collection['word_count']} words, "
        f"IPA coverage {len(ipa)}/{len(lemmas)}, glosses {glossed}/{len(lemmas)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
