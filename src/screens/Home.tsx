import { useEffect, useState } from "preact/hooks";

import hintFigure from "../assets/hint-add-to-home-screen.png";
import type { Collection, Platform, ProgressStore } from "../ports";
import { routes } from "../route";

const HINT_DISMISSED_KEY = "hint.addToHomeScreen.dismissed";

interface HomeProps {
  collection: Collection;
  progressStore: ProgressStore;
  platform: Platform;
}

export function Home({ collection, progressStore, platform }: HomeProps) {
  const [hintVisible, setHintVisible] = useState(false);

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
    <main class="screen">
      <header class="screen__header screen__header--with-actions">
        <div>
          <h1>Hordbook</h1>
          <p class="muted">A personal word hoard</p>
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

      <section class="card" aria-labelledby="collection-title">
        <h2 id="collection-title">{collection.name}</h2>
        <p>{collection.words.length.toLocaleString("en")} words, sorted by {collection.sortKey}</p>
        <p class="muted">Browsing the words by rank comes next.</p>
      </section>
    </main>
  );
}
