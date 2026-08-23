import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Check, Trash2, Lock } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { hasFeature } from '../lib/entitlements'
import { listAllReviewsForOwner, approveReview, deleteReview } from '../lib/api/reviews'
import type { Review } from '../types'

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={13} color="#D4A853" fill={i <= rating ? '#D4A853' : 'none'} />
      ))}
    </div>
  )
}

export default function Reviews() {
  const { business, subscription } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const entitled = hasFeature(subscription, 'reviews')

  useEffect(() => {
    if (business && entitled) listAllReviewsForOwner(business.id).then(r => { setReviews(r); setLoading(false) })
    else setLoading(false)
  }, [business, entitled])

  async function approve(id: string) {
    await approveReview(id)
    setReviews(prev => prev.map(r => (r.id === id ? { ...r, isApproved: true } : r)))
  }
  async function remove(id: string) {
    if (!confirm('Delete this review?')) return
    await deleteReview(id)
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  if (!business) return null

  if (!entitled) {
    return (
      <DashboardLayout>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Reviews</h1>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 40, textAlign: 'center', marginTop: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(212,168,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Lock size={19} color="#D4A853" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 6 }}>Reviews is a Premium feature</div>
          <p style={{ fontSize: 13.5, color: 'rgba(10,12,16,0.5)', marginBottom: 18, maxWidth: 340, margin: '0 auto 18px' }}>
            Let customers leave public reviews on your site — you approve each one before it's visible. Upgrade to Premium to turn it on.
          </p>
          <Link to="/dashboard/billing" style={{ display: 'inline-block', background: '#D4A853', color: '#0A0C10', padding: '10px 20px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            View plans
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const pending = reviews.filter(r => !r.isApproved)
  const approved = reviews.filter(r => r.isApproved)

  return (
    <DashboardLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Reviews</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 22 }}>New reviews wait for your approval before they're public.</p>

      {loading ? (
        <div style={{ color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>Loading…</div>
      ) : reviews.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', padding: 40, textAlign: 'center', color: 'rgba(10,12,16,0.4)', fontSize: 13.5 }}>
          No reviews yet.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(10,12,16,0.5)', marginBottom: 10 }}>Awaiting approval</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(r => (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #D4A853', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{r.customerName}</span>
                        <Stars rating={r.rating} />
                      </div>
                      <span style={{ fontSize: 11.5, color: 'rgba(10,12,16,0.4)' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.comment && <p style={{ fontSize: 13, color: 'rgba(10,12,16,0.65)', marginTop: 8 }}>{r.comment}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => approve(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                        <Check size={12} /> Approve
                      </button>
                      <button onClick={() => remove(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {approved.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(10,12,16,0.5)', marginBottom: 10 }}>Live on your site</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {approved.map(r => (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(10,12,16,0.06)', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{r.customerName}</span>
                        <Stars rating={r.rating} />
                      </div>
                      <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', color: 'rgba(10,12,16,0.35)', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {r.comment && <p style={{ fontSize: 13, color: 'rgba(10,12,16,0.65)', marginTop: 8 }}>{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
