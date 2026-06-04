/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do Web App do Apps Script. Vazio => usa o mock local. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
