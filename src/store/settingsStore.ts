import { create } from 'zustand'

const STORAGE_KEY = 'picross-settings'

interface Settings {
  offlineMode: boolean
  darkMode: boolean
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Settings
  } catch {
    /* ignore */
  }
  return { offlineMode: false, darkMode: false }
}

function save(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

interface SettingsStore extends Settings {
  setOfflineMode: (enabled: boolean) => void
  setDarkMode: (enabled: boolean) => void
}

function applyDarkClass(enabled: boolean) {
  document.documentElement.classList.toggle('dark', enabled)
}

export const useSettingsStore = create<SettingsStore>((set, get) => {
  // Applique le dark mode au chargement
  const initial = load()
  applyDarkClass(initial.darkMode)

  return {
    ...initial,

    setOfflineMode: (enabled) => {
      set({ offlineMode: enabled })
      save({ ...get(), offlineMode: enabled })
    },

    setDarkMode: (enabled) => {
      applyDarkClass(enabled)
      set({ darkMode: enabled })
      save({ ...get(), darkMode: enabled })
    },
  }
})
