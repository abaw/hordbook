import { render } from "@testing-library/preact";

import { App } from "../App";
import type { Ports } from "../ports";
import { fakePlatform, fixtureCollection, memoryProgressStore } from "./fakes";

/** Renders the real app root with fake ports; override any port per test. */
export function renderApp(overrides: Partial<Ports> = {}) {
  const ports: Ports = {
    collection: fixtureCollection(),
    progressStore: memoryProgressStore(),
    platform: fakePlatform(),
    appVersion: "0.1.0 (test)",
    ...overrides,
  };
  return render(<App {...ports} />);
}

/** jsdom dispatches hashchange/popstate asynchronously after a navigation. */
export async function settleNavigation() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
