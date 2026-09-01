import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { failed: boolean }

/** Keeps an isolated render failure from leaving a blank application shell.
 * Details are intentionally not rendered or logged to the browser. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Production diagnostics belong in the hosting/observability platform;
    // never print stack traces or user/session data to the browser console.
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main role="alert" style={{ minHeight: '100vh', background: '#0A0C10', color: '#F0EDE7', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, marginBottom: 10 }}>AbroBiz needs a refresh</h1>
          <p style={{ color: 'rgba(240,237,231,0.65)', marginBottom: 18 }}>This page could not be displayed. Your account data is still protected.</p>
          <button onClick={() => window.location.reload()} style={{ background: '#D4A853', color: '#0A0C10', border: 0, borderRadius: 10, padding: '11px 18px', fontWeight: 700, cursor: 'pointer' }}>Refresh page</button>
        </div>
      </main>
    )
  }
}
