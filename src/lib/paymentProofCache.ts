// Payment proofs are sensitive documents. Keep the optional upload handoff in
// memory only; browser persistence would survive logout and be readable by
// any script running in the origin. The upload API remains the source of
// truth and validates the file again server-side.
const memoryCache = new Map<string, File>()

export async function saveCachedPaymentProof(businessId: string, file: File): Promise<void> {
  memoryCache.set(businessId, file)
}

export async function readCachedPaymentProof(businessId: string): Promise<File | null> {
  return memoryCache.get(businessId) ?? null
}

export async function clearCachedPaymentProof(businessId: string): Promise<void> {
  memoryCache.delete(businessId)
}
