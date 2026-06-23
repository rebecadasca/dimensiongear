import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { App } from './app/App'
import { AuthProvider } from './features/auth/AuthContext'
import { CartProvider } from './features/cart/CartContext'
import { CatalogProvider } from './features/catalog/CatalogContext'
import './shared/styles/global.scss'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? 'not-configured'}>
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </CartProvider>
        </CatalogProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
