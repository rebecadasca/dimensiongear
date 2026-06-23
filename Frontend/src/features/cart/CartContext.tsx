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
import { useAuth } from '../auth/AuthContext'
import type { Product } from '../catalog/types'
import type { CartItem, CartTotals, ConfigurationSelectionInput } from './types'

const emptyTotals: CartTotals = {
  discount: '0.00', loyaltyPointsUsed: 0, payNow: '0.00', remaining: '0.00', shipping: '0.00', subtotal: '0.00', total: '0.00',
}

type CartResponse = { id: string | null; items: CartItem[]; totals: CartTotals }
type CartContextValue = CartResponse & {
  addConfiguration: (input: { productSlug: string; quantity?: number; selections: ConfigurationSelectionInput[]; sourceConfigurationId?: string }) => Promise<void>
  addDefaultConfiguration: (input: { productSlug: string; quantity?: number }) => Promise<void>
  addItem: (input: { product: Product; quantity?: number }) => Promise<void>
  clearLocalState: () => void
  error: string
  isLoading: boolean
  refresh: () => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  totalQuantity: number
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { currentUser, isLoading: isAuthLoading } = useAuth()
  const [cart, setCart] = useState<CartResponse>({ id: null, items: [], totals: emptyTotals })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!currentUser) { setCart({ id: null, items: [], totals: emptyTotals }); return }
    setIsLoading(true)
    try { setCart(await apiRequest<CartResponse>('/cart')); setError('') }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Coș indisponibil') }
    finally { setIsLoading(false) }
  }, [currentUser])

  useEffect(() => {
    // Synchronize the server cart whenever the authenticated user changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isAuthLoading) void refresh()
  }, [isAuthLoading, refresh])

  const addItem = useCallback(async ({ product, quantity = 1 }: { product: Product; quantity?: number }) => {
    setCart(await apiRequest<CartResponse>('/cart/items', { method: 'POST', body: jsonBody({ productSlug: product.id, quantity }) }))
  }, [])
  const addConfiguration = useCallback(async (input: { productSlug: string; quantity?: number; selections: ConfigurationSelectionInput[]; sourceConfigurationId?: string }) => {
    setCart(await apiRequest<CartResponse>('/cart/items/configuration', { method: 'POST', body: jsonBody({ ...input, quantity: input.quantity ?? 1 }) }))
  }, [])
  const addDefaultConfiguration = useCallback(async (input: { productSlug: string; quantity?: number }) => {
    setCart(await apiRequest<CartResponse>('/cart/items/default-configuration', { method: 'POST', body: jsonBody({ ...input, quantity: input.quantity ?? 1 }) }))
  }, [])
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setCart(await apiRequest<CartResponse>(`/cart/items/${itemId}`, { method: 'PATCH', body: jsonBody({ quantity }) }))
  }, [])
  const removeItem = useCallback(async (itemId: string) => {
    setCart(await apiRequest<CartResponse>(`/cart/items/${itemId}`, { method: 'DELETE' }))
  }, [])
  const clearLocalState = useCallback(() => setCart({ id: null, items: [], totals: emptyTotals }), [])

  const totalQuantity = useMemo(() => cart.items.reduce((total, item) => total + item.quantity, 0), [cart.items])
  const value = useMemo(() => ({ ...cart, addConfiguration, addDefaultConfiguration, addItem, clearLocalState, error, isLoading, refresh, removeItem, totalQuantity, updateQuantity }), [addConfiguration, addDefaultConfiguration, addItem, cart, clearLocalState, error, isLoading, refresh, removeItem, totalQuantity, updateQuantity])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
