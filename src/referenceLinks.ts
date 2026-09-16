import type { Word } from "./ports";

/** An outbound link on the word card. Adding a resource is one more entry. */
export interface ReferenceLink {
  label: string;
  url: (word: Word) => string;
}

export const REFERENCE_LINKS: ReferenceLink[] = [
  {
    label: "Youglish",
    // `/english` covers all English accents; `/english/us` etc. would narrow it.
    url: (word) => `https://youglish.com/pronounce/${encodeURIComponent(word.lemma)}/english`,
  },
  {
    label: "Longman",
    url: (word) => `https://www.ldoceonline.com/dictionary/${encodeURIComponent(word.lemma)}`,
  },
];
