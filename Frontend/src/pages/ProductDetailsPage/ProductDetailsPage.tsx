import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useCart } from '../../features/cart/CartContext'
import { useCatalog } from '../../features/catalog/CatalogContext'
import { useAuth } from '../../features/auth/AuthContext'
import type { Product, ProductCategory } from '../../features/catalog/types'
import { formatCurrency } from '../../shared/utils/formatCurrency'
import styles from './ProductDetailsPage.module.scss'

const categoryLabels: Record<ProductCategory, string> = {
  'gaming-chair': 'Scaun de gaming',
  headset: 'Căști',
  keyboard: 'Tastatură',
  mouse: 'Mouse',
}

const cardImageOverrides: Record<string, string> = {
  'logitech-mx-master-3s-pale-gray': 'image-01',
  'nova-s6-air-3d-custom-wireless': 'image-03',
}

function getPrimaryImage(product: Product) {
  const preferredImageId = cardImageOverrides[product.id]

  return (
    product.gallery.find((image) => image.id === preferredImageId) ??
    product.gallery.find((image) => image.isPrimary) ??
    product.gallery[0]
  )
}

export function ProductDetailsPage() {
  const { productId } = useParams()
  const { getProductById, isLoading, products } = useCatalog()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const product = productId ? getProductById(productId) : undefined
  const { addDefaultConfiguration, addItem } = useCart()
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [failedImageIds, setFailedImageIds] = useState<string[]>([])
  const [wasAdded, setWasAdded] = useState(false)

  const selectedColor = useMemo(
    () =>
      product?.colors.find((color) => color.id === selectedColorId) ??
      product?.colors[0],
    [product?.colors, selectedColorId],
  )

  const recommendations = useMemo(() => {
    if (!product) {
      return []
    }

    return products
      .filter(
        (candidate) =>
          candidate.category === product.category && candidate.id !== product.id,
      )
      .slice(0, 4)
  }, [product, products])

  if (isLoading) {
    return <section className={styles.page}><div className={styles.contentShell}>Se încarcă produsul...</div></section>
  }

  if (!product) {
    return (
      <section className={styles.page}>
        <div className={styles.contentShell}>
          <div className={styles.notFound}>
            <h1>Produsul nu a fost găsit</h1>
            <Link to="/products">Înapoi la produse</Link>
          </div>
        </div>
      </section>
    )
  }

  const currentProduct = product
  const colorGallery = selectedColor
    ? currentProduct.gallery.filter((image) => image.colorId === selectedColor.id)
    : []
  const visibleGallery = colorGallery.length > 0 ? colorGallery : currentProduct.gallery
  const activeImage =
    visibleGallery[activeImageIndex] ?? visibleGallery[0]
  const isActiveImageMissing = activeImage
    ? failedImageIds.includes(activeImage.id)
    : true
  const displayedPrice =
    selectedColor?.priceOverride ?? currentProduct.pricing.current
  const shortDescription =
    currentProduct.description.long.length > 225 && !isDescriptionExpanded
      ? `${currentProduct.description.long.slice(0, 225).trim()}...`
      : currentProduct.description.long

  function goToPreviousImage() {
    setActiveImageIndex((currentIndex) =>
      currentIndex === 0 ? visibleGallery.length - 1 : currentIndex - 1,
    )
  }

  function goToNextImage() {
    setActiveImageIndex((currentIndex) =>
      currentIndex === visibleGallery.length - 1 ? 0 : currentIndex + 1,
    )
  }

  function markImageAsFailed(imageId: string) {
    setFailedImageIds((currentIds) =>
      currentIds.includes(imageId) ? currentIds : [...currentIds, imageId],
    )
  }

  async function handleAddToCart() {
    if (!currentUser) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    if (currentProduct.productType === 'customizable') {
      await addDefaultConfiguration({ productSlug: currentProduct.id, quantity: 1 })
    } else {
      await addItem({ product: currentProduct, quantity: 1 })
    }
    setWasAdded(true)
  }

  return (
    <section className={styles.page}>
      <span className={styles.glowLeft} aria-hidden="true" />
      <span className={styles.glowRight} aria-hidden="true" />

      <div className={styles.contentShell}>
        <div className={styles.productLayout}>
            <section className={styles.gallery} aria-label="Galerie produs">
            <div className={styles.mainFrame}>
              <img
                alt=""
                aria-hidden="true"
                className={styles.mainFrameImage}
                src="/design-reference/assets/view-categories-card.png"
              />

              {activeImage && !isActiveImageMissing ? (
                <img
                  alt={activeImage.alt}
                  className={styles.mainProductImage}
                  onError={() => markImageAsFailed(activeImage.id)}
                  src={activeImage.src}
                />
              ) : (
                <div className={styles.mainImagePlaceholder}>
                  <span>Imagine PNG în așteptare</span>
                </div>
              )}

              <div className={styles.galleryControls}>
                <button
                  aria-label="Imaginea anterioară"
                  className={styles.imageNavButton}
                  onClick={goToPreviousImage}
                  type="button"
                >
                  <span aria-hidden="true" />
                </button>
                <button
                  aria-label="Imaginea următoare"
                  className={`${styles.imageNavButton} ${styles.nextButton}`}
                  onClick={goToNextImage}
                  type="button"
                >
                  <span aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className={styles.thumbnails} aria-label="Imagini produs">
              {visibleGallery.map((item, index) => {
                const hasFailed = failedImageIds.includes(item.id)

                return (
                  <button
                    aria-label={`Arată ${item.label}`}
                    className={
                      index === activeImageIndex
                        ? `${styles.thumbnail} ${styles.activeThumbnail}`
                        : styles.thumbnail
                    }
                    key={item.id}
                    onClick={() => setActiveImageIndex(index)}
                    type="button"
                  >
                    {hasFailed ? (
                      <span className={styles.imagePlaceholder}>PNG</span>
                    ) : (
                      <img
                        alt=""
                        className={styles.thumbnailImage}
                        onError={() => markImageAsFailed(item.id)}
                        src={item.src}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <aside className={styles.details}>
            <p className={styles.category}>{categoryLabels[currentProduct.category]}</p>
            <h1>{currentProduct.name}</h1>

            <div className={styles.priceAndRating}>
              <div className={styles.priceGroup}>
                {currentProduct.pricing.previous ? (
                  <span className={styles.oldPrice}>
                    {formatCurrency(currentProduct.pricing.previous)}
                  </span>
                ) : null}
                <strong>{formatCurrency(displayedPrice)}</strong>
              </div>

              <div className={styles.ratingRow}>
                <span>{currentProduct.reviewCount.toLocaleString('ro-RO')} recenzii</span>
                <strong aria-label={`${currentProduct.rating} din 5 stele`}>
                  <i aria-hidden="true" />
                  {currentProduct.rating}
                </strong>
              </div>
            </div>

            <div className={styles.descriptionBlock}>
              <strong>Descriere:</strong>
              <p>
                {shortDescription}
                {currentProduct.description.long.length > 225 ? (
                  <>
                    {' '}
                    <button
                      onClick={() =>
                        setIsDescriptionExpanded((isExpanded) => !isExpanded)
                      }
                      type="button"
                    >
                      {isDescriptionExpanded ? 'Vezi mai puțin' : 'Vezi mai mult'}
                    </button>
                  </>
                ) : null}
              </p>
            </div>

            <div className={styles.colorBlock}>
              <p>
                <span>Culoare:</span> {selectedColor?.label}
              </p>
              <div className={styles.swatches}>
                {currentProduct.colors.map((color) => (
                  <button
                    aria-label={`Alege ${color.label}`}
                    className={
                      color.id === selectedColor?.id ? styles.selectedSwatch : ''
                    }
                    disabled={!color.inStock}
                    key={color.id}
                    onClick={() => {
                      setSelectedColorId(color.id)
                      setActiveImageIndex(0)
                    }}
                    style={{ backgroundColor: color.hex }}
                    type="button"
                  />
                ))}
              </div>
            </div>

            <div className={styles.actions}>
              <button onClick={() => void handleAddToCart()} type="button">
                Adaugă în coș
              </button>
              {currentProduct.productType === 'customizable' ? (
                <Link to={`/products/${currentProduct.id}/customize`}>Costumizează</Link>
              ) : null}
            </div>

            <Link className={styles.deliveryLink} to="/checkout">
              Termeni livrare
            </Link>

            {wasAdded ? (
              <div className={styles.notice} role="status">
                Adăugat în coș. <Link to="/cart">Deschide coșul</Link>
              </div>
            ) : null}
          </aside>
        </div>

        {recommendations.length > 0 ? (
          <section className={styles.recommendations} aria-labelledby="also-like-title">
            <header>
              <h2 id="also-like-title">S-ar putea să îți placă și</h2>
              <Link to={`/products?category=${currentProduct.category}`}>
                Vezi toate produsele din categoria {categoryLabels[currentProduct.category].toLowerCase()}
              </Link>
            </header>

            <div className={styles.recommendationGrid}>
              {recommendations.map((item) => {
                const image = getPrimaryImage(item)

                return (
                  <article
                    className={`${styles.recommendationCard} ${
                      item.productType === 'customizable'
                        ? styles.customRecommendation
                        : styles.basicRecommendation
                    }`}
                    key={item.id}
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className={styles.recommendationFrame}
                      src="/design-reference/assets/view-categories-card.png"
                    />
                    {item.productType === 'customizable' ? (
                      <span className={styles.recommendationBadge}>
                        personalizabil
                      </span>
                    ) : null}

                    <Link
                      aria-label={`Vezi ${item.name}`}
                      className={styles.recommendationMediaLink}
                      to={`/products/${item.id}`}
                    >
                      <img
                        alt={image.alt}
                        className={styles.recommendationImage}
                        src={image.src}
                      />
                    </Link>

                    <div className={styles.recommendationInfo}>
                      <div className={styles.recommendationTitleRow}>
                        <div>
                          <p>{categoryLabels[item.category]}</p>
                          <h3>{item.name}</h3>
                        </div>
                        <strong>{formatCurrency(item.pricing.current)}</strong>
                      </div>

                      <p className={styles.recommendationDescription}>
                        {item.description.short}
                      </p>

                      <div className={styles.recommendationFooter}>
                        <div
                          aria-label={`Opțiuni de culoare pentru ${item.name}`}
                          className={styles.recommendationSwatches}
                        >
                          {item.colors.map((color) => (
                            <span
                              aria-label={color.label}
                              key={color.id}
                              style={{ backgroundColor: color.hex }}
                              title={color.label}
                            />
                          ))}
                        </div>
                        <Link to={`/products/${item.id}`}>detalii</Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  )
}
