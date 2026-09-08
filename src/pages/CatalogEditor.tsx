import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Plus, Trash2, Eye, EyeOff, Image as ImageIcon, X, Pencil } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'
import { listCategories, createCategory, updateCategory, deleteCategory } from '../lib/api/categories'
import { listItems, createItem, updateItem, deleteItem, uploadItemImage } from '../lib/api/items'
import type { Category, Item, ItemTranslations, Language } from '../types'
import { safeImageUrl } from '../lib/safeUrl'
import { friendlyError } from '../lib/errors'
import { IMAGE_UPLOAD_ACCEPT, takeSelectedFile } from '../lib/fileUpload'

export default function CatalogEditor() {
  const { business } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [labels, setLabels] = useState({ itemLabel: 'Item', categoryLabel: 'Category' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!business) return
    Promise.all([listCategories(business.id), listItems(business.id)]).then(([cats, its]) => {
      setCategories(cats)
      setItems(its)
      setSelectedCategoryId(cats[0]?.id ?? null)
      setLoading(false)
    })
    if (business.categoryId) {
      supabase.from('business_categories').select('item_label, category_label').eq('id', business.categoryId).maybeSingle()
        .then(({ data }) => { if (data) setLabels({ itemLabel: data.item_label, categoryLabel: data.category_label }) })
    }
  }, [business])

  async function handleAddCategory() {
    if (!business || !newCategoryName.trim()) return
    const cat = await createCategory(business.id, newCategoryName.trim())
    setCategories(prev => [...prev, cat])
    setSelectedCategoryId(cat.id)
    setNewCategoryName('')
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm(`Delete this ${labels.categoryLabel.toLowerCase()} and all its ${labels.itemLabel.toLowerCase()}s?`)) return
    await deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setItems(prev => prev.filter(i => i.categoryId !== id))
    if (selectedCategoryId === id) setSelectedCategoryId(categories[0]?.id ?? null)
  }

  async function handleToggleHidden(cat: Category) {
    await updateCategory(cat.id, { isHidden: !cat.isHidden })
    setCategories(prev => prev.map(c => (c.id === cat.id ? { ...c, isHidden: !c.isHidden } : c)))
  }

  if (loading) return <DashboardLayout><div style={{ color: 'rgba(10,12,16,0.4)' }}>Loading…</div></DashboardLayout>

  const categoryItems = items.filter(i => i.categoryId === selectedCategoryId)

  return (
    <DashboardLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>
        {labels.itemLabel === 'Service' ? 'Services' : labels.itemLabel === 'Product' ? 'Products' : 'Menu'}
      </h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>
        Manage your {labels.categoryLabel.toLowerCase()}s and {labels.itemLabel.toLowerCase()}s.
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Category list */}
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 12 }}>
          {categories.map(cat => (
            <div
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px',
                borderRadius: 9, cursor: 'pointer', marginBottom: 2,
                background: selectedCategoryId === cat.id ? '#F6F3EE' : 'transparent',
              }}
            >
              <span style={{ fontSize: 13.5, color: cat.isHidden ? 'rgba(10,12,16,0.35)' : '#0A0C10', fontWeight: selectedCategoryId === cat.id ? 600 : 500 }}>
                {cat.name}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={e => { e.stopPropagation(); handleToggleHidden(cat) }} style={miniBtn} title={cat.isHidden ? 'Hidden from site' : 'Visible on site'}>
                  {cat.isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id) }} style={miniBtn}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              placeholder={`New ${labels.categoryLabel.toLowerCase()}`}
              style={{ flex: 1, fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(10,12,16,0.1)', outline: 'none' }}
            />
            <button onClick={handleAddCategory} style={{ ...miniBtn, background: '#0A0C10', color: '#fff', width: 32, height: 32 }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, minWidth: 280 }}>
          {business && selectedCategoryId && (
            <ItemsGrid
              businessId={business.id}
              categoryId={selectedCategoryId}
              languages={business.languages}
              itemLabel={labels.itemLabel}
              items={categoryItems}
              onChange={setItems}
              allItems={items}
              currency={business.currency}
            />
          )}
          {categories.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(10,12,16,0.4)', fontSize: 14 }}>
              Add a {labels.categoryLabel.toLowerCase()} on the left to get started.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function ItemsGrid({
  businessId, categoryId, languages, itemLabel, items, allItems, onChange, currency,
}: {
  businessId: string
  categoryId: string
  languages: Language[]
  itemLabel: string
  items: Item[]
  allItems: Item[]
  onChange: (items: Item[]) => void
  currency: string
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setEditingId('new')} style={addBtn}>
          <Plus size={15} /> Add {itemLabel.toLowerCase()}
        </button>
      </div>

      <AnimatePresence>
        {editingId === 'new' && (
          <ItemForm
            businessId={businessId}
            categoryId={categoryId}
            languages={languages}
            itemLabel={itemLabel}
            onCancel={() => setEditingId(null)}
            onSaved={item => { onChange([...allItems, item]); setEditingId(null) }}
          />
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {items.map(item => (
          <div key={item.id}>
            {editingId === item.id ? (
              <ItemForm
                businessId={businessId}
                categoryId={categoryId}
                languages={languages}
                itemLabel={itemLabel}
                existing={item}
                onCancel={() => setEditingId(null)}
                onSaved={updated => { onChange(allItems.map(i => (i.id === updated.id ? updated : i))); setEditingId(null) }}
              />
            ) : (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(10,12,16,0.06)', overflow: 'hidden', opacity: item.isAvailable ? 1 : 0.55 }}>
                <div style={{ height: 120, background: safeImageUrl(item.imageUrl) ? `url("${safeImageUrl(item.imageUrl)}") center/cover` : '#F6F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {!safeImageUrl(item.imageUrl) && <ImageIcon size={22} color="rgba(10,12,16,0.2)" />}
                  {item.isFeatured && (
                    <span style={{ position: 'absolute', top: 8, left: 8, background: '#D4A853', color: '#0A0C10', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6 }}>
                      FEATURED
                    </span>
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0A0C10' }}>{item.translations.en?.name || 'Untitled'}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#D4A853', whiteSpace: 'nowrap' }}>{item.price} {currency}</span>
                  </div>
                  {item.translations.en?.description && (
                    <p style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.5)', marginTop: 4, lineHeight: 1.4 }}>{item.translations.en.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button onClick={() => setEditingId(item.id)} style={miniBtn}><Pencil size={13} /></button>
                    <button
                      onClick={async () => { await updateItem(item.id, { isAvailable: !item.isAvailable }); onChange(allItems.map(i => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i))) }}
                      style={miniBtn}
                    >
                      {item.isAvailable ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      onClick={async () => { if (confirm('Delete this item?')) { await deleteItem(item.id); onChange(allItems.filter(i => i.id !== item.id)) } }}
                      style={miniBtn}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && editingId !== 'new' && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>
          No {itemLabel.toLowerCase()}s here yet.
        </div>
      )}
    </div>
  )
}

function ItemForm({
  businessId, categoryId, languages, itemLabel, existing, onCancel, onSaved,
}: {
  businessId: string
  categoryId: string
  languages: Language[]
  itemLabel: string
  existing?: Item
  onCancel: () => void
  onSaved: (item: Item) => void
}) {
  const [translations, setTranslations] = useState<ItemTranslations>(existing?.translations ?? {})
  const [price, setPrice] = useState(existing?.price ?? 0)
  const [activeLang, setActiveLang] = useState<Language>('en')
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl)
  const [isFeatured, setIsFeatured] = useState(existing?.isFeatured ?? false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleImage(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadItemImage(businessId, file)
      setImageUrl(url)
    } catch (error) {
      setUploadError(friendlyError(error))
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (existing) {
        await updateItem(existing.id, { price, translations, imageUrl, isFeatured })
        onSaved({ ...existing, price, translations, imageUrl, isFeatured })
      } else {
        const item = await createItem({ businessId, categoryId, price, translations })
        if (imageUrl || isFeatured) await updateItem(item.id, { imageUrl, isFeatured })
        onSaved({ ...item, imageUrl, isFeatured })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #D4A853', padding: 16, marginBottom: 14, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{existing ? `Edit ${itemLabel.toLowerCase()}` : `New ${itemLabel.toLowerCase()}`}</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
      </div>

      {languages.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {languages.map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              style={{
                fontSize: 12, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: activeLang === lang ? '#0A0C10' : '#F6F3EE', color: activeLang === lang ? '#fff' : '#0A0C10',
              }}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={translations[activeLang]?.name ?? ''}
          onChange={e => setTranslations(prev => ({ ...prev, [activeLang]: { name: e.target.value, description: prev[activeLang]?.description ?? '' } }))}
          placeholder={`${itemLabel} name (${activeLang})`}
          style={formInput}
        />
        <textarea
          value={translations[activeLang]?.description ?? ''}
          onChange={e => setTranslations(prev => ({ ...prev, [activeLang]: { name: prev[activeLang]?.name ?? '', description: e.target.value } }))}
          placeholder="Short description (optional)"
          rows={2}
          style={{ ...formInput, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="number" step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} style={{ ...formInput, width: 120 }} placeholder="Price" />
          <label style={{ fontSize: 12.5, color: '#0A0C10', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            {safeImageUrl(imageUrl) && <img src={safeImageUrl(imageUrl) ?? undefined} alt="" width={32} height={32} loading="lazy" decoding="async" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
            <span style={{ padding: '8px 12px', borderRadius: 8, background: '#F6F3EE', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {!uploading && <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-flex' }}><ArrowUp size={13} /></motion.span>}
              {uploading ? 'Uploading…' : imageUrl ? 'Change photo' : 'Add photo'}
            </span>
            <input type="file" accept={IMAGE_UPLOAD_ACCEPT} hidden onChange={e => { const file = takeSelectedFile(e.currentTarget); if (file) void handleImage(file) }} />
          </label>
        </div>
        {uploadError && <div style={{ color: '#B91C1C', fontSize: 12.5 }}>{uploadError}</div>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#0A0C10', cursor: 'pointer' }}>
          <input type="checkbox" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} style={{ width: 15, height: 15 }} />
          Feature on homepage
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel} style={{ ...miniBtn, width: 'auto', padding: '8px 14px' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !translations.en?.name} style={{ ...addBtn, opacity: saving || !translations.en?.name ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

const miniBtn: React.CSSProperties = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
  border: 'none', background: 'rgba(10,12,16,0.06)', cursor: 'pointer', color: '#0A0C10',
}
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: '#D4A853', color: '#0A0C10', border: 'none',
  borderRadius: 9, padding: '9px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
}
const formInput: React.CSSProperties = {
  border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
}
