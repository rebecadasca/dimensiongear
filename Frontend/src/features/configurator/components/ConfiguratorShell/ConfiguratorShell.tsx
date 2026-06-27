import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { useCart } from '../../../cart/CartContext'
import type { ConfigurationSelectionInput } from '../../../cart/types'
import type { Product } from '../../../catalog/types'
import type {
  CustomizationComponent,
  CustomizationOptionValue,
} from '../../types'
import { apiRequest, jsonBody } from '../../../../shared/api/client'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import { ProductViewer, type ScenePreviewVariant } from '../ProductViewer/ProductViewer'
import { ProductViewer3D } from '../ProductViewer3D/ProductViewer3D'
import styles from './ConfiguratorShell.module.scss'

type ConfiguratorShellProps = { product: Product }

type PendingStockSelection = {
  optionId: string
  value: CustomizationOptionValue
}

type ScenePreviewConfig = {
  rotateActiveLabel: string
  rotateLabel: string
  variant: ScenePreviewVariant
}

const scenePreviewConfigs: Record<string, ScenePreviewConfig> = {
  'nova-s6-air-3d-custom-wireless': {
    rotateActiveLabel: 'Opreste rotirea mouse-ului',
    rotateLabel: 'Roteste mouse-ul',
    variant: 'desk-mouse',
  },
  'skullcandy-crusher-custom': {
    rotateActiveLabel: 'Opreste rotirea previzualizarii',
    rotateLabel: 'Roteste previzualizarea',
    variant: 'headphones-person',
  },
  'vortex-x7-racing-3d-custom': {
    rotateActiveLabel: 'Opreste rotirea previzualizarii',
    rotateLabel: 'Roteste previzualizarea',
    variant: 'chair-desk',
  },
  'vertex-k68-pastel-3d-custom': {
    rotateActiveLabel: 'Opreste rotirea tastaturii',
    rotateLabel: 'Roteste tastatura',
    variant: 'keyboard-desk',
  },
}

const draftKey = (productId: string) => (
  `dimensiongear-draft-${productId}${
    productId === 'skullcandy-crusher-custom'
      ? '-v2'
      : productId === 'vortex-x7-racing-3d-custom'
        ? '-v2'
        : productId === 'vertex-k68-pastel-3d-custom'
          ? '-v2'
        : ''
  }`
)

export function ConfiguratorShell({ product }: ConfiguratorShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sourceConfigurationId = searchParams.get('configurationId') ?? undefined
  const { currentUser } = useAuth()
  const { addConfiguration } = useCart()
  const [components, setComponents] = useState<CustomizationComponent[]>([])
  const [selectionsByOption, setSelectionsByOption] = useState<Record<string, string>>({})
  const [activePartIndex, setActivePartIndex] = useState(0)
  const [price, setPrice] = useState(product.pricing.current)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDoneDialogOpen, setIsDoneDialogOpen] = useState(false)
  const [pendingStockSelection, setPendingStockSelection] = useState<PendingStockSelection | null>(null)
  const [exitTarget, setExitTarget] = useState<string | null>(null)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isScenePreviewOpen, setIsScenePreviewOpen] = useState(false)
  const [isScenePreparing, setIsScenePreparing] = useState(false)
  const [isSceneFullscreen, setIsSceneFullscreen] = useState(false)
  const [isSceneRotating, setIsSceneRotating] = useState(false)
  const [sceneZoomRequest, setSceneZoomRequest] = useState<{ direction: 'in' | 'out'; id: number }>({ direction: 'in', id: 0 })
  const [previewVersion, setPreviewVersion] = useState(0)
  const addToCartButtonRef = useRef<HTMLButtonElement>(null)
  const scenePreviewRef = useRef<HTMLDivElement>(null)
  const suppressExitPromptRef = useRef(false)

  const selections = useMemo<ConfigurationSelectionInput[]>(() =>
    components.flatMap((component) => component.options.flatMap((option) => {
      const valueId = selectionsByOption[option.id]
      return valueId ? [{ componentId: component.id, optionId: option.id, valueId }] : []
    })), [components, selectionsByOption])
  const totalOptionCount = useMemo(() =>
    components.reduce((count, component) => count + component.options.length, 0), [components])
  const scenePreviewConfig = scenePreviewConfigs[product.id]

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const result = await apiRequest<{ components: CustomizationComponent[] }>(`/products/${product.id}/customization`)
        if (cancelled) return
        const configuredComponents = result.components
        setComponents(configuredComponents)
        const defaults: Record<string, string> = {}
        for (const component of configuredComponents) {
          for (const option of component.options) {
            const first = option.values.find((value) => value.available)
            if (first) defaults[option.id] = first.id
          }
        }
        const storedDraft = sessionStorage.getItem(draftKey(product.id))
        if (storedDraft) Object.assign(defaults, JSON.parse(storedDraft))
        if (sourceConfigurationId && currentUser) {
          const history = await apiRequest<{ configuration: { selections: Array<{ optionId: string; valueId: string }> } }>(`/users/me/configurations/${sourceConfigurationId}`)
          for (const selection of history.configuration.selections) defaults[selection.optionId] = selection.valueId
        }
        setSelectionsByOption(defaults)
        setError('')
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Configurator indisponibil')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [currentUser, product.id, sourceConfigurationId])

  useEffect(() => {
    if (!components.length || selections.length !== totalOptionCount) return
    const timeout = window.setTimeout(() => {
      void apiRequest<{ price: string }>(`/products/${product.id}/customization/quote`, {
        method: 'POST', body: jsonBody({ selections }),
      }).then((quote) => { setPrice(quote.price); setError('') })
        .catch((quoteError) => setError(quoteError instanceof Error ? quoteError.message : 'Preț indisponibil'))
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [components, product.id, selections, totalOptionCount])

  useEffect(() => {
    if (!isDoneDialogOpen && !pendingStockSelection) return
    if (isDoneDialogOpen) addToCartButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDoneDialogOpen(false)
        setPendingStockSelection(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isDoneDialogOpen, pendingStockSelection])

  useEffect(() => {
    if (isSaved) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isSaved])

  useEffect(() => {
    if (isSaved) return
    const interceptNavigation = (event: MouseEvent) => {
      if (suppressExitPromptRef.current) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target || anchor.origin !== window.location.origin) return
      const nextPath = `${anchor.pathname}${anchor.search}${anchor.hash}`
      const currentPath = `${location.pathname}${location.search}${location.hash}`
      if (nextPath === currentPath) return
      event.preventDefault()
      setExitTarget(nextPath)
      setIsExitDialogOpen(true)
    }
    document.addEventListener('click', interceptNavigation, true)
    return () => document.removeEventListener('click', interceptNavigation, true)
  }, [isSaved, location.hash, location.pathname, location.search])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsSceneFullscreen(document.fullscreenElement === scenePreviewRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const activePart = components[activePartIndex]
  const activePartLabel = product.id === 'nova-s6-air-3d-custom-wireless' && activePart?.key === 'illuminated-logo'
    ? 'Logo'
    : activePart?.label
  const colorOption = activePart?.options.find((option) => option.type === 'color')
  const secondaryOptions = activePart?.options.filter((option) => option.type !== 'color') ?? []

  function selectValue(optionId: string, valueId: string) {
    setIsSaved(false)
    setSelectionsByOption((current) => ({ ...current, [optionId]: valueId }))
  }

  function requestValueSelection(optionId: string, value: CustomizationOptionValue) {
    if (!value.inStock && selectionsByOption[optionId] !== value.id) {
      setPendingStockSelection({ optionId, value })
      return
    }

    selectValue(optionId, value.id)
  }

  function confirmOutOfStockSelection() {
    if (!pendingStockSelection) return
    selectValue(pendingStockSelection.optionId, pendingStockSelection.value.id)
    setPendingStockSelection(null)
  }

  function requireLogin() {
    sessionStorage.setItem(draftKey(product.id), JSON.stringify(selectionsByOption))
    suppressExitPromptRef.current = true
    navigate(`/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`)
  }

  async function handleAddToCart() {
    if (!currentUser) { requireLogin(); return }
    try {
      await addConfiguration({ productSlug: product.id, selections, sourceConfigurationId })
      sessionStorage.removeItem(draftKey(product.id))
      suppressExitPromptRef.current = true
      navigate('/cart')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nu s-a putut adăuga configurația')
      setIsDoneDialogOpen(false)
    }
  }

  async function handleSaveOnly() {
    if (!currentUser) { requireLogin(); return }
    try {
      await apiRequest('/configurations', {
        method: 'POST',
        body: jsonBody({ productSlug: product.id, selections, sourceConfigurationId }),
      })
      sessionStorage.removeItem(draftKey(product.id))
      setIsSaved(true)
      setIsDoneDialogOpen(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nu s-a putut salva configurația')
      setIsDoneDialogOpen(false)
    }
  }

  async function openScenePreview() {
    if (!scenePreviewConfig) {
      setPreviewVersion((value) => value + 1)
      return
    }
    if (!components.length || selections.length !== totalOptionCount) {
      setError('Asteapta finalizarea configuratiei inainte de previzualizare.')
      return
    }
    setIsScenePreviewOpen(true)
    setIsScenePreparing(true)
    setIsSceneRotating(false)
    if (!currentUser) {
      setIsScenePreparing(false)
      return
    }
    try {
      await apiRequest('/configuration-sessions/preview', {
        method: 'POST',
        body: jsonBody({ productSlug: product.id, selections, sourceConfigurationId }),
      })
    } catch {
      // Previzualizarea ramane disponibila chiar daca salvarea temporara nu raspunde.
    } finally {
      setIsScenePreparing(false)
    }
  }

  async function closeScenePreview() {
    if (document.fullscreenElement === scenePreviewRef.current) {
      await document.exitFullscreen().catch(() => undefined)
    }
    setIsScenePreviewOpen(false)
  }

  async function toggleSceneFullscreen() {
    if (document.fullscreenElement === scenePreviewRef.current) {
      await document.exitFullscreen().catch(() => undefined)
      return
    }
    await scenePreviewRef.current?.requestFullscreen().catch(() => undefined)
  }

  async function finishScenePreview() {
    await closeScenePreview()
    await handleAddToCart()
  }

  function requestSceneZoom(direction: 'in' | 'out') {
    setSceneZoomRequest((current) => ({ direction, id: current.id + 1 }))
  }

  function previousPart() {
    setActivePartIndex((index) => index === 0 ? components.length - 1 : index - 1)
  }

  function nextPart() {
    setActivePartIndex((index) => index === components.length - 1 ? 0 : index + 1)
  }

  function requestExit(target = `/products/${product.id}`) {
    if (isSaved) {
      navigate(target)
      return
    }
    setExitTarget(target)
    setIsExitDialogOpen(true)
  }

  function confirmExit() {
    suppressExitPromptRef.current = true
    setIsExitDialogOpen(false)
    navigate(exitTarget ?? `/products/${product.id}`)
  }

  function cancelExit() {
    setIsExitDialogOpen(false)
    setExitTarget(null)
  }

  if (isLoading) return <div className={styles.shell}><div className={styles.heroStage}>Se încarcă configuratorul...</div></div>
  if (!activePart) return <div className={styles.shell}><div className={styles.heroStage}>{error || 'Nu există opțiuni de personalizare disponibile.'}</div></div>

  return (
    <div className={styles.shell}>
      <section className={styles.heroStage} aria-label="Previzualizare produs">
        <header className={styles.heroHeader}>
          <div className={styles.productMeta}>
            <h1>{product.name}</h1>
            <p>{formatCurrency(price)}</p>
            <div className={styles.previewActions}>
              <button className={styles.previewButton} onClick={() => void openScenePreview()} type="button">Previzualizare scenă</button>
              <button className={styles.exitButton} onClick={() => requestExit()} type="button">Inapoi la produs</button>
            </div>
          </div>
          <div className={styles.doneAction}>
            <button className={styles.doneButton} onClick={() => setIsDoneDialogOpen(true)} type="button">Gata</button>
            {isSaved ? <span role="status">Configurație salvată</span> : null}
            {error ? <span role="alert">{error}</span> : null}
          </div>
        </header>
        <div className={styles.viewerStage}>
          <ProductViewer3D
            activeComponentKey={activePart.key}
            components={components}
            key={previewVersion}
            modelPath={product.customization?.model3DUrl}
            productId={product.id}
            selectionsByOption={selectionsByOption}
            title={`Previzualizare configurată pentru ${product.name}`}
          />
        </div>
      </section>

      <section className={styles.controls} aria-label="Controale configurator">
        <div className={styles.partNavigator}>
          <button aria-label="Componenta anterioară" className={styles.navButton} onClick={previousPart} type="button"><span aria-hidden="true" /></button>
          <div><h2>{activePartLabel}</h2><strong>{activePartIndex + 1}/{components.length}</strong></div>
          <button aria-label="Componenta următoare" className={`${styles.navButton} ${styles.nextButton}`} onClick={nextPart} type="button"><span aria-hidden="true" /></button>
        </div>

        {secondaryOptions.map((option) => (
          <div className={styles.materialTabs} key={option.id} aria-label={option.label}>
            {option.values.map((value) => (
              <button className={selectionsByOption[option.id] === value.id ? styles.selected : ''} disabled={!value.available} key={value.id} onClick={() => selectValue(option.id, value.id)} type="button">{value.label}</button>
            ))}
          </div>
        ))}

        {colorOption ? (
          <div className={styles.colorList}>
            {colorOption.values.map((color) => (
              <button aria-label={`${activePartLabel} ${color.label}${color.inStock ? '' : ', indisponibil în stoc'}`} className={`${selectionsByOption[colorOption.id] === color.id ? styles.selectedColor : ''} ${!color.inStock ? styles.outOfStockColor : ''}`} disabled={!color.available} key={color.id} onClick={() => requestValueSelection(colorOption.id, color)} style={{ '--swatch-color': color.hex } as CSSProperties} type="button"><span /><strong>{color.label}</strong>{!color.inStock ? <small>+{formatCurrency(color.priceModifier)}</small> : null}</button>
            ))}
          </div>
        ) : null}
      </section>

      {pendingStockSelection ? (
        <div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) setPendingStockSelection(null) }}>
          <section aria-describedby="stock-dialog-description" aria-labelledby="stock-dialog-title" aria-modal="true" className={styles.doneDialog} role="dialog">
            <span className={styles.dialogEyebrow}>Culoare disponibilă la comandă</span>
            <h2 id="stock-dialog-title">Culoarea nu este disponibilă în stoc</h2>
            <p id="stock-dialog-description">Dacă selectați culoarea {pendingStockSelection.value.label}, prețul va crește cu {formatCurrency(pendingStockSelection.value.priceModifier)}. Doriți să continuați?</p>
            <div className={styles.dialogActions}>
              <button autoFocus className={styles.primaryDialogButton} onClick={confirmOutOfStockSelection} type="button">Da, continuă</button>
              <button className={styles.secondaryDialogButton} onClick={() => setPendingStockSelection(null)} type="button">Anulează</button>
            </div>
          </section>
        </div>
      ) : null}

      {isDoneDialogOpen ? (
        <div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) setIsDoneDialogOpen(false) }}>
          <section aria-describedby="done-dialog-description" aria-labelledby="done-dialog-title" aria-modal="true" className={styles.doneDialog} role="dialog">
            <span className={styles.dialogEyebrow}>Configurația este gata</span>
            <h2 id="done-dialog-title">Vrei să adaugi produsul în coș?</h2>
            <p id="done-dialog-description">Dacă îl adaugi, configurația va fi salvată automat.</p>
            {!currentUser ? <p>Trebuie să te autentifici înainte de a salva configurația.</p> : null}
            <div className={styles.dialogActions}>
              <button className={styles.primaryDialogButton} onClick={() => void handleAddToCart()} ref={addToCartButtonRef} type="button">{currentUser ? 'Adaugă în coș' : 'Autentifică-te pentru adăugare'}</button>
              <button className={styles.secondaryDialogButton} onClick={() => void handleSaveOnly()} type="button">{currentUser ? 'Nu, doar salvează' : 'Autentifică-te pentru salvare'}</button>
            </div>
          </section>
        </div>
      ) : null}

      {isExitDialogOpen ? (
        <div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) cancelExit() }}>
          <section aria-describedby="exit-dialog-description" aria-labelledby="exit-dialog-title" aria-modal="true" className={styles.doneDialog} role="dialog">
            <span className={styles.dialogEyebrow}>Sesiune nesalvata</span>
            <h2 id="exit-dialog-title">Renunti la configurare?</h2>
            <p id="exit-dialog-description">nu ai salvat sesiunea de configurare, esti sigur ca vrei sa renunti?</p>
            <div className={styles.dialogActions}>
              <button autoFocus className={styles.primaryDialogButton} onClick={confirmExit} type="button">Iesire</button>
              <button className={styles.secondaryDialogButton} onClick={cancelExit} type="button">Anuleaza</button>
            </div>
          </section>
        </div>
      ) : null}

      {isScenePreviewOpen && scenePreviewConfig ? createPortal((
        <div className={styles.sceneOverlay} ref={scenePreviewRef}>
          <ProductViewer
            components={components}
            isPreviewRotating={isSceneRotating}
            modelPath={product.customization?.model3DUrl}
            productId={product.id}
            selectionsByOption={selectionsByOption}
            title={`Previzualizare in spatiu pentru ${product.name}`}
            variant={scenePreviewConfig.variant}
            zoomRequest={sceneZoomRequest}
          />
          <div className={styles.sceneChrome}>
            <header className={styles.sceneHeader}>
              <button className={styles.sceneBackButton} onClick={() => void closeScenePreview()} type="button">Inapoi la configurare</button>
            </header>
            {isScenePreparing ? (
              <p className={styles.sceneStatus} role="status">
                Pregatim scena...
              </p>
            ) : null}
            <div className={styles.sceneControls}>
              <button className={isSceneRotating ? styles.activeSceneControl : ''} onClick={() => setIsSceneRotating((value) => !value)} type="button">
                {isSceneRotating ? scenePreviewConfig.rotateActiveLabel : scenePreviewConfig.rotateLabel}
              </button>
              <button onClick={() => requestSceneZoom('in')} type="button">Zoom in</button>
              <button onClick={() => requestSceneZoom('out')} type="button">Zoom out</button>
              <button onClick={() => void toggleSceneFullscreen()} type="button">
                {isSceneFullscreen ? 'Iesi din ecran complet' : 'Ecran complet'}
              </button>
            </div>
            <button className={styles.sceneFinishButton} onClick={() => void finishScenePreview()} type="button">Finalizare configurare</button>
          </div>
        </div>
      ), document.body) : null}
    </div>
  )
}
