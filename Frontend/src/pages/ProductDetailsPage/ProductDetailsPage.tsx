import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useCart } from '../../features/cart/CartContext'
import { useCatalog } from '../../features/catalog/CatalogContext'
import { getProductCardImage } from '../../features/catalog/getProductCardImage'
import { useAuth } from '../../features/auth/AuthContext'
import type { ProductCategory } from '../../features/catalog/types'
import { apiRequest, jsonBody } from '../../shared/api/client'
import { formatCurrency } from '../../shared/utils/formatCurrency'
import styles from './ProductDetailsPage.module.scss'

const categoryLabels: Record<ProductCategory, string> = {
  'gaming-chair': 'Scaun de gaming',
  headset: 'Căști',
  keyboard: 'Tastatură',
  mouse: 'Mouse',
}

type ProductReviewReply = {
  authorName: string
  createdAt: string
  id: string
  text: string
}

type ProductReview = {
  authorName: string
  createdAt: string
  id: string
  rating: number
  replies: ProductReviewReply[]
  text: string
  updatedAt: string
}

type ProductReviewsResponse = {
  productId: string
  rating: number
  reviewCount: number
  reviews: ProductReview[]
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function formatReviewDate(value: string) {
  const createdAt = new Date(value)
  const diffMs = Date.now() - createdAt.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.max(0, Math.floor(diffMs / dayMs))

  if (diffDays < 1) return 'astazi'
  if (diffDays < 7) return diffDays === 1 ? 'acum o zi' : `acum ${diffDays} zile`
  if (diffDays < 14) return 'acum o saptamana'
  if (diffDays < 30) return `acum ${Math.floor(diffDays / 7)} saptamani`
  if (diffDays < 45) return 'acum o luna'

  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(createdAt)
}

function renderStars(rating: number) {
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
}

export function ProductDetailsPage() {
  const { productId } = useParams()
  const { currentUser } = useAuth()

  return (
    <ProductDetailsPageContent
      key={`${productId ?? 'missing'}:${currentUser?.id ?? 'guest'}`}
    />
  )
}

function ProductDetailsPageContent() {
  const { productId } = useParams()
  const { getProductById, isLoading, products, refresh } = useCatalog()
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
  const [previewReviews, setPreviewReviews] = useState<ProductReview[]>([])
  const [allReviews, setAllReviews] = useState<ProductReview[]>([])
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [isReviewsLoading, setIsReviewsLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null)
  const reviewWordCount = countWords(reviewText)
  const isReviewInvalid = reviewWordCount > 200 || reviewText.trim().length === 0

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

  useEffect(() => {
    window.scrollTo({ behavior: 'smooth', top: 0 })
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadPreviewReviews() {
      if (!productId) {
        setPreviewReviews([])
        return
      }

      setReviewError('')
      try {
        const result = await apiRequest<ProductReviewsResponse>(`/products/${productId}/reviews?limit=2`)
        if (isMounted) setPreviewReviews(result.reviews)
      } catch (requestError) {
        if (isMounted) {
          setPreviewReviews([])
          setReviewError(requestError instanceof Error ? requestError.message : 'Recenziile nu pot fi incarcate')
        }
      }
    }

    void loadPreviewReviews()

    return () => {
      isMounted = false
    }
  }, [productId])

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

  async function refreshPreviewReviews() {
    const result = await apiRequest<ProductReviewsResponse>(`/products/${currentProduct.id}/reviews?limit=2`)
    setPreviewReviews(result.reviews)
  }

  async function loadAllProductReviews() {
    setIsReviewsLoading(true)
    setReviewError('')
    try {
      const result = await apiRequest<ProductReviewsResponse>(`/products/${currentProduct.id}/reviews`)
      setAllReviews(result.reviews)
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : 'Recenziile nu pot fi incarcate')
    } finally {
      setIsReviewsLoading(false)
    }
  }

  async function openReviewsModal() {
    setIsReviewModalOpen(true)
    await loadAllProductReviews()
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentUser) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    if (isReviewInvalid) return

    setIsSubmittingReview(true)
    setReviewError('')
    try {
      const result = await apiRequest<{ review: ProductReview }>(`/products/${currentProduct.id}/reviews`, {
        body: jsonBody({ rating: reviewRating, text: reviewText }),
        method: 'POST',
      })
      setPreviewReviews((current) => [
        result.review,
        ...current.filter((review) => review.id !== result.review.id),
      ].slice(0, 2))
      setAllReviews((current) => [
        result.review,
        ...current.filter((review) => review.id !== result.review.id),
      ])
      setReviewText('')
      setReviewRating(5)
      await Promise.all([
        refresh(),
        refreshPreviewReviews(),
        isReviewModalOpen ? loadAllProductReviews() : Promise.resolve(),
      ])
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : 'Recenzia nu a putut fi salvata')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  async function handleReplySubmit(reviewId: string) {
    const text = replyTexts[reviewId]?.trim() ?? ''
    if (!currentUser) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    if (!text || countWords(text) > 200) return

    setSubmittingReplyId(reviewId)
    setReviewError('')
    try {
      await apiRequest(`/products/${currentProduct.id}/reviews/${reviewId}/replies`, {
        body: jsonBody({ text }),
        method: 'POST',
      })
      setReplyTexts((current) => ({ ...current, [reviewId]: '' }))
      await Promise.all([refreshPreviewReviews(), loadAllProductReviews()])
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : 'Raspunsul nu a putut fi salvat')
    } finally {
      setSubmittingReplyId(null)
    }
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
        <Link className={styles.backToCategory} to={`/products?category=${currentProduct.category}`}>
          <span aria-hidden="true" />
          Inapoi la {categoryLabels[currentProduct.category].toLowerCase()}
        </Link>

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

        <section className={styles.reviewsSection} aria-labelledby="reviews-title">
          <header className={styles.reviewsHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Recenzii clienti</p>
              <h2 id="reviews-title">Pareri despre produs</h2>
            </div>
            <button onClick={() => void openReviewsModal()} type="button">
              Vezi recenziile produsului
            </button>
          </header>

          <div
            className={
              previewReviews.length > 0 || reviewError
                ? styles.reviewsContent
                : `${styles.reviewsContent} ${styles.reviewsContentSingle}`
            }
          >
            <form className={styles.reviewForm} onSubmit={(event) => void handleReviewSubmit(event)}>
              <strong>{currentUser ? 'Lasa o recenzie' : 'Autentifica-te pentru a lasa o recenzie'}</strong>
              <div className={styles.ratingPicker} aria-label="Alege ratingul">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    aria-label={`${star} stele`}
                    className={star <= reviewRating ? styles.activeStar : ''}
                    key={star}
                    onClick={() => setReviewRating(star)}
                    type="button"
                  >
                    ★
                  </button>
                ))}
              </div>
              <label>
                <span>Text recenzie</span>
                <textarea
                  maxLength={1600}
                  onChange={(event) => setReviewText(event.target.value)}
                  placeholder="Spune pe scurt cum ti se pare produsul."
                  rows={4}
                  value={reviewText}
                />
              </label>
              <small className={reviewWordCount > 200 ? styles.limitExceeded : ''}>
                {reviewWordCount}/200 cuvinte
              </small>
              <button disabled={isSubmittingReview || isReviewInvalid} type="submit">
                {isSubmittingReview ? 'Se salveaza...' : 'Trimite recenzia'}
              </button>
            </form>

            {previewReviews.length > 0 || reviewError ? (
              <div className={styles.reviewPreviewList}>
                {reviewError ? <p className={styles.reviewError}>{reviewError}</p> : null}
                {previewReviews.map((review) => (
                  <article className={styles.reviewCard} key={review.id}>
                    <div className={styles.reviewMeta}>
                      <strong>{review.authorName}</strong>
                      <span>{formatReviewDate(review.createdAt)}</span>
                    </div>
                    <p className={styles.reviewStars} aria-label={`${review.rating} din 5 stele`}>
                      {renderStars(review.rating)}
                    </p>
                    <p>{review.text}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

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
                const image = getProductCardImage(item)

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

      {isReviewModalOpen ? (
        <div className={styles.reviewModalBackdrop} role="presentation">
          <section
            aria-labelledby="reviews-modal-title"
            aria-modal="true"
            className={styles.reviewModal}
            role="dialog"
          >
            <header className={styles.reviewModalHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Recenzii produs</p>
                <h2 id="reviews-modal-title">{currentProduct.name}</h2>
              </div>
              <button
                aria-label="Inchide recenziile"
                className={styles.closeModalButton}
                onClick={() => setIsReviewModalOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>

            {isReviewsLoading ? (
              <div className={styles.emptyReviews}>Se incarca recenziile...</div>
            ) : allReviews.length > 0 ? (
              <div className={styles.fullReviewList}>
                {allReviews.map((review) => {
                  const replyText = replyTexts[review.id] ?? ''
                  const replyWordCount = countWords(replyText)

                  return (
                    <article className={styles.reviewCard} key={review.id}>
                      <div className={styles.reviewMeta}>
                        <strong>{review.authorName}</strong>
                        <span>{formatReviewDate(review.createdAt)}</span>
                      </div>
                      <p className={styles.reviewStars} aria-label={`${review.rating} din 5 stele`}>
                        {renderStars(review.rating)}
                      </p>
                      <p>{review.text}</p>

                      {review.replies.length > 0 ? (
                        <div className={styles.replyList}>
                          {review.replies.map((reply) => (
                            <div className={styles.replyItem} key={reply.id}>
                              <div className={styles.reviewMeta}>
                                <strong>{reply.authorName}</strong>
                                <span>{formatReviewDate(reply.createdAt)}</span>
                              </div>
                              <p>{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <form
                        className={styles.replyForm}
                        onSubmit={(event) => {
                          event.preventDefault()
                          void handleReplySubmit(review.id)
                        }}
                      >
                        <label>
                          <span>Raspunde la recenzie</span>
                          <textarea
                            maxLength={1600}
                            onChange={(event) =>
                              setReplyTexts((current) => ({
                                ...current,
                                [review.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            value={replyText}
                          />
                        </label>
                        <div className={styles.replyActions}>
                          <small className={replyWordCount > 200 ? styles.limitExceeded : ''}>
                            {replyWordCount}/200 cuvinte
                          </small>
                          <button
                            disabled={
                              submittingReplyId === review.id ||
                              replyText.trim().length === 0 ||
                              replyWordCount > 200
                            }
                            type="submit"
                          >
                            {submittingReplyId === review.id ? 'Se trimite...' : 'Raspunde'}
                          </button>
                        </div>
                      </form>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className={styles.emptyReviews}>Nu exista recenzii pentru acest produs.</div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
