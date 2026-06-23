import { Link, useParams } from 'react-router-dom'
import { useCatalog } from '../../features/catalog/CatalogContext'
import { ConfiguratorShell } from '../../features/configurator/components/ConfiguratorShell/ConfiguratorShell'
import styles from './ProductCustomizerPage.module.scss'

export function ProductCustomizerPage() {
  const { productId } = useParams()
  const { getProductById, isLoading } = useCatalog()
  const product = productId ? getProductById(productId) : undefined

  if (isLoading) {
    return <section className={styles.page}><div className={styles.notFound}>Se încarcă configuratorul...</div></section>
  }

  if (!product || product.productType !== 'customizable') {
    return (
      <section className={styles.page}>
        <div className={styles.notFound}>
          <h1>Produsul nu este personalizabil</h1>
          <Link to="/products">Înapoi la produse</Link>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <span className={styles.glowLeft} aria-hidden="true" />
      <span className={styles.glowRight} aria-hidden="true" />

      <div className={styles.contentShell}>
        <ConfiguratorShell key={product.id} product={product} />
      </div>
    </section>
  )
}
