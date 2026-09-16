import { useEffect, useState } from "preact/hooks";

/**
 * Screens are addressed by URL fragment (`#/settings`) so that the browser's
 * back button and gesture work inside the installed app, and so that GitHub
 * Pages, which has no SPA fallback, never sees a deep path.
 */
export type Route = { screen: "home" } | { screen: "settings" };

export const routes = {
  home: "#/",
  settings: "#/settings",
} as const;

export function parseRoute(hash: string): Route {
  switch (hash) {
    case routes.settings:
      return { screen: "settings" };
    default:
      return { screen: "home" };
  }
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
