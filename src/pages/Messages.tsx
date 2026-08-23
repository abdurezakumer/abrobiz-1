import { useEffect, useState } from 'react'
import { Mail, MailOpen, Phone } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { listMessages, markMessageRead } from '../lib/api/messages'
import type { ContactMessage } from '../types'

export default function Messages() {
  const { business } = useAuth()
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (business) listMessages(business.id).then(m => { setMessages(m); setLoading(false) })
  }, [business])

  async function open(msg: ContactMessage) {
    if (!msg.isRead) {
      await markMessageRead(msg.id)
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, isRead: true } : m)))
    }
  }

  if (!business) return null

  return (
    <DashboardLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Messages</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>
        Inquiries submitted through your site's Contact page.
      </p>

      {loading ? (
        <div style={{ color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>Loading…</div>
      ) : messages.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 40, textAlign: 'center', color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>
          No messages yet. They'll show up here as soon as someone contacts you.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              onClick={() => open(msg)}
              style={{
                background: '#fff', borderRadius: 14, border: msg.isRead ? '1px solid rgba(10,12,16,0.06)' : '1.5px solid #D4A853',
                padding: '16px 18px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {msg.isRead ? <MailOpen size={15} color="rgba(10,12,16,0.35)" /> : <Mail size={15} color="#D4A853" />}
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0A0C10' }}>{msg.name}</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)', whiteSpace: 'nowrap' }}>{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'rgba(10,12,16,0.65)', marginTop: 8, lineHeight: 1.5 }}>{msg.message}</p>
              <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                {msg.email && <a href={`mailto:${msg.email}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#D4A853', textDecoration: 'none' }}><Mail size={12} /> {msg.email}</a>}
                {msg.phone && <a href={`tel:${msg.phone}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#D4A853', textDecoration: 'none' }}><Phone size={12} /> {msg.phone}</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
