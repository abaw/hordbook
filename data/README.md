# Hordbook data pipeline

Builds collection files from licensed sources. Runs on the maintainer's machine
only; nothing here ships to the device except the produced `collections/*.json`.

## Setup

```sh
cd data
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Build the NGSL collection

```sh
.venv/bin/python -m pipeline.build_ngsl            # downloads sources/Wiktionary as needed
.venv/bin/python -m pipeline.build_ngsl --no-network   # rebuild from cached inputs only
```

Outputs:

- `../collections/ngsl.json` — the collection consumed by the app.
- `derived/wiktionary_pos_candidates.json` — per-lemma part-of-speech
  candidates from Wiktionary, input to the gloss/PoS step.

Inputs (fetched on first run):

- `sources/NGSL_12_stats.csv`, `sources/NGSL_12_with_English_definitions.xlsx`
  — the official NGSL 1.2 downloads (CC BY-SA 4.0).
- `cache/kaikki/<lemma>.jsonl` — per-word Wiktionary extracts from kaikki.org
  (CC BY-SA 4.0); gitignored, ~15 minutes to populate.
- `glosses/ngsl.json` — `{lemma: gloss}` produced by the gloss step; optional.

## Checks and tests

```sh
.venv/bin/pytest          # seam-1 tests on the build boundary
.venv/bin/mypy            # strict typing on the pipeline package
```

## Facts about the sources that shaped the pipeline

- The official definitions workbook has two columns only (word, definition);
  it carries **no part of speech**. `pos` is therefore `null` after this step
  and is filled by the gloss step using Wiktionary candidates. Word IDs are
  `ngsl:<lemma>` (lemmas are unique in the NGSL), so IDs do not depend on PoS.
- The stats CSV contains `TRUE`/`FALSE` (Excel boolean artefacts) and `email`;
  the definitions workbook contains `true`/`false` and `e-mail`. Lemmas are
  lowercased (except `I`) and `e-mail` is aliased to `email`, matching the
  official lemmatized teaching list. Any other mismatch fails the build.
- Ranks are unique and contiguous 1–2,809; the build enforces this.
- Wiktionary IPA: a US-tagged broad transcription is preferred, then any broad,
  then US-tagged narrow, then any narrow; letter/symbol/proper-name senses are
  skipped. Four lemmas have audio only and no IPA.
