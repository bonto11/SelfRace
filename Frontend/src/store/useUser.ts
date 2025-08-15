import { create } from 'zustand'

interface UserState {
  currentUserId: number | null
  setUserId: (id: number) => void
}

export const useUser = create<UserState>((set) => ({
  currentUserId: null,
  setUserId: (id) => set({ currentUserId: id }),
}))
