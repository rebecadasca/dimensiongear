import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  useGLTF,
} from '@react-three/drei'
import {
  Box3,
  type Group,
  type Object3D,
  type Vector3Tuple,
  Vector3,
} from 'three'
import { clone as cloneScene } from 'three/addons/utils/SkeletonUtils.js'
import type { CustomizationComponent } from '../../types'
import {
  applySceneConfiguration,
  prepareConfigurableScene,
} from '../../3d/applySceneConfiguration'
import styles from './ProductViewer.module.scss'

const DESK_SCENE_PATH = '/models/scenes/gaming-desk-scene.glb'
const FALLBACK_MOUSE_POSITION: Vector3Tuple = [1.39, 0.16, -0.38]
const MOUSE_TARGET: Vector3Tuple = [1.39, 0.24, -0.38]
const MOUSE_LENGTH_IN_SCENE = 1.15
const MIN_CAMERA_DISTANCE = 1.25
const MAX_CAMERA_DISTANCE = 12

type SceneZoomRequest = {
  direction: 'in' | 'out'
  id: number
}

type ProductViewerProps = {
  components: CustomizationComponent[]
  isMouseRotating: boolean
  modelPath?: string
  productId: string
  selectionsByOption: Record<string, string>
  title?: string
  zoomRequest: SceneZoomRequest
}

type NormalizedModel = {
  model: Object3D
  offset: Vector3Tuple
  scale: number
}

function LoadingState() {
  return (
    <Html center className={styles.loading}>
      Pregatim scena...
    </Html>
  )
}

function normalizeModel(model: Object3D): NormalizedModel {
  model.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(model)
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  const footprint = Math.max(size.x, size.z, size.y)
  const scale = footprint > 0 ? MOUSE_LENGTH_IN_SCENE / footprint : 1

  return {
    model,
    offset: [-center.x, -box.min.y, -center.z],
    scale,
  }
}

function DeskScene({ onAnchorFound }: { onAnchorFound: (position: Vector3Tuple) => void }) {
  const { scene } = useGLTF(DESK_SCENE_PATH)
  const deskScene = useMemo(() => {
    const clonedScene = cloneScene(scene)
    clonedScene.updateWorldMatrix(true, true)
    const anchor = clonedScene.getObjectByName('MouseAnchor')
    if (anchor) anchor.visible = false
    return clonedScene
  }, [scene])

  useLayoutEffect(() => {
    const anchor = deskScene.getObjectByName('MouseAnchor')
    if (anchor) {
      const position = anchor.getWorldPosition(new Vector3())
      onAnchorFound([position.x, position.y + 0.16, position.z])
    } else {
      onAnchorFound(FALLBACK_MOUSE_POSITION)
    }
  }, [deskScene, onAnchorFound])

  return <primitive object={deskScene} />
}

function ConfiguredMouse({
  components,
  isMouseRotating,
  modelPath,
  mousePosition,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isMouseRotating' | 'modelPath' | 'productId' | 'selectionsByOption'> & {
  mousePosition: Vector3Tuple
}) {
  const groupRef = useRef<Group | null>(null)
  const { scene } = useGLTF(modelPath ?? '/models/optimized/ice_claw_mouse.optimized.glb')
  const normalized = useMemo(() => normalizeModel(cloneScene(scene)), [scene])

  useLayoutEffect(() => {
    prepareConfigurableScene(normalized.model)
    applySceneConfiguration(normalized.model, {
      components,
      productId,
      selectionsByOption,
    })
  }, [components, normalized.model, productId, selectionsByOption])

  useFrame((_state, delta) => {
    if (!isMouseRotating || !groupRef.current) return
    groupRef.current.rotation.y += delta * 0.65
  })

  return (
    <group position={mousePosition} ref={groupRef} rotation={[0, -0.18, 0]}>
      <group scale={normalized.scale}>
        <primitive object={normalized.model} position={normalized.offset} />
      </group>
    </group>
  )
}

function ProductScene({
  components,
  isMouseRotating,
  modelPath,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isMouseRotating' | 'modelPath' | 'productId' | 'selectionsByOption'>) {
  const [mousePosition, setMousePosition] = useState<Vector3Tuple>(FALLBACK_MOUSE_POSITION)

  return (
    <>
      <DeskScene onAnchorFound={setMousePosition} />
      <ConfiguredMouse
        components={components}
        isMouseRotating={isMouseRotating}
        modelPath={modelPath}
        mousePosition={mousePosition}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    </>
  )
}

function CameraZoomController({ zoomRequest }: { zoomRequest: SceneZoomRequest }) {
  const { camera } = useThree()

  useEffect(() => {
    if (!zoomRequest.id) return

    const target = new Vector3(...MOUSE_TARGET)
    const direction = camera.position.clone().sub(target)
    const currentDistance = direction.length()
    if (!currentDistance) return

    const scale = zoomRequest.direction === 'in' ? 0.82 : 1.24
    const nextDistance = Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, currentDistance * scale))
    direction.setLength(nextDistance)
    camera.position.copy(target).add(direction)
    camera.updateProjectionMatrix()
  }, [camera, zoomRequest])

  return null
}

export function ProductViewer({
  components,
  isMouseRotating,
  modelPath,
  productId,
  selectionsByOption,
  title = 'Previzualizare in spatiu',
  zoomRequest,
}: ProductViewerProps) {
  return (
    <div className={styles.viewer} aria-label={title}>
      <Canvas
        camera={{ fov: 42, position: [3.25, 1.75, 3.35] }}
        className={styles.canvas}
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        performance={{ min: 0.55 }}
        shadows
      >
        <color attach="background" args={['#020806']} />
        <ambientLight intensity={0.72} />
        <directionalLight intensity={2.4} position={[3.8, 5.2, 2.5]} />
        <spotLight
          angle={0.46}
          castShadow
          intensity={4}
          penumbra={0.65}
          position={[1.4, 2.8, 1.8]}
        />
        <Suspense fallback={<LoadingState />}>
          <ProductScene
            components={components}
            isMouseRotating={isMouseRotating}
            modelPath={modelPath}
            productId={productId}
            selectionsByOption={selectionsByOption}
          />
          <Environment resolution={64}>
            <Lightformer
              color="#19ff76"
              intensity={2.2}
              position={[0, 3, -4]}
              scale={[5, 2, 1]}
            />
            <Lightformer
              color="#51ffd1"
              intensity={1.6}
              position={[4, 2.5, 3]}
              scale={[3, 4, 1]}
            />
          </Environment>
        </Suspense>
        <CameraZoomController zoomRequest={zoomRequest} />
        <OrbitControls
          enableDamping
          enablePan={false}
          enableZoom
          maxDistance={MAX_CAMERA_DISTANCE}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={MIN_CAMERA_DISTANCE}
          minPolarAngle={Math.PI / 5.2}
          target={MOUSE_TARGET}
        />
      </Canvas>
    </div>
  )
}
