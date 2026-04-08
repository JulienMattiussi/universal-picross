import { create } from 'zustand'

const STORAGE_KEY = 'picross-settings'

interface Settings {
  offlineMode: boolean
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Settings
  } catch {
    /* ignore */
  }
  return { offlineMode: false }
}

function save(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

interface SettingsStore extends Settings {
  setOfflineMode: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...load(),

  setOfflineMode: (enabled) => {
    set({ offlineMode: enabled })
    save({ ...get(), offlineMode: enabled })
  },
}))
