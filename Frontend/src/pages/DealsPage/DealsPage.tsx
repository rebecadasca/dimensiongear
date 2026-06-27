import { Link } from 'react-router-dom'
import { useCatalog } from '../../features/catalog/CatalogContext'
import { getProductCardImage } from '../../features/catalog/getProductCardImage'
import type { ProductCategory } from '../../features/catalog/types'
import { formatCurrency } from '../../shared/utils/formatCurrency'
import styles from '../ProductsPage/ProductsPage.module.scss'

const categoryLabels: Record<ProductCategory, string> = {
  'gaming-chair': 'Scaune',
  headset: 'Căști',
  keyboard: 'Tastaturi',
  mouse: 'Mouse',
}

export function DealsPage() {
  const { error, isLoading, products } = useCatalog()
  const discountedProducts = products.filter((product) => Boolean(product.pricing.previous))

  if (isLoading) {
    return <section className={styles.page}><div className={styles.emptyState}>Se încarcă ofertele...</div></section>
  }

  if (error) {
    return <section className={styles.page}><div className={styles.emptyState}>{error}</div></section>
  }

  return (
    <section className={`${styles.page} ${styles.categoryProducts}`}>
      <span className={styles.categoryGlowRight} aria-hidden="true" />
      <div className={styles.categoryProductsContent}>
        <header className={styles.productsHeader}>
          <div>
            <h1>Oferte</h1>
            <p>Produse DimensionGear cu preț redus, gata pentru upgrade-ul setupului tău.</p>
          </div>
        </header>

        {discountedProducts.length > 0 ? (
          <div className={styles.productsGrid}>
            {discountedProducts.map((product) => {
              const image = getProductCardImage(product)

              return (
                <article
                  className={`${styles.productCard} ${
                    product.productType === 'customizable'
                      ? styles.customProduct
                      : styles.basicProduct
                  }`}
                  key={product.id}
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className={styles.productFrame}
                    src="/design-reference/assets/view-categories-card.png"
                  />
                  {product.productType === 'customizable' ? (
                    <span className={styles.productBadge}>personalizabil</span>
                  ) : null}

                  <Link
                    aria-label={`Vezi ${product.name}`}
                    className={styles.productMediaLink}
                    to={`/products/${product.id}`}
                  >
                    <img
                      alt={image?.alt ?? product.name}
                      className={styles.productImage}
                      src={image?.src ?? ''}
                    />
                  </Link>

                  <div className={styles.productInfo}>
                    <div className={styles.productTitleRow}>
                      <div>
                        <p>{categoryLabels[product.category]}</p>
                        <h2>{product.name}</h2>
                      </div>
                      <strong>{formatCurrency(product.pricing.current)}</strong>
                    </div>
                    <p className={styles.productDescription}>{product.description.short}</p>
                    <div className={styles.productFooter}>
                      <div
                        aria-label={`Opțiuni de culoare pentru ${product.name}`}
                        className={styles.swatches}
                      >
                        {product.colors.map((color) => (
                          <span
                            aria-label={color.label}
                            key={color.id}
                            style={{ backgroundColor: color.hex }}
                            title={color.label}
                          />
                        ))}
                      </div>
                      <Link to={`/products/${product.id}`}>detalii</Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>Nu există oferte active momentan.</strong>
            <Link to="/products?category=mouse">Înapoi la produse</Link>
          </div>
        )}
      </div>
    </section>
  )
}
