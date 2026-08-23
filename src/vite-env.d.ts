/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_AUTH_URL?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_PLATFORM_DOMAIN?: string
  readonly VITE_TELEGRAM_BOT_USERNAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
