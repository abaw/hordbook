/** Injected by `define` in vite.config.ts from package.json. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Set by the Pages workflow to the commit being built; absent in local builds. */
  readonly VITE_COMMIT_SHA?: string;
}
