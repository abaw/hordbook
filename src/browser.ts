import type { Platform, TextFile, Voice } from "./ports";
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
    async shareFile(file) {
      const blob = new File([file.content], file.name, { type: file.type });
      // iOS Safari: the share sheet, with "Save to Files", AirDrop and so on.
      if (navigator.canShare?.({ files: [blob] })) {
        try {
          await navigator.share({ files: [blob], title: file.name });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return; // learner dismissed the sheet
        }
      }
      // Desktop browsers: a plain download.
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    pickFile(accept) {
      return new Promise<TextFile | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.addEventListener("change", () => {
          const chosen = input.files?.[0];
          if (!chosen) return resolve(null);
          void chosen.text().then((content) => resolve({ name: chosen.name, type: chosen.type, content }));
        });
        input.addEventListener("cancel", () => resolve(null));
        input.click();
      });
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
