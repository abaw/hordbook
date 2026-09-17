import { useCallback, useEffect, useState } from "preact/hooks";

import type { ProgressStore, SpeechLocale } from "./ports";
import { DEFAULT_SPEECH_LOCALE, isSpeechLocale } from "./speech";

const KEYS = {
  voiceLocale: "voiceLocale",
  enhancedVoiceHintDismissed: "hint.enhancedVoice.dismissed",
  customGptUrl: "customGptUrl",
} as const;

export interface AppSettings {
  voiceLocale: SpeechLocale;
  enhancedVoiceHintDismissed: boolean;
  /** The learner's tutor GPT link; null means prompt actions target plain ChatGPT. */
  customGptUrl: string | null;
}

export interface SettingsHandle {
  /** Null until the store has been read. */
  settings: AppSettings | null;
  setVoiceLocale(locale: SpeechLocale): void;
  dismissEnhancedVoiceHint(): void;
  setCustomGptUrl(url: string | null): void;
}

/** Small learner preferences, read once at launch and written through on change. */
export function useSettings(store: ProgressStore): SettingsHandle {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSettings(null);
    void Promise.all([
      store.getSetting(KEYS.voiceLocale),
      store.getSetting(KEYS.enhancedVoiceHintDismissed),
      store.getSetting(KEYS.customGptUrl),
    ]).then(([locale, hintDismissed, gptUrl]) => {
      if (cancelled) return;
      setSettings({
        voiceLocale: isSpeechLocale(locale) ? locale : DEFAULT_SPEECH_LOCALE,
        enhancedVoiceHintDismissed: hintDismissed !== null,
        customGptUrl: gptUrl === "" ? null : gptUrl,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const setVoiceLocale = useCallback(
    (locale: SpeechLocale) => {
      setSettings((s) => (s === null ? s : { ...s, voiceLocale: locale }));
      void store.setSetting(KEYS.voiceLocale, locale);
    },
    [store],
  );

  const dismissEnhancedVoiceHint = useCallback(() => {
    setSettings((s) => (s === null ? s : { ...s, enhancedVoiceHintDismissed: true }));
    void store.setSetting(KEYS.enhancedVoiceHintDismissed, new Date().toISOString());
  }, [store]);

  const setCustomGptUrl = useCallback(
    (url: string | null) => {
      setSettings((s) => (s === null ? s : { ...s, customGptUrl: url }));
      void store.setSetting(KEYS.customGptUrl, url ?? "");
    },
    [store],
  );

  return { settings, setVoiceLocale, dismissEnhancedVoiceHint, setCustomGptUrl };
}
