import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { platformSeoForPath } from '../lib/seo'
import { applySeoDefinition } from '../lib/seoDom'
import { isBusinessSubdomain } from '../lib/storefrontUrl'

export default function PlatformSeoHead() {
  const location = useLocation()

  useEffect(() => {
    if (isBusinessSubdomain()) return undefined
    return applySeoDefinition(platformSeoForPath(location.pathname, import.meta.env.VITE_SITE_URL || 'https://abrobiz.com'))
  }, [location.pathname])

  return null
}
