import { Send, Check } from 'lucide-react'
import { telegramDeepLink, type TelegramLinkStatus } from '../lib/api/telegram'

export default function TelegramConnectCard({ status, kind }: { status: TelegramLinkStatus | null; kind: 'business' | 'admin' }) {
  if (!status) return null

  const deepLink = telegramDeepLink(status.linkToken)
  const connected = !!status.linkedAt

  return (
    <div
      style={{
        background: connected ? 'rgba(34,197,94,0.06)' : '#fff',
        border: connected ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(10,12,16,0.06)',
        borderRadius: 16, padding: '16px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#26A5E4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send size={17} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0C10' }}>
            {connected ? `Connected to Telegram${status.telegramUsername ? ` as @${status.telegramUsername}` : ''}` : 'Connect Telegram'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.5)', marginTop: 1 }}>
            {connected
              ? kind === 'admin'
                ? 'Payment approvals show up here with one-tap Approve/Reject.'
                : "You'll get notified here when your payments are reviewed — and can submit new ones with /pay."
              : kind === 'admin'
                ? 'Get payment approval requests as Telegram messages you can approve in one tap.'
                : 'Get notified the moment your payment is approved, or submit proof right from the chat.'}
          </div>
        </div>
      </div>

      {connected ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#16A34A', background: 'rgba(34,197,94,0.12)', padding: '6px 12px', borderRadius: 999 }}>
          <Check size={13} /> Connected
        </span>
      ) : deepLink ? (
        <a href={deepLink} target="_blank" rel="noreferrer" style={connectBtn}>Connect</a>
      ) : (
        <span style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)' }}>Bot not configured yet</span>
      )}
    </div>
  )
}

const connectBtn: React.CSSProperties = {
  background: '#26A5E4', color: '#fff', padding: '9px 18px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
}
