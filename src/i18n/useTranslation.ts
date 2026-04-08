import { useI18nStore } from './i18nStore'
import { translations } from './translations'

export function useTranslation() {
  const locale = useI18nStore((s) => s.locale)
  return translations[locale]
}
