import type { SpeechLocale, Voice, VoiceQuality, Word } from "./ports";

export const SPEECH_LOCALES: Array<{ locale: SpeechLocale; label: string }> = [
  { locale: "en-US", label: "US English" },
  { locale: "en-GB", label: "UK English" },
];

export const DEFAULT_SPEECH_LOCALE: SpeechLocale = "en-US";

export function isSpeechLocale(value: unknown): value is SpeechLocale {
  return SPEECH_LOCALES.some((entry) => entry.locale === value);
}

/**
 * What to hand the synthesiser so heteronyms are stressed for the sense
 * shown: "to record" (verb) vs "the record" (noun). Other parts of speech
 * get the bare lemma.
 */
export function carrierPhrase(word: Pick<Word, "lemma" | "pos">): string {
  switch (word.pos) {
    case "verb":
      return `to ${word.lemma}`;
    case "noun":
      return `the ${word.lemma}`;
    default:
      return word.lemma;
  }
}

const QUALITY_RANK: Record<VoiceQuality, number> = { premium: 3, enhanced: 2, compact: 1, other: 0 };

/** Voices whose language matches the locale (case-insensitive, `en_US` tolerated). */
export function voicesFor(voices: Voice[], locale: SpeechLocale): Voice[] {
  const wanted = locale.toLowerCase();
  return voices.filter((v) => v.lang.replace("_", "-").toLowerCase() === wanted);
}

/** The most natural installed voice for the locale, or null if none. */
export function bestVoice(voices: Voice[], locale: SpeechLocale): Voice | null {
  return voicesFor(voices, locale).reduce<Voice | null>(
    (best, v) => (best === null || QUALITY_RANK[v.quality] > QUALITY_RANK[best.quality] ? v : best),
    null,
  );
}

/**
 * True when the device has voices for the locale but none better than
 * compact: the learner would benefit from downloading an enhanced voice.
 * With no voices at all we cannot tell, so no hint.
 */
export function onlyCompactVoices(voices: Voice[], locale: SpeechLocale): boolean {
  const best = bestVoice(voices, locale);
  return best !== null && QUALITY_RANK[best.quality] <= QUALITY_RANK.compact;
}

/**
 * Classifies a device voice from its identifier and name. iOS reports URIs
 * such as `com.apple.voice.enhanced.en-US.Samantha`; other platforms only
 * hint in the name ("Samantha (Enhanced)").
 */
export function classifyVoice(name: string, voiceURI: string): VoiceQuality {
  const haystack = `${voiceURI} ${name}`.toLowerCase();
  if (haystack.includes("premium")) return "premium";
  if (haystack.includes("enhanced")) return "enhanced";
  if (haystack.includes("compact")) return "compact";
  return "other";
}
