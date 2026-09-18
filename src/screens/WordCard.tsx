import { useState } from "preact/hooks";

import type { Collection, Platform } from "../ports";
import { type ProgressRecords, stateOf } from "../progress";
import { composePrompt, PROMPT_ACTIONS, type PromptAction } from "../promptActions";
import { REFERENCE_LINKS } from "../referenceLinks";
import { routes } from "../route";
import type { AppSettings } from "../settings";
import { carrierPhrase, onlyCompactVoices } from "../speech";
import { levelNumberOf, locateWord, PART_OF_SPEECH_LABELS } from "../wordList";
import { StateButton } from "./StateButton";

interface WordCardProps {
  collection: Collection;
  platform: Platform;
  wordId: string;
  records: ProgressRecords;
  onCycleState(wordId: string): void;
  settings: AppSettings;
  onDismissEnhancedVoiceHint(): void;
}

export function WordCard({
  collection,
  platform,
  wordId,
  records,
  onCycleState,
  settings,
  onDismissEnhancedVoiceHint,
}: WordCardProps) {
  const position = locateWord(collection, wordId);
  const word = position?.word;
  const [voiceHintVisible, setVoiceHintVisible] = useState(false);

  const speak = () => {
    if (word === undefined) return;
    platform.speak(carrierPhrase(word), settings.voiceLocale);
    if (!settings.enhancedVoiceHintDismissed) {
      void platform.voices().then((voices) => {
        if (onlyCompactVoices(voices, settings.voiceLocale)) setVoiceHintVisible(true);
      });
    }
  };

  const runPromptAction = (action: PromptAction) => {
    if (word === undefined) return;
    const { text, url } = composePrompt(action, word);
    // Clipboard first: the fallback if ChatGPT stops honouring the prefill.
    platform.writeClipboard(text);
    platform.openUrl(url);
  };

  const dismissVoiceHint = () => {
    setVoiceHintVisible(false);
    onDismissEnhancedVoiceHint();
  };

  return (
    <main class="screen">
      <header class="screen__header">
        <nav aria-label="Breadcrumb">
          <a class="back-link" href={routes.home}>
            <span aria-hidden="true">‹ </span>Words
          </a>
        </nav>
      </header>

      {word === undefined ? (
        <p class="empty" role="status">
          This word is not in the collection.
        </p>
      ) : (
        <article class="card word" aria-labelledby="word-lemma">
          <p class="muted">
            Rank {word.rank} · Level {levelNumberOf(collection, word.rank)}
          </p>
          <div class="word__headline">
            <h1 id="word-lemma" class="word__lemma">
              {word.lemma}
            </h1>
            <button type="button" class="speak" onClick={speak} aria-label="Speak">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 9v6h4l5 4V5L8 9H4z" />
                <path d="M16 9a4 4 0 0 1 0 6" />
                <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
              </svg>
            </button>
          </div>
          <p class="word__meta">
            {word.ipa && <span class="word__ipa">{word.ipa}</span>}
            {word.pos && <span class="word__pos">{PART_OF_SPEECH_LABELS[word.pos].name}</span>}
          </p>
          <p class="word__definition">{word.definition}</p>
          {word.gloss && (
            <p class="word__gloss" lang={collection.glossLanguage}>
              {word.gloss}
            </p>
          )}

          <div class="word__state">
            <StateButton lemma={word.lemma} state={stateOf(records, word.id)} onCycle={() => onCycleState(word.id)} size="card" />
          </div>

          <div class="prompt-actions" role="group" aria-label="Ask ChatGPT">
            {PROMPT_ACTIONS.map((action) => (
              <button key={action.id} type="button" class="prompt-action" onClick={() => runPromptAction(action)}>
                {action.label}
              </button>
            ))}
          </div>

          <ul class="reference-links" aria-label="Look up elsewhere">
            {REFERENCE_LINKS.map((link) => {
              const url = link.url(word);
              return (
                <li key={link.label}>
                  <a
                    class="chip"
                    href={url}
                    onClick={(event) => {
                      event.preventDefault();
                      platform.openUrl(url);
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </article>
      )}

      {voiceHintVisible && !settings.enhancedVoiceHintDismissed && (
        <aside class="hint" role="note" aria-labelledby="voice-hint-title">
          <h2 id="voice-hint-title" class="hint__title">
            Get an enhanced voice
          </h2>
          <p>
            Only the compact English voice is installed, so Speak sounds robotic. On your iPhone, open{" "}
            <strong>Settings › Accessibility › Read &amp; Speak › Voices › English</strong> (on iOS 18 and earlier the
            menu is called <strong>Spoken Content</strong>) and download an Enhanced or Premium voice for your
            accent. Hordbook will use it automatically.
          </p>
          <button type="button" class="button" onClick={dismissVoiceHint}>
            Got it
          </button>
        </aside>
      )}

      {position && (
        <nav class="pager" aria-label="Previous and next word">
          {position.previous ? (
            <a class="pager__link" href={routes.word(position.previous.id)}>
              <span class="pager__label">Previous:</span> {position.previous.lemma}
            </a>
          ) : (
            <span class="pager__link pager__link--disabled" aria-hidden="true" />
          )}
          {position.next ? (
            <a class="pager__link pager__link--next" href={routes.word(position.next.id)}>
              <span class="pager__label">Next:</span> {position.next.lemma}
            </a>
          ) : (
            <span class="pager__link pager__link--disabled" aria-hidden="true" />
          )}
        </nav>
      )}
    </main>
  );
}
