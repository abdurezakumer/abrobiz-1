import { useEffect, useState } from 'react'
import { Plus, Check, X, Github, ExternalLink, Pencil, Save, Sparkles } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../lib/authContext'
import { hasAdminPermission } from '../../lib/api/adminControl'
import { adminListAllPlans, createPlan, updatePlan } from '../../lib/api/plans'
import { listPaymentMethods, createPaymentMethod, updatePaymentMethod } from '../../lib/api/paymentMethods'
import { listBusinessCategories, createBusinessCategory, updateBusinessCategory } from '../../lib/api/businessCategories'
import { categoryIcon, CATEGORY_ICONS } from '../../lib/icons'
import { adminListTemplates, importTemplate, setTemplateActive } from '../../lib/api/templates'
import type { Plan, PaymentMethod, BusinessCategory, Template } from '../../types'
import { safeHttpsUrl, safeImageUrl } from '../../lib/safeUrl'
import { friendlyError } from '../../lib/errors'
import { formatEtb } from '../../lib/planPricing'

type Tab = 'plans' | 'methods' | 'categories' | 'templates'

export default function AdminSettings({ initialTab = 'plans', pricingOnly = false }: { initialTab?: Tab; pricingOnly?: boolean }) {
  const { profile } = useAuth()
  const canManagePlans = hasAdminPermission(profile, 'plans.manage')
  const availableTabs: Tab[] = pricingOnly ? ['plans'] : [ ...(canManagePlans ? ['plans' as const] : []), 'methods', 'categories', 'templates' ]
  const [tab, setTab] = useState<Tab>(availableTabs.includes(initialTab) ? initialTab : availableTabs[0] ?? 'templates')

  return (
    <AdminLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Settings</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 20 }}>{pricingOnly ? 'Manage live monthly, annual, and promotional pricing from one secure control surface.' : 'Configure pricing, payment methods, business verticals, and storefront templates.'}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {availableTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 13, padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 500,
              background: tab === t ? '#0A0C10' : '#fff', color: tab === t ? '#fff' : '#0A0C10',
              textTransform: 'capitalize', boxShadow: tab === t ? 'none' : '0 0 0 1px rgba(10,12,16,0.08)',
            }}
          >
            {t === 'methods' ? 'Payment methods' : t}
          </button>
        ))}
      </div>

      {tab === 'plans' && canManagePlans && <PlansTabV2 />}
      {tab === 'methods' && <MethodsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'templates' && <TemplatesTab />}
    </AdminLayout>
  )
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    adminListTemplates().then(setTemplates).catch(err => setError(friendlyError(err))).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setImporting(true)
    try {
      await importTemplate(repoUrl)
      setRepoUrl('')
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Github size={17} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>Add from GitHub</div>
      </div>
      <p style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.55)', lineHeight: 1.55, marginBottom: 12 }}>
        Paste a public repository link. For custom colors and labels, add an optional <code>template.json</code> file at the repository root.
      </p>
      <form onSubmit={handleImport} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input required type="url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/template" style={{ ...formInput, flex: '1 1 300px' }} />
        <button type="submit" disabled={importing} style={saveBtn}>{importing ? 'Importing…' : 'Import template'}</button>
      </form>
      <p style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.42)', marginTop: 9 }}>
        Supported manifest fields: <code>slug</code>, <code>name</code>, <code>description</code>, <code>previewUrl</code>, and <code>config</code> ({'{'}bg, card, text, textDim, border, heroBg, visualStyle{'}'}).
      </p>
      {error && <div style={{ color: '#DC2626', background: 'rgba(220,38,38,0.07)', padding: '9px 11px', borderRadius: 9, fontSize: 12.5, marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 22 }}>
        {loading ? <div style={{ color: 'rgba(10,12,16,0.45)', fontSize: 13 }}>Loading…</div> : templates.map(template => (
          <div key={template.id} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 34, borderRadius: 7, background: safeImageUrl(template.previewUrl) ? `url("${safeImageUrl(template.previewUrl)}") center/cover` : template.config.bg ?? '#F6F3EE', border: '1px solid rgba(10,12,16,0.08)' }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{template.name} {template.isBuiltin && <span style={{ fontSize: 10.5, color: 'rgba(10,12,16,0.4)', fontWeight: 400 }}>built-in</span>}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.45)' }}>{template.slug}{safeHttpsUrl(template.repoUrl) ? <a href={safeHttpsUrl(template.repoUrl) ?? undefined} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: '#946F1F' }} aria-label={`Open ${template.name} repository`}><ExternalLink size={11} /></a> : null}</div>
              </div>
            </div>
            <ToggleActive active={template.isActive} onToggle={async () => { await setTemplateActive(template.id, !template.isActive); load() }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Retained for backwards compatibility with older local admin bundles.
// The live settings route uses PlansTabV2 below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [form, setForm] = useState({ name: '', slug: '', priceEtb: 0, features: '', bookings: false, ordering: false, reviews: false, aiCopy: false })
  const [showForm, setShowForm] = useState(false)

  function load() { adminListAllPlans().then(setPlans) }
  useEffect(load, [])

  async function handleCreate() {
    if (!form.name || !form.slug) return
    await createPlan({
      slug: form.slug, name: form.name, priceEtb: form.priceEtb, billingInterval: 'month',
      features: form.features.split(',').map(f => f.trim()).filter(Boolean),
      featureFlags: { bookings: form.bookings, ordering: form.ordering, reviews: form.reviews, aiCopy: form.aiCopy },
    })
    setForm({ name: '', slug: '', priceEtb: 0, features: '', bookings: false, ordering: false, reviews: false, aiCopy: false })
    setShowForm(false)
    load()
  }

  async function toggleFlag(plan: Plan, flag: keyof Plan['featureFlags']) {
    await updatePlan(plan.id, { featureFlags: { ...plan.featureFlags, [flag]: !plan.featureFlags[flag] } })
    load()
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 20 }}>
      {plans.filter(p => !p.isTrial).map(plan => (
        <div key={plan.id} style={{ ...rowStyle, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{plan.name} <span style={{ color: 'rgba(10,12,16,0.4)', fontWeight: 400 }}>({plan.slug})</span></div>
            <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>{plan.priceEtb} ETB/{plan.billingInterval} · {plan.features.join(', ')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {(['bookings', 'ordering', 'reviews', 'aiCopy'] as const).map(flag => (
              <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'rgba(10,12,16,0.55)', cursor: 'pointer', textTransform: 'capitalize' }}>
                <input type="checkbox" checked={!!plan.featureFlags[flag]} onChange={() => toggleFlag(plan, flag)} style={{ width: 13, height: 13 }} />
                {flag === 'aiCopy' ? 'AI copy' : flag}
              </label>
            ))}
            <ToggleActive active={plan.isActive} onToggle={async () => { await updatePlan(plan.id, { isActive: !plan.isActive }); load() }} />
          </div>
        </div>
      ))}

      {showForm ? (
        <div style={{ marginTop: 14, padding: 14, background: '#F6F3EE', borderRadius: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} style={formInput} />
            <input placeholder="Price (ETB/mo)" type="number" value={form.priceEtb || ''} onChange={e => setForm({ ...form, priceEtb: parseFloat(e.target.value) || 0 })} style={formInput} />
          </div>
          <input placeholder="Features, comma separated" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} style={{ ...formInput, width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            {(['bookings', 'ordering', 'reviews', 'aiCopy'] as const).map(flag => (
              <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(10,12,16,0.6)', cursor: 'pointer', textTransform: 'capitalize' }}>
                <input type="checkbox" checked={form[flag]} onChange={e => setForm({ ...form, [flag]: e.target.checked })} style={{ width: 14, height: 14 }} />
                {flag === 'aiCopy' ? 'AI copy' : flag}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={saveBtn}>Add plan</button>
            <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={addRowBtn}><Plus size={14} /> Add plan</button>
      )}
    </div>
  )
}

type PricingForm = {
  name: string; slug: string; monthlyPriceEtb: number; annualPriceEtb: number; features: string
  bookings: boolean; ordering: boolean; reviews: boolean; aiCopy: boolean
  discountType: 'none' | 'percent' | 'fixed'; discountValue: number; discountLabel: string; discountStartsAt: string; discountEndsAt: string
}

function blankPricingForm(): PricingForm {
  return { name: '', slug: '', monthlyPriceEtb: 0, annualPriceEtb: 0, features: '', bookings: false, ordering: false, reviews: false, aiCopy: false, discountType: 'none', discountValue: 0, discountLabel: '', discountStartsAt: '', discountEndsAt: '' }
}

function pricingFormFrom(plan: Plan): PricingForm {
  const monthly = plan.monthlyPriceEtb ?? plan.priceEtb
  return { name: plan.name, slug: plan.slug, monthlyPriceEtb: monthly, annualPriceEtb: plan.annualPriceEtb ?? monthly * 12, features: plan.features.join(', '), bookings: !!plan.featureFlags.bookings, ordering: !!plan.featureFlags.ordering, reviews: !!plan.featureFlags.reviews, aiCopy: !!plan.featureFlags.aiCopy, discountType: plan.discountType ?? 'none', discountValue: plan.discountValue ?? 0, discountLabel: plan.discountLabel ?? '', discountStartsAt: plan.discountStartsAt?.slice(0, 16) ?? '', discountEndsAt: plan.discountEndsAt?.slice(0, 16) ?? '' }
}

function pricingPayload(form: PricingForm) {
  return { name: form.name.trim(), slug: form.slug.trim(), priceEtb: form.monthlyPriceEtb, billingInterval: 'month' as const, monthlyPriceEtb: form.monthlyPriceEtb, annualPriceEtb: form.annualPriceEtb, features: form.features.split(',').map(item => item.trim()).filter(Boolean), featureFlags: { bookings: form.bookings, ordering: form.ordering, reviews: form.reviews, aiCopy: form.aiCopy }, discountType: form.discountType, discountValue: form.discountValue, discountLabel: form.discountLabel.trim(), discountStartsAt: form.discountStartsAt ? new Date(form.discountStartsAt).toISOString() : null, discountEndsAt: form.discountEndsAt ? new Date(form.discountEndsAt).toISOString() : null }
}

function PlansTabV2() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [form, setForm] = useState<PricingForm>(blankPricingForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { setPlans(await adminListAllPlans()) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function savePlan(plan?: Plan) {
    if (!form.name.trim() || form.monthlyPriceEtb < 0 || form.annualPriceEtb < 0) { setError('Enter a name and valid monthly and annual prices.'); return }
    setSaving(true); setError('')
    try {
      if (plan) await updatePlan(plan.id, pricingPayload(form))
      else await createPlan(pricingPayload(form))
      setEditingId(null); setAdding(false); setForm(blankPricingForm()); await load()
    } catch (err) { setError(friendlyError(err)) } finally { setSaving(false) }
  }

  function editor(plan?: Plan) {
    const current = form
    const set = (patch: Partial<PricingForm>) => setForm(previous => ({ ...previous, ...patch }))
    return <div style={pricingEditor}>
      <div style={pricingGrid}>
        <label style={fieldLabel}>Plan name<input value={current.name} onChange={event => set({ name: event.target.value, ...(plan ? {} : { slug: event.target.value.toLowerCase().replace(/\s+/g, '-') }) })} style={formInput} /></label>
        <label style={fieldLabel}>Slug<input value={current.slug} disabled={!!plan} onChange={event => set({ slug: event.target.value })} style={formInput} /></label>
        <label style={fieldLabel}>Monthly price (ETB)<input type="number" min="0" step="0.01" value={current.monthlyPriceEtb || ''} onChange={event => set({ monthlyPriceEtb: Number(event.target.value) || 0 })} style={formInput} /></label>
        <label style={fieldLabel}>Annual price (ETB)<input type="number" min="0" step="0.01" value={current.annualPriceEtb || ''} onChange={event => set({ annualPriceEtb: Number(event.target.value) || 0 })} style={formInput} /></label>
      </div>
      <div style={pricingGrid}>
        <label style={fieldLabel}>Event discount<select value={current.discountType} onChange={event => set({ discountType: event.target.value as PricingForm['discountType'] })} style={formInput}><option value="none">No event discount</option><option value="percent">Percentage discount</option><option value="fixed">Fixed ETB discount</option></select></label>
        <label style={fieldLabel}>Discount value<input type="number" min="0" step="0.01" value={current.discountValue || ''} onChange={event => set({ discountValue: Number(event.target.value) || 0 })} style={formInput} /></label>
        <label style={fieldLabel}>Offer label<input value={current.discountLabel} placeholder="e.g. New season" onChange={event => set({ discountLabel: event.target.value })} style={formInput} /></label>
        <label style={fieldLabel}>Starts<input type="datetime-local" value={current.discountStartsAt} onChange={event => set({ discountStartsAt: event.target.value })} style={formInput} /></label>
        <label style={fieldLabel}>Ends<input type="datetime-local" value={current.discountEndsAt} onChange={event => set({ discountEndsAt: event.target.value })} style={formInput} /></label>
      </div>
      <label style={fieldLabel}>Features<input value={current.features} placeholder="Features, comma separated" onChange={event => set({ features: event.target.value })} style={{ ...formInput, width: '100%' }} /></label>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>{(['bookings', 'ordering', 'reviews', 'aiCopy'] as const).map(flag => <label key={flag} style={checkLabel}><input type="checkbox" checked={current[flag]} onChange={event => set({ [flag]: event.target.checked })} />{flag === 'aiCopy' ? 'AI copy' : flag}</label>)}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button type="button" disabled={saving} onClick={() => void savePlan(plan)} style={saveBtn}><Save size={14} /> {saving ? 'Saving…' : plan ? 'Save pricing' : 'Add plan'}</button><button type="button" onClick={() => { setAdding(false); setEditingId(null) }} style={cancelBtn}>Cancel</button></div>
    </div>
  }

  return <div style={pricingPanel}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 8 }}><div><div style={{ fontSize: 17, fontWeight: 750 }}>Pricing studio</div><div style={{ color: 'rgba(10,12,16,0.52)', fontSize: 12.5, marginTop: 4 }}>Monthly, annual, and event pricing are live database values used by checkout.</div></div><Sparkles size={20} color="#D4A853" /></div>
    {error && <div style={adminError}>{error}</div>}
    {loading ? <div style={{ padding: '24px 0', color: 'rgba(10,12,16,0.5)' }}>Loading pricing…</div> : plans.filter(plan => !plan.isTrial).map(plan => {
      const monthly = plan.monthlyPriceEtb ?? plan.priceEtb
      const annual = plan.annualPriceEtb ?? monthly * 12
      const annualSaving = Math.max(0, monthly * 12 - annual)
      return <div key={plan.id} style={pricingCard}>{editingId === plan.id ? editor(plan) : <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}><div><div style={{ fontSize: 15, fontWeight: 750 }}>{plan.name} <span style={{ color: 'rgba(10,12,16,0.4)', fontWeight: 450 }}>/{plan.slug}</span></div><div style={{ color: 'rgba(10,12,16,0.5)', fontSize: 12, marginTop: 5 }}>{plan.features.join(' · ') || 'No feature list yet'}</div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ToggleActive active={plan.isActive} onToggle={async () => { await updatePlan(plan.id, { isActive: !plan.isActive }); void load() }} /><button type="button" onClick={() => { setForm(pricingFormFrom(plan)); setEditingId(plan.id); setAdding(false) }} style={iconButton} aria-label={`Edit ${plan.name}`}><Pencil size={14} /></button></div></div>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 15 }}><div><div style={metricLabel}>Monthly</div><strong>{formatEtb(monthly)} ETB</strong></div><div><div style={metricLabel}>Annual</div><strong>{formatEtb(annual)} ETB</strong>{annualSaving > 0 && <span style={savingPill}>Save {formatEtb(annualSaving)}</span>}</div><div><div style={metricLabel}>Event offer</div><strong>{plan.discountType && plan.discountType !== 'none' ? plan.discountLabel || `${plan.discountValue}${plan.discountType === 'percent' ? '%' : ' ETB'} off` : 'None'}</strong></div></div>
        <div style={{ display: 'flex', gap: 13, flexWrap: 'wrap', marginTop: 12 }}>{(['bookings', 'ordering', 'reviews', 'aiCopy'] as const).map(flag => <label key={flag} style={checkLabel}><input type="checkbox" checked={!!plan.featureFlags[flag]} onChange={async () => { await updatePlan(plan.id, { featureFlags: { ...plan.featureFlags, [flag]: !plan.featureFlags[flag] } }); void load() }} />{flag === 'aiCopy' ? 'AI copy' : flag}</label>)}</div>
      </>}</div>
    })}
    {adding ? editor() : <button type="button" onClick={() => { setForm(blankPricingForm()); setAdding(true); setEditingId(null) }} style={addRowBtn}><Plus size={14} /> Add plan</button>}
  </div>
}

function MethodsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [form, setForm] = useState({ name: '', accountName: '', accountNumber: '', instructions: '' })
  const [showForm, setShowForm] = useState(false)

  function load() { listPaymentMethods(false).then(setMethods) }
  useEffect(load, [])

  async function handleCreate() {
    if (!form.name || !form.accountNumber) return
    await createPaymentMethod(form)
    setForm({ name: '', accountName: '', accountNumber: '', instructions: '' })
    setShowForm(false)
    load()
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 20 }}>
      {methods.map(m => (
        <div key={m.id} style={rowStyle}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>{m.accountName} — {m.accountNumber}</div>
          </div>
          <ToggleActive active={m.isActive} onToggle={async () => { await updatePaymentMethod(m.id, { isActive: !m.isActive }); load() }} />
        </div>
      ))}

      {showForm ? (
        <div style={{ marginTop: 14, padding: 14, background: '#F6F3EE', borderRadius: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <input placeholder="Method name (e.g. Telebirr)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={formInput} />
            <input placeholder="Account name" value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} style={formInput} />
            <input placeholder="Account number" value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} style={formInput} />
          </div>
          <input placeholder="Instructions for owners" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} style={{ ...formInput, width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={saveBtn}>Add method</button>
            <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={addRowBtn}><Plus size={14} /> Add payment method</button>
      )}
    </div>
  )
}

function CategoriesTab() {
  const [categories, setCategories] = useState<BusinessCategory[]>([])
  const [form, setForm] = useState({ label: '', slug: '', itemLabel: '', categoryLabel: '', icon: 'Store' })
  const [showForm, setShowForm] = useState(false)

  function load() { listBusinessCategories().then(setCategories) }
  useEffect(load, [])

  async function handleCreate() {
    if (!form.label || !form.slug) return
    await createBusinessCategory(form)
    setForm({ label: '', slug: '', itemLabel: '', categoryLabel: '', icon: 'Store' })
    setShowForm(false)
    load()
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 20 }}>
      <p style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.5)', marginBottom: 14 }}>
        These are the business types owners choose from when setting up their site.
      </p>
      {categories.map(cat => {
        const Icon = categoryIcon(cat.icon)
        return (
          <div key={cat.id} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={16} color="#D4A853" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{cat.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.45)' }}>{cat.itemLabel} · {cat.categoryLabel}</div>
              </div>
            </div>
            <ToggleActive active={cat.isActive} onToggle={async () => { await updateBusinessCategory(cat.id, { isActive: !cat.isActive }); load() }} />
          </div>
        )
      })}

      {showForm ? (
        <div style={{ marginTop: 14, padding: 14, background: '#F6F3EE', borderRadius: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <input placeholder="Label (e.g. Hotel)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} style={formInput} />
            <input placeholder="Item label (e.g. Room)" value={form.itemLabel} onChange={e => setForm({ ...form, itemLabel: e.target.value })} style={formInput} />
            <input placeholder="Category label (e.g. Category)" value={form.categoryLabel} onChange={e => setForm({ ...form, categoryLabel: e.target.value })} style={formInput} />
            <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={formInput}>
              {Object.keys(CATEGORY_ICONS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={saveBtn}>Add category</button>
            <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={addRowBtn}><Plus size={14} /> Add business type</button>
      )}
    </div>
  )
}

function ToggleActive({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 999,
        padding: '5px 11px', cursor: 'pointer',
        background: active ? 'rgba(22,163,74,0.1)' : 'rgba(10,12,16,0.06)', color: active ? '#16A34A' : 'rgba(10,12,16,0.45)',
      }}
    >
      {active ? <Check size={12} /> : <X size={12} />} {active ? 'Active' : 'Inactive'}
    </button>
  )
}

const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid rgba(10,12,16,0.05)' }
const formInput: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
const saveBtn: React.CSSProperties = { background: '#D4A853', color: '#0A0C10', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const cancelBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'rgba(10,12,16,0.5)', fontSize: 13, cursor: 'pointer' }
const addRowBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed rgba(10,12,16,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: 'rgba(10,12,16,0.6)', cursor: 'pointer', marginTop: 12, width: '100%', justifyContent: 'center' }
const pricingPanel: React.CSSProperties = { background: '#fff', borderRadius: 18, border: '1px solid rgba(10,12,16,0.06)', padding: 20 }
const pricingCard: React.CSSProperties = { border: '1px solid rgba(10,12,16,0.08)', borderRadius: 15, padding: 16, marginTop: 12, background: '#fff' }
const pricingEditor: React.CSSProperties = { marginTop: 4, padding: 15, background: '#F6F3EE', borderRadius: 13 }
const pricingGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'rgba(10,12,16,0.62)' }
const checkLabel: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(10,12,16,0.62)', textTransform: 'capitalize' }
const metricLabel: React.CSSProperties = { color: 'rgba(10,12,16,0.43)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }
const savingPill: React.CSSProperties = { display: 'inline-flex', marginLeft: 7, borderRadius: 999, padding: '3px 6px', background: 'rgba(22,101,52,0.1)', color: '#166534', fontSize: 10, fontWeight: 700 }
const iconButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 8, background: '#fff', color: '#0A0C10', cursor: 'pointer' }
const adminError: React.CSSProperties = { color: '#991B1B', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '9px 11px', fontSize: 12.5, margin: '12px 0' }
