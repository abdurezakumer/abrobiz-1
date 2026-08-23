import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { publicStorefrontUrl } from '../lib/storefrontUrl'

export default function QRPage() {
  const { business } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState('')

  const siteUrl = business ? publicStorefrontUrl(business.slug) : ''

  useEffect(() => {
    if (!siteUrl || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, siteUrl, { width: 280, margin: 2, color: { dark: '#0A0C10', light: '#FFFFFF' } })
    QRCode.toDataURL(siteUrl, { width: 1024, margin: 2 }).then(setDataUrl)
  }, [siteUrl])

  function download() {
    if (!dataUrl || !business) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${business.slug}-qr-code.png`
    a.click()
  }

  if (!business) return null

  return (
    <DashboardLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>QR Code</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 24 }}>
        Print this and place it on tables, in your window, or on receipts.
      </p>

      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid rgba(10,12,16,0.06)', padding: 32, maxWidth: 380, textAlign: 'center' }}>
        <canvas ref={canvasRef} style={{ borderRadius: 12 }} />
        <p style={{ fontSize: 13, color: 'rgba(10,12,16,0.5)', marginTop: 16, wordBreak: 'break-all' }}>{siteUrl}</p>
        <button onClick={download} style={downloadBtn}>
          <Download size={16} /> Download PNG
        </button>
      </div>
    </DashboardLayout>
  )
}

const downloadBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, background: '#D4A853', color: '#0A0C10', border: 'none',
  borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 18,
}
