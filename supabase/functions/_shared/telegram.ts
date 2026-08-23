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

  async editMessageText(chatId: string | number, messageId: number, text: string, opts: { replyMarkup?: unknown } = {}) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
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
    const res = await fetch(this.fileUrl(filePath))
    if (!res.ok) throw new Error(`Failed to download Telegram file: ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }

  async setWebhook(url: string, secretToken: string) {
    return this.call('setWebhook', { url, secret_token: secretToken })
  }

  private async call(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
    const res = await fetch(`${TELEGRAM_API}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) {
      throw new Error(`Telegram API error (${method}): ${data.description ?? res.statusText}`)
    }
    return data
  }
}
