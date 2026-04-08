import type { Locale, TranslationKeys } from '../types'
import { fr } from './fr'
import { en } from './en'
import { de } from './de'
import { it } from './it'
import { es } from './es'

export const translations: Record<Locale, TranslationKeys> = { fr, en, de, it, es }
