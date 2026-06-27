import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useCatalog } from '../../features/catalog/CatalogContext'
import { getProductCardImage } from '../../features/catalog/getProductCardImage'
import type { Product, ProductCategory } from '../../features/catalog/types'
import styles from './ProductsPage.module.scss'

type ProductCard = {
  imageAlt: string
  imageSrc: string
  product: Product
}

type FilterOption = {
  groupId: string
  id: string
  label: string
  matches: (product: Product) => boolean
}

type FilterGroup = {
  id: string
  options: FilterOption[]
  title: string
}

const categoryLabels: Record<ProductCategory, string> = {
  'gaming-chair': 'Scaune',
  headset: 'Căști',
  keyboard: 'Tastaturi',
  mouse: 'Mouse',
}

const validCategories: ProductCategory[] = [
  'gaming-chair',
  'headset',
  'keyboard',
  'mouse',
]

const priceFormatter = new Intl.NumberFormat('ro-RO', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function getCategoryParam(value: string | null): ProductCategory | null {
  return value && validCategories.includes(value as ProductCategory)
    ? (value as ProductCategory)
    : null
}

function getBooleanSpec(product: Product, key: string) {
  return product.specifications[key] === true
}

function getNumberSpec(product: Product, key: string) {
  const value = product.specifications[key]

  return typeof value === 'number' ? value : null
}

function getStringSpec(product: Product, key: string) {
  const value = product.specifications[key]

  return typeof value === 'string' ? value.toLowerCase() : ''
}

function hasTag(product: Product, tagPart: string) {
  const normalizedTagPart = tagPart.toLowerCase()

  return product.tags.some((tag) => tag.toLowerCase().includes(normalizedTagPart))
}

function makeOption(
  groupId: string,
  id: string,
  label: string,
  matches: (product: Product) => boolean,
): FilterOption {
  return { groupId, id, label, matches }
}

function makeGroup(
  id: string,
  title: string,
  categoryProducts: Product[],
  options: FilterOption[],
): FilterGroup | null {
  const availableOptions = options.filter((option) =>
    categoryProducts.some((product) => option.matches(product)),
  )

  return availableOptions.length > 0
    ? { id, options: availableOptions, title }
    : null
}

function makeWarrantyGroup(categoryProducts: Product[]) {
  const values = Array.from(
    new Set(
      categoryProducts
        .map((product) => getNumberSpec(product, 'warrantyMonths'))
        .filter((value): value is number => typeof value === 'number'),
    ),
  ).sort((left, right) => left - right)

  return values.length > 0
    ? {
        id: 'warranty',
        options: values.map((value) =>
          makeOption(
            'warranty',
            `warranty-${value}`,
            `${value} luni`,
            (product) => getNumberSpec(product, 'warrantyMonths') === value,
          ),
        ),
        title: 'Garanție',
      }
    : null
}

function makeCategoryFilterGroups(
  category: ProductCategory,
  categoryProducts: Product[],
): FilterGroup[] {
  const generalGroups = [
    makeGroup('general', 'General', categoryProducts, [
      makeOption('general', 'in-stock', 'În stoc', (product) =>
        product.colors.some((color) => color.inStock),
      ),
      makeOption('general', 'discounts', 'Reduceri', (product) =>
        Boolean(product.pricing.previous),
      ),
    ]),
    makeGroup('product-type', 'Tip produs', categoryProducts, [
      makeOption('product-type', 'customizable', 'Personalizabil', (product) =>
        product.productType === 'customizable',
      ),
      makeOption('product-type', 'classic', 'Clasic', (product) =>
        product.productType === 'classic',
      ),
    ]),
    makeGroup('rating', 'Recenzii clienți', categoryProducts, [
      makeOption('rating', 'rating-4', '4 stele sau mai mult', (product) =>
        product.rating >= 4,
      ),
      makeOption('rating', 'with-reviews', 'Cu recenzii', (product) =>
        product.reviewCount > 0,
      ),
    ]),
    makeWarrantyGroup(categoryProducts),
  ]

  const categoryGroups: Record<ProductCategory, Array<FilterGroup | null>> = {
    'gaming-chair': [
      makeGroup('comfort', 'Confort', categoryProducts, [
        makeOption('comfort', 'lumbar-support', 'Suport lombar', (product) =>
          getBooleanSpec(product, 'hasLumbarSupport'),
        ),
        makeOption('comfort', 'headrest-pillow', 'Pernă pentru cap', (product) =>
          getBooleanSpec(product, 'hasHeadrestPillow'),
        ),
        makeOption('comfort', 'reclining-backrest', 'Spătar rabatabil', (product) =>
          getBooleanSpec(product, 'recliningBackrest'),
        ),
      ]),
      makeGroup('chair-build', 'Construcție', categoryProducts, [
        makeOption('chair-build', 'armrests-4d', 'Brațe 4D', (product) =>
          getStringSpec(product, 'armrestType').includes('4d'),
        ),
        makeOption('chair-build', 'fabric', 'Tapițerie textilă', (product) =>
          getStringSpec(product, 'upholsteryMaterial').includes('fabric'),
        ),
        makeOption('chair-build', 'leather', 'Tapițerie din piele', (product) =>
          getStringSpec(product, 'upholsteryMaterial').includes('leather'),
        ),
        makeOption('chair-build', '150kg', '150 kg sau mai mult', (product) =>
          (getNumberSpec(product, 'maxWeightKg') ?? 0) >= 150,
        ),
      ]),
    ],
    headset: [
      makeGroup('technology', 'Tehnologie', categoryProducts, [
        makeOption('technology', 'wireless', 'Wireless/Bluetooth', (product) =>
          hasTag(product, 'wireless') || hasTag(product, 'bluetooth'),
        ),
        makeOption('technology', 'low-latency', 'Latență redusă', (product) =>
          hasTag(product, 'low-latency') || hasTag(product, 'hyperspeed'),
        ),
      ]),
      makeGroup('microphone', 'Microfon', categoryProducts, [
        makeOption('microphone', 'mic-yes', 'Inclus', (product) =>
          getBooleanSpec(product, 'microphoneIncluded'),
        ),
        makeOption('microphone', 'detachable-mic', 'Detașabil', (product) =>
          hasTag(product, 'detachable-mic'),
        ),
      ]),
    ],
    keyboard: [
      makeGroup('technology', 'Tehnologie', categoryProducts, [
        makeOption('technology', 'wireless', 'Wireless', (product) =>
          getBooleanSpec(product, 'isWireless'),
        ),
        makeOption('technology', 'wired', 'Cu fir', (product) =>
          !getBooleanSpec(product, 'isWireless'),
        ),
      ]),
      makeGroup('keyboard-build', 'Construcție tastatură', categoryProducts, [
        makeOption('keyboard-build', 'mechanical', 'Mecanică', (product) =>
          getBooleanSpec(product, 'isMechanical'),
        ),
        makeOption('keyboard-build', 'numeric', 'Taste numerice', (product) =>
          getBooleanSpec(product, 'hasNumericKeys'),
        ),
        makeOption('keyboard-build', 'compact', 'Layout compact', (product) =>
          !getBooleanSpec(product, 'hasNumericKeys'),
        ),
      ]),
    ],
    mouse: [
      makeGroup('technology', 'Tehnologie', categoryProducts, [
        makeOption('technology', 'wireless', 'Wireless', (product) =>
          getBooleanSpec(product, 'wireless'),
        ),
        makeOption('technology', 'wired', 'Cu fir', (product) =>
          !getBooleanSpec(product, 'wireless'),
        ),
      ]),
      makeGroup('mouse-build', 'Construcție mouse', categoryProducts, [
        makeOption('mouse-build', 'rgb', 'Iluminare RGB', (product) =>
          getBooleanSpec(product, 'hasRgbLighting'),
        ),
        makeOption('mouse-build', '20000-dpi', '20,000 DPI+', (product) =>
          (getNumberSpec(product, 'maxDpi') ?? 0) >= 20000,
        ),
        makeOption('mouse-build', 'ergonomic', 'Ergonomic', (product) =>
          hasTag(product, 'ergonomic'),
        ),
      ]),
    ],
  }

  return [...generalGroups, ...categoryGroups[category]].filter(
    (group): group is FilterGroup => Boolean(group),
  )
}

function formatPrice(price: string) {
  return `${priceFormatter.format(new Decimal(price).toNumber())} RON`
}

export function ProductsPage() {
  const { error, isLoading, products } = useCatalog()
  const [searchParams] = useSearchParams()
  const activeCategory = getCategoryParam(searchParams.get('category'))
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [selectedFilterIds, setSelectedFilterIds] = useState<string[]>([])

  const productCards = useMemo<ProductCard[]>(
    () =>
      products.map((product) => {
        const primaryImage = getProductCardImage(product)

        return {
          imageAlt: primaryImage?.alt ?? product.name,
          imageSrc: primaryImage?.src ?? '',
          product,
        }
      }),
    [products],
  )

  const categoryProductCards = activeCategory
    ? productCards.filter(({ product }) => product.category === activeCategory)
    : []
  const categoryProducts = categoryProductCards.map(({ product }) => product)
  const categoryMaxPrice = Math.max(
    100,
    Math.ceil(
      Math.max(...categoryProducts.map((product) => new Decimal(product.pricing.current).toNumber()), 100) / 50,
    ) * 50,
  )
  const effectiveMaxPrice = Math.min(maxPrice, categoryMaxPrice)
  const filterGroups = activeCategory
    ? makeCategoryFilterGroups(activeCategory, categoryProducts)
    : []
  const selectedOptionsByGroup = filterGroups.map((group) => ({
    group,
    selectedOptions: group.options.filter((option) =>
      selectedFilterIds.includes(option.id),
    ),
  }))
  const activeFilterCount = selectedOptionsByGroup.reduce(
    (count, { selectedOptions }) => count + selectedOptions.length,
    0,
  )
  const visibleProducts = categoryProductCards.filter(({ product }) => {
    if (new Decimal(product.pricing.current).greaterThan(effectiveMaxPrice)) {
      return false
    }

    return selectedOptionsByGroup.every(({ selectedOptions }) => {
      if (selectedOptions.length === 0) {
        return true
      }

      return selectedOptions.some((option) => option.matches(product))
    })
  })

  function toggleFilter(filterId: string) {
    setSelectedFilterIds((current) =>
      current.includes(filterId)
        ? current.filter((id) => id !== filterId)
        : [...current, filterId],
    )
  }

  function clearFilters() {
    setSelectedFilterIds([])
    setMaxPrice(categoryMaxPrice)
  }

  if (isLoading) {
    return <section className={styles.page}><div className={styles.emptyState}>Se încarcă produsele...</div></section>
  }

  if (error) {
    return <section className={styles.page}><div className={styles.emptyState}>{error}</div></section>
  }

  if (!activeCategory) {
    return <Navigate replace to="/products?category=mouse" />
  }

  return (
    <section
      className={`${styles.page} ${styles.categoryProducts}`}
      data-debug-path="src/pages/ProductsPage/ProductsPage.module.scss -> .page"
    >
      <span className={styles.categoryGlowRight} aria-hidden="true" />

        <div className={styles.categoryProductsContent}>
          <header className={styles.productsHeader}>
            <div>
              <h1>Pregătește-ți setupul!</h1>
              <p>Alege produsul potrivit și rafinează lista cu filtrele disponibile.</p>
            </div>

            <div className={styles.filterDock}>
              <button
                aria-expanded={isFilterOpen}
                className={styles.filterToggle}
                onClick={() => setIsFilterOpen((current) => !current)}
                type="button"
              >
                {isFilterOpen ? 'Ascunde filtrele' : 'Arată filtrele'}
              </button>

              {isFilterOpen ? (
                <div className={styles.filterMenu}>
                  <label className={styles.priceControl}>
                    <span>Preț</span>
                    <input
                      max={categoryMaxPrice}
                      min="0"
                      onChange={(event) => setMaxPrice(Number(event.target.value))}
                      step="50"
                      type="range"
                      value={effectiveMaxPrice}
                    />
                    <small>
                      <span>0</span>
                      <span>{effectiveMaxPrice}</span>
                    </small>
                  </label>

                  <div className={styles.filterGroups}>
                    {filterGroups.map((group) => (
                      <fieldset className={styles.filterGroup} key={group.id}>
                        <legend>{group.title}</legend>
                        <div>
                          {group.options.map((option) => (
                            <label className={styles.checkboxLabel} key={option.id}>
                              <input
                                checked={selectedFilterIds.includes(option.id)}
                                onChange={() => toggleFilter(option.id)}
                                type="checkbox"
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>

                  {activeFilterCount > 0 || effectiveMaxPrice < categoryMaxPrice ? (
                    <button
                      className={styles.clearFilters}
                      onClick={clearFilters}
                      type="button"
                    >
                      Curăță filtrele
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>

          <div className={styles.productsToolbar}>
            <strong>{categoryLabels[activeCategory]}</strong>
          </div>

          {visibleProducts.length > 0 ? (
            <div className={styles.productsGrid}>
              {visibleProducts.map((item) => (
                <article
                  className={`${styles.productCard} ${
                    item.product.productType === 'customizable'
                      ? styles.customProduct
                      : styles.basicProduct
                  }`}
                  key={item.product.id}
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className={styles.productFrame}
                    src="/design-reference/assets/view-categories-card.png"
                  />
                  {item.product.productType === 'customizable' ? (
                    <span className={styles.productBadge}>personalizabil</span>
                  ) : null}

                  <Link
                    aria-label={`Vezi ${item.product.name}`}
                    className={styles.productMediaLink}
                    to={`/products/${item.product.id}`}
                  >
                    <img
                      alt={item.imageAlt}
                      className={styles.productImage}
                      src={item.imageSrc}
                    />
                  </Link>

                  <div className={styles.productInfo}>
                    <div className={styles.productTitleRow}>
                      <div>
                        <p>{categoryLabels[item.product.category]}</p>
                        <h2>{item.product.name}</h2>
                      </div>
                      <strong>{formatPrice(item.product.pricing.current)}</strong>
                    </div>

                    <p className={styles.productDescription}>
                      {item.product.description.short}
                    </p>

                    <div className={styles.productFooter}>
                      <div
                        aria-label={`Opțiuni de culoare pentru ${item.product.name}`}
                        className={styles.swatches}
                      >
                        {item.product.colors.map((color) => (
                          <span
                            aria-label={color.label}
                            key={color.id}
                            style={{ backgroundColor: color.hex }}
                            title={color.label}
                          />
                        ))}
                      </div>
                        <Link to={`/products/${item.product.id}`}>detalii</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>Nu există produse pentru aceste filtre.</strong>
              <button onClick={clearFilters} type="button">
                Resetează filtrele
              </button>
            </div>
          )}
        </div>
    </section>
  )
}
