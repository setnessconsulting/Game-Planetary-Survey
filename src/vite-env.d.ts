/// <reference types="vite/client" />

/**
 * Planetary Survey runs against the browser environment only. There is no server
 * runtime, and no environment variable is required to play
 * (docs/PRIVACY_AND_PERSISTENCE.md §1).
 */
interface ImportMetaEnv {
  /** Absolute or relative base the build was served from (nested games-site prefix). */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
