import { create } from 'zustand'

interface DebugStore {
  debug: boolean
  toggle: () => void
}

export const useDebugStore = create<DebugStore>((set) => ({
  debug: false,
  toggle: () => set((s) => ({ debug: !s.debug })),
}))
