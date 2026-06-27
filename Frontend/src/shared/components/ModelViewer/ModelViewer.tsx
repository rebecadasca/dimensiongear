import { Suspense, useLayoutEffect, useMemo } from 'react'
import { type Object3D, type Vector3Tuple } from 'three'
import { clone as cloneScene } from 'three/addons/utils/SkeletonUtils.js'
import { Canvas, useThree } from '@react-three/fiber'
import {
  Bounds,
  Center,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  useGLTF,
} from '@react-three/drei'
import styles from './ModelViewer.module.scss'

export type ModelViewerProps = {
  active?: boolean
  autoRotate?: boolean
  cameraPosition?: Vector3Tuple
  className?: string
  dracoDecoderPath?: string
  dpr?: [number, number]
  fitModel?: boolean
  interactive?: boolean
  modelPath: string
  modelPosition?: Vector3Tuple
  modelRotation?: Vector3Tuple
  modelScale?: number | Vector3Tuple
  title: string
  withEnvironment?: boolean
  configureModel?: (model: Object3D) => void
}

type ModelProps = Pick<
  ModelViewerProps,
  'configureModel' | 'dracoDecoderPath' | 'modelPath' | 'modelPosition' | 'modelRotation' | 'modelScale'
>

function Model({
  configureModel,
  dracoDecoderPath,
  modelPath,
  modelPosition,
  modelRotation,
  modelScale,
}: ModelProps) {
  const { scene } = useGLTF(modelPath, dracoDecoderPath)
  const invalidate = useThree((state) => state.invalidate)
  const model = useMemo(() => cloneScene(scene), [scene])

  useLayoutEffect(() => {
    configureModel?.(model)
    invalidate()
  }, [configureModel, invalidate, model])

  return (
    <primitive
      object={model}
      position={modelPosition}
      rotation={modelRotation}
      scale={modelScale}
    />
  )
}

function LoadingState() {
  return (
    <Html center className={styles.loading}>
      Se încarcă 3D
    </Html>
  )
}

export function ModelViewer({
  active = true,
  autoRotate = true,
  cameraPosition = [0, 0.35, 4.8],
  className,
  dracoDecoderPath = '/draco/gltf/',
  dpr = [1, 1.5],
  fitModel = true,
  interactive = true,
  modelPath,
  modelPosition = [0, 0, 0],
  modelRotation = [0, 0, 0],
  modelScale = 1,
  title,
  withEnvironment = true,
  configureModel,
}: ModelViewerProps) {
  return (
    <div className={`${styles.viewer} ${className ?? ''}`} aria-label={title}>
      <Canvas
        camera={{ fov: 38, position: cameraPosition }}
        dpr={dpr}
        frameloop={active && autoRotate ? 'always' : 'demand'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        performance={{ min: 0.55 }}
      >
        <ambientLight intensity={0.95} />
        <directionalLight intensity={2.2} position={[3.5, 4, 3]} />
        <spotLight
          angle={0.45}
          intensity={3.2}
          penumbra={0.55}
          position={[-3, 4, 4]}
        />
        <Suspense fallback={<LoadingState />}>
          {fitModel ? (
            <Bounds clip fit margin={1.18} observe>
              <Center>
                <Model
                  configureModel={configureModel}
                  dracoDecoderPath={dracoDecoderPath}
                  modelPath={modelPath}
                  modelPosition={modelPosition}
                  modelRotation={modelRotation}
                  modelScale={modelScale}
                />
              </Center>
            </Bounds>
          ) : (
            <Model
              configureModel={configureModel}
              dracoDecoderPath={dracoDecoderPath}
              modelPath={modelPath}
              modelPosition={modelPosition}
              modelRotation={modelRotation}
              modelScale={modelScale}
            />
          )}
          {withEnvironment ? (
            <Environment resolution={64}>
              <Lightformer
                color="#19ff76"
                intensity={2.6}
                position={[0, 4, -5]}
                scale={[7, 2, 1]}
              />
              <Lightformer
                color="#51ffd1"
                intensity={1.4}
                position={[4, 2, 3]}
                scale={[3, 5, 1]}
              />
            </Environment>
          ) : null}
        </Suspense>
        {interactive ? (
          <OrbitControls
            autoRotate={autoRotate && active}
            autoRotateSpeed={0.7}
            enabled={active}
            enableDamping
            enablePan={false}
            enableZoom={false}
            maxPolarAngle={Math.PI / 1.8}
            minPolarAngle={Math.PI / 3.2}
          />
        ) : null}
      </Canvas>
    </div>
  )
}
