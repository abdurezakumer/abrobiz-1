const DATABASE_NAME = 'abrobiz-payment-cache'
const STORE_NAME = 'proofs'
const DATABASE_VERSION = 1

type CachedProof = {
  key: string
  name: string
  type: string
  bytes: ArrayBuffer
  updatedAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser cannot save the payment proof.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the payment proof cache.'))
  })
}

export async function saveCachedPaymentProof(businessId: string, file: File): Promise<void> {
  const bytes = await file.arrayBuffer()
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({
        key: businessId,
        name: file.name,
        type: file.type,
        bytes,
        updatedAt: Date.now(),
      } satisfies CachedProof)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the payment proof.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not save the payment proof.'))
    })
  } finally {
    db.close()
  }
}

export async function readCachedPaymentProof(businessId: string): Promise<File | null> {
  const db = await openDatabase()
  try {
    const record = await new Promise<CachedProof | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(businessId)
      request.onsuccess = () => resolve(request.result as CachedProof | undefined)
      request.onerror = () => reject(request.error ?? new Error('Could not read the payment proof cache.'))
    })
    return record ? new File([record.bytes], record.name, { type: record.type, lastModified: record.updatedAt }) : null
  } finally {
    db.close()
  }
}

export async function clearCachedPaymentProof(businessId: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(businessId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear the payment proof cache.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not clear the payment proof cache.'))
    })
  } finally {
    db.close()
  }
}
