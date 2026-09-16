import { screen, waitFor } from "@testing-library/preact";
import { describe, expect, it } from "vitest";

import { fakePlatform, fixtureCollection, memoryProgressStore } from "./test/fakes";
import { renderApp } from "./test/renderApp";

describe("App root", () => {
  it("renders the Home screen with the collection it was given", () => {
    renderApp({ collection: fixtureCollection({ name: "Fixture Collection 0.1", wordCount: 3 }) });

    expect(screen.getByRole("heading", { level: 1, name: "Hordbook" })).toBeInTheDocument();
    expect(screen.getByText("Fixture Collection 0.1")).toBeInTheDocument();
    expect(screen.getByText(/3 words/)).toBeInTheDocument();
  });

  it("shows the Add to Home Screen hint until it is dismissed, and remembers the dismissal", async () => {
    const progressStore = memoryProgressStore();

    const first = renderApp({ progressStore });
    const hint = await screen.findByRole("note", { name: /add to home screen/i });
    hint.querySelector("button")!.click();
    await waitFor(() => expect(screen.queryByRole("note", { name: /add to home screen/i })).not.toBeInTheDocument());
    first.unmount();

    renderApp({ progressStore });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("note", { name: /add to home screen/i })).not.toBeInTheDocument();
  });

  it("does not show the hint when already running as an installed app", async () => {
    renderApp({ platform: fakePlatform({ isStandalone: true }) });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("note", { name: /add to home screen/i })).not.toBeInTheDocument();
  });
});
