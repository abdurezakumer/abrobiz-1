// A small, purpose-built mock of just the query-builder shapes this project's
// edge functions actually use — not a general Supabase mock.

type Row = Record<string, any>

export class MockTable {
  rows: Row[]
  constructor(rows: Row[] = []) {
    this.rows = rows
  }
}

export class MockSupabase {
  tables: Record<string, MockTable> = {}
  rpcCalls: { name: string; args: any }[] = []
  rpcImpl: (name: string, args: any) => { data?: unknown; error: { message: string } | null } = () => ({ data: null, error: null })
  storageUploads: { bucket: string; path: string }[] = []

  seed(table: string, rows: Row[]) {
    this.tables[table] = new MockTable(rows)
    return this
  }

  from(table: string) {
    if (!this.tables[table]) this.tables[table] = new MockTable([])
    return new QueryBuilder(this.tables[table], this)
  }

  async rpc(name: string, args: any) {
    this.rpcCalls.push({ name, args })
    return this.rpcImpl(name, args)
  }

  get storage() {
    const self = this
    return {
      from(bucket: string) {
        return {
          async upload(path: string, _bytes: unknown) {
            self.storageUploads.push({ bucket, path })
            return { error: null }
          },
          async createSignedUrl(path: string, _expiresIn: number) {
            return { data: { signedUrl: `https://example.test/${bucket}/${path}` } }
          },
        }
      },
    }
  }
}

class QueryBuilder {
  private filters: ((row: Row) => boolean)[] = []
  private pendingInsert: Row | null = null
  private pendingUpdate: Row | null = null
  private pendingUpsert: Row | null = null
  private isDelete = false

  constructor(private table: MockTable, private db: MockSupabase) {}

  select(_cols?: string) {
    return this
  }

  eq(col: string, val: unknown) {
    this.filters.push(row => row[col] === val)
    return this
  }

  in(col: string, vals: unknown[]) {
    this.filters.push(row => vals.includes(row[col]))
    return this
  }

  lt(col: string, val: string) {
    this.filters.push(row => row[col] != null && row[col] < val)
    return this
  }

  is(col: string, val: null) {
    this.filters.push(row => (val === null ? row[col] === null || row[col] === undefined : row[col] === val))
    return this
  }

  not(col: string, _op: string, val: unknown) {
    this.filters.push(row => !(val === null ? row[col] === null || row[col] === undefined : row[col] === val))
    return this
  }

  order(_col: string, _opts?: unknown) {
    return this
  }

  limit(_count: number) {
    return this
  }

  insert(row: Row) {
    this.pendingInsert = row
    return this
  }

  update(patch: Row) {
    this.pendingUpdate = patch
    return this
  }

  upsert(row: Row) {
    this.pendingUpsert = row
    return this
  }

  delete() {
    this.isDelete = true
    return this
  }

  private matching() {
    return this.table.rows.filter(row => this.filters.every(f => f(row)))
  }

  async maybeSingle() {
    this.flushMutations()
    const found = this.matching()[0] ?? null
    return { data: found, error: null }
  }

  async single() {
    this.flushMutations()
    const found = this.matching()[0] ?? null
    return { data: found, error: found ? null : { message: 'not found' } }
  }

  // Used when a SELECT with no .single()/.maybeSingle() is awaited directly
  then(resolve: (v: { data: Row[]; error: null }) => void) {
    this.flushMutations()
    resolve({ data: this.matching(), error: null })
  }

  private flushMutations() {
    if (this.pendingInsert) {
      const row = { id: this.pendingInsert.id ?? crypto.randomUUID(), ...this.pendingInsert }
      this.table.rows.push(row)
      this.pendingInsert = null
      this.filters = [r => r === row]
    }
    if (this.pendingUpdate) {
      for (const row of this.matching()) Object.assign(row, this.pendingUpdate)
      this.pendingUpdate = null
    }
    if (this.pendingUpsert) {
      const key = 'telegram_chat_id' in this.pendingUpsert ? 'telegram_chat_id' : 'id'
      const existing = this.table.rows.find(r => r[key] === this.pendingUpsert![key])
      if (existing) Object.assign(existing, this.pendingUpsert)
      else this.table.rows.push({ ...this.pendingUpsert })
      this.pendingUpsert = null
    }
    if (this.isDelete) {
      this.table.rows = this.table.rows.filter(row => !this.filters.every(f => f(row)))
      this.isDelete = false
    }
  }
}

export class MockTelegram {
  sent: { method: string; chatId: string; text?: string; replyMarkup?: unknown }[] = []

  async sendMessage(chatId: string | number, text: string, opts: { replyMarkup?: unknown } = {}) {
    this.sent.push({ method: 'sendMessage', chatId: String(chatId), text, replyMarkup: opts.replyMarkup })
    return { ok: true }
  }
  async sendPhoto(chatId: string | number, _photo: string, opts: { caption?: string; replyMarkup?: unknown } = {}) {
    this.sent.push({ method: 'sendPhoto', chatId: String(chatId), text: opts.caption, replyMarkup: opts.replyMarkup })
    return { ok: true }
  }
  async editMessageText(chatId: string | number, _messageId: number, text: string, opts: { replyMarkup?: unknown } = {}) {
    this.sent.push({ method: 'editMessageText', chatId: String(chatId), text, replyMarkup: opts.replyMarkup })
    return { ok: true }
  }
  async answerCallbackQuery(_id: string, _text?: string) {
    return { ok: true }
  }
  async getFile(_fileId: string) {
    return { file_path: 'photos/mock.jpg' }
  }
  async downloadFile(_filePath: string) {
    return new Uint8Array([1, 2, 3])
  }
}
