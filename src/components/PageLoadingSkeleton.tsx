export default function PageLoadingSkeleton({ label = 'Loading AbroBiz' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} style={{ minHeight: '100vh', background: '#F6F3EE', padding: 18, color: '#0A0C10' }}>
      <style>{'@keyframes abrobiz-page-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }'}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ height: 56, borderRadius: 14, background: '#0A0C10', marginBottom: 18, padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: 116, height: 14, borderRadius: 999, ...pageSkeletonBlock }} />
          <div style={{ display: 'flex', gap: 8 }}><div style={{ width: 34, height: 34, borderRadius: 9, ...pageSkeletonBlock }} /><div style={{ width: 34, height: 34, borderRadius: 9, ...pageSkeletonBlock }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
          {[1, 2, 3].map(item => <div key={item} style={{ minHeight: 92, borderRadius: 14, background: '#fff', border: '1px solid rgba(10,12,16,0.06)', padding: 18 }}><div style={{ width: '42%', height: 10, borderRadius: 999, ...pageSkeletonBlock }} /><div style={{ width: '68%', height: 24, borderRadius: 7, ...pageSkeletonBlock, marginTop: 14 }} /></div>)}
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(10,12,16,0.06)', borderRadius: 16, padding: 20, minHeight: 330 }}>
          <div style={{ width: 190, height: 17, borderRadius: 6, ...pageSkeletonBlock, marginBottom: 12 }} />
          <div style={{ width: '72%', height: 11, borderRadius: 999, ...pageSkeletonBlock, marginBottom: 8 }} />
          <div style={{ width: '55%', height: 11, borderRadius: 999, ...pageSkeletonBlock, marginBottom: 24 }} />
          <div style={{ display: 'grid', gap: 10 }}>{[1, 2, 3, 4].map(item => <div key={item} style={{ height: 42, borderRadius: 9, ...pageSkeletonBlock }} />)}</div>
        </div>
        <div style={{ color: 'rgba(10,12,16,0.42)', fontSize: 12, textAlign: 'center', marginTop: 14 }}>{label}…</div>
      </div>
    </div>
  )
}

const pageSkeletonBlock: React.CSSProperties = { background: 'linear-gradient(100deg, rgba(10,12,16,.07) 30%, rgba(255,255,255,.9) 50%, rgba(10,12,16,.07) 70%)', backgroundSize: '220% 100%', animation: 'abrobiz-page-skeleton 1.25s ease-in-out infinite' }
