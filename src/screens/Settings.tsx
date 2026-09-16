import type { Collection } from "../ports";
import { routes } from "../route";

const REPOSITORY_URL = "https://github.com/abaw/hordbook";

interface SettingsProps {
  collection: Collection;
  appVersion: string;
}

/**
 * Settings screen. In this ticket it holds only About; voice, custom GPT URL
 * and Export/Import/Reset arrive with their own tickets.
 */
export function Settings({ collection, appVersion }: SettingsProps) {
  const sourceSite = collection.source.urls[0];
  const sourceLabel = `${collection.source.name} ${collection.source.version}`;
  return (
    <main class="screen">
      <header class="screen__header">
        <nav aria-label="Breadcrumb">
          <a class="back-link" href={routes.home}>
            <span aria-hidden="true">‹ </span>Home
          </a>
        </nav>
        <h1>Settings</h1>
      </header>

      <section class="card" aria-labelledby="about-title">
        <h2 id="about-title">About</h2>

        <h3 class="card__subtitle">{collection.name}</h3>
        <p>
          Source:{" "}
          {sourceSite ? (
            <a href={sourceSite} target="_blank" rel="noopener">
              {sourceLabel}
            </a>
          ) : (
            sourceLabel
          )}
        </p>
        <p>
          Licence:{" "}
          <a href={collection.license.url} target="_blank" rel="noopener">
            {collection.license.name}
          </a>
        </p>
        <p>{collection.attribution}</p>
        <p class="muted">
          {collection.words.length.toLocaleString("en")} words, collection built {collection.builtAt}.
        </p>

        <h3 class="card__subtitle">Hordbook</h3>
        <p>Version {appVersion}</p>
        <p>
          Code licensed under MIT.{" "}
          <a href={REPOSITORY_URL} target="_blank" rel="noopener">
            Source code on GitHub
          </a>
        </p>
      </section>
    </main>
  );
}
