import { useState } from "preact/hooks";

import type { Collection, SpeechLocale } from "../ports";
import { parseCustomGptUrl } from "../promptActions";
import { routes } from "../route";
import type { AppSettings } from "../settings";
import { SPEECH_LOCALES } from "../speech";

const REPOSITORY_URL = "https://github.com/abaw/hordbook";

interface SettingsProps {
  collection: Collection;
  appVersion: string;
  settings: AppSettings;
  onVoiceLocaleChange(locale: SpeechLocale): void;
  onCustomGptUrlChange(url: string | null): void;
}

/** Settings screen: Voice, ChatGPT, About. Export/Import/Reset arrive with their ticket. */
export function Settings({ collection, appVersion, settings, onVoiceLocaleChange, onCustomGptUrlChange }: SettingsProps) {
  const sourceSite = collection.source.urls[0];
  const sourceLabel = `${collection.source.name} ${collection.source.version}`;
  const [gptDraft, setGptDraft] = useState(settings.customGptUrl ?? "");
  const gptDraftInvalid = gptDraft.trim() !== "" && parseCustomGptUrl(gptDraft) === null;

  const onGptInput = (value: string) => {
    setGptDraft(value);
    if (value.trim() === "") onCustomGptUrlChange(null);
    else {
      const url = parseCustomGptUrl(value);
      if (url !== null) onCustomGptUrlChange(url);
    }
  };
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

      <section class="card" aria-labelledby="chatgpt-title">
        <h2 id="chatgpt-title">ChatGPT</h2>
        <label class="field" for="custom-gpt-url">
          Custom GPT URL
        </label>
        <input
          id="custom-gpt-url"
          class="field__input"
          type="url"
          inputMode="url"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          placeholder="https://chatgpt.com/g/g-…"
          value={gptDraft}
          aria-invalid={gptDraftInvalid}
          aria-describedby="custom-gpt-help"
          onInput={(event) => onGptInput(event.currentTarget.value)}
        />
        {gptDraftInvalid && (
          <p class="field__error" role="alert">
            Enter a GPT link like https://chatgpt.com/g/g-… — or leave empty to use plain ChatGPT.
          </p>
        )}
        <p id="custom-gpt-help" class="muted">
          Paste the link of your tutor GPT and the card's prompt actions will open it with short prompts. Leave
          empty to send full prompts to plain ChatGPT. See the repository's <code>docs/custom-gpt.md</code> for the
          recommended GPT instructions.
        </p>
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
