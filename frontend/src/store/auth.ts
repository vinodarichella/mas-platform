import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  userId: string | null
  email: string | null
  name: string | null
  setAuth: (token: string, userId: string, email: string, name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:  null,
      userId: null,
      email:  null,
      name:   null,
      setAuth: (token, userId, email, name) =>
        set({ token, userId, email, name }),
      logout: () =>
        set({ token: null, userId: null, email: null, name: null }),
    }),
    { name: 'mas-auth' },
  ),
)
