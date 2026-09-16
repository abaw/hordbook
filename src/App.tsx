import type { Ports } from "./ports";
import { useRoute } from "./route";
import { Home } from "./screens/Home";
import { Settings } from "./screens/Settings";

export function App({ collection, progressStore, platform, appVersion }: Ports) {
  const route = useRoute();
  switch (route.screen) {
    case "settings":
      return <Settings collection={collection} appVersion={appVersion} />;
    case "home":
      return <Home collection={collection} progressStore={progressStore} platform={platform} />;
  }
}
