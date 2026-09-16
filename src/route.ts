import { useEffect, useState } from "preact/hooks";

/**
 * Screens are addressed by URL fragment (`#/settings`, `#/words/<id>`) so
 * that the browser's back button and gesture work inside the installed app,
 * and so that GitHub Pages, which has no SPA fallback, never sees a deep path.
 */
export type Route = { screen: "home" } | { screen: "settings" } | { screen: "word"; wordId: string };

const WORD_PREFIX = "#/words/";

export const routes = {
  home: "#/",
  settings: "#/settings",
  word: (wordId: string) => `${WORD_PREFIX}${encodeURI(wordId)}`,
} as const;

export function parseRoute(hash: string): Route {
  if (hash === routes.settings) return { screen: "settings" };
  if (hash.startsWith(WORD_PREFIX) && hash.length > WORD_PREFIX.length) {
    return { screen: "word", wordId: decodeURI(hash.slice(WORD_PREFIX.length)) };
  }
  return { screen: "home" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
