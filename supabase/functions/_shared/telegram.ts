import { fetchWithTimeout, readJsonResponse } from './external.ts'

const TELEGRAM_API = 'https://api.telegram.org'

export interface InlineButton {
  text: string
  callback_data: string
}

export function buildInlineKeyboard(rows: InlineButton[][]) {
  return { inline_keyboard: rows }
}

export class TelegramClient {
  constructor(private token: string) {
    if (!token) throw new Error('TelegramClient requires a bot token')
  }

  async sendMessage(chatId: string | number, text: string, opts: { replyMarkup?: unknown } = {}) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: opts.replyMarkup,
    })
  }

  async sendPhoto(chatId: string | number, photo: string, opts: { caption?: string; replyMarkup?: unknown } = {}) {
    return this.call('sendPhoto', {
      chat_id: chatId,
      photo,
      caption: opts.caption,
      reply_markup: opts.replyMarkup,
    })
  }

  /** Uploads bytes directly to Telegram. Payment proofs use this path so the
   * receipt never needs to be copied into Supabase Storage. */
  async sendPhotoBytes(chatId: string | number, bytes: Uint8Array, filename: string, contentType = 'image/jpeg', opts: { caption?: string; replyMarkup?: unknown } = {}) {
    const form = new FormData()
    form.set('chat_id', String(chatId))
    form.set('photo', new Blob([bytes], { type: contentType }), filename)
    if (opts.caption) form.set('caption', opts.caption)
    if (opts.replyMarkup) form.set('reply_markup', JSON.stringify(opts.replyMarkup))
    // A camera photo can be several megabytes. The default external-request
    // timeout is appropriate for small JSON calls but is too short for a
    // Telegram multipart upload on a busy edge/mobile path.
    return this.callFormData('sendPhoto', form, 60_000)
  }

  async editMessageText(chatId: string | number, messageId: number, text: string, opts: { replyMarkup?: unknown } = {}) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: opts.replyMarkup ?? { inline_keyboard: [] },
    })
  }

  async editMessageCaption(chatId: string | number, messageId: number, caption: string, opts: { replyMarkup?: unknown } = {}) {
    return this.call('editMessageCaption', {
      chat_id: chatId,
      message_id: messageId,
      caption,
      reply_markup: opts.replyMarkup ?? { inline_keyboard: [] },
    })
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
  }

  async getFile(fileId: string): Promise<{ file_path: string }> {
    const res = await this.call('getFile', { file_id: fileId })
    return res.result as { file_path: string }
  }

  fileUrl(filePath: string): string {
    return `${TELEGRAM_API}/file/bot${this.token}/${filePath}`
  }

  async downloadFile(filePath: string): Promise<Uint8Array> {
    const res = await fetchWithTimeout(this.fileUrl(filePath), {}, 10000)
    if (!res.ok) throw new Error(`Failed to download Telegram file: ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Telegram file is too large')
    return bytes
  }

  async setWebhook(url: string, secretToken: string) {
    return this.call('setWebhook', { url, secret_token: secretToken })
  }

  private async call(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
    const res = await fetchWithTimeout(`${TELEGRAM_API}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await readJsonResponse(res, 256 * 1024)
    if (!data.ok) {
      throw new Error(`Telegram API error (${method}): ${data.description ?? res.statusText}`)
    }
    return data
  }

  private async callFormData(method: string, body: FormData, timeoutMs = 8_000): Promise<{ ok: boolean; result?: unknown; description?: string }> {
    const res = await fetchWithTimeout(`${TELEGRAM_API}/bot${this.token}/${method}`, {
      method: 'POST',
      body,
    }, timeoutMs)
    const data = await readJsonResponse(res, 256 * 1024)
    if (!data.ok) {
      throw new Error(`Telegram API error (${method}): ${data.description ?? res.statusText}`)
    }
    return data
  }
}
