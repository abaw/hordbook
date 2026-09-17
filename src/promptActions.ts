import type { Word } from "./ports";
import { PART_OF_SPEECH_LABELS } from "./wordList";

/** Browsers and the ChatGPT app accept URLs comfortably below this. */
export const MAX_PROMPT_URL_LENGTH = 2000;

export const PLAIN_CHATGPT_URL = "https://chatgpt.com/?q=";

/**
 * A custom GPT link looks like https://chatgpt.com/g/g-<id>-<slug>; nothing
 * else is accepted. Returns the link in canonical form, or null.
 */
export function parseCustomGptUrl(value: string): string | null {
  const match = /^(https:\/\/chatgpt\.com\/g\/g-[A-Za-z0-9_-]+)\/?$/.exec(value.trim());
  return match?.[1] ?? null;
}

/**
 * A button on the word card that opens ChatGPT with a ready-made prompt.
 * `full` is self-contained for plain ChatGPT; `compact` relies on the tutor
 * GPT's instructions (docs/custom-gpt.md) to expand it.
 */
export interface PromptAction {
  id: "examples" | "teach" | "compare";
  label: string;
  full(word: WordFacts): string;
  compact(word: WordFacts): string;
}

/** What every prompt carries so ChatGPT explains the intended sense. */
export interface WordFacts {
  lemma: string;
  pos: string;
  definition: string;
}

const ENGLISH_ONLY = "Reply in English only.";

function intro(w: WordFacts): string {
  return `I am learning the English word "${w.lemma}" (${w.pos}), meaning: ${w.definition}.`;
}

export const PROMPT_ACTIONS: PromptAction[] = [
  {
    id: "examples",
    label: "Example sentences",
    full: (w) =>
      `${intro(w)} Give me 8 varied example sentences using it in exactly this sense, from everyday speech to formal writing, and put the word in bold in each. ${ENGLISH_ONLY}`,
    compact: (w) => `examples: ${w.lemma} (${w.pos}) — ${w.definition}`,
  },
  {
    id: "teach",
    label: "Teach me inside out",
    full: (w) =>
      `${intro(w)} Teach me this word inside out: its core meaning and nuances in this sense, common collocations, register, mistakes learners make, a memory hook, and three example sentences. ${ENGLISH_ONLY}`,
    compact: (w) => `teach: ${w.lemma} (${w.pos}) — ${w.definition}`,
  },
  {
    id: "compare",
    label: "Compare with similar words",
    full: (w) =>
      `${intro(w)} Compare it with its near-synonyms and commonly confused words: explain the differences in meaning, register and typical use, with contrasting example sentences. ${ENGLISH_ONLY}`,
    compact: (w) => `compare: ${w.lemma} (${w.pos}) — ${w.definition}`,
  },
];

export function wordFacts(word: Word): WordFacts {
  return {
    lemma: word.lemma,
    pos: word.pos ? PART_OF_SPEECH_LABELS[word.pos].name.toLocaleLowerCase("en") : "word",
    definition: word.definition,
  };
}

export interface ComposedPrompt {
  /** The text handed to the clipboard; identical to what the URL carries. */
  text: string;
  url: string;
}

/**
 * Composes the prompt and its deep link. With a custom GPT URL the compact
 * form is used; otherwise the full prompt goes to plain ChatGPT. If the URL
 * would exceed the bound, the definition is shortened until it fits.
 */
export function composePrompt(action: PromptAction, word: Word, customGptUrl: string | null): ComposedPrompt {
  const facts = wordFacts(word);
  const base = customGptUrl ? `${customGptUrl}?q=` : PLAIN_CHATGPT_URL;
  const render = (f: WordFacts) => (customGptUrl ? action.compact(f) : action.full(f));

  let definition = facts.definition;
  for (;;) {
    const text = render({ ...facts, definition });
    const url = base + encodeURIComponent(text);
    if (url.length <= MAX_PROMPT_URL_LENGTH || definition.length === 0) return { text, url };
    // Trim by a chunk; the loop re-measures because encoding inflates unevenly.
    const cut = Math.max(0, definition.length - Math.max(20, Math.ceil((url.length - MAX_PROMPT_URL_LENGTH) / 3)));
    definition = definition.slice(0, cut).trimEnd() + (cut > 0 ? "…" : "");
    if (cut === 0) definition = "";
  }
}
