import { useEffect, useState } from 'react'
import { Bell, ShieldCheck, Send } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import TelegramConnectCard from '../../components/TelegramConnectCard'
import { useAuth } from '../../lib/authContext'
import { disconnectTelegram, getOrCreateAdminTelegramLink, type TelegramLinkStatus } from '../../lib/api/telegram'

export default function AdminTelegram() {
  const { profile } = useAuth()
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null)
  useEffect(() => { if (profile) void getOrCreateAdminTelegramLink(profile.id).then(setStatus).catch(() => {}) }, [profile])
  return <AdminLayout>
    <div style={{ marginBottom: 24 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Send size={21} color="#26A5E4" /><h1 style={heading}>Telegram workspace</h1></div><p style={subheading}>Connect one Telegram account to this administrator profile for timely operational alerts. The connection follows your assigned role.</p></div>
    <TelegramConnectCard status={status} kind="admin" onDisconnect={async () => { await disconnectTelegram('admin'); if (profile) setStatus(await getOrCreateAdminTelegramLink(profile.id)) }} />
    <div style={grid}><Info icon={<ShieldCheck size={17} />} title="One account, one connection" text="Each administrator profile can have one active Telegram connection. Disconnecting rotates the old link before a new connection can be made." /><Info icon={<Bell size={17} />} title="Role-aware alerts" text="Operations and finance admins receive payment workflow alerts. Super administrators can use the same secure connection for platform oversight." /></div>
  </AdminLayout>
}

function Info({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div style={infoCard}><div style={iconBox}>{icon}</div><strong>{title}</strong><p>{text}</p></div> }
const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 650, color: '#0A0C10', margin: 0 }
const subheading: React.CSSProperties = { color: 'rgba(10,12,16,0.52)', fontSize: 14, margin: '6px 0 0', lineHeight: 1.55, maxWidth: 680 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }
const infoCard: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,0.07)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, boxShadow: '0 8px 30px rgba(10,12,16,0.03)' }
const iconBox: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(38,165,228,0.1)', color: '#1688BF' }
