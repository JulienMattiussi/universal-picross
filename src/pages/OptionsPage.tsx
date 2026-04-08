import { useEffect, useState } from 'react'
import { useI18nStore } from '@/i18n/i18nStore'
import { useTranslation } from '@/i18n/useTranslation'
import { LOCALES } from '@/i18n/types'
import type { Locale } from '@/i18n/types'
import { useSettingsStore } from '@/store/settingsStore'
import { isOCRCached, preloadOCR } from '@/lib/preloadOCR'

interface OptionsPageProps {
  onBack: () => void
}

export default function OptionsPage({ onBack }: OptionsPageProps) {
  const t = useTranslation()
  const { locale, setLocale } = useI18nStore()
  const { darkMode, setDarkMode, offlineMode, setOfflineMode } = useSettingsStore()
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cached, setCached] = useState(false)

  useEffect(() => {
    isOCRCached().then(setCached)
  }, [])

  const handleToggleOffline = async (enabled: boolean) => {
    setOfflineMode(enabled)
    if (enabled && !cached) {
      setDownloading(true)
      setProgress(0)
      try {
        await preloadOCR((p) => setProgress(p))
        setCached(true)
      } finally {
        setDownloading(false)
      }
    }
  }

  return (
    <main className="flex flex-col items-center gap-8 py-8 px-4 min-h-svh">
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="text-sm text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer"
        >
          ← {t.common.back}
        </button>
      </div>

      <header className="text-center">
        <h1 className="text-2xl font-bold text-txt">{t.options.title}</h1>
      </header>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Langue */}
        <div className="flex flex-col gap-3 p-4 bg-surface-card rounded-xl border border-brd shadow-sm">
          <label className="text-sm font-medium text-txt-secondary">{t.options.language}</label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-brd-strong bg-surface-card text-txt-secondary text-sm cursor-pointer"
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

        {/* Mode sombre */}
        <div className="flex flex-col gap-3 p-4 bg-surface-card rounded-xl border border-brd shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-txt-secondary">{t.options.darkMode}</label>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                darkMode ? 'bg-primary-500' : 'bg-toggle-off',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-txt-inverse transition-transform',
                  darkMode ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>
        </div>

        {/* Mode offline */}
        <div className="flex flex-col gap-3 p-4 bg-surface-card rounded-xl border border-brd shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-txt-secondary">
              {t.options.offlineMode}
            </label>
            <button
              onClick={() => handleToggleOffline(!offlineMode)}
              disabled={downloading}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                offlineMode ? 'bg-primary-500' : 'bg-toggle-off',
                downloading ? 'opacity-50' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-txt-inverse transition-transform',
                  offlineMode ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>
          <p className="text-xs text-txt-muted">{t.options.offlineDesc}</p>

          {/* Barre de progression */}
          {downloading && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-txt-tertiary">{t.options.offlineDownloading}</span>
              <div className="w-full bg-surface-tertiary rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Indicateur cache OK */}
          {cached && !downloading && offlineMode && (
            <span className="text-xs text-status-success">✓ {t.options.offlineReady}</span>
          )}
        </div>
      </div>
    </main>
  )
}
