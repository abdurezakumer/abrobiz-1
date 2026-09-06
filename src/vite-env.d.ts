/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_AUTH_URL?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_PLATFORM_DOMAIN?: string
  readonly VITE_TELEGRAM_BOT_USERNAME?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface GoogleIdentityNotification {
  isNotDisplayed(): boolean
  isSkippedMoment(): boolean
  isDismissedMoment(): boolean
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(options: {
        client_id: string
        callback: (response: { credential?: string }) => void | Promise<void>
        ux_mode?: 'popup' | 'redirect'
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
      }): void
      prompt(callback?: (notification: GoogleIdentityNotification) => void): void
    }
  }
}

interface Window {
  google?: GoogleIdentityApi
}
