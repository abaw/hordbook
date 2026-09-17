import type { Platform, Voice } from "./ports";
import { bestVoice, classifyVoice } from "./speech";

/** Detects the iOS home-screen web app and the standard display-mode media query. */
export function browserPlatform(): Platform {
  const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;

  return {
    isStandalone: navigatorStandalone || displayModeStandalone,
    openUrl(url) {
      window.open(url, "_blank", "noopener");
    },
    speak(text, locale) {
      if (synth === null) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      const voice = bestVoice(deviceVoices(synth), locale);
      if (voice !== null) {
        utterance.voice = synth.getVoices().find((v) => v.name === voice.name && v.lang === voice.lang) ?? null;
      }
      utterance.rate = 0.9;
      synth.cancel();
      synth.speak(utterance);
    },
    writeClipboard(text) {
      // Best effort: the deep link carries the same text, so a refusal is not fatal.
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    },
    voices() {
      if (synth === null) return Promise.resolve([]);
      const now = deviceVoices(synth);
      if (now.length > 0) return Promise.resolve(now);
      // Safari may populate the list asynchronously on first access.
      return new Promise((resolve) => {
        const done = () => {
          synth.removeEventListener("voiceschanged", done);
          resolve(deviceVoices(synth));
        };
        synth.addEventListener("voiceschanged", done);
        setTimeout(done, 1000);
      });
    },
  };
}

function deviceVoices(synth: SpeechSynthesis): Voice[] {
  return synth.getVoices().map((v) => ({ name: v.name, lang: v.lang, quality: classifyVoice(v.name, v.voiceURI) }));
}
