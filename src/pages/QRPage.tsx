import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, ExternalLink, Image as ImageIcon, QrCode as QrCodeIcon, Sparkles } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { publicStorefrontUrl } from '../lib/storefrontUrl'

export default function QRPage() {
  const { business } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [posterDataUrl, setPosterDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const siteUrl = business ? publicStorefrontUrl(business.slug) : ''

  useEffect(() => {
    if (!siteUrl || !business) return
    let active = true
    setError('')
    void (async () => {
      try {
        const [rawQr, posterQr] = await Promise.all([
          QRCode.toDataURL(siteUrl, { width: 1024, margin: 2, color: { dark: '#0A0C10', light: '#FFFFFF' } }),
          QRCode.toDataURL(siteUrl, { width: 620, margin: 2, color: { dark: business.accentColor || '#0A0C10', light: '#FFFFFF' } }),
        ])
        if (!active) return
        setQrDataUrl(rawQr)
        setPosterDataUrl(await createBrandedPoster(posterQr, business.name, business.accentColor || '#D4A853', siteUrl))
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, siteUrl, { width: 280, margin: 2, color: { dark: business.accentColor || '#0A0C10', light: '#FFFFFF' } })
        }
      } catch {
        if (active) setError('The QR preview could not be prepared. Please refresh and try again.')
      }
    })()
    return () => { active = false }
  }, [siteUrl, business])

  function downloadFile(dataUrl: string, filename: string) {
    if (!dataUrl || !business) return
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = filename
    anchor.click()
  }

  async function downloadSvg() {
    if (!siteUrl || !business) return
    const svg = await QRCode.toString(siteUrl, { type: 'svg', margin: 2, color: { dark: business.accentColor || '#0A0C10', light: '#FFFFFF' } })
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${business.slug}-qr-code.svg`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(siteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the link. Press and hold the link to copy it.')
    }
  }

  if (!business) return null

  return (
    <DashboardLayout>
      <style>{'@media(max-width:760px){.qr-kit-grid{grid-template-columns:1fr!important}.qr-kit-poster{min-height:300px!important}}'}</style>
      <div style={pageHeader}>
        <div>
          <div style={eyebrow}>BRANDED DISCOVERY</div>
          <h1 style={pageTitle}>Your QR kit</h1>
          <p style={pageCopy}>Create a branded QR asset ready for tables, flyers, receipts, counters, social posts, and window displays.</p>
        </div>
        <a href={siteUrl} target="_blank" rel="noopener noreferrer" style={viewSiteButton}><ExternalLink size={14} /> View live site</a>
      </div>

      {error && <div role="alert" style={errorBox}>{error}</div>}

      <div className="qr-kit-grid" style={qrGrid}>
        <section className="qr-kit-poster" style={posterPanel}>
          <div style={panelLabel}><ImageIcon size={15} /> Branded poster template</div>
          <div style={posterPreview}>
            {posterDataUrl ? <img src={posterDataUrl} alt={`Branded QR poster for ${business.name}`} style={posterImage} /> : <div style={posterLoading}><Sparkles size={20} /> Preparing your branded template…</div>}
          </div>
          <div style={downloadRow}>
            <button type="button" onClick={() => downloadFile(posterDataUrl, `${business.slug}-branded-qr-poster.png`)} disabled={!posterDataUrl} style={primaryDownload}><Download size={15} /> Download branded PNG</button>
            <button type="button" onClick={() => void downloadSvg()} disabled={!qrDataUrl} style={secondaryDownload}><Download size={15} /> SVG</button>
          </div>
          <p style={smallHint}>The branded PNG includes your business name, a scan prompt, accent color, and your live website address. It is sized for easy sharing and printing.</p>
        </section>

        <section style={qrPanel}>
          <div style={panelLabel}><QrCodeIcon size={15} /> Scan-only QR</div>
          <div style={rawQrFrame}><canvas ref={canvasRef} aria-label={`QR code linking to ${siteUrl}`} /></div>
          <div style={businessMark}><span style={{ ...businessMarkIcon, background: business.accentColor || '#D4A853' }}>{business.name.slice(0, 1).toUpperCase()}</span><strong>{business.name}</strong></div>
          <p style={urlText}>{siteUrl}</p>
          <div style={downloadRow}>
            <button type="button" onClick={() => downloadFile(qrDataUrl, `${business.slug}-qr-code.png`)} disabled={!qrDataUrl} style={primaryDownload}><Download size={15} /> Download QR PNG</button>
            <button type="button" onClick={() => void copyLink()} style={secondaryDownload}><Copy size={15} /> {copied ? 'Copied' : 'Copy link'}</button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

async function createBrandedPoster(qrDataUrl: string, businessName: string, accent: string, siteUrl: string): Promise<string> {
  const qrImage = await loadImage(qrDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1500
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable.')

  const background = context.createLinearGradient(0, 0, 1200, 1500)
  background.addColorStop(0, '#11151D')
  background.addColorStop(1, '#29312D')
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = accent
  context.fillRect(0, 0, canvas.width, 18)

  context.fillStyle = '#F0EDE7'
  context.textAlign = 'center'
  context.font = '700 68px Georgia, serif'
  context.fillText(businessName.slice(0, 30), 600, 190)
  context.fillStyle = 'rgba(240,237,231,0.72)'
  context.font = '500 30px Arial, sans-serif'
  context.fillText('Scan to explore our website', 600, 255)

  context.fillStyle = '#FFFFFF'
  roundRect(context, 120, 335, 960, 960, 30)
  context.fill()
  context.drawImage(qrImage, 235, 450, 730, 730)

  context.fillStyle = '#11151D'
  context.font = '700 34px Arial, sans-serif'
  context.fillText('Discover more', 600, 1380)
  context.fillStyle = '#626A70'
  context.font = '500 22px Arial, sans-serif'
  context.fillText(siteUrl.replace(/^https?:\/\//, ''), 600, 1425)
  return canvas.toDataURL('image/png')
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('QR image could not be loaded.'))
    image.src = source
  })
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.closePath()
}

const pageHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }
const eyebrow: React.CSSProperties = { color: '#A27A22', fontSize: 10.5, fontWeight: 850, letterSpacing: 1.5 }
const pageTitle: React.CSSProperties = { margin: '7px 0 5px', color: '#0A0C10', fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 650, letterSpacing: '-.03em' }
const pageCopy: React.CSSProperties = { maxWidth: 620, margin: 0, color: 'rgba(10,12,16,0.55)', fontSize: 14, lineHeight: 1.6 }
const viewSiteButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: '1px solid rgba(10,12,16,0.12)', borderRadius: 9, background: '#fff', color: '#0A0C10', textDecoration: 'none', fontSize: 12.5, fontWeight: 650 }
const errorBox: React.CSSProperties = { marginBottom: 18, padding: '11px 13px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#991B1B', fontSize: 13 }
const qrGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, .75fr)', gap: 18, alignItems: 'start' }
const posterPanel: React.CSSProperties = { background: '#11151D', borderRadius: 22, padding: '20px 20px 22px', color: '#F0EDE7', overflow: 'hidden' }
const qrPanel: React.CSSProperties = { background: '#fff', borderRadius: 22, border: '1px solid rgba(10,12,16,0.06)', padding: '20px 20px 22px', textAlign: 'center' }
const panelLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, color: '#D4A853', fontSize: 11, fontWeight: 800, letterSpacing: 1.05, textTransform: 'uppercase', marginBottom: 15 }
const posterPreview: React.CSSProperties = { minHeight: 380, display: 'grid', placeItems: 'center', borderRadius: 16, padding: 12, background: 'radial-gradient(circle at 50% 15%, rgba(212,168,83,0.2), transparent 45%), rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
const posterImage: React.CSSProperties = { width: 'min(100%, 330px)', borderRadius: 10, boxShadow: '0 20px 42px rgba(0,0,0,0.28)' }
const posterLoading: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(240,237,231,0.65)', fontSize: 13 }
const rawQrFrame: React.CSSProperties = { display: 'grid', placeItems: 'center', minHeight: 310, padding: 15, borderRadius: 16, background: '#F6F3EE' }
const businessMark: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 15, color: '#0A0C10', fontSize: 15 }
const businessMarkIcon: React.CSSProperties = { width: 25, height: 25, display: 'grid', placeItems: 'center', borderRadius: 8, color: '#0A0C10', fontSize: 13, fontWeight: 800 }
const urlText: React.CSSProperties = { margin: '7px auto 16px', maxWidth: 320, color: 'rgba(10,12,16,0.48)', fontSize: 12, wordBreak: 'break-all' }
const downloadRow: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }
const primaryDownload: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, flex: '1 1 180px', border: 'none', borderRadius: 10, padding: '11px 13px', background: '#D4A853', color: '#0A0C10', fontSize: 12.5, fontWeight: 750, cursor: 'pointer' }
const secondaryDownload: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid rgba(10,12,16,0.12)', borderRadius: 10, padding: '10px 13px', background: '#fff', color: '#0A0C10', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }
const smallHint: React.CSSProperties = { margin: '12px 0 0', color: 'rgba(240,237,231,0.52)', fontSize: 11.5, lineHeight: 1.55 }
