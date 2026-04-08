import { useI18nStore } from '@/i18n/i18nStore'
import { useTranslation } from '@/i18n/useTranslation'
import { LOCALES } from '@/i18n/types'
import type { Locale } from '@/i18n/types'

interface OptionsPageProps {
  onBack: () => void
}

export default function OptionsPage({ onBack }: OptionsPageProps) {
  const t = useTranslation()
  const { locale, setLocale } = useI18nStore()

  return (
    <main className="flex flex-col items-center gap-8 py-8 px-4 min-h-svh">
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          ← {t.common.back}
        </button>
      </div>

      <header className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">{t.options.title}</h1>
      </header>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <label className="text-sm font-medium text-gray-700">{t.options.language}</label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm cursor-pointer"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t.languages[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </main>
  )
}
