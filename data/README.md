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

## Generate glosses and parts of speech

```sh
.venv/bin/python -m pipeline.gloss_ngsl               # run missing batches (claude-haiku-4.5)
.venv/bin/python -m pipeline.gloss_ngsl --review      # re-run queued lemmas (claude-sonnet-4.6)
.venv/bin/python -m pipeline.gloss_ngsl --assemble-only   # re-run checks without calling a model
.venv/bin/python -m pipeline.build_ngsl --no-network  # fold accepted glosses/pos into the collection
```

The model is called through `kiro-cli chat --no-interactive` with the tool-less
agents in `.kiro/agents/` (`glosser`, `glosser-review`). Batches of 100 words
in rank order; raw replies are committed under `glosses/raw/` and a batch is
skipped when its reply exists and parses, so the run is resumable.

Automatic checks on every record (`pipeline/glosses.py`): non-empty gloss,
contains CJK, no Simplified-only characters (characters absent from Big5-HKSCS;
OpenCC's `s2t` round trip was tried first and rejected because it "corrects"
legitimate Taiwan forms such as 准, 布, 群, 床), at most 24 characters, part of
speech within the NGSL vocabulary and within Wiktionary's candidates for the
lemma, and — for content words — at least one character shared with a
Wiktionary Mandarin translation.

Records failing a check go to `glosses/review-queue.json`. Resolution order:
the review model's reply (`glosses/raw/review-*.txt`) takes precedence over the
first reply; then `glosses/overrides.json` applies human resolutions, either a
replacement `{pos, gloss}` or a `waive` list of problem codes judged to be false
positives, each with a `note`. The queue must be empty before the collection is
considered complete.

Run of 2026-09-15: 2,809 records; 2,505 accepted first pass; 304 re-run with
the review model; 80 residual overlap flags reviewed and waived (all cases where
Wiktionary's translations cover a different sense than the NGSL definition).

## Checks and tests

```sh
.venv/bin/pytest          # seam-1 tests on the build boundary
.venv/bin/mypy            # strict typing on the pipeline package
```

## Facts about the sources that shaped the pipeline

- The official definitions workbook has two columns only (word, definition);
  it carries **no part of speech**. `pos` is therefore `null` after the build
  step and is filled by the gloss step, which asks the model to choose among
  Wiktionary's candidates for the sense in the definition. Word IDs are
  `ngsl:<lemma>` (lemmas are unique in the NGSL), so IDs do not depend on PoS.
- The stats CSV contains `TRUE`/`FALSE` (Excel boolean artefacts) and `email`;
  the definitions workbook contains `true`/`false` and `e-mail`. Lemmas are
  lowercased (except `I`) and `e-mail` is aliased to `email`, matching the
  official lemmatized teaching list. Any other mismatch fails the build.
- Ranks are unique and contiguous 1–2,809; the build enforces this.
- Wiktionary IPA: a US-tagged broad transcription is preferred, then any broad,
  then US-tagged narrow, then any narrow; letter/symbol/proper-name senses are
  skipped. Four lemmas have audio only and no IPA.
