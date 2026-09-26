import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Plus, Trash2, Eye, EyeOff, Image as ImageIcon, X, Pencil, AlertCircle, CheckCircle2, Images, Upload } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'
import { listCategories, createCategory, updateCategory, deleteCategory } from '../lib/api/categories'
import { listItems, createItem, updateItem, deleteItem, uploadItemImage } from '../lib/api/items'
import type { Category, Item, ItemTranslations, Language } from '../types'
import { safeImageUrl } from '../lib/safeUrl'
import { friendlyError } from '../lib/errors'
import { fileInputStyle, IMAGE_UPLOAD_ACCEPT, takeSelectedFile } from '../lib/fileUpload'

export default function CatalogEditor() {
  const { business } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [labels, setLabels] = useState({ itemLabel: 'Item', categoryLabel: 'Category' })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)

  useEffect(() => {
    if (!business) return
    let active = true
    setLoadError('')
    void Promise.all([listCategories(business.id), listItems(business.id)]).then(([cats, its]) => {
      if (!active) return
      setCategories(cats)
      setItems(its)
      setSelectedCategoryId(cats[0]?.id ?? null)
    }).catch(() => {
      if (active) setLoadError('Your catalog could not be loaded. Please refresh and try again.')
    }).finally(() => { if (active) setLoading(false) })
    if (business.categoryId) {
      supabase.from('business_categories').select('item_label, category_label').eq('id', business.categoryId).maybeSingle()
        .then(({ data }) => { if (data) setLabels({ itemLabel: data.item_label, categoryLabel: data.category_label }) })
    }
    return () => { active = false }
  }, [business])

  async function handleAddCategory() {
    if (!business || !newCategoryName.trim()) return
    setCategorySaving(true)
    setActionError('')
    try {
      const cat = await createCategory(business.id, newCategoryName.trim())
      setCategories(prev => [...prev, cat])
      setSelectedCategoryId(cat.id)
      setNewCategoryName('')
    } catch (error) {
      setActionError(friendlyError(error))
    } finally {
      setCategorySaving(false)
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm(`Delete this ${labels.categoryLabel.toLowerCase()} and all its ${labels.itemLabel.toLowerCase()}s?`)) return
    setActionError('')
    try {
      await deleteCategory(id)
      const nextCategories = categories.filter(c => c.id !== id)
      setCategories(nextCategories)
      setItems(prev => prev.filter(i => i.categoryId !== id))
      if (selectedCategoryId === id) setSelectedCategoryId(nextCategories[0]?.id ?? null)
    } catch (error) {
      setActionError(friendlyError(error))
    }
  }

  async function handleToggleHidden(cat: Category) {
    setActionError('')
    try {
      await updateCategory(cat.id, { isHidden: !cat.isHidden })
      setCategories(prev => prev.map(c => (c.id === cat.id ? { ...c, isHidden: !c.isHidden } : c)))
    } catch (error) {
      setActionError(friendlyError(error))
    }
  }

  if (loading) return <DashboardLayout><div style={catalogSkeleton}><div style={skeletonLineWide} /><div style={skeletonLine} /><div style={skeletonLineShort} /></div></DashboardLayout>
  if (loadError) return <DashboardLayout><div role="alert" style={catalogError}><AlertCircle size={18} /><span>{loadError}</span></div></DashboardLayout>

  const categoryItems = items.filter(i => i.categoryId === selectedCategoryId)

  return (
    <DashboardLayout>
      <style>{'@media(max-width:700px){.catalog-layout{flex-direction:column!important}.catalog-sidebar{width:100%!important}.catalog-category-list{display:flex;overflow-x:auto;padding-bottom:4px}.catalog-category-list>div{min-width:156px}.catalog-section-header{align-items:flex-start!important;flex-direction:column!important}}'}</style>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>
        {labels.itemLabel === 'Service' ? 'Services' : labels.itemLabel === 'Product' ? 'Products' : 'Menu'}
      </h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>
        Build a clean, organized {labels.categoryLabel.toLowerCase()} and {labels.itemLabel.toLowerCase()} catalog for your customers.
      </p>
      {actionError && <div role="alert" style={catalogError}><AlertCircle size={16} /><span>{actionError}</span><button type="button" onClick={() => setActionError('')} style={dismissError}><X size={14} /></button></div>}

      <div className="catalog-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Category list */}
        <div className="catalog-sidebar" style={{ width: 240, flexShrink: 0, background: '#fff', borderRadius: 18, border: '1px solid rgba(10,12,16,0.06)', padding: 14, boxShadow: '0 8px 24px rgba(10,12,16,0.035)' }}>
          <div style={sidebarHeading}><div><div style={sidebarEyebrow}>ORGANIZE</div><strong>{labels.categoryLabel}s</strong></div><span style={countPill}>{categories.length}</span></div>
          <div className="catalog-category-list">
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
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAddCategory() }}
              placeholder={`New ${labels.categoryLabel.toLowerCase()}`}
              disabled={categorySaving}
              style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(10,12,16,0.1)', outline: 'none' }}
            />
            <button type="button" onClick={() => void handleAddCategory()} disabled={categorySaving} aria-label={`Add ${labels.categoryLabel.toLowerCase()}`} style={{ ...miniBtn, background: '#0A0C10', color: '#fff', width: 34, height: 34, opacity: categorySaving ? 0.6 : 1 }}>
              <Plus size={14} />
            </button>
          </div>
          <div style={helperText}>Add a category first, then add items inside it.</div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, minWidth: 280 }}>
          {selectedCategoryId && <div className="catalog-section-header" style={catalogSectionHeader}><div><div style={sidebarEyebrow}>CURRENT SECTION</div><h2 style={catalogSectionTitle}>{categories.find(category => category.id === selectedCategoryId)?.name ?? labels.categoryLabel}</h2><span style={helperText}>{categoryItems.length} {labels.itemLabel.toLowerCase()}{categoryItems.length === 1 ? '' : 's'} in this section</span></div><span style={readyBadge}><CheckCircle2 size={13} /> Live editing</span></div>}
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
              <div style={{ fontSize: 32, marginBottom: 10 }}>✦</div>
              Add a {labels.categoryLabel.toLowerCase()} above to get started.
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
  const [batchOpen, setBatchOpen] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setBatchOpen(true)} style={batchBtn}>
          <Images size={15} /> Batch add
        </button>
        <button type="button" onClick={() => setEditingId('new')} style={addBtn}>
          <Plus size={15} /> Add {itemLabel.toLowerCase()}
        </button>
      </div>

      <AnimatePresence>
        {batchOpen && (
          <BatchItemForm
            businessId={businessId}
            categoryId={categoryId}
            itemLabel={itemLabel}
            onCancel={() => setBatchOpen(false)}
            onSaved={created => onChange([...allItems, ...created])}
          />
        )}
      </AnimatePresence>

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

type BatchItemRow = {
  id: string
  file: File
  previewUrl: string
  name: string
  description: string
  price: number
  imageUrl?: string
  itemId?: string
  progress: number
  status: 'queued' | 'uploading' | 'saved' | 'error'
  error?: string
}

function BatchItemForm({
  businessId, categoryId, itemLabel, onCancel, onSaved,
}: {
  businessId: string
  categoryId: string
  itemLabel: string
  onCancel: () => void
  onSaved: (items: Item[]) => void
}) {
  const [rows, setRows] = useState<BatchItemRow[]>([])
  const [isFeatured, setIsFeatured] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [complete, setComplete] = useState(false)
  const previewUrls = useRef(new Set<string>())

  useEffect(() => () => {
    previewUrls.current.forEach(url => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }, [])

  function addFiles(files: File[]) {
    setBatchError('')
    setComplete(false)
    const remaining = Math.max(0, 20 - rows.length)
    const accepted = files.slice(0, remaining)
    if (files.length > remaining) setBatchError('You can add up to 20 photos at a time.')
    const nextRows = accepted.map((file, index) => {
      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl,
        name: readableFileName(file.name),
        description: '',
        price: 0,
        progress: 0,
        status: 'queued' as const,
      }
    })
    setRows(previous => [...previous, ...nextRows])
  }

  function removeRow(id: string) {
    setRows(previous => {
      const row = previous.find(item => item.id === id)
      if (row) {
        URL.revokeObjectURL(row.previewUrl)
        previewUrls.current.delete(row.previewUrl)
      }
      return previous.filter(item => item.id !== id)
    })
  }

  function updateRow(id: string, patch: Partial<BatchItemRow>) {
    setRows(previous => previous.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  async function saveBatch() {
    const pendingRows = rows.filter(row => row.status !== 'saved')
    if (pendingRows.length === 0) {
      setComplete(true)
      return
    }
    const invalid = pendingRows.find(row => !row.name.trim() || !Number.isFinite(row.price) || row.price < 0)
    if (invalid) {
      setBatchError('Add a name and a valid price for every photo before saving.')
      return
    }

    setProcessing(true)
    setBatchError('')
    const created: Item[] = []
    for (const row of pendingRows) {
      updateRow(row.id, { status: 'uploading', progress: row.imageUrl ? 70 : 0, error: undefined })
      try {
        let imageUrl = row.imageUrl
        if (!imageUrl) {
          imageUrl = await uploadItemImage(businessId, row.file, progress => updateRow(row.id, { progress: Math.min(70, Math.round(progress * 0.7)) }))
          updateRow(row.id, { imageUrl, progress: 72 })
        }

        const translations = { en: { name: row.name.trim(), description: row.description.trim() } }
        let item: Item
        if (row.itemId) {
          await updateItem(row.itemId, { price: row.price, imageUrl, isFeatured, translations })
          item = { id: row.itemId, businessId, categoryId, imageUrl, price: row.price, isAvailable: true, isFeatured, sortOrder: 0, translations }
        } else {
          item = await createItem({ businessId, categoryId, price: row.price, translations })
          updateRow(row.id, { itemId: item.id, progress: 88 })
          await updateItem(item.id, { imageUrl, isFeatured })
          item = { ...item, imageUrl, isFeatured }
        }
        created.push(item)
        updateRow(row.id, { status: 'saved', progress: 100 })
      } catch (error) {
        updateRow(row.id, { status: 'error', error: friendlyError(error), progress: 0 })
      }
    }
    if (created.length > 0) onSaved(created)
    setComplete(created.length === pendingRows.length)
    setProcessing(false)
  }

  const savedCount = rows.filter(row => row.status === 'saved').length
  const failedCount = rows.filter(row => row.status === 'error').length

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #D4A853', padding: 16, marginBottom: 14, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 650 }}>Batch add {itemLabel.toLowerCase()}s</span>
          <p style={{ margin: '5px 0 0', color: 'rgba(10,12,16,0.5)', fontSize: 12.5, lineHeight: 1.45 }}>Choose up to 20 photos. Each photo becomes a new item that you can name and price before saving.</p>
        </div>
        <button type="button" onClick={onCancel} disabled={processing} aria-label="Close batch uploader" style={{ background: 'none', border: 'none', cursor: processing ? 'not-allowed' : 'pointer' }}><X size={16} /></button>
      </div>

      <label style={batchDropzone}>
        <Upload size={18} />
        <span>{rows.length > 0 ? 'Add more photos' : 'Choose multiple photos'}</span>
        <small>JPEG, PNG, WebP, or phone photo formats · max 20</small>
        <input
          type="file"
          accept={IMAGE_UPLOAD_ACCEPT}
          multiple
          disabled={processing}
          style={fileInputStyle}
          onClick={event => { event.currentTarget.value = '' }}
          onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; addFiles(files) }}
        />
      </label>

      {rows.length > 0 && (
        <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
          {rows.map(row => (
            <div key={row.id} style={batchRow}>
              <img src={row.previewUrl} alt="Selected item" style={batchPreview} />
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 7 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: 7 }}>
                  <input value={row.name} disabled={row.status === 'saved' || processing} onChange={event => updateRow(row.id, { name: event.target.value })} aria-label="Item name" placeholder={`${itemLabel} name`} style={formInput} />
                  <input type="number" min="0" step="0.01" value={row.price} disabled={row.status === 'saved' || processing} onChange={event => updateRow(row.id, { price: parseFloat(event.target.value) || 0 })} aria-label="Item price" placeholder="Price" style={formInput} />
                </div>
                <input value={row.description} disabled={row.status === 'saved' || processing} onChange={event => updateRow(row.id, { description: event.target.value })} aria-label="Item description" placeholder="Description (optional)" style={formInput} />
                {row.status === 'uploading' && <div role="progressbar" aria-label={`Uploading ${row.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.progress} style={batchProgressTrack}><div style={{ width: `${row.progress}%`, height: '100%', background: '#D4A853', transition: 'width 180ms ease' }} /></div>}
                {row.status === 'saved' && <span style={batchSaved}><CheckCircle2 size={13} /> Saved</span>}
                {row.error && <span style={batchFailed}><AlertCircle size={13} /> {row.error}</span>}
              </div>
              {row.status !== 'saved' && <button type="button" onClick={() => removeRow(row.id)} disabled={processing} aria-label={`Remove ${row.name || 'photo'}`} style={{ ...miniBtn, flexShrink: 0 }}><X size={13} /></button>}
            </div>
          ))}
        </div>
      )}

      {batchError && <div role="alert" style={{ color: '#B91C1C', fontSize: 12.5, marginTop: 10 }}>{batchError}</div>}
      {rows.length > 0 && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, fontSize: 12.5, color: '#0A0C10', cursor: 'pointer' }}>
            <input type="checkbox" checked={isFeatured} onChange={event => setIsFeatured(event.target.checked)} disabled={processing || savedCount > 0} style={{ width: 15, height: 15 }} />
            Feature these items on the homepage
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 13, flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(10,12,16,0.48)', fontSize: 12 }}>{savedCount > 0 ? `${savedCount} saved` : `${rows.length} ready`}{failedCount > 0 ? ` · ${failedCount} failed — retry available` : ''}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onCancel} disabled={processing} style={{ ...miniBtn, width: 'auto', padding: '8px 14px', opacity: processing ? 0.5 : 1 }}>{complete ? 'Done' : 'Cancel'}</button>
              <button type="button" onClick={() => void saveBatch()} disabled={processing || complete || rows.length === 0} style={{ ...addBtn, opacity: processing || complete ? 0.55 : 1 }}>
                {processing ? 'Saving…' : complete ? 'Batch saved' : failedCount > 0 ? 'Retry failed' : 'Save all'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}

function readableFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  const readable = withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return readable ? readable.slice(0, 120) : 'New item'
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleImage(file: File) {
    if (uploading) return
    setUploading(true)
    setUploadProgress(0)
    setUploadError('')
    try {
      const url = await uploadItemImage(businessId, file, setUploadProgress)
      setImageUrl(url)
    } catch (error) {
      setUploadError(friendlyError(error))
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  async function handleSave() {
    if (!translations.en?.name?.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      if (existing) {
        await updateItem(existing.id, { price, translations, imageUrl, isFeatured })
        onSaved({ ...existing, price, translations, imageUrl, isFeatured })
      } else {
        const item = await createItem({ businessId, categoryId, price, translations })
        if (imageUrl || isFeatured) await updateItem(item.id, { imageUrl, isFeatured })
        onSaved({ ...item, imageUrl, isFeatured })
      }
    } catch (error) {
      setSaveError(friendlyError(error))
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
        {safeImageUrl(imageUrl) && (
          <div style={itemImagePreview}>
            <img
              src={safeImageUrl(imageUrl) ?? undefined}
              alt={`${translations[activeLang]?.name || itemLabel} photo preview`}
              decoding="async"
              style={itemImagePreviewImage}
            />
            <span style={itemImagePreviewLabel}>Photo preview</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="number" step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} style={{ ...formInput, width: 120 }} placeholder="Price" />
          <label style={{ fontSize: 12.5, color: '#0A0C10', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            {safeImageUrl(imageUrl) && <img src={safeImageUrl(imageUrl) ?? undefined} alt="" width={32} height={32} loading="lazy" decoding="async" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
            <span style={{ padding: '8px 12px', borderRadius: 8, background: '#F6F3EE', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: uploading ? 0.7 : 1 }}>
              {!uploading && <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-flex' }}><ArrowUp size={13} /></motion.span>}
              {uploading ? `Uploading… ${uploadProgress ?? 0}%` : imageUrl ? 'Change photo' : 'Add photo'}
            </span>
            <input type="file" accept={IMAGE_UPLOAD_ACCEPT} style={fileInputStyle} disabled={uploading} onClick={e => { e.currentTarget.value = '' }} onChange={e => { const file = takeSelectedFile(e.currentTarget); if (file) void handleImage(file) }} />
          </label>
        </div>
        {uploading && <div role="progressbar" aria-label="Menu image upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress ?? 0} style={{ height: 5, borderRadius: 99, background: 'rgba(10,12,16,0.1)', overflow: 'hidden' }}><div style={{ width: `${uploadProgress ?? 0}%`, height: '100%', background: '#D4A853', transition: 'width 180ms ease' }} /></div>}
        {uploadError && <div style={{ color: '#B91C1C', fontSize: 12.5 }}>{uploadError}</div>}
        {saveError && <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: '#B91C1C', fontSize: 12.5 }}><AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{saveError}</div>}
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
const batchBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: '#F6F3EE', color: '#0A0C10', border: '1px solid rgba(10,12,16,0.1)',
  borderRadius: 9, padding: '9px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
}
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: '#D4A853', color: '#0A0C10', border: 'none',
  borderRadius: 9, padding: '9px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
}
const formInput: React.CSSProperties = {
  border: '1px solid rgba(10,12,16,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
}
const itemImagePreview: React.CSSProperties = { position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#F6F3EE', border: '1px solid rgba(10,12,16,0.08)', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const itemImagePreviewImage: React.CSSProperties = { display: 'block', width: '100%', maxHeight: 260, objectFit: 'contain', objectPosition: 'center', background: '#F6F3EE' }
const itemImagePreviewLabel: React.CSSProperties = { position: 'absolute', left: 10, bottom: 10, padding: '5px 8px', borderRadius: 7, background: 'rgba(10,12,16,0.72)', color: '#fff', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2 }
const batchDropzone: React.CSSProperties = { position: 'relative', display: 'grid', placeItems: 'center', gap: 5, minHeight: 92, padding: '14px 16px', border: '1px dashed rgba(162,122,34,0.55)', borderRadius: 12, background: '#FFFCF5', color: '#7C5B16', cursor: 'pointer', textAlign: 'center', fontSize: 13.5, fontWeight: 650 }
const batchRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: 9, borderRadius: 11, border: '1px solid rgba(10,12,16,0.08)', background: '#FCFBF8' }
const batchPreview: React.CSSProperties = { width: 72, height: 72, flexShrink: 0, borderRadius: 9, objectFit: 'cover', background: '#F6F3EE' }
const batchProgressTrack: React.CSSProperties = { height: 5, borderRadius: 99, background: 'rgba(10,12,16,0.1)', overflow: 'hidden' }
const batchSaved: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#166534', fontSize: 12 }
const batchFailed: React.CSSProperties = { display: 'inline-flex', alignItems: 'flex-start', gap: 5, color: '#B91C1C', fontSize: 12, lineHeight: 1.35 }
const catalogSkeleton: React.CSSProperties = { display: 'grid', gap: 14 }
const skeletonLineWide: React.CSSProperties = { height: 28, width: '42%', borderRadius: 8, background: 'linear-gradient(100deg, #eeeae3 30%, #fff 50%, #eeeae3 70%)', backgroundSize: '200% 100%', animation: 'abrobiz-skeleton-shimmer 1.2s ease-in-out infinite' }
const skeletonLine: React.CSSProperties = { height: 180, width: '100%', borderRadius: 16, background: 'linear-gradient(100deg, #eeeae3 30%, #fff 50%, #eeeae3 70%)', backgroundSize: '200% 100%', animation: 'abrobiz-skeleton-shimmer 1.2s ease-in-out infinite' }
const skeletonLineShort: React.CSSProperties = { height: 90, width: '70%', borderRadius: 14, background: 'linear-gradient(100deg, #eeeae3 30%, #fff 50%, #eeeae3 70%)', backgroundSize: '200% 100%', animation: 'abrobiz-skeleton-shimmer 1.2s ease-in-out infinite' }
const catalogError: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderRadius: 11, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#991B1B', fontSize: 13 }
const dismissError: React.CSSProperties = { marginLeft: 'auto', display: 'grid', placeItems: 'center', width: 27, height: 27, border: 'none', borderRadius: 7, background: 'rgba(220,38,38,0.08)', color: '#991B1B', cursor: 'pointer' }
const sidebarHeading: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '3px 4px 13px', color: '#0A0C10', fontSize: 14 }
const sidebarEyebrow: React.CSSProperties = { color: '#A27A22', fontSize: 9.5, fontWeight: 850, letterSpacing: 1.3, marginBottom: 4 }
const countPill: React.CSSProperties = { minWidth: 25, padding: '4px 7px', borderRadius: 999, background: '#F6F3EE', color: 'rgba(10,12,16,0.58)', textAlign: 'center', fontSize: 11, fontWeight: 700 }
const helperText: React.CSSProperties = { display: 'block', marginTop: 9, color: 'rgba(10,12,16,0.43)', fontSize: 11.5, lineHeight: 1.45 }
const catalogSectionHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 14, padding: '2px 2px 14px', borderBottom: '1px solid rgba(10,12,16,0.07)' }
const catalogSectionTitle: React.CSSProperties = { margin: 0, color: '#0A0C10', fontFamily: 'Outfit, sans-serif', fontSize: 21, fontWeight: 650 }
const readyBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999, background: 'rgba(22,101,52,0.1)', color: '#166534', fontSize: 10.5, fontWeight: 750, whiteSpace: 'nowrap' }
