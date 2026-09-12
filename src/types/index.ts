export type Language = 'en' | 'am' | 'or'
export type TemplateSlug = string
export type Role = 'admin' | 'super_admin' | 'owner'
export type AdminRole = 'none' | 'super_admin' | 'operations' | 'support' | 'finance' | 'content' | 'marketing_admin' | 'sales_person'
export type StorefrontVisualStyle = 'minimal' | 'grid' | 'warm' | 'aurora' | 'luxury' | 'heritage'

export interface TemplateConfig {
  bg?: string
  card?: string
  text?: string
  textDim?: string
  border?: string
  heroBg?: string
  visualStyle?: StorefrontVisualStyle
  layout?: 'standard' | 'restaurant-cafe'
  headingFont?: string
}

export interface Template {
  id: string
  slug: string
  name: string
  description: string
  repoUrl?: string
  previewUrl?: string
  config: TemplateConfig
  isBuiltin: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface Translation {
  name: string
  description: string
}

export interface ItemTranslations {
  en?: Translation
  am?: Translation
  or?: Translation
}

export interface Profile {
  id: string
  role: Role
  platformId: string
  adminRole: AdminRole
  name: string
  phone: string
  email?: string // populated client-side from auth session, not stored on profiles
  emailVerifiedAt?: string | null
  termsAcceptedAt?: string | null
  privacyAcceptedAt?: string | null
  legalVersion?: string | null
  marketingPolicyAcceptedAt?: string | null
  marketingPolicyVersion?: string | null
}

export interface BusinessCategory {
  id: string
  slug: string
  label: string
  itemLabel: string
  categoryLabel: string
  icon: string
  sortOrder: number
  isActive: boolean
}

export interface OpeningHours {
  open: string
  close: string
  closed: boolean
}

export type WeeklyHours = Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', OpeningHours>

export interface BusinessSocial {
  facebookUrl?: string
  instagramUrl?: string
  tiktokUrl?: string
  telegramHandle?: string
}

export interface Business {
  id: string
  ownerId: string
  categoryId: string | null
  name: string
  slug: string
  description: string
  aboutContent: string
  galleryUrls: string[]
  logoUrl?: string
  coverUrl?: string
  phone: string
  email: string
  address: string
  mapsUrl: string
  templateSlug: TemplateSlug
  languages: Language[]
  accentColor: string
  openingHours: WeeklyHours
  social: BusinessSocial
  currency: string
  timezone: string
  isPublished: boolean
  isBlocked: boolean
  blockedReason?: string
  createdAt: string
}

export interface Category {
  id: string
  businessId: string
  name: string
  icon: string
  sortOrder: number
  isHidden: boolean
  translations?: { am?: string; or?: string }
}

export interface Item {
  id: string
  businessId: string
  categoryId: string
  imageUrl?: string
  price: number
  isAvailable: boolean
  isFeatured: boolean
  sortOrder: number
  translations: ItemTranslations
}

export type BillingInterval = 'month' | 'year'

export interface PlanFeatureFlags {
  bookings: boolean
  ordering: boolean
  reviews: boolean
}

export interface Plan {
  id: string
  slug: string
  name: string
  priceEtb: number
  billingInterval: BillingInterval
  features: string[]
  featureFlags: PlanFeatureFlags
  isTrial: boolean
  trialDays?: number
  isActive: boolean
  sortOrder: number
}

export interface PaymentMethod {
  id: string
  name: string
  accountName: string
  accountNumber: string
  instructions: string
  isActive: boolean
  sortOrder: number
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled'

export interface Subscription {
  id: string
  businessId: string
  planId: string | null
  plan?: Plan
  status: SubscriptionStatus
  startDate: string
  endDate: string | null
  autoRenew: boolean
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export type FulfillmentType = 'pickup' | 'delivery'

export interface OrderItem {
  id: string
  itemId: string | null
  itemName: string
  priceEtb: number
  quantity: number
}

export interface Order {
  id: string
  businessId: string
  customerName: string
  phone: string
  fulfillmentType: FulfillmentType
  address: string
  notes: string
  status: OrderStatus
  totalEtb: number
  createdAt: string
  items: OrderItem[]
}

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled'

export interface Booking {
  id: string
  businessId: string
  customerName: string
  phone: string
  partySize: number | null
  requestedDate: string
  requestedTime: string
  notes: string
  status: BookingStatus
  createdAt: string
}

export interface Review {
  id: string
  businessId: string
  customerName: string
  rating: number
  comment: string
  isApproved: boolean
  createdAt: string
}

export interface ContactMessage {
  id: string
  businessId: string
  name: string
  email: string
  phone: string
  message: string
  isRead: boolean
  createdAt: string
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected'

export interface Payment {
  id: string
  businessId: string
  planId: string
  plan?: Plan
  billingCycle: BillingInterval
  amountEtb: number
  paymentMethodId: string | null
  proofUrl?: string
  ownerNote: string
  status: PaymentStatus
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
  createdAt: string
  business?: { name: string; slug: string }
}
