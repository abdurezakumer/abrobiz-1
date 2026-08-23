import type { Language } from '../types'

type Dict = Record<string, Record<Language, string>>

const translations: Dict = {
  contact: { en: 'Contact', am: 'ያግኙን', or: 'Nu qunnamaa' },
  openingHours: { en: 'Opening Hours', am: 'የመክፈቻ ሰዓት', or: "Sa'aatii Banamuu" },
  closed: { en: 'Closed', am: 'ዝግ ነው', or: 'Cufaa dha' },
  soldOut: { en: 'Sold out', am: 'አልቋል', or: 'Dhumeera' },
  getDirections: { en: 'Get Directions', am: 'አቅጣጫ ያግኙ', or: 'Kallattii Argadhu' },
  callUs: { en: 'Call Us', am: 'ይደውሉልን', or: 'Nu Bilbilaa' },
  poweredBy: { en: 'Powered by', am: 'በ ... የተጎላበተ', or: "... tiin Deeggarame" },
  viewOnMap: { en: 'View on map', am: 'በካርታ ይመልከቱ', or: 'Kaartaa irratti ilaali' },
  allCategories: { en: 'All', am: 'ሁሉም', or: 'Hunda' },
  currentlyClosed: { en: 'Currently closed', am: 'አሁን ዝግ ነው', or: "Amma cufaa dha" },
  currentlyOpen: { en: 'Open now', am: 'አሁን ክፍት ነው', or: 'Amma banaa dha' },
}

export function t(key: keyof typeof translations, lang: Language = 'en'): string {
  return translations[key]?.[lang] ?? translations[key]?.en ?? key
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  am: 'አማርኛ',
  or: 'Afaan Oromoo',
}

export const DAY_LABELS: Record<string, Record<Language, string>> = {
  mon: { en: 'Monday', am: 'ሰኞ', or: 'Wiixata' },
  tue: { en: 'Tuesday', am: 'ማክሰኞ', or: 'Kibxata' },
  wed: { en: 'Wednesday', am: 'ረቡዕ', or: 'Roobii' },
  thu: { en: 'Thursday', am: 'ሐሙስ', or: 'Kamiisa' },
  fri: { en: 'Friday', am: 'አርብ', or: "Jimaata" },
  sat: { en: 'Saturday', am: 'ቅዳሜ', or: 'Sanbata' },
  sun: { en: 'Sunday', am: 'እሁድ', or: 'Dilbata' },
}
