/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
// Force Vercel to pull latest code
// Vercel cache bust - Tue Sep  2 23:54:10 +08 2025
