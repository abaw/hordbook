import { useEffect, useMemo, useState } from "preact/hooks";

import hintFigure from "../assets/hint-add-to-home-screen.png";
import { isPartOfSpeech, type Collection, type PartOfSpeech, type Platform, type ProgressStore, type Word } from "../ports";
import { routes } from "../route";
import { filterLevels, levelsOf, PART_OF_SPEECH_LABELS, partsOfSpeechIn } from "../wordList";

const HINT_DISMISSED_KEY = "hint.addToHomeScreen.dismissed";

interface HomeProps {
  collection: Collection;
  progressStore: ProgressStore;
  platform: Platform;
  /** Kept mounted but hidden while a word card is open. */
  hidden?: boolean;
}

export function Home({ collection, progressStore, platform, hidden = false }: HomeProps) {
  const [hintVisible, setHintVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<PartOfSpeech | null>(null);
  const levels = useMemo(() => levelsOf(collection), [collection]);
  const partsOfSpeech = useMemo(() => partsOfSpeechIn(collection), [collection]);
  const visibleLevels = useMemo(() => filterLevels(levels, { search, pos }), [levels, search, pos]);

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
      </div>

      {visibleLevels.length === 0 && (
        <p class="empty" role="status">
          No words match{search.trim() ? ` “${search.trim()}”` : ""}
          {pos ? ` (${PART_OF_SPEECH_LABELS[pos].name})` : ""}.
        </p>
      )}

      {visibleLevels.map((level) => (
        <section key={level.number} class="level" aria-labelledby={`level-${level.number}`}>
          <header class="level__header">
            <h2 id={`level-${level.number}`}>Level {level.number}</h2>
            <p class="muted">
              Ranks {level.firstRank}–{level.lastRank}
            </p>
          </header>
          <ol class="rows">
            {level.words.map((word) => (
              <WordRow key={word.id} word={word} />
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}

function WordRow({ word }: { word: Word }) {
  return (
    <li class="row">
      <a class="row__link" href={routes.word(word.id)}>
        <span class="row__rank">{word.rank}</span> <span class="row__lemma">{word.lemma}</span>{" "}
        <span class="row__pos muted">{word.pos ? PART_OF_SPEECH_LABELS[word.pos].short : ""}</span>
      </a>
    </li>
  );
}
