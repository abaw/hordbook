import { useState } from "preact/hooks";

import { buildExport, exportFileName, type ExportDocument, type ExportInput, mergeRecords, parseExport } from "../backup";
import type { Platform, ProgressRecord, SpeechLocale } from "../ports";
import type { ProgressRecords } from "../progress";

interface BackupProps {
  platform: Platform;
  records: ProgressRecords;
  exportInput: Omit<ExportInput, "records">;
  onImport(records: Iterable<ProgressRecord>, settings: { voiceLocale?: SpeechLocale; lastWordId?: string }): number;
  onReset(): void;
}

type Pending = { kind: "import"; document: ExportDocument; fileName: string } | { kind: "reset" } | null;

/** Settings › Backup: Export, Import and Reset progress. */
export function Backup({ platform, records, exportInput, onImport, onReset }: BackupProps) {
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<{ tone: "status" | "alert"; text: string } | null>(null);

  const exportProgress = async () => {
    const now = new Date();
    const document = buildExport({ ...exportInput, records }, now);
    await platform.shareFile({
      name: exportFileName(now),
      type: "application/json",
      content: JSON.stringify(document, null, 2),
    });
    setMessage({ tone: "status", text: `Exported ${plural(document.records.length, "record")}.` });
  };

  const chooseImport = async () => {
    setMessage(null);
    const file = await platform.pickFile("application/json,.json");
    if (file === null) return;
    const parsed = parseExport(file.content);
    if (!parsed.ok) {
      setMessage({ tone: "alert", text: parsed.reason });
      return;
    }
    setPending({ kind: "import", document: parsed.document, fileName: file.name });
  };

  const confirmImport = (document: ExportDocument) => {
    const merge = mergeRecords(records, document.records);
    const written = onImport(merge.changed.values(), document.settings);
    setPending(null);
    setMessage({
      tone: "status",
      text: `Imported ${plural(written, "record")}${merge.unchanged > 0 ? ` (${merge.unchanged} were already up to date)` : ""}.`,
    });
  };

  const confirmReset = () => {
    onReset();
    setPending(null);
    setMessage({ tone: "status", text: "Progress reset. Every word is unseen again." });
  };

  return (
    <section class="card" aria-labelledby="backup-title">
      <h2 id="backup-title">Backup</h2>
      <p class="muted">
        Progress lives only on this phone. Export saves it as a JSON file you can keep in iCloud Drive or send to
        yourself; Import merges such a file back in.
      </p>
      <div class="actions">
        <button type="button" class="button" onClick={() => void exportProgress()}>
          Export progress
        </button>
        <button type="button" class="button button--secondary" onClick={() => void chooseImport()}>
          Import…
        </button>
      </div>

      {pending?.kind === "import" && (
        <div class="confirm" role="dialog" aria-labelledby="import-title" aria-describedby="import-summary">
          <h3 id="import-title" class="card__subtitle">
            Import this file?
          </h3>
          <p id="import-summary">
            {pending.fileName}: {plural(pending.document.records.length, "record")}
            {pending.document.exportedAt ? `, exported ${formatDate(pending.document.exportedAt)}` : ""}
            {pending.document.collections.length > 0 ? `, collection ${pending.document.collections.join(", ")}` : ""}
            {pending.document.appVersion !== "unknown" ? ` (Hordbook ${pending.document.appVersion})` : ""}.
          </p>
          <p class="muted">
            Records are merged: where this phone and the file both know a word, the more recently reviewed record
            wins. Nothing is deleted.
          </p>
          <div class="actions">
            <button type="button" class="button" onClick={() => confirmImport(pending.document)}>
              Import
            </button>
            <button type="button" class="button button--secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <h3 class="card__subtitle">Start over</h3>
      <button type="button" class="button button--danger" onClick={() => setPending({ kind: "reset" })}>
        Reset progress…
      </button>

      {pending?.kind === "reset" && (
        <div class="confirm" role="dialog" aria-labelledby="reset-title" aria-describedby="reset-summary">
          <h3 id="reset-title" class="card__subtitle">
            Delete all progress?
          </h3>
          <p id="reset-summary">
            {plural(records.size, "record")} on this phone will be deleted and every word becomes unseen. This cannot
            be undone; export first if you want a backup.
          </p>
          <div class="actions">
            <button type="button" class="button button--danger" onClick={confirmReset}>
              Delete everything
            </button>
            <button type="button" class="button button--secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p class={message.tone === "alert" ? "field__error" : "muted"} role={message.tone}>
          {message.text}
        </p>
      )}
    </section>
  );
}

function plural(n: number, noun: string): string {
  return `${n.toLocaleString("en")} ${noun}${n === 1 ? "" : "s"}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}
