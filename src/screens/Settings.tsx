import type { BuildInfo, Collection, SpeechLocale } from "../ports";
import { routes } from "../route";
import type { AppSettings } from "../settings";
import { SPEECH_LOCALES } from "../speech";

const REPOSITORY_URL = "https://github.com/abaw/hordbook";

interface SettingsProps {
  collection: Collection;
  build: BuildInfo;
  settings: AppSettings;
  onVoiceLocaleChange(locale: SpeechLocale): void;
}

/** Settings screen: Voice, About. Export/Import/Reset arrive with their ticket. */
export function Settings({ collection, build, settings, onVoiceLocaleChange }: SettingsProps) {
  const sourceSite = collection.source.urls[0];
  const appVersion = `${build.version} (${build.commit ? build.commit.slice(0, 7) : "dev"})`;
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

      <section class="card" aria-labelledby="voice-title">
        <h2 id="voice-title">Voice</h2>
        <fieldset class="choices" role="radiogroup" aria-labelledby="voice-accent-legend">
          <legend id="voice-accent-legend">Voice accent</legend>
          {SPEECH_LOCALES.map(({ locale, label }) => (
            <label key={locale} class="choice">
              <input
                type="radio"
                name="voice-accent"
                value={locale}
                checked={settings.voiceLocale === locale}
                onChange={() => onVoiceLocaleChange(locale)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p class="muted">Speak uses the best English voice installed on this phone for the chosen accent.</p>
      </section>

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
