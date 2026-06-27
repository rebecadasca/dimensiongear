import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  useGLTF,
} from '@react-three/drei'
import {
  type Group,
  Mesh,
  MeshStandardMaterial,
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

export type ScenePreviewVariant = 'desk-mouse' | 'headphones-person' | 'chair-desk' | 'keyboard-desk'

const DESK_SCENE_PATH = '/models/scenes/mouse-gaming-desk-scene.glb'
const MOUSE_PREVIEW_PATH = '/models/preview/mouse-preview.glb'
const KEYBOARD_SCENE_PATH = '/models/scenes/keyboard-gaming-desk-scene.glb'
const KEYBOARD_PREVIEW_PATH = '/models/preview/keyboard-gaming-desk-preview.glb'
const PERSON_HEADPHONES_SCENE_PATH = '/models/scenes/person-headphones-scene.glb'
const HEADPHONES_PREVIEW_PATH = '/models/preview/headphones-fitted-preview.glb'
const CHAIR_SCENE_PATH = '/models/scenes/chair-within-room-scene.glb'
const CHAIR_PREVIEW_PATH = '/models/preview/chair-preview-room.glb'

const MOUSE_TARGET: Vector3Tuple = [1.35, 0.51, -0.6]
const KEYBOARD_TARGET: Vector3Tuple = [1.38, 0.43, 2.83]

const FALLBACK_HEADPHONES_POSITION: Vector3Tuple = [0, 15.25, -0.25]
const HEADPHONES_TARGET: Vector3Tuple = [-0.03, 15.25, -0.26]
const CHAIR_TARGET: Vector3Tuple = [-0.41, -0.45, 0.95]
const HUMAN_PREVIEW_COLOR = '#cfa28c'

type SceneZoomRequest = {
  direction: 'in' | 'out'
  id: number
}

type SceneViewConfig = {
  background: string
  cameraPosition: Vector3Tuple
  maxDistance: number
  maxPolarAngle: number
  minDistance: number
  minPolarAngle: number
  target: Vector3Tuple
}

const VIEW_CONFIGS: Record<ScenePreviewVariant, SceneViewConfig> = {
  'desk-mouse': {
    background: '#6f6f6f',
    cameraPosition: [3.25, 1.75, 3.35],
    maxDistance: 12,
    maxPolarAngle: Math.PI / 2.05,
    minDistance: 1.25,
    minPolarAngle: Math.PI / 5.2,
    target: MOUSE_TARGET,
  },
  'keyboard-desk': {
    background: '#6f6f6f',
    cameraPosition: [3.55, 1.72, 5.15],
    maxDistance: 12,
    maxPolarAngle: Math.PI / 2.05,
    minDistance: 1.25,
    minPolarAngle: Math.PI / 5.2,
    target: KEYBOARD_TARGET,
  },
  'headphones-person': {
    background: '#6f6f6f',
    cameraPosition: [-0.03, 15.45, 5.6],
    maxDistance: 10,
    maxPolarAngle: Math.PI / 1.7,
    minDistance: 2.1,
    minPolarAngle: Math.PI / 10,
    target: HEADPHONES_TARGET,
  },
  'chair-desk': {
    background: '#6f6f6f',
    cameraPosition: [-0.4, -0.32, 3.75],
    maxDistance: 7,
    maxPolarAngle: Math.PI / 1.58,
    minDistance: 0.9,
    minPolarAngle: Math.PI / 6,
    target: CHAIR_TARGET,
  },
}

type ProductViewerProps = {
  components: CustomizationComponent[]
  isPreviewRotating: boolean
  modelPath?: string
  productId: string
  selectionsByOption: Record<string, string>
  title?: string
  variant: ScenePreviewVariant
  zoomRequest: SceneZoomRequest
}

function LoadingState() {
  return (
    <Html center className={styles.loading}>
      Pregatim scena...
    </Html>
  )
}

function DeskScene() {
  const { scene } = useGLTF(DESK_SCENE_PATH)
  const deskScene = useMemo(() => {
    const clonedScene = cloneScene(scene)
    clonedScene.updateWorldMatrix(true, true)
    const anchor = clonedScene.getObjectByName('MouseAnchor')
    if (anchor) anchor.visible = false
    return clonedScene
  }, [scene])

  return <primitive object={deskScene} />
}

function KeyboardScene() {
  const { scene } = useGLTF(KEYBOARD_SCENE_PATH)
  const keyboardDeskScene = useMemo(() => {
    const clonedScene = cloneScene(scene)
    clonedScene.updateWorldMatrix(true, true)
    const anchor = clonedScene.getObjectByName('KeyboardAnchor')
    if (anchor) anchor.visible = false
    return clonedScene
  }, [scene])

  return <primitive object={keyboardDeskScene} />
}

function PersonScene({ onAnchorFound }: { onAnchorFound: (position: Vector3Tuple) => void }) {
  const { scene } = useGLTF(PERSON_HEADPHONES_SCENE_PATH)
  const personScene = useMemo(() => {
    const clonedScene = cloneScene(scene)
    clonedScene.updateWorldMatrix(true, true)
    const anchor = clonedScene.getObjectByName('HeadphonesAnchor')
    if (anchor) anchor.visible = false
    clonedScene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material
      object.material = new MeshStandardMaterial({
        color: HUMAN_PREVIEW_COLOR,
        metalness: 0,
        roughness: 0.62,
        normalMap: sourceMaterial instanceof MeshStandardMaterial ? sourceMaterial.normalMap : null,
      })
    })
    return clonedScene
  }, [scene])

  useLayoutEffect(() => {
    const anchor = personScene.getObjectByName('HeadphonesAnchor')
    if (!anchor) {
      onAnchorFound(FALLBACK_HEADPHONES_POSITION)
      return
    }

    const position = anchor.getWorldPosition(new Vector3())
    onAnchorFound([position.x, position.y, position.z])
  }, [personScene, onAnchorFound])

  return <primitive object={personScene} />
}

function ConfiguredMouse({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isPreviewRotating' | 'productId' | 'selectionsByOption'>) {
  const groupRef = useRef<Group | null>(null)
  const { scene } = useGLTF(MOUSE_PREVIEW_PATH)
  const mouseScene = useMemo(() => cloneScene(scene), [scene])

  useLayoutEffect(() => {
    prepareConfigurableScene(mouseScene)
    applySceneConfiguration(mouseScene, {
      components,
      productId,
      selectionsByOption,
    })
  }, [components, mouseScene, productId, selectionsByOption])

  useFrame((_state, delta) => {
    if (!isPreviewRotating || !groupRef.current) return
    groupRef.current.rotation.y += delta * 0.65
  })

  return (
    <group position={MOUSE_TARGET} ref={groupRef}>
      <primitive object={mouseScene} position={[-MOUSE_TARGET[0], -MOUSE_TARGET[1], -MOUSE_TARGET[2]]} />
    </group>
  )
}

function ConfiguredKeyboard({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isPreviewRotating' | 'productId' | 'selectionsByOption'>) {
  const groupRef = useRef<Group | null>(null)
  const { scene } = useGLTF(KEYBOARD_PREVIEW_PATH)
  const keyboardScene = useMemo(() => cloneScene(scene), [scene])

  useLayoutEffect(() => {
    prepareConfigurableScene(keyboardScene)
    applySceneConfiguration(keyboardScene, {
      components,
      productId,
      selectionsByOption,
    })
  }, [components, keyboardScene, productId, selectionsByOption])

  useFrame((_state, delta) => {
    if (!isPreviewRotating || !groupRef.current) return
    groupRef.current.rotation.y += delta * 0.45
  })

  return (
    <group position={KEYBOARD_TARGET} ref={groupRef}>
      <primitive object={keyboardScene} position={[-KEYBOARD_TARGET[0], -KEYBOARD_TARGET[1], -KEYBOARD_TARGET[2]]} />
    </group>
  )
}

function ConfiguredHeadphones({
  components,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'productId' | 'selectionsByOption'>) {
  const { scene } = useGLTF(HEADPHONES_PREVIEW_PATH)
  const headphonesScene = useMemo(() => cloneScene(scene), [scene])

  useLayoutEffect(() => {
    prepareConfigurableScene(headphonesScene)
    applySceneConfiguration(headphonesScene, {
      components,
      productId,
      selectionsByOption,
    })
  }, [components, headphonesScene, productId, selectionsByOption])

  return <primitive object={headphonesScene} />
}

function ChairScene() {
  const { scene } = useGLTF(CHAIR_SCENE_PATH)
  const chairDeskScene = useMemo(() => {
    const clonedScene = cloneScene(scene)
    clonedScene.updateWorldMatrix(true, true)
    const anchor = clonedScene.getObjectByName('ChairAnchor') ?? clonedScene.getObjectByName('GamingchairAnchor')
    if (anchor) anchor.visible = false
    return clonedScene
  }, [scene])

  return <primitive object={chairDeskScene} />
}

function ConfiguredChair({
  components,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'productId' | 'selectionsByOption'>) {
  const { scene } = useGLTF(CHAIR_PREVIEW_PATH)
  const chairScene = useMemo(() => cloneScene(scene), [scene])

  useLayoutEffect(() => {
    prepareConfigurableScene(chairScene)
    applySceneConfiguration(chairScene, {
      components,
      productId,
      selectionsByOption,
    })
  }, [chairScene, components, productId, selectionsByOption])

  return <primitive object={chairScene} />
}

function DeskMouseScene({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isPreviewRotating' | 'productId' | 'selectionsByOption'>) {
  return (
    <>
      <DeskScene />
      <ConfiguredMouse
        components={components}
        isPreviewRotating={isPreviewRotating}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    </>
  )
}

function KeyboardDeskScene({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isPreviewRotating' | 'productId' | 'selectionsByOption'>) {
  return (
    <>
      <KeyboardScene />
      <ConfiguredKeyboard
        components={components}
        isPreviewRotating={isPreviewRotating}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    </>
  )
}

function HeadphonesPersonScene({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isPreviewRotating' | 'productId' | 'selectionsByOption'>) {
  const groupRef = useRef<Group | null>(null)

  useFrame((_state, delta) => {
    if (!isPreviewRotating || !groupRef.current) return
    groupRef.current.rotation.y += delta * 0.45
  })

  return (
    <group ref={groupRef}>
      <PersonScene onAnchorFound={() => undefined} />
      <ConfiguredHeadphones
        components={components}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    </group>
  )
}

function ChairDeskScene({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
}: Pick<ProductViewerProps, 'components' | 'isPreviewRotating' | 'productId' | 'selectionsByOption'>) {
  const groupRef = useRef<Group | null>(null)

  useFrame((_state, delta) => {
    if (!isPreviewRotating || !groupRef.current) return
    groupRef.current.rotation.y += delta * 0.38
  })

  return (
    <group ref={groupRef}>
      <ChairScene />
      <ConfiguredChair
        components={components}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    </group>
  )
}

function ProductScene({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
  variant,
}: Pick<ProductViewerProps, 'components' | 'isPreviewRotating' | 'productId' | 'selectionsByOption' | 'variant'>) {
  if (variant === 'headphones-person') {
    return (
      <HeadphonesPersonScene
        components={components}
        isPreviewRotating={isPreviewRotating}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    )
  }

  if (variant === 'keyboard-desk') {
    return (
      <KeyboardDeskScene
        components={components}
        isPreviewRotating={isPreviewRotating}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    )
  }

  if (variant === 'chair-desk') {
    return (
      <ChairDeskScene
        components={components}
        isPreviewRotating={isPreviewRotating}
        productId={productId}
        selectionsByOption={selectionsByOption}
      />
    )
  }

  return (
    <DeskMouseScene
      components={components}
      isPreviewRotating={isPreviewRotating}
      productId={productId}
      selectionsByOption={selectionsByOption}
    />
  )
}

function CameraZoomController({
  config,
  zoomRequest,
}: {
  config: SceneViewConfig
  zoomRequest: SceneZoomRequest
}) {
  const { camera } = useThree()

  useEffect(() => {
    if (!zoomRequest.id) return

    const target = new Vector3(...config.target)
    const direction = camera.position.clone().sub(target)
    const currentDistance = direction.length()
    if (!currentDistance) return

    const scale = zoomRequest.direction === 'in' ? 0.82 : 1.24
    const nextDistance = Math.min(config.maxDistance, Math.max(config.minDistance, currentDistance * scale))
    direction.setLength(nextDistance)
    camera.position.copy(target).add(direction)
    camera.updateProjectionMatrix()
  }, [camera, config, zoomRequest])

  return null
}

export function ProductViewer({
  components,
  isPreviewRotating,
  productId,
  selectionsByOption,
  title = 'Previzualizare in spatiu',
  variant,
  zoomRequest,
}: ProductViewerProps) {
  const config = VIEW_CONFIGS[variant]
  const isHeadphonesPreview = variant === 'headphones-person'
  const isChairPreview = variant === 'chair-desk'

  return (
    <div className={styles.viewer} aria-label={title}>
      <Canvas
        camera={{ fov: isHeadphonesPreview ? 38 : isChairPreview ? 44 : 42, position: config.cameraPosition }}
        className={styles.canvas}
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        performance={{ min: 0.55 }}
        shadows
      >
        <color attach="background" args={[config.background]} />
        <ambientLight intensity={isHeadphonesPreview ? 1.05 : isChairPreview ? 0.84 : 0.72} />
        <directionalLight
          intensity={isHeadphonesPreview ? 2.8 : isChairPreview ? 2.6 : 2.4}
          position={isHeadphonesPreview ? [2.8, 17, 4.2] : isChairPreview ? [1.8, 2.8, 3.4] : [3.8, 5.2, 2.5]}
        />
        <spotLight
          angle={isHeadphonesPreview ? 0.54 : isChairPreview ? 0.52 : 0.46}
          castShadow
          intensity={isHeadphonesPreview ? 3.2 : isChairPreview ? 3.5 : 4}
          penumbra={0.65}
          position={isHeadphonesPreview ? [0, 15.5, 3.4] : isChairPreview ? [-0.4, 1.4, 2.8] : [1.4, 2.8, 1.8]}
        />
        <Suspense fallback={<LoadingState />}>
          <ProductScene
            components={components}
            isPreviewRotating={isPreviewRotating}
            productId={productId}
            selectionsByOption={selectionsByOption}
            variant={variant}
          />
          <Environment resolution={64}>
            {isHeadphonesPreview ? (
              <>
                <Lightformer
                  color="#ffffff"
                  intensity={1.8}
                  position={[0, 14, 4]}
                  scale={[5, 4, 1]}
                />
                <Lightformer
                  color="#d7f2ff"
                  intensity={1.1}
                  position={[-4, 12, 2]}
                  scale={[3, 4, 1]}
                />
              </>
            ) : isChairPreview ? (
              <>
                <Lightformer
                  color="#ffffff"
                  intensity={1.4}
                  position={[-0.3, 1.6, 2.4]}
                  scale={[3, 2, 1]}
                />
                <Lightformer
                  color="#ffffff"
                  intensity={1.1}
                  position={[-1.3, 0.5, -0.5]}
                  scale={[2.5, 1.6, 1]}
                />
              </>
            ) : (
              <>
                <Lightformer
                  color="#ffffff"
                  intensity={2.2}
                  position={[0, 3, -4]}
                  scale={[5, 2, 1]}
                />
                <Lightformer
                  color="#ffffff"
                  intensity={1.6}
                  position={[4, 2.5, 3]}
                  scale={[3, 4, 1]}
                />
              </>
            )}
          </Environment>
        </Suspense>
        <CameraZoomController config={config} zoomRequest={zoomRequest} />
        <OrbitControls
          enableDamping
          enablePan={false}
          enableZoom
          maxDistance={config.maxDistance}
          maxPolarAngle={config.maxPolarAngle}
          minDistance={config.minDistance}
          minPolarAngle={config.minPolarAngle}
          target={config.target}
        />
      </Canvas>
    </div>
  )
}
