import { useEffect, useState } from 'react'
import { Send, Megaphone } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { sendAnnouncement, listAnnouncements, type Announcement } from '../../lib/api/announcements'
import { friendlyError } from '../../lib/errors'

export default function AdminAnnouncements() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    listAnnouncements().then(a => { setHistory(a); setLoading(false) })
  }
  useEffect(load, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm(`Send this to every business owner? This can't be undone.`)) return
    setSending(true)
    setError('')
    setResult(null)
    try {
      const res = await sendAnnouncement(subject, body)
      setResult(res)
      setSubject('')
      setBody('')
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Announcements</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>Send an email to every business owner on the platform.</p>

      <form onSubmit={handleSend} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 20, marginBottom: 30, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={inputStyle} />
        <textarea required value={body} onChange={e => setBody(e.target.value)} placeholder="Message — one idea per line works well" rows={6} style={{ ...inputStyle, resize: 'vertical' }} />

        {error && <div style={{ color: '#DC2626', fontSize: 13 }}>{error}</div>}
        {result && (
          <div style={{ fontSize: 13, color: '#16A34A' }}>
            Sent to {result.sent} of {result.total} owners{result.failed > 0 ? ` (${result.failed} failed)` : ''}.
          </div>
        )}

        <button type="submit" disabled={sending} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start', background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          <Send size={14} /> {sending ? 'Sending…' : 'Send to all owners'}
        </button>
      </form>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 12 }}>History</div>
      {loading ? (
        <div style={{ color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>Loading…</div>
      ) : history.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 30, textAlign: 'center', color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>
          Nothing sent yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map(a => (
            <div key={a.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(10,12,16,0.06)', padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Megaphone size={14} color="#D4A853" />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{a.subject}</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)' }}>{new Date(a.createdAt).toLocaleDateString()} · {a.recipientCount} sent</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.55)', marginTop: 6, whiteSpace: 'pre-wrap' }}>{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const inputStyle: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '10px 13px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }
