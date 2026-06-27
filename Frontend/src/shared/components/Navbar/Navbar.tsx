import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../../features/auth/AuthContext'
import { useCart } from '../../../features/cart/CartContext'
import styles from './Navbar.module.scss'

const categoryItems = [
  { label: 'Mouse', to: '/products?category=mouse' },
  { label: 'Căști', to: '/products?category=headset' },
  { label: 'Tastaturi', to: '/products?category=keyboard' },
  { label: 'Scaune', to: '/products?category=gaming-chair' },
]

export function Navbar() {
  const { currentUser } = useAuth()
  const { totalQuantity } = useCart()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isShopActive = location.pathname === '/products'
  const isCustomiseActive =
    location.pathname === '/customise' ||
    (location.pathname.startsWith('/products/') && location.pathname.endsWith('/customize'))
  const isDealsActive = location.pathname === '/deals'

  function closeMobileMenu() {
    setIsMobileMenuOpen(false)
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link aria-label="Acasă DimensionGear" className={styles.brand} to="/" onClick={closeMobileMenu}>
          DimensionGear
        </Link>

        <nav aria-label="Navigație principală" className={styles.navigation}>
          <div className={styles.shopMenu}>
            <button
              aria-expanded="false"
              className={isShopActive ? `${styles.link} ${styles.active}` : styles.link}
              type="button"
            >
              Shop Gear
            </button>
            <div className={styles.dropdown}>
              {categoryItems.map((item) => (
                <Link key={item.to} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <Link
            className={isCustomiseActive ? `${styles.link} ${styles.active}` : styles.link}
            to="/customise"
          >
            Personalizează
          </Link>
          <Link
            className={isDealsActive ? `${styles.link} ${styles.active}` : styles.link}
            to="/deals"
          >
            Oferte
          </Link>
        </nav>

        <div className={styles.actions}>
          <Link
            aria-label="Coș"
            className={`${styles.iconControl} ${styles.cartIcon}`}
            data-tooltip={`${totalQuantity} în coș`}
            to="/cart"
          >
            <span aria-hidden="true" />
            {totalQuantity > 0 ? (
              <strong className={styles.cartBadge}>{totalQuantity}</strong>
            ) : null}
          </Link>
          <Link
            aria-label={currentUser ? `Contul lui ${currentUser.name}` : 'Contul tău'}
            className={`${styles.iconControl} ${styles.accountIcon}`}
            data-tooltip={currentUser ? currentUser.name : 'Contul tău'}
            to={currentUser ? '/account' : '/auth?next=/account'}
          >
            <span aria-hidden="true" />
          </Link>
          <button
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Închide meniul' : 'Deschide meniul'}
            className={`${styles.iconControl} ${styles.menuButton}`}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            type="button"
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className={
          isMobileMenuOpen
            ? `${styles.mobileBackdrop} ${styles.mobileBackdropOpen}`
            : styles.mobileBackdrop
        }
        onClick={closeMobileMenu}
      />

      <aside
        aria-hidden={!isMobileMenuOpen}
        className={
          isMobileMenuOpen
            ? `${styles.mobilePanel} ${styles.mobilePanelOpen}`
            : styles.mobilePanel
        }
      >
        <div className={styles.mobilePanelHeader}>
          <strong>DimensionGear</strong>
          <button aria-label="Închide meniul" onClick={closeMobileMenu} type="button">
            X
          </button>
        </div>

        <nav aria-label="Navigație mobilă" className={styles.mobileNavigation}>
          <span className={isShopActive ? styles.mobileActive : ''}>Shop Gear</span>
          <div className={styles.mobileCategories}>
            {categoryItems.map((item) => (
              <Link key={item.to} onClick={closeMobileMenu} to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
          <Link
            className={isCustomiseActive ? styles.mobileActive : ''}
            onClick={closeMobileMenu}
            to="/customise"
          >
            Personalizează
          </Link>
          <Link
            className={isDealsActive ? styles.mobileActive : ''}
            onClick={closeMobileMenu}
            to="/deals"
          >
            Oferte
          </Link>
          <Link className={styles.mobileUtilityLink} onClick={closeMobileMenu} to="/cart">
            <span
              aria-hidden="true"
              className={`${styles.mobileUtilityIcon} ${styles.mobileCartIcon}`}
            />
            <span>Coș</span>
            {totalQuantity > 0 ? (
              <strong className={styles.mobileCartBadge}>{totalQuantity}</strong>
            ) : null}
          </Link>
          <Link
            className={styles.mobileUtilityLink}
            onClick={closeMobileMenu}
            to={currentUser ? '/account' : '/auth?next=/account'}
          >
            <span
              aria-hidden="true"
              className={`${styles.mobileUtilityIcon} ${styles.mobileAccountIcon}`}
            />
            <span>{currentUser ? 'Contul meu' : 'Autentificare'}</span>
          </Link>
        </nav>
      </aside>
    </header>
  )
}
