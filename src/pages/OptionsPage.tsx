interface OptionsPageProps {
  onBack: () => void
}

export default function OptionsPage({ onBack }: OptionsPageProps) {
  return (
    <main className="flex flex-col items-center gap-8 py-8 px-4 min-h-svh">
      {/* Breadcrumb */}
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          ← Accueil
        </button>
      </div>

      <header className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Options</h1>
      </header>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <label className="text-sm font-medium text-gray-700">Langue</label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 text-sm cursor-not-allowed"
            disabled
            value="fr"
          >
            <option value="fr">Français</option>
          </select>
          <p className="text-xs text-gray-400">Seul le français est disponible pour le moment.</p>
        </div>
      </div>
    </main>
  )
}
