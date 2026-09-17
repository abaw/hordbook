import { useEffect, useMemo, useState } from "preact/hooks";

import hintFigure from "../assets/hint-add-to-home-screen.png";
import {
  isPartOfSpeech,
  type Collection,
  type PartOfSpeech,
  type Platform,
  type ProgressState,
  type ProgressStore,
  type Word,
} from "../ports";
import { isProgressState, PROGRESS_STATE_LABELS, PROGRESS_STATES, type ProgressRecords, stateOf } from "../progress";
import { routes } from "../route";
import { filterLevels, levelsOf, PART_OF_SPEECH_LABELS, partsOfSpeechIn } from "../wordList";
import { countProgress, ProgressBar } from "./ProgressBar";
import { StateButton } from "./StateButton";

const HINT_DISMISSED_KEY = "hint.addToHomeScreen.dismissed";

interface HomeProps {
  collection: Collection;
  progressStore: ProgressStore;
  platform: Platform;
  records: ProgressRecords;
  onCycleState(wordId: string): void;
  /** The word the learner last viewed; the list opens scrolled to its row. */
  initialWordId: string | null;
  /** Kept mounted but hidden while a word card is open. */
  hidden?: boolean;
}

export function Home({
  collection,
  progressStore,
  platform,
  records,
  onCycleState,
  initialWordId,
  hidden = false,
}: HomeProps) {
  const [hintVisible, setHintVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<PartOfSpeech | null>(null);
  const [state, setState] = useState<ProgressState | null>(null);
  const levels = useMemo(() => levelsOf(collection), [collection]);
  const partsOfSpeech = useMemo(() => partsOfSpeechIn(collection), [collection]);
  const visibleLevels = useMemo(
    () => filterLevels(levels, { search, pos, state }, (wordId) => stateOf(records, wordId)),
    [levels, search, pos, state, records],
  );
  // Progress is counted over each whole level, not over the filtered rows.
  const levelCounts = useMemo(
    () => new Map(levels.map((level) => [level.number, countProgress(level.words, records)])),
    [levels, records],
  );

  useEffect(() => {
    if (platform.isStandalone) return;
    let cancelled = false;
    void progressStore.getSetting(HINT_DISMISSED_KEY).then((dismissed) => {
      if (!cancelled && dismissed === null) setHintVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [platform.isStandalone, progressStore]);

  // Once, on launch: return to where the learner stopped.
  useEffect(() => {
    if (hidden || initialWordId === null) return;
    document.getElementById(rowId(initialWordId))?.scrollIntoView({ block: "center" });
  }, []);

  const dismissHint = () => {
    setHintVisible(false);
    void progressStore.setSetting(HINT_DISMISSED_KEY, new Date().toISOString());
  };

  return (
    <main class="screen" hidden={hidden}>
      <header class="screen__header screen__header--with-actions">
        <div>
          <h1>Hordbook</h1>
          <p class="muted">
            {collection.name} · {collection.words.length.toLocaleString("en")} words
          </p>
        </div>
        <a class="icon-link" href={routes.settings} aria-label="Settings">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </a>
      </header>

      {hintVisible && (
        <aside class="hint" role="note" aria-labelledby="hint-title">
          <h2 id="hint-title" class="hint__title">
            Add to Home Screen
          </h2>
          <img class="hint__figure" src={hintFigure} alt="" width="720" height="300" />
          <p>
            In Safari, tap <strong>Share</strong> and then <strong>Add to Home Screen</strong>. Hordbook then
            opens full-screen and works offline.
          </p>
          <button type="button" class="button" onClick={dismissHint}>
            Got it
          </button>
        </aside>
      )}

      <ProgressBar subject="Collection" counts={countProgress(collection.words, records)} />

      <div class="toolbar" role="search">
        <label class="visually-hidden" for="search">
          Search words
        </label>
        <input
          id="search"
          class="toolbar__search"
          type="search"
          placeholder="Search words"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          value={search}
          onInput={(event) => setSearch(event.currentTarget.value)}
        />
        <label class="visually-hidden" for="pos-filter">
          Part of speech
        </label>
        <select
          id="pos-filter"
          class="toolbar__select"
          value={pos ?? ""}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setPos(isPartOfSpeech(value) ? value : null);
          }}
        >
          <option value="">All parts of speech</option>
          {partsOfSpeech.map((p) => (
            <option key={p} value={p}>
              {PART_OF_SPEECH_LABELS[p].name}
            </option>
          ))}
        </select>
        <label class="visually-hidden" for="state-filter">
          Progress
        </label>
        <select
          id="state-filter"
          class="toolbar__select"
          value={state ?? ""}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setState(isProgressState(value) ? value : null);
          }}
        >
          <option value="">All progress</option>
          {PROGRESS_STATES.map((s) => (
            <option key={s} value={s}>
              {PROGRESS_STATE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {visibleLevels.length === 0 && (
        <p class="empty" role="status">
          No words match{search.trim() ? ` “${search.trim()}”` : ""}
          {pos ? ` (${PART_OF_SPEECH_LABELS[pos].name})` : ""}
          {state ? ` (${PROGRESS_STATE_LABELS[state]})` : ""}.
        </p>
      )}

      {visibleLevels.map((level) => (
        <section key={level.number} class="level" aria-labelledby={`level-${level.number}`}>
          <header class="level__header">
            <div class="level__title">
              <h2 id={`level-${level.number}`}>Level {level.number}</h2>
              <p class="muted">
                Ranks {level.firstRank}–{level.lastRank}
              </p>
            </div>
            <ProgressBar subject={`Level ${level.number}`} counts={levelCounts.get(level.number)!} />
          </header>
          <ol class="rows">
            {level.words.map((word) => (
              <WordRow key={word.id} word={word} state={stateOf(records, word.id)} onCycleState={() => onCycleState(word.id)} />
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}

interface WordRowProps {
  word: Word;
  state: ProgressState;
  onCycleState(): void;
}

function rowId(wordId: string): string {
  return `row-${wordId}`;
}

function WordRow({ word, state, onCycleState }: WordRowProps) {
  return (
    <li class="row" id={rowId(word.id)}>
      <a class="row__link" href={routes.word(word.id)}>
        <span class="row__rank">{word.rank}</span> <span class="row__lemma">{word.lemma}</span>{" "}
        <span class="row__pos muted">{word.pos ? PART_OF_SPEECH_LABELS[word.pos].short : ""}</span>
      </a>
      <StateButton lemma={word.lemma} state={state} onCycle={onCycleState} />
    </li>
  );
}
