import type { Word } from "./ports";
import { PART_OF_SPEECH_LABELS } from "./wordList";

/** Browsers and the ChatGPT app accept URLs comfortably below this. */
export const MAX_PROMPT_URL_LENGTH = 2000;

/**
 * The only ChatGPT URL that prefills the message box from a link. Custom GPT
 * links (`/g/...`) ignore `q`, so the structure a tutor GPT would supply is
 * written into each prompt instead (see docs/adr/0001-prompt-actions-use-plain-chatgpt.md).
 */
export const PLAIN_CHATGPT_URL = "https://chatgpt.com/?q=";

/** A button on the word card that opens ChatGPT with a ready-made prompt. */
export interface PromptAction {
  id: "examples" | "teach" | "compare";
  label: string;
  /** The task-specific part of the prompt; the shared intro and rules are added around it. */
  task(word: WordFacts): string;
}

/** What every prompt carries so ChatGPT explains the intended sense. */
export interface WordFacts {
  lemma: string;
  pos: string;
  definition: string;
}

const RULES =
  "Explain this sense only. Reply in English only, in clear B1-B2 English, with short headings and bullet points; put the target word in bold wherever it appears in an example.";

export const PROMPT_ACTIONS: PromptAction[] = [
  {
    id: "examples",
    label: "Example sentences",
    task: (w) =>
      `Give 8 example sentences using "${w.lemma}" in this sense, ordered from everyday speech to formal writing. Vary tense and subject; include one question and one negative sentence. Then add a two-line note on the word's most common grammar pattern.`,
  },
  {
    id: "teach",
    label: "Teach me inside out",
    task: (w) =>
      `Teach me "${w.lemma}" inside out: 1) core meaning and the nuance of this sense; 2) 6-10 frequent collocations grouped by pattern; 3) register and connotation; 4) 2-3 common learner mistakes, each with a wrong and a corrected sentence; 5) one vivid memory hook; 6) three example sentences.`,
  },
  {
    id: "compare",
    label: "Compare with similar words",
    task: (w) =>
      `Compare "${w.lemma}" with the 3-5 near-synonyms or confusable words learners most often mix up with it. For each: how it differs in meaning, register or typical use, then a contrasting pair of sentences, one with each word. Finish with a one-line rule of thumb for choosing between them.`,
  },
];

export function wordFacts(word: Word): WordFacts {
  return {
    lemma: word.lemma,
    pos: word.pos ? PART_OF_SPEECH_LABELS[word.pos].name.toLocaleLowerCase("en") : "word",
    definition: word.definition,
  };
}

export function renderPrompt(action: PromptAction, facts: WordFacts): string {
  return `I am learning the English word "${facts.lemma}" (${facts.pos}), meaning: ${facts.definition}. ${RULES} ${action.task(facts)}`;
}

export interface ComposedPrompt {
  /** The text handed to the clipboard; identical to what the URL carries. */
  text: string;
  url: string;
}

/**
 * Composes the prompt and its deep link. If the URL would exceed the bound,
 * the definition is shortened until it fits (no NGSL definition needs it).
 */
export function composePrompt(action: PromptAction, word: Word): ComposedPrompt {
  const facts = wordFacts(word);
  let definition = facts.definition;
  for (;;) {
    const text = renderPrompt(action, { ...facts, definition });
    const url = PLAIN_CHATGPT_URL + encodeURIComponent(text);
    if (url.length <= MAX_PROMPT_URL_LENGTH || definition.length === 0) return { text, url };
    // Trim by a chunk; the loop re-measures because encoding inflates unevenly.
    const cut = Math.max(0, definition.length - Math.max(20, Math.ceil((url.length - MAX_PROMPT_URL_LENGTH) / 3)));
    definition = cut > 0 ? definition.slice(0, cut).trimEnd() + "…" : "";
  }
}
