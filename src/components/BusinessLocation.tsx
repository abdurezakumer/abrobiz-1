import { useState } from 'react'
import { ExternalLink, MapPin, Navigation } from 'lucide-react'
import type { Business, Language } from '../types'
import type { StorefrontTheme } from '../lib/storefrontTheme'
import { safeHttpsUrl } from '../lib/safeUrl'
import { t } from '../lib/i18n'

function mapSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function embedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}

export default function BusinessLocation({ business, theme, lang = 'en' }: { business: Business; theme: StorefrontTheme; lang?: Language }) {
  const address = business.address.trim()
  const [mapLoaded, setMapLoaded] = useState(false)
  if (!address) return null

  const configuredMapUrl = safeHttpsUrl(business.mapsUrl)
  const viewUrl = configuredMapUrl ?? mapSearchUrl(address)
  const directions = directionsUrl(address)

  return (
    <section aria-labelledby="business-location-title" style={{ marginTop: 18 }}>
      <h3 id="business-location-title" style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>Visit us</h3>
      <div style={{ overflow: 'hidden', border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.card }}>
        {mapLoaded ? (
          <iframe
            title={`Map showing ${business.name}`}
            src={embedUrl(address)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ display: 'block', width: '100%', height: 180, border: 0 }}
          />
        ) : (
          <button type="button" onClick={() => setMapLoaded(true)} aria-label={`Load map for ${business.name}`} style={{ position: 'relative', display: 'grid', placeItems: 'center', width: '100%', height: 150, border: 0, padding: 18, cursor: 'pointer', color: theme.text, background: `radial-gradient(circle at 25% 30%, ${business.accentColor}35, transparent 34%), linear-gradient(135deg, ${theme.heroBg}, ${theme.bg})` }}>
            <span aria-hidden style={{ position: 'absolute', inset: 0, opacity: .22, backgroundImage: `linear-gradient(${theme.border} 1px, transparent 1px), linear-gradient(90deg, ${theme.border} 1px, transparent 1px)`, backgroundSize: '30px 30px' }} />
            <span style={{ position: 'relative', display: 'grid', placeItems: 'center', gap: 6, textAlign: 'center' }}><MapPin size={27} color={business.accentColor} /><strong style={{ fontSize: 12.5 }}>Load map</strong></span>
          </button>
        )}
        <div style={{ padding: '12px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: theme.text, fontSize: 12.5, lineHeight: 1.5 }}><MapPin size={16} color={business.accentColor} aria-hidden /> <span>{address}</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 11 }}>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" style={mapAction(theme, business.accentColor)}><ExternalLink size={13} /> {t('viewOnMap', lang)}</a>
            <a href={directions} target="_blank" rel="noopener noreferrer" style={mapAction(theme, business.accentColor)}><Navigation size={13} /> {t('getDirections', lang)}</a>
          </div>
        </div>
      </div>
    </section>
  )
}

function mapAction(theme: StorefrontTheme, accent: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 9px', border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, textDecoration: 'none', fontSize: 11.5, fontWeight: 650, background: `${accent}12` }
}
