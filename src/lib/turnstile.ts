export const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()
export const turnstileEnabled = turnstileSiteKey.length > 0
