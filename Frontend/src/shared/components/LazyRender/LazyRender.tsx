import { type ReactNode, useEffect, useRef, useState } from 'react'

type LazyRenderProps = {
  children: ReactNode
  fallback: ReactNode
  rootMargin?: string
}

export function LazyRender({
  children,
  fallback,
  rootMargin = '520px',
}: LazyRenderProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (shouldRender) {
      return undefined
    }

    const element = containerRef.current

    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldRender(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [rootMargin, shouldRender])

  return <div ref={containerRef}>{shouldRender ? children : fallback}</div>
}
