import { useId, type CSSProperties } from 'react'

export default function AbroBizLogo({
  size = 32,
  showName = true,
  light = false,
}: {
  size?: number
  showName?: boolean
  light?: boolean
}) {
  const markColor = light ? '#F3C86B' : '#D4A853'
  const letterColor = light ? '#17130D' : '#0A0C10'
  const textColor = light ? '#FFFFFF' : '#F0EDE7'
  const gradientId = `abrobiz-mark-${useId().replace(/:/g, '')}`

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(8, size * 0.28) }}>
      <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="AbroBiz logo">
        <defs>
          <linearGradient id={gradientId} x1="4" y1="3" x2="35" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor={markColor} />
            <stop offset="1" stopColor={light ? '#D88A3D' : '#A97A2C'} />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill={`url(#${gradientId})`} />
        <path d="M20 8.5 10.4 30h4.7l1.65-4.15h6.5L24.9 30h4.7L20 8.5Zm0 7.8 1.75 5.55h-3.5L20 16.3Z" fill={letterColor} />
        <path d="M27.3 11.6c2.1 1.5 3.55 3.9 3.7 6.65" fill="none" stroke={letterColor} strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
      </svg>
      {showName && <span style={{ color: textColor, fontFamily: 'Outfit, sans-serif', fontWeight: 650, fontSize: Math.max(14, size * 0.52), letterSpacing: '-0.02em' }}>AbroBiz</span>}
    </span>
  )
}

export const logoTextStyle: CSSProperties = { fontFamily: 'Outfit, sans-serif', fontWeight: 650, letterSpacing: '-0.02em' }
