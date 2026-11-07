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
  const logoSrc = showName
    ? light ? '/brand/abrobiz-logo-horizontal-dark.svg' : '/brand/abrobiz-logo-horizontal-light.svg'
    : light ? '/brand/abrobiz-mark-dark.svg' : '/brand/abrobiz-mark-light.svg'
  const logoWidth = size * (showName ? 4502.3 / 880 : 900 / 880)

  return (
    <img
      src={logoSrc}
      width={logoWidth}
      height={size}
      alt={showName ? 'AbroBiz' : 'AbroBiz mark'}
      style={{ display: 'block', width: logoWidth, height: size, objectFit: 'contain', flex: '0 0 auto' }}
    />
  )
}

export const logoTextStyle: CSSProperties = { fontFamily: 'Outfit, sans-serif', fontWeight: 650, letterSpacing: '-0.02em' }
