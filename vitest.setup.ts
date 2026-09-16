import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { afterEach } from "vitest";

// jsdom has no layout, so scrolling is a no-op; tests spy on it when needed.
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
});
