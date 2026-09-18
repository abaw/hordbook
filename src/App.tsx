import { useLayoutEffect, useRef } from "preact/hooks";

import type { Ports } from "./ports";
import { useLastPosition, useProgress } from "./progress";
import { type Route, useRoute } from "./route";
import { useSettings } from "./settings";
import { Home } from "./screens/Home";
import { Settings } from "./screens/Settings";
import { WordCard } from "./screens/WordCard";

export function App({ collection, progressStore, platform, build }: Ports) {
  const route = useRoute();
  const progress = useProgress(progressStore);
  const lastPosition = useLastPosition(progressStore);
  const { settings, setVoiceLocale, dismissEnhancedVoiceHint } = useSettings(progressStore);
  useListScrollRestore(route);

  const viewedWordId = route.screen === "word" ? route.wordId : null;
  useLayoutEffect(() => {
    if (viewedWordId !== null) lastPosition.remember(viewedWordId);
  }, [viewedWordId, lastPosition.remember]);

  // Wait for the device's progress records and last position so nothing
  // flashes from unseen or jumps after the first paint.
  if (progress.records === null || lastPosition.wordId === undefined || settings === null) return null;

  if (route.screen === "settings") {
    return (
      <Settings
        collection={collection}
        build={build}
        platform={platform}
        settings={settings}
        onVoiceLocaleChange={setVoiceLocale}
        records={progress.records}
        lastWordId={lastPosition.wordId}
        onImport={(records, imported) => {
          if (imported.voiceLocale) setVoiceLocale(imported.voiceLocale);
          if (imported.lastWordId) lastPosition.remember(imported.lastWordId);
          return progress.putRecords(records);
        }}
        onReset={progress.resetAll}
      />
    );
  }
  // The list stays mounted (hidden) under a word card so that its filters
  // and scroll position survive the round trip.
  return (
    <>
      <Home
        collection={collection}
        progressStore={progressStore}
        platform={platform}
        records={progress.records}
        onCycleState={progress.cycleState}
        initialWordId={lastPosition.wordId}
        hidden={route.screen !== "home"}
      />
      {route.screen === "word" && (
        <WordCard
          collection={collection}
          platform={platform}
          wordId={route.wordId}
          records={progress.records}
          onCycleState={progress.cycleState}
          settings={settings}
          onDismissEnhancedVoiceHint={dismissEnhancedVoiceHint}
        />
      )}
    </>
  );
}

/**
 * Remembers where the list was scrolled when a word card opens and puts it
 * back on return; cards themselves always open at the top.
 */
function useListScrollRestore(route: Route) {
  const previous = useRef<Route["screen"] | null>(null);
  const listScrollY = useRef(0);
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = route.screen;
    if (from === route.screen) return;
    if (from === "home") listScrollY.current = window.scrollY;
    if (route.screen === "home" && from !== null) {
      window.scrollTo(0, listScrollY.current);
    } else if (route.screen !== "home") {
      window.scrollTo(0, 0);
    }
  }, [route.screen, route.screen === "word" ? route.wordId : null]);
}
