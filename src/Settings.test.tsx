import { screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import ngslFile from "../collections/ngsl.json";
import { collectionFromFile, type CollectionFile } from "./collectionFile";
import { fixtureCollection } from "./test/fakes";
import { renderApp, settleNavigation } from "./test/renderApp";

afterEach(async () => {
  window.location.hash = "";
  await settleNavigation();
});

describe("Settings and About", () => {
  it("opens Settings from Home and shows the collection's attribution, licence, source and the app version", async () => {
    const user = userEvent.setup();
    const collection = fixtureCollection({
      name: "Fixture Collection 0.1",
      source: { name: "Fixture Word Source", version: "0.1", urls: ["https://example.test/source"] },
      attribution: "Words by Ada Fixture (example.test), licensed under CC BY-SA 4.0.",
    });
    await renderApp({ collection, build: { version: "0.1.0", commit: "abc1234def" } });

    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByText("Fixture Collection 0.1")).toBeInTheDocument();
    expect(within(about).getByText("Words by Ada Fixture (example.test), licensed under CC BY-SA 4.0.")).toBeInTheDocument();
    expect(
      within(about).getByRole("link", { name: "Creative Commons Attribution-ShareAlike 4.0 International" }),
    ).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
    expect(within(about).getByRole("link", { name: "Fixture Word Source 0.1" })).toHaveAttribute(
      "href",
      "https://example.test/source",
    );
    expect(within(about).getByText(/0\.1\.0 \(abc1234\)/)).toBeInTheDocument();
  });

  it("credits the NGSL authors under CC BY-SA 4.0 and links to the source site for the shipped collection", async () => {
    window.location.hash = "#/settings";
    await settleNavigation();
    await renderApp({ collection: collectionFromFile(ngslFile as CollectionFile) });

    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByText(/Charles Browne, Brent Culligan and Joseph Phillips/)).toBeInTheDocument();
    expect(within(about).getByText(/CC BY-SA 4\.0/)).toBeInTheDocument();
    expect(within(about).getByRole("link", { name: "New General Service List 1.2" })).toHaveAttribute(
      "href",
      "https://www.newgeneralservicelist.com/new-general-service-list",
    );
  });

  it("returns to Home with the browser back button", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole("link", { name: "Settings" }));
    await screen.findByRole("heading", { level: 1, name: "Settings" });

    window.history.back();

    expect(await screen.findByRole("heading", { level: 1, name: "Hordbook" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Settings" })).not.toBeInTheDocument();
  });

  it("opens Settings directly when launched at its URL, and its Home link leads back", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/settings";
    await settleNavigation();

    await renderApp();

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Home" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Hordbook" })).toBeInTheDocument();
  });
});
