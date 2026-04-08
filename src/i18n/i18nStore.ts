import { create } from 'zustand'
import type { Locale } from './types'
import { LOCALES } from './types'

const STORAGE_KEY = 'picross-locale'

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && LOCALES.includes(stored as Locale)) return stored as Locale
  const browser = navigator.language.slice(0, 2)
  if (LOCALES.includes(browser as Locale)) return browser as Locale
  return 'fr'
}

interface I18nStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useI18nStore = create<I18nStore>((set) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
    set({ locale })
  },
}))
