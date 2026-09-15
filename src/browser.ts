import type { Platform, ProgressStore } from "./ports";

/** Detects the iOS home-screen web app and the standard display-mode media query. */
export function browserPlatform(): Platform {
  const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return {
    isStandalone: navigatorStandalone || displayModeStandalone,
    openUrl(url) {
      window.open(url, "_blank", "noopener");
    },
  };
}

/**
 * Settings persisted in localStorage. Word-level progress records arrive with
 * the IndexedDB store in a later ticket; settings stay small and synchronous.
 */
export function localStorageSettings(prefix = "hordbook."): ProgressStore {
  return {
    async getSetting(key) {
      return window.localStorage.getItem(prefix + key);
    },
    async setSetting(key, value) {
      window.localStorage.setItem(prefix + key, value);
    },
  };
}
