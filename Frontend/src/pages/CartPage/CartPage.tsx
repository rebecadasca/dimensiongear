import { Link } from 'react-router-dom'
import { useCart } from '../../features/cart/CartContext'
import { useAuth } from '../../features/auth/AuthContext'
import { formatCurrency } from '../../shared/utils/formatCurrency'
import styles from './CartPage.module.scss'

export function CartPage() {
  const { currentUser } = useAuth()
  const {
    items,
    removeItem,
    totalQuantity,
    totals,
    updateQuantity,
  } = useCart()

  if (!currentUser) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyState}>
          <p>Coș blocat</p>
          <h1>Autentifică-te pentru a folosi coșul.</h1>
          <Link to="/auth?next=/cart">Autentificare sau înregistrare</Link>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyState}>
          <p>Coș</p>
          <h1>Coșul tău așteaptă produse.</h1>
          <span>
            Adaugă un produs standard sau o configurație personalizată, apoi
            revino aici pentru a verifica comanda.
          </span>
          <Link to="/products">Vezi produse</Link>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p>{totalQuantity} produse</p>
        <h1>Coșul tău</h1>
      </header>

      <div className={styles.cartShell}>
        <div className={styles.itemList}>
          {items.map((item) => (
            <article className={styles.item} key={item.id}>
              <div className={styles.itemPreview}>
                <span>{item.variantName}</span>
              </div>

              <div className={styles.itemBody}>
                <div className={styles.itemHeader}>
                  <div>
                    <p>{item.variantName}</p>
                    <h2>{item.productName}</h2>
                  </div>
                  <strong>{formatCurrency(item.unitPrice)}</strong>
                </div>

                <p className={styles.standardCopy}>
                  {item.configurationId
                    ? 'Configurație 3D salvată atașată.'
                    : 'Variantă standard, pregătită pentru finalizarea comenzii.'}
                </p>

                <div className={styles.itemControls}>
                  <label>
                    <span>Cantitate</span>
                    <input
                      min="1"
                      onChange={(event) =>
                        void updateQuantity(item.id, Number(event.target.value))
                      }
                      type="number"
                      value={item.quantity}
                    />
                  </label>

                  <button className={styles.deleteButton} onClick={() => void removeItem(item.id)} type="button">
                    Elimină
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className={styles.summary}>
          <p>Sumar comandă</p>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatCurrency(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>Livrare</dt>
              <dd>{formatCurrency(totals.shipping)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCurrency(totals.total)}</dd>
            </div>
            <div>
              <dt>Plătești azi</dt>
              <dd>{formatCurrency(totals.payNow)}</dd>
            </div>
            <div>
              <dt>Rămas</dt>
              <dd>{formatCurrency(totals.remaining)}</dd>
            </div>
          </dl>
          <span>
            Alege plata integrală sau un avans de 30% la finalizarea comenzii.
          </span>
          <Link to="/checkout">Continuă spre plată</Link>
        </aside>
      </div>
    </section>
  )
}
