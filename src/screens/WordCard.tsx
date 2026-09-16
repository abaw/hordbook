import type { Collection, Platform } from "../ports";
import { REFERENCE_LINKS } from "../referenceLinks";
import { routes } from "../route";
import { levelNumberOf, locateWord, PART_OF_SPEECH_LABELS } from "../wordList";

interface WordCardProps {
  collection: Collection;
  platform: Platform;
  wordId: string;
}

export function WordCard({ collection, platform, wordId }: WordCardProps) {
  const position = locateWord(collection, wordId);
  const word = position?.word;

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
          <h1 id="word-lemma" class="word__lemma">
            {word.lemma}
          </h1>
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
