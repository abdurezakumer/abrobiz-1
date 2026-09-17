import type { CSSProperties } from 'react'

export default function AbroBizLogo({
  size = 32,
  showName = true,
  light = false,
}: {
  size?: number
  showName?: boolean
  light?: boolean
}) {
  const textColor = light ? '#FFFFFF' : '#F0EDE7'
  const markCrop = size / 78

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(8, size * 0.28) }}>
      <span style={{ position: 'relative', width: size, height: size, overflow: 'hidden', borderRadius: Math.max(5, size * 0.22), background: '#FFFFFF', flex: '0 0 auto' }}>
        <img
          src="/favicon_io/android-chrome-192x192.png"
          width={192 * markCrop}
          height={192 * markCrop}
          alt="AbroBiz logo mark"
          style={{ position: 'absolute', maxWidth: 'none', left: -58 * markCrop, top: -34 * markCrop }}
        />
      </span>
      {showName && <span style={{ color: textColor, fontFamily: 'Outfit, sans-serif', fontWeight: 650, fontSize: Math.max(14, size * 0.52), letterSpacing: '-0.02em' }}>AbroBiz</span>}
    </span>
  )
}

export const logoTextStyle: CSSProperties = { fontFamily: 'Outfit, sans-serif', fontWeight: 650, letterSpacing: '-0.02em' }
