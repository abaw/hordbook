import { useEffect, useState } from "preact/hooks";

import hintFigure from "./assets/hint-add-to-home-screen.png";
import type { Ports } from "./ports";

const HINT_DISMISSED_KEY = "hint.addToHomeScreen.dismissed";

export function App({ collection, progressStore, platform }: Ports) {
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
      <header class="screen__header">
        <h1>Hordbook</h1>
        <p class="muted">A personal word hoard</p>
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
