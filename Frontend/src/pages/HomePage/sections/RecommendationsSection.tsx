import { Link } from 'react-router-dom'
import { useCatalog } from '../../../features/catalog/CatalogContext'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import styles from './RecommendationsSection.module.scss'

export function RecommendationsSection() {
  const { getProductById } = useCatalog()
  const mouse = getProductById('logitech-mx-master-3s-pale-gray')
  const headset = getProductById('corsair-virtuoso-se-wireless')

  return (
    <section className={styles.recommendations} aria-label="Recomandările noastre">
      <div className={styles.layout}>
        <h2>Recomandările noastre</h2>

        <div className={styles.mouseCardGroup}>
          <article className={`${styles.productCard} ${styles.mouseCard}`}>
            <img
              className={styles.mouseDots}
              src="/design-reference/assets/three-circles.svg"
              alt=""
              aria-hidden="true"
            />
            <div className={styles.productText}>
              <h3>{mouse?.name ?? 'Mouse wireless Logitech MX'}</h3>
              <p>
                Preț <strong>{mouse ? formatCurrency(mouse.pricing.current) : '-'}</strong>
              </p>
              <Link to="/products/logitech-mx-master-3s-pale-gray">Detalii</Link>
            </div>
            <img
              className={styles.mouseImage}
              src="/design-reference/recommendations/logitech-mx-wireless-mouse.svg"
              alt="Mouse wireless Logitech MX"
            />
          </article>
          <img
            className={styles.mouseChevrons}
            src="/design-reference/assets/mini-asset.svg"
            alt=""
            aria-hidden="true"
          />
        </div>

        <article className={`${styles.productCard} ${styles.headsetCard}`}>
          <div className={styles.productText}>
            <h3>{headset?.name ?? 'Virtuoso RGB Wireless'}</h3>
            <p>
              Preț <strong>{headset ? formatCurrency(headset.pricing.current) : '-'}</strong>
            </p>
            <Link to="/products/corsair-virtuoso-se-wireless">Detalii</Link>
          </div>
          <img
            className={styles.headsetImage}
            src="/design-reference/recommendations/virtuoso-rgb-wireless.svg"
            alt="Căști wireless Virtuoso RGB"
          />
        </article>
      </div>
    </section>
  )
}
