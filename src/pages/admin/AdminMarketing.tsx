import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, Link2, RefreshCw, ShieldCheck, Users, TrendingUp } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../lib/authContext'
import { assignMarketingTeam, getMarketingWorkspace, rotateReferralCode, setCommissionRule, updateCommissionStatus, type MarketingWorkspace } from '../../lib/api/marketing'
import { friendlyError } from '../../lib/errors'

const money = (value: number) => `${Math.round(value).toLocaleString()} ETB`

export default function AdminMarketing() {
  const { profile } = useAuth()
  const [workspace, setWorkspace] = useState<MarketingWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const isSuper = profile?.role === 'super_admin' || profile?.adminRole === 'super_admin'
  const canManage = isSuper || profile?.adminRole === 'marketing_admin'

  async function load(refresh = false) {
    if (!profile) return
    if (refresh) setRefreshing(true); else setLoading(true)
    setError('')
    try { setWorkspace(await getMarketingWorkspace(profile)) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { void load() }, [profile?.id, profile?.adminRole])

  return <AdminLayout>
    <div style={header}><div><div style={eyebrow}><TrendingUp size={13} /> ABROBIZ MARKETING</div><h1 style={heading}>Marketing performance</h1><p style={subheading}>Track attributed owners, full-plan payments, partner follow-up, and server-calculated commissions.</p></div><button type="button" onClick={() => void load(true)} disabled={refreshing} style={refreshButton}><RefreshCw size={14} style={{ animation: refreshing ? 'marketing-spin .8s linear infinite' : 'none' }} /> Refresh</button></div>
    {error && <div role="alert" style={errorBox}>{error}</div>}
    {loading ? <div style={panel}>Loading marketing workspace…</div> : workspace ? <>
      <SummaryCards workspace={workspace} />
      <div className="marketing-layout-grid" style={layoutGrid}><CustomersPanel workspace={workspace} /><LedgerPanel workspace={workspace} isSuper={isSuper} onChanged={() => void load(true)} /></div>
      {canManage && <TeamPanel workspace={workspace} isSuper={isSuper} onChanged={() => void load(true)} />}
    </> : null}
    <style>{'@keyframes marketing-spin { to { transform: rotate(360deg); } } @media (max-width: 900px) { .marketing-layout-grid { grid-template-columns: 1fr !important; } }'}</style>
  </AdminLayout>
}

function SummaryCards({ workspace }: { workspace: MarketingWorkspace }) {
  const cards = [
    { label: 'Attributed customers', value: workspace.summary.customers, icon: Users },
    { label: 'Paid customers', value: workspace.summary.paidCustomers, icon: BadgeDollarSign },
    { label: 'Payment pending', value: workspace.summary.pendingCustomers, icon: Link2 },
    { label: 'Qualifying full payments', value: money(workspace.summary.qualifyingPayments), icon: TrendingUp },
    { label: 'Partner commission', value: money(workspace.summary.commissionTotal), icon: BadgeDollarSign },
    { label: 'Paid commission', value: money(workspace.summary.commissionPaid), icon: ShieldCheck },
  ]
  return <div style={summaryGrid}>{cards.map(card => <div key={card.label} style={summaryCard}><div style={summaryIcon}><card.icon size={16} /></div><div><div style={summaryLabel}>{card.label}</div><div style={summaryValue}>{card.value}</div></div></div>)}</div>
}

function CustomersPanel({ workspace }: { workspace: MarketingWorkspace }) {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return workspace.customers.filter(customer => !term || `${customer.ownerName} ${customer.ownerEmail} ${customer.businessName} ${customer.ownerPlatformId} ${customer.referralCode ?? ''}`.toLowerCase().includes(term))
  }, [workspace.customers, query])
  return <section style={panel}><div style={panelHeader}><div><h2 style={panelTitle}>Attributed customers</h2><p style={panelHint}>One locked acquisition record per owner. Direct owners remain unassigned.</p></div><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search customers" style={searchInput} /></div><div style={tableWrap}><table style={table}><thead><tr><th style={th}>Customer</th><th style={th}>Attribution</th><th style={th}>Plan / full amount</th><th style={th}>Payment</th></tr></thead><tbody>{rows.map(customer => <tr key={customer.attributionId}><td style={td}><strong>{customer.businessName}</strong><div style={muted}>{customer.ownerName} · {customer.ownerPlatformId}</div><div style={muted}>{customer.ownerEmail}</div></td><td style={td}><span style={pill}>{customer.source === 'direct' ? 'Direct' : customer.referralCode ?? 'Assigned'}</span></td><td style={td}>{customer.planName}<div style={muted}>{customer.amountRequired ? money(customer.amountRequired) : 'Not selected'}</div></td><td style={td}><span style={{ ...statusPill, ...statusColor(customer.paymentStatus) }}>{customer.paymentStatus}</span>{customer.paidAmount > 0 && <div style={muted}>{money(customer.paidAmount)} received</div>}</td></tr>)}</tbody></table>{rows.length === 0 && <div style={empty}>No attributed customers found.</div>}</div></section>
}

function LedgerPanel({ workspace, isSuper, onChanged }: { workspace: MarketingWorkspace; isSuper: boolean; onChanged: () => void }) {
  const partnerEntries = workspace.ledger.filter(entry => entry.recipientType !== 'abrobiz')
  return <section style={panel}><div style={panelHeader}><div><h2 style={panelTitle}>Commission ledger</h2><p style={panelHint}>Generated only after an approved payment and calculated on the full plan payment.</p></div><span style={pill}>{workspace.summary.commissionPending ? `${money(workspace.summary.commissionPending)} pending` : 'No pending commission'}</span></div><div style={tableWrap}><table style={table}><thead><tr><th style={th}>Recipient</th><th style={th}>Rate</th><th style={th}>Amount</th><th style={th}>Status</th>{isSuper && <th style={th}>Action</th>}</tr></thead><tbody>{partnerEntries.slice(0, 100).map(entry => <tr key={entry.id}><td style={td}>{entry.recipientType === 'sales_person' ? 'Sales Person' : 'Marketing Admin'}<div style={muted}>{entry.entryType}</div></td><td style={td}>{entry.rate}%</td><td style={td}>{money(entry.amountEtb)}</td><td style={td}><span style={{ ...statusPill, ...statusColor(entry.status) }}>{entry.status}</span></td>{isSuper && <td style={td}><select value={entry.status} onChange={event => void updateCommissionStatus(entry.id, event.target.value).then(onChanged).catch(() => {})} style={smallSelect}><option value="pending">Pending</option><option value="eligible">Eligible</option><option value="approved">Approved</option><option value="payable">Payable</option><option value="paid">Paid</option><option value="disputed">Disputed</option><option value="cancelled">Cancelled</option></select></td>}</tr>)}</tbody></table>{partnerEntries.length === 0 && <div style={empty}>No commission entries yet. They appear after a full payment is approved.</div>}</div></section>
}

function TeamPanel({ workspace, isSuper, onChanged }: { workspace: MarketingWorkspace; isSuper: boolean; onChanged: () => void }) {
  const salesPeople = workspace.team.filter(member => member.role === 'sales_person')
  const marketingAdmins = workspace.team.filter(member => member.role === 'marketing_admin' || member.role === 'super_admin')
  const [selectedSales, setSelectedSales] = useState('')
  const [selectedAdmin, setSelectedAdmin] = useState('')
  const [selectedCodeSales, setSelectedCodeSales] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const activeCodeBySales = new Map(workspace.referralCodes.filter(item => item.isActive).map(item => [item.salesPersonId, item.code]))

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage('')
    try { await action(); setMessage(success); onChanged() } catch (err) { setMessage(friendlyError(err)) } finally { setBusy(false) }
  }

  return <section style={{ ...panel, marginTop: 16 }}><div style={panelHeader}><div><h2 style={panelTitle}>{isSuper ? 'Marketing administration' : 'Marketing team'}</h2><p style={panelHint}>{isSuper ? 'Assign partner roles, lock referral ownership, and manage the active commission rule.' : 'Your attributed customer and commission activity appears above.'}</p></div><span style={pill}>{workspace.commissionRule ? `${workspace.commissionRule.salesPersonRate}% sales · ${workspace.commissionRule.marketingAdminRate}% admin · ${workspace.commissionRule.abrobizRate}% AbroBiz` : 'No rule'}</span></div>{isSuper && <div style={managementGrid}>
    <div style={managementCard}><strong>Assign Sales Person team</strong><select value={selectedSales} onChange={event => setSelectedSales(event.target.value)} style={formInput}><option value="">Select Sales Person</option>{salesPeople.map(member => <option key={member.id} value={member.id}>{member.name} · {member.platformId}</option>)}</select><select value={selectedAdmin} onChange={event => setSelectedAdmin(event.target.value)} style={formInput}><option value="">Select Marketing Admin</option>{marketingAdmins.map(member => <option key={member.id} value={member.id}>{member.name} · {member.platformId}</option>)}</select><button type="button" disabled={busy || !selectedSales || !selectedAdmin} onClick={() => void run(() => assignMarketingTeam(selectedSales, selectedAdmin), 'Team assignment saved.')} style={primaryButton}>Save assignment</button></div>
    <div style={managementCard}><strong>System referral code</strong><select value={selectedCodeSales} onChange={event => setSelectedCodeSales(event.target.value)} style={formInput}><option value="">Select Sales Person</option>{salesPeople.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button type="button" disabled={busy || !selectedCodeSales} onClick={() => void run(() => rotateReferralCode(selectedCodeSales), 'A new unique referral code was generated.')} style={primaryButton}>Generate new unique code</button><div style={muted}>Codes are created automatically when a Sales Person is assigned. Current codes: {salesPeople.map(member => `${member.name}: ${activeCodeBySales.get(member.id) ?? 'generating'}`).join(' · ') || 'none'}</div></div>
    <CommissionRuleCard workspace={workspace} busy={busy} onSaved={message => { setMessage(message); onChanged() }} />
  </div>}{message && <div style={{ ...messageBox, color: message.includes('saved') ? '#166534' : '#991B1B' }}>{message}</div>}</section>
}

function CommissionRuleCard({ workspace, busy, onSaved }: { workspace: MarketingWorkspace; busy: boolean; onSaved: (message: string) => void }) {
  const rule = workspace.commissionRule
  const [sales, setSales] = useState(String(rule?.salesPersonRate ?? 20))
  const [admin, setAdmin] = useState(String(rule?.marketingAdminRate ?? 5))
  const [abrobiz, setAbrobiz] = useState(String(rule?.abrobizRate ?? 75))
  const total = Number(sales) + Number(admin) + Number(abrobiz)
  return <div style={managementCard}><strong>Active commission rule</strong><div style={rateGrid}><input type="number" min="0" max="100" value={sales} onChange={event => setSales(event.target.value)} style={formInput} placeholder="Sales %" /><input type="number" min="0" max="100" value={admin} onChange={event => setAdmin(event.target.value)} style={formInput} placeholder="Admin %" /><input type="number" min="0" max="100" value={abrobiz} onChange={event => setAbrobiz(event.target.value)} style={formInput} placeholder="AbroBiz %" /></div><div style={{ ...muted, color: total === 100 ? '#166534' : '#991B1B' }}>Total: {total}% (must equal 100%)</div><button type="button" disabled={busy || total !== 100} onClick={() => setCommissionRule('Standard referral distribution', Number(sales), Number(admin), Number(abrobiz)).then(() => onSaved('Commission rule saved.')).catch(() => onSaved('Could not save commission rule.'))} style={primaryButton}>Save rule</button></div>
}

function statusColor(status: string): React.CSSProperties { if (status === 'approved' || status === 'paid') return { color: '#166534', background: 'rgba(22,101,52,.1)' }; if (status === 'pending' || status === 'unpaid') return { color: '#8A6417', background: 'rgba(212,168,83,.14)' }; return { color: '#991B1B', background: 'rgba(220,38,38,.1)' } }
const header: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }
const eyebrow: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#946F1F', fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4 }
const heading: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 650, color: '#0A0C10', margin: '7px 0 5px' }
const subheading: React.CSSProperties = { color: 'rgba(10,12,16,.52)', fontSize: 14, lineHeight: 1.55, margin: 0, maxWidth: 720 }
const refreshButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(10,12,16,.12)', background: '#fff', borderRadius: 9, padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }
const summaryGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 10, marginBottom: 16 }
const summaryCard: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,.07)', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }
const summaryIcon: React.CSSProperties = { width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(212,168,83,.14)', color: '#946F1F' }
const summaryLabel: React.CSSProperties = { color: 'rgba(10,12,16,.48)', fontSize: 11.5 }
const summaryValue: React.CSSProperties = { color: '#0A0C10', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 18, marginTop: 2 }
const layoutGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, .75fr)', gap: 16 }
const panel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(10,12,16,.07)', borderRadius: 16, padding: 18, minWidth: 0 }
const panelHeader: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }
const panelTitle: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 650, margin: 0, color: '#0A0C10' }
const panelHint: React.CSSProperties = { color: 'rgba(10,12,16,.48)', fontSize: 12, lineHeight: 1.5, margin: '4px 0 0' }
const searchInput: React.CSSProperties = { width: 190, border: '1px solid rgba(10,12,16,.12)', borderRadius: 9, padding: '8px 10px', outline: 'none', fontSize: 12.5 }
const tableWrap: React.CSSProperties = { overflowX: 'auto' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: 590 }
const th: React.CSSProperties = { textAlign: 'left', padding: '9px 8px', borderBottom: '1px solid rgba(10,12,16,.08)', color: 'rgba(10,12,16,.44)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 8px', borderBottom: '1px solid rgba(10,12,16,.055)', fontSize: 12.5, color: '#0A0C10', verticalAlign: 'top' }
const muted: React.CSSProperties = { color: 'rgba(10,12,16,.46)', fontSize: 11.5, marginTop: 3 }
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '5px 8px', background: 'rgba(212,168,83,.13)', color: '#72551D', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }
const statusPill: React.CSSProperties = { display: 'inline-flex', borderRadius: 999, padding: '5px 8px', fontSize: 10.5, fontWeight: 700, textTransform: 'capitalize' }
const empty: React.CSSProperties = { padding: 24, textAlign: 'center', color: 'rgba(10,12,16,.42)', fontSize: 13 }
const managementGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }
const managementCard: React.CSSProperties = { background: '#F6F3EE', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }
const formInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(10,12,16,.13)', background: '#fff', borderRadius: 8, padding: '9px 10px', fontSize: 12.5, outline: 'none' }
const rateGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 8, padding: '9px 11px', background: '#0A0C10', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 650 }
const smallSelect: React.CSSProperties = { border: '1px solid rgba(10,12,16,.12)', borderRadius: 7, padding: '5px 6px', fontSize: 11.5, background: '#fff' }
const messageBox: React.CSSProperties = { marginTop: 12, padding: '9px 11px', borderRadius: 9, background: 'rgba(22,101,52,.08)', fontSize: 12.5 }
const errorBox: React.CSSProperties = { marginBottom: 16, padding: '10px 12px', color: '#991B1B', background: 'rgba(220,38,38,.08)', borderRadius: 10, fontSize: 13 }
