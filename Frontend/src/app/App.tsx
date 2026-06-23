import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '../shared/layouts/MainLayout/MainLayout'
import { AuthPage } from '../pages/AuthPage/AuthPage'
import { CartPage } from '../pages/CartPage/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage/CheckoutPage'
import { HomePage } from '../pages/HomePage/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage/NotFoundPage'
import { CustomiseProductsPage } from '../pages/CustomiseProductsPage/CustomiseProductsPage'
import { DealsPage } from '../pages/DealsPage/DealsPage'
import { ProductCustomizerPage } from '../pages/ProductCustomizerPage/ProductCustomizerPage'
import { ProductDetailsPage } from '../pages/ProductDetailsPage/ProductDetailsPage'
import { ProductsPage } from '../pages/ProductsPage/ProductsPage'
import { AccountPage } from '../pages/AccountPage/AccountPage'

export function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="customise" element={<CustomiseProductsPage />} />
        <Route path="deals" element={<DealsPage />} />
        <Route path="products/:productId" element={<ProductDetailsPage />} />
        <Route
          path="products/:productId/customize"
          element={<ProductCustomizerPage />}
        />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
