import { useEffect, useRef, useState } from 'react'
import { turnstileEnabled, turnstileSiteKey } from '../lib/turnstile'

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove?: (widgetId?: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  const promise: Promise<TurnstileApi> = new Promise((resolve, reject) => {
    const existing = document.getElementById('abrobiz-turnstile-script') as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    script.id = 'abrobiz-turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable'))
    script.onerror = () => reject(new Error('Turnstile unavailable'))
    if (!existing) document.head.appendChild(script)
  })
  scriptPromise = promise.catch(error => {
    scriptPromise = null
    throw error
  })
  return scriptPromise
}

export default function TurnstileWidget({ action, onToken, resetKey = 0 }: { action: string; onToken: (token: string | null) => void; resetKey?: number }) {
  const container = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const onTokenRef = useRef(onToken)
  const [state, setState] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading')
  onTokenRef.current = onToken

  useEffect(() => {
    if (!turnstileEnabled || !container.current) return
    let active = true
    const mount = async () => {
      try {
        const api = await loadTurnstile()
        if (!active || !container.current) return
        widgetId.current = api.render(container.current, {
          sitekey: turnstileSiteKey,
          action,
          callback: (token: string) => { onTokenRef.current(token); setState('ready') },
          'expired-callback': () => { onTokenRef.current(null); setState('expired') },
          'error-callback': () => { onTokenRef.current(null); setState('error') },
          'timeout-callback': () => { onTokenRef.current(null); setState('error') },
        })
      } catch {
        if (active) { onTokenRef.current(null); setState('error') }
      }
    }
    setState('loading')
    onTokenRef.current(null)
    mount()
    return () => {
      active = false
      if (widgetId.current && window.turnstile) {
        if (window.turnstile.remove) window.turnstile.remove(widgetId.current)
        else window.turnstile.reset(widgetId.current)
      }
      widgetId.current = undefined
    }
  }, [action, resetKey])

  if (!turnstileEnabled) return null
  return (
    <div aria-label="Security verification" style={{ minHeight: 66 }}>
      <div ref={container} />
      {state === 'loading' && <div aria-live="polite" style={statusStyle}>Loading security check...</div>}
      {state === 'expired' && <div aria-live="polite" style={statusStyle}>The security check expired. Please complete it again.</div>}
      {state === 'error' && <div aria-live="polite" style={statusStyle}>Security check unavailable. Please retry.</div>}
    </div>
  )
}

const statusStyle: React.CSSProperties = { color: '#F87171', fontSize: 12, marginTop: 4 }
