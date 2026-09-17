# Hordbook — domain context

Hordbook is a personal word hoard: an installable single-page web app (PWA) that presents vocabulary collections in a study order and records which words the learner knows.

## Glossary

- **Collection** — a named, versioned, licensed set of words with a defined study order. The unit of extension: new vocabulary pools are added as collections. The first collection is **NGSL** (New General Service List 1.2, 2,809 ranked words). Avoid: "list", "pool", "deck".
- **Word** (or **entry**) — one item in a collection: a lemma with one part of speech, an optional pronunciation, an English definition and a gloss. Identified by a **word ID** that is stable across releases of the collection.
- **Lemma** — the headword form of a word (e.g. `abandon`), as published by the collection's source.
- **Rank** — the word's position in the collection's study order. For NGSL it is the corpus frequency rank (1 = most frequent). The default sort key of the word list. Avoid: "index", "position".
- **Level** — a display grouping of consecutive ranks (for NGSL: seven levels of about 400 words, matching the source's convention).
- **Definition** — the easy-English definition supplied by the collection's source.
- **Gloss** — the short Traditional Chinese rendering of the definition's sense. Generated, not sourced; owned by the project. Avoid: "translation".
- **Progress state** — the learner's per-word status: `unseen` (default), `learning`, `known`. Stored on the device, keyed by word ID, independent of the collection file.
- **Progress record** — the per-word data behind a progress state, shaped to admit spaced repetition later: state, first seen, last reviewed, interval.
- **Export** / **Import** — the versioned JSON document that carries all progress records (and, in future, user-authored words) out of and back into the device via the iOS share sheet / Files picker. The only sync mechanism.
- **Reference link** — an outbound link on a word card to an external resource (Youglish, Longman). Data-driven list.
- **Prompt action** — a button on a word card that composes a prompt for ChatGPT and opens it via deep link (`chatgpt.com/?q=…` or a custom GPT URL). Three in v1: *Example sentences*, *Teach me inside out*, *Compare with similar words*. Output is always English.
- **Custom GPT** — the learner's own ChatGPT GPT holding the tutor instructions; its URL is set in Settings. When absent, prompt actions fall back to full-text prompts against plain ChatGPT.
- **Speak** — the on-device text-to-speech action (Web Speech API) that pronounces the lemma inside a part-of-speech **carrier phrase** ("to record" for verbs, "the record" for nouns, the bare lemma otherwise) so heteronyms are stressed for the sense shown.
- **Voice accent** — the learner's Settings choice between US English (`en-US`) and UK English (`en-GB`) for Speak. The app picks the highest-quality installed voice for that locale; iOS ships a *compact* voice and lets the learner download *enhanced* or *premium* ones.
- **Pipeline** — the offline Python process that builds a collection file from licensed sources, generates glosses, and runs licence and script checks. Runs on the maintainer's machine, never on the device.

## Invariants

- Zero recurring or one-off cost beyond the learner's existing ChatGPT Plus subscription.
- All shipped collection data is redistributable under CC BY-SA 4.0 with attribution.
- No server, no account, no telemetry. Progress never leaves the device except by explicit Export.
