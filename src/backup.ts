import type { BuildInfo, Collection, ProgressRecord, SpeechLocale } from "./ports";
import type { ProgressRecords } from "./progress";
import { isSpeechLocale } from "./speech";

/** Bump when the export shape changes incompatibly; importers refuse newer versions. */
export const EXPORT_SCHEMA_VERSION = 1;

/** The JSON document Export writes and Import reads: the only sync mechanism. */
export interface ExportDocument {
  app: "hordbook";
  schemaVersion: number;
  appVersion: string;
  /** ISO timestamp of the export. */
  exportedAt: string;
  /** IDs of the collections the records refer to. */
  collections: string[];
  /** Every stored record; unseen words have none, so these are exactly the non-unseen states. */
  records: ProgressRecord[];
  settings: {
    voiceLocale?: SpeechLocale;
    lastWordId?: string;
  };
}

export interface ExportInput {
  records: ProgressRecords;
  collection: Collection;
  build: BuildInfo;
  voiceLocale: SpeechLocale;
  lastWordId: string | null;
}

export function buildExport(input: ExportInput, now: Date): ExportDocument {
  return {
    app: "hordbook",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    appVersion: `${input.build.version} (${input.build.commit ? input.build.commit.slice(0, 7) : "dev"})`,
    exportedAt: now.toISOString(),
    collections: [input.collection.id],
    records: [...input.records.values()],
    settings: {
      voiceLocale: input.voiceLocale,
      ...(input.lastWordId === null ? {} : { lastWordId: input.lastWordId }),
    },
  };
}

/** `hordbook-progress-2026-09-18.json`, using the device's local date. */
export function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `hordbook-progress-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export type ParsedExport = { ok: true; document: ExportDocument } | { ok: false; reason: string };

/** Validates a file's text as an export document; the reason is shown to the learner as is. */
export function parseExport(text: string): ParsedExport {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "This file is not a Hordbook export (it is not valid JSON)." };
  }
  if (!isObject(value) || value.app !== "hordbook" || typeof value.schemaVersion !== "number") {
    return { ok: false, reason: "This file is not a Hordbook export." };
  }
  if (value.schemaVersion > EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `This export was made by a newer Hordbook (format ${value.schemaVersion}). Update the app, then import again.`,
    };
  }
  if (!Array.isArray(value.records) || !value.records.every(isRecord)) {
    return { ok: false, reason: "This Hordbook export is damaged: its records are not readable." };
  }
  const settings = isObject(value.settings) ? value.settings : {};
  return {
    ok: true,
    document: {
      app: "hordbook",
      schemaVersion: value.schemaVersion,
      appVersion: typeof value.appVersion === "string" ? value.appVersion : "unknown",
      exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "",
      collections: Array.isArray(value.collections) ? value.collections.filter((c) => typeof c === "string") : [],
      records: value.records,
      settings: {
        ...(isSpeechLocale(settings.voiceLocale) ? { voiceLocale: settings.voiceLocale } : {}),
        ...(typeof settings.lastWordId === "string" ? { lastWordId: settings.lastWordId } : {}),
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecord(value: unknown): value is ProgressRecord {
  return (
    isObject(value) &&
    typeof value.wordId === "string" &&
    (value.state === "learning" || value.state === "known") &&
    typeof value.firstSeen === "string" &&
    typeof value.lastReviewed === "string" &&
    typeof value.interval === "number"
  );
}

/**
 * Merges imported records into the current ones. Where both sides have a
 * record for a word, the more recently reviewed one wins, so importing an
 * old backup never erases newer progress. Returns only the records that
 * changed, keyed by word ID.
 */
export function mergeRecords(current: ProgressRecords, incoming: ProgressRecord[]): MergeResult {
  const changed = new Map<string, ProgressRecord>();
  for (const record of incoming) {
    const existing = current.get(record.wordId);
    // ISO-8601 UTC timestamps (toISOString) compare correctly as strings.
    if (existing === undefined || record.lastReviewed > existing.lastReviewed) changed.set(record.wordId, record);
  }
  return { changed, unchanged: incoming.length - changed.size };
}

export interface MergeResult {
  /** Records to store, keyed by word ID. */
  changed: Map<string, ProgressRecord>;
  /** Incoming records the device already had at least as recent a version of. */
  unchanged: number;
}
