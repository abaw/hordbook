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

render(
  <App collection={collection} progressStore={localStorageSettings()} platform={browserPlatform()} />,
  document.getElementById("app")!,
);
