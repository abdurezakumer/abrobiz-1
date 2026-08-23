export interface TelegramUser {
  id: number
  username?: string
  first_name?: string
}

export interface TelegramPhotoSize {
  file_id: string
  file_size?: number
  width: number
  height: number
}

export interface TelegramMessage {
  message_id: number
  chat: { id: number; type: string }
  from?: TelegramUser
  text?: string
  photo?: TelegramPhotoSize[]
}

export interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}
