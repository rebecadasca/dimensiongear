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
import { apiRequest } from '../../shared/api/client'
import type { Product } from './types'

type CatalogContextValue = {
  error: string
  getProductById: (id: string) => Product | undefined
  isLoading: boolean
  products: Product[]
  refresh: () => Promise<void>
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await apiRequest<{ products: Product[] }>('/products')
      setProducts(result.products)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Catalog indisponibil')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial catalog hydration from MongoDB through the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({
    error,
    getProductById: (id: string) => products.find((product) => product.id === id),
    isLoading,
    products,
    refresh,
  }), [error, isLoading, products, refresh])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalog must be used inside CatalogProvider')
  return context
}
