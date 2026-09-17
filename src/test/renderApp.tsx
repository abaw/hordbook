import { render, waitFor } from "@testing-library/preact";

import { App } from "../App";
import type { Ports } from "../ports";
import { fakePlatform, fixtureCollection, memoryProgressStore } from "./fakes";

/**
 * Renders the real app root with fake ports and waits until the first screen
 * is on the page (the app reads the progress store before showing anything).
 * Override any port per test.
 */
export async function renderApp(overrides: Partial<Ports> = {}) {
  const ports: Ports = {
    collection: fixtureCollection(),
    progressStore: memoryProgressStore(),
    platform: fakePlatform(),
    build: { version: "0.1.0", commit: "abc1234def" },
    ...overrides,
  };
  const view = render(<App {...ports} />);
  await waitFor(() => {
    if (view.container.querySelector("main") === null) throw new Error("app not ready");
  });
  return view;
}

/** jsdom dispatches hashchange/popstate asynchronously after a navigation. */
export async function settleNavigation() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
