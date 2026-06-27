import { useCallback } from 'react'
import type { Object3D } from 'three'
import { LazyModelViewer } from '../../../../shared/components/LazyModelViewer/LazyModelViewer'
import type { CustomizationComponent } from '../../types'
import {
  applySceneConfiguration,
  prepareConfigurableScene,
} from '../../3d/applySceneConfiguration'
import styles from './ProductViewer3D.module.scss'

type ProductViewer3DProps = {
  activeComponentKey?: string
  components: CustomizationComponent[]
  modelPath?: string
  productId: string
  selectionsByOption: Record<string, string>
  title?: string
}

export function ProductViewer3D({
  activeComponentKey,
  components,
  modelPath,
  productId,
  selectionsByOption,
  title = 'Configured product preview',
}: ProductViewer3DProps) {
  const resolvedModelPath = productId === 'vortex-x7-racing-3d-custom'
    ? '/models/optimized/gaming_chair.glb'
    : productId === 'skullcandy-crusher-custom'
      ? '/models/optimized/casti_skull_x10.glb'
    : productId === 'aether-m9-oled-3d-custom-wireless'
      ? '/models/configurable/aether-m9-glossy.glb'
    : modelPath
  const isVertexK87 = productId === 'vertex-k87-3d-custom-wireless'
  const isKeyboard = isVertexK87 || productId === 'vertex-k68-pastel-3d-custom'
  const hasStaticPresentation = isKeyboard || productId === 'aether-m9-oled-3d-custom-wireless'
  const configureModel = useCallback((scene: Object3D) => {
    prepareConfigurableScene(scene)
    applySceneConfiguration(scene, {
      activeComponentKey,
      components,
      productId,
      selectionsByOption,
    })
  }, [activeComponentKey, components, productId, selectionsByOption])

  return (
    <div className={styles.viewer}>
      {resolvedModelPath ? (
        <LazyModelViewer
          autoRotate={!hasStaticPresentation}
          cameraPosition={[0, 0.3, 4.4]}
          className={styles.model}
          configureModel={configureModel}
          dpr={[1, 1.25]}
          fitModel={!isKeyboard}
          modelPath={resolvedModelPath}
          modelPosition={isVertexK87 ? [0, -0.75, 0] : isKeyboard ? [1.3, -0.75, 0] : undefined}
          modelRotation={isKeyboard ? [Math.PI / 2, 0, 0] : undefined}
          modelScale={isVertexK87 ? 800 : isKeyboard ? 0.85 : 2.55}
          rootMargin="520px"
          title={title}
          withEnvironment
        />
      ) : (
        <p>3D preview unavailable</p>
      )}
    </div>
  )
}
