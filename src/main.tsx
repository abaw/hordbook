import { render } from "preact";
import { registerSW } from "virtual:pwa-register";

import ngslFile from "../collections/ngsl.json";
import { App } from "./App";
import { browserPlatform, localStorageSettings } from "./browser";
import { collectionFromFile, type CollectionFile } from "./collectionFile";
import "./styles.css";

// New versions activate on the next launch; nothing to prompt for.
registerSW({ immediate: true });

const collection = collectionFromFile(ngslFile as CollectionFile);

// package.json version, plus the commit the Pages workflow built from.
const commit = import.meta.env.VITE_COMMIT_SHA;
const appVersion = `${__APP_VERSION__} (${commit ? commit.slice(0, 7) : "dev"})`;

render(
  <App
    collection={collection}
    progressStore={localStorageSettings()}
    platform={browserPlatform()}
    appVersion={appVersion}
  />,
  document.getElementById("app")!,
);
