import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ModelViewerProps } from '../ModelViewer/ModelViewer'
import styles from './LazyModelViewer.module.scss'

const ModelViewer = lazy(() =>
  import('../ModelViewer/ModelViewer').then((module) => ({
    default: module.ModelViewer,
  })),
)

type LazyModelViewerProps = ModelViewerProps & {
  debugPath?: string
  rootMargin?: string
}

export function LazyModelViewer({
  debugPath,
  rootMargin = '420px',
  title,
  ...viewerProps
}: LazyModelViewerProps) {
  const [hasEntered, setHasEntered] = useState(false)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = containerRef.current

    if (!element || typeof IntersectionObserver === 'undefined') {
      setHasEntered(true)
      setIsNearViewport(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = Boolean(entry?.isIntersecting)

        setIsNearViewport(isIntersecting)

        if (isIntersecting) {
          setHasEntered(true)
        }
      },
      { rootMargin },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div
      ref={containerRef}
      className={styles.wrapper}
      data-debug-path={debugPath}
    >
      {hasEntered ? (
        <Suspense fallback={<ModelPlaceholder title={title} />}>
          <ModelViewer
            {...viewerProps}
            active={isNearViewport}
            title={title}
          />
        </Suspense>
      ) : (
        <ModelPlaceholder title={title} />
      )}
    </div>
  )
}

function ModelPlaceholder({ title }: Pick<ModelViewerProps, 'title'>) {
  return (
    <div className={styles.placeholder} aria-label={`${title} loading`}>
      <span>3D PREVIEW</span>
    </div>
  )
}
