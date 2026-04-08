import { describe, it, expect } from 'vitest'
import { translations } from '@/i18n/translations'
import { LOCALES } from '@/i18n/types'
import type { Locale } from '@/i18n/types'

/** Collecte récursivement tous les chemins de clés d'un objet (ex: "home.subtitle") */
function getKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    if (typeof val === 'object' && val !== null) {
      paths.push(...getKeyPaths(val as Record<string, unknown>, fullKey))
    } else {
      paths.push(fullKey)
    }
  }
  return paths
}

/** Récupère la valeur d'un chemin de clé (ex: "home.subtitle") dans un objet */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

const referenceLocale: Locale = 'fr'
const referenceKeys = getKeyPaths(
  translations[referenceLocale] as unknown as Record<string, unknown>,
)

describe('i18n translations', () => {
  it('la langue de référence (fr) a des clés', () => {
    expect(referenceKeys.length).toBeGreaterThan(0)
  })

  for (const locale of LOCALES) {
    describe(`locale: ${locale}`, () => {
      it('a exactement les mêmes clés que la référence (fr)', () => {
        const localeKeys = getKeyPaths(translations[locale] as unknown as Record<string, unknown>)
        const missingInLocale = referenceKeys.filter((k) => !localeKeys.includes(k))
        const extraInLocale = localeKeys.filter((k) => !referenceKeys.includes(k))

        expect(missingInLocale, `Clés manquantes dans ${locale}`).toEqual([])
        expect(extraInLocale, `Clés en trop dans ${locale}`).toEqual([])
      })

      it('aucune valeur vide', () => {
        const localeObj = translations[locale] as unknown as Record<string, unknown>
        const emptyKeys = referenceKeys.filter((k) => {
          const val = getByPath(localeObj, k)
          return typeof val !== 'string' || val.trim() === ''
        })

        expect(emptyKeys, `Valeurs vides dans ${locale}`).toEqual([])
      })
    })
  }
})
