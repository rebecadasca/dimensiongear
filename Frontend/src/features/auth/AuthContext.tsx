/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiRequest, jsonBody } from '../../shared/api/client'

export type AuthUser = {
  id: string
  name: string
  email: string
  phone: string
  loyaltyPoints: number
  createdAt: string
}

type AuthResult = { ok: boolean; message: string }

type AuthContextValue = {
  currentUser: AuthUser | null
  googleLogin: (credential: string) => Promise<AuthResult>
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<AuthResult>
  updateProfile: (input: { name?: string; phone?: string }) => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const result = await apiRequest<{ user: AuthUser }>('/auth/me')
      setCurrentUser(result.user)
    } catch {
      setCurrentUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial session hydration from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUser()
  }, [refreshUser])

  const runAuth = useCallback(async (path: string, input: unknown): Promise<AuthResult> => {
    try {
      const result = await apiRequest<{ user: AuthUser }>(path, { method: 'POST', body: jsonBody(input) })
      setCurrentUser(result.user)
      return { message: 'Autentificare reușită.', ok: true }
    } catch (error) {
      return { message: error instanceof Error ? error.message : 'Autentificarea a eșuat.', ok: false }
    }
  }, [])

  const login = useCallback((email: string, password: string) =>
    runAuth('/auth/login', { email, password }), [runAuth])
  const signup = useCallback((name: string, email: string, password: string) =>
    runAuth('/auth/register', { email, name, password }), [runAuth])
  const googleLogin = useCallback((credential: string) =>
    runAuth('/auth/google', { credential }), [runAuth])

  const logout = useCallback(async () => {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined)
    setCurrentUser(null)
  }, [])

  const updateProfile = useCallback(async (input: { name?: string; phone?: string }) => {
    try {
      const result = await apiRequest<{ user: AuthUser }>('/users/me', { method: 'PATCH', body: jsonBody(input) })
      setCurrentUser(result.user)
      return { message: 'Profil actualizat.', ok: true }
    } catch (error) {
      return { message: error instanceof Error ? error.message : 'Actualizarea profilului a eșuat.', ok: false }
    }
  }, [])

  const value = useMemo(() => ({ currentUser, googleLogin, isLoading, login, logout, refreshUser, signup, updateProfile }),
    [currentUser, googleLogin, isLoading, login, logout, refreshUser, signup, updateProfile])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
