import type { Platform } from "./ports";

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
