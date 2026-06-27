import {
  Box3,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
  Vector2,
  Vector3,
} from 'three'
import type {
  CustomizationComponent,
  CustomizationOptionValue,
} from '../types'
import {
  productModelBindings,
  type ComponentVisualBinding,
  type FixedColorMask,
  type MeshSelector,
  type NormalizedBox,
  type NormalizedEllipse,
} from './modelBindings'

type ApplyConfigurationInput = {
  activeComponentKey?: string
  components: CustomizationComponent[]
  productId: string
  selectionsByOption: Record<string, string>
}

type ResolvedComponent = {
  binding: ComponentVisualBinding
  color?: string
  key: string
  linkedColor?: string
  linkedColorMaskPath?: string
  materialKey?: string
}

const BASE_GEOMETRY = '__dimensionGearBaseGeometry'
const BASE_MATERIAL = '__dimensionGearBaseMaterial'
const PREPARED = '__dimensionGearPrepared'
const textureCache = new Map<string, Texture>()
const textureLoader = new TextureLoader()

function materialList(material: Material | Material[]) {
  return Array.isArray(material) ? material : [material]
}

function cloneMaterial(material: Material | Material[]) {
  return Array.isArray(material) ? material.map((item) => item.clone()) : material.clone()
}

function mapMaterial(
  material: Material | Material[],
  transform: (item: Material) => Material,
) {
  return Array.isArray(material) ? material.map(transform) : transform(material)
}

export function prepareConfigurableScene(scene: Object3D) {
  if (scene.userData[PREPARED]) return
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry = object.geometry.clone()
    object.material = cloneMaterial(object.material)
    object.userData[BASE_GEOMETRY] = object.geometry.clone()
    object.userData[BASE_MATERIAL] = cloneMaterial(object.material)
  })
  scene.userData[PREPARED] = true
}

function restoreScene(scene: Object3D) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const geometry = object.userData[BASE_GEOMETRY] as BufferGeometry | undefined
    const material = object.userData[BASE_MATERIAL] as Material | Material[] | undefined
    if (geometry) object.geometry = geometry.clone()
    if (material) object.material = cloneMaterial(material)
  })
}

function selectedValue(
  optionId: string,
  values: CustomizationOptionValue[],
  selectionsByOption: Record<string, string>,
) {
  return values.find((value) => value.id === selectionsByOption[optionId])
}

function resolveComponents(input: ApplyConfigurationInput) {
  const productBinding = productModelBindings[input.productId]
  if (!productBinding) return []

  const resolved = input.components.flatMap<ResolvedComponent>((component) => {
    const binding = productBinding.components[component.key]
    if (!binding) return []
    const colorOption = component.options.find((option) => option.type === 'color')
    const materialOption = component.options.find((option) => option.type === 'material')
    const color = colorOption
      ? selectedValue(colorOption.id, colorOption.values, input.selectionsByOption)?.hex
      : undefined
    const materialKey = materialOption
      ? selectedValue(materialOption.id, materialOption.values, input.selectionsByOption)?.key
      : undefined
    return [{ binding, color, key: component.key, materialKey }]
  })
  return resolved.map((component) => ({
    ...component,
    linkedColor: resolved.find((candidate) => (
      candidate.key === component.binding.linkedColorComponentKey
    ))?.color,
    linkedColorMaskPath: component.binding.linkedColorMaskPath,
  }))
}

function meshMaterialNames(mesh: Mesh) {
  return materialList(mesh.material).map((material) => material.name)
}

function selectorText(value: string) {
  return value.toLocaleLowerCase().replace(/[\s_-]+/g, '')
}

function includesSelectorText(value: string, part: string) {
  return value.includes(part) || selectorText(value).includes(selectorText(part))
}

function matchesSelector(mesh: Mesh, selector: MeshSelector) {
  const materialNames = meshMaterialNames(mesh)
  const ancestors: string[] = []
  let parent = mesh.parent
  while (parent) {
    ancestors.push(parent.name)
    parent = parent.parent
  }
  const hierarchyNames = [mesh.name, ...ancestors]

  const matchesName = !selector.nameIncludes?.length || selector.nameIncludes.some((part) => includesSelectorText(mesh.name, part))
  const matchesMaterial = !selector.materialNames?.length || selector.materialNames.some((name) => materialNames.includes(name))
  const matchesAncestor = !selector.ancestorIncludes?.length || selector.ancestorIncludes.some((part) => hierarchyNames.some((name) => includesSelectorText(name, part)))
  return matchesName && matchesMaterial && matchesAncestor
}

function matchesBinding(mesh: Mesh, binding: ComponentVisualBinding) {
  return binding.selectors.some((selector) => matchesSelector(mesh, selector))
}

function loadSurfaceTexture(
  key: string,
  path: string,
  colorSpace: typeof SRGBColorSpace | typeof NoColorSpace,
) {
  const cached = textureCache.get(key)
  if (cached) return cached
  const texture = textureLoader.load(path)
  texture.colorSpace = colorSpace
  texture.flipY = false
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  textureCache.set(key, texture)
  return texture
}

function surfaceTextures(kind: 'leather' | 'mesh' | 'textile') {
  const root = `/materials/chair/${kind}`
  return {
    map: loadSurfaceTexture(`${kind}:basecolor`, `${root}/basecolor.png`, SRGBColorSpace),
    normalMap: loadSurfaceTexture(`${kind}:normal`, `${root}/normal.png`, NoColorSpace),
    roughnessMap: loadSurfaceTexture(`${kind}:roughness`, `${root}/roughness.png`, NoColorSpace),
  }
}

function uvMaskRegions(mask: Pick<FixedColorMask, 'ellipses' | 'regions'>) {
  const rectangles = (mask.regions ?? []).map((region) => `(
    step(${region.u[0].toFixed(4)}, vMapUv.x) *
    step(vMapUv.x, ${region.u[1].toFixed(4)}) *
    step(${region.v[0].toFixed(4)}, vMapUv.y) *
    step(vMapUv.y, ${region.v[1].toFixed(4)})
  )`)
  const ellipses = (mask.ellipses ?? []).map((ellipse) => {
    const outer = `1.0 - step(1.0, dot(
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.radius[0].toFixed(4)}, ${ellipse.radius[1].toFixed(4)}),
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.radius[0].toFixed(4)}, ${ellipse.radius[1].toFixed(4)})
    ))`
    if (!ellipse.innerRadius) return `(${outer})`
    const inner = `step(1.0, dot(
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.innerRadius[0].toFixed(4)}, ${ellipse.innerRadius[1].toFixed(4)}),
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.innerRadius[0].toFixed(4)}, ${ellipse.innerRadius[1].toFixed(4)})
    ))`
    return `((${outer}) * (${inner}))`
  })

  return [...rectangles, ...ellipses].join(' + ') || '0.0'
}

function fixedColorMaskShader(masks: FixedColorMask[]) {
  return masks.map((mask, index) => {
    const bounds = uvMaskRegions(mask)
    const brightness = mask.brightness
      ? `
        float dimensionGearFixedBrightness${index} = max(
          sampledDiffuseColor.r,
          max(sampledDiffuseColor.g, sampledDiffuseColor.b)
        );
        dimensionGearFixedMask${index} *= ${mask.invertBrightness ? '1.0 - ' : ''}smoothstep(
          ${mask.brightness[0].toFixed(4)},
          ${mask.brightness[1].toFixed(4)},
          dimensionGearFixedBrightness${index}
        );
      `
      : ''
    return `
      float dimensionGearFixedMask${index} = clamp(${bounds}, 0.0, 1.0);
      ${brightness}
      diffuseColor.rgb = mix(
        diffuseColor.rgb,
        dimensionGearFixedColor${index},
        clamp(dimensionGearFixedMask${index}, 0.0, 1.0)
      );
    `
  }).join('\n')
}

function physicalMaterial(
  base: Material,
  color: string | undefined,
  materialKey?: string,
  finish?: ComponentVisualBinding['finish'],
  colorMapMode: 'colorize' | 'multiply' | 'replace' = 'multiply',
) {
  const source = base as Material & Record<string, unknown>
  const preset = materialKey === 'leather'
    ? { bumpScale: 0.055, clearcoat: 0.28, clearcoatRoughness: 0.38, roughness: 0.34, sheen: 0.12 }
    : materialKey === 'mesh'
      ? { bumpScale: 0.12, clearcoat: 0, clearcoatRoughness: 1, roughness: 0.78, sheen: 0.18 }
      : materialKey === 'textile'
        ? { bumpScale: 0.085, clearcoat: 0, clearcoatRoughness: 1, roughness: 0.88, sheen: 0.62 }
        : finish === 'glossyPlastic'
          ? {
              bumpScale: 0.02,
              clearcoat: 0.62,
              clearcoatRoughness: 0.18,
              roughness: typeof source.roughness === 'number' ? Math.min(source.roughness, 0.28) : 0.22,
              sheen: 0,
            }
        : {
            bumpScale: 0,
            clearcoat: 0,
            clearcoatRoughness: 1,
            roughness: typeof source.roughness === 'number' ? source.roughness : 0.62,
            sheen: 0,
          }
  const surface = materialKey && ['leather', 'mesh', 'textile'].includes(materialKey)
    ? surfaceTextures(materialKey as 'leather' | 'mesh' | 'textile')
    : null

  return new MeshPhysicalMaterial({
    alphaMap: source.alphaMap as Texture | null | undefined,
    clearcoat: preset.clearcoat,
    clearcoatRoughness: preset.clearcoatRoughness,
    color: color ?? ((source.color as Color | undefined)?.getHexString() ? `#${(source.color as Color).getHexString()}` : '#ffffff'),
    envMapIntensity: materialKey === 'leather' || finish === 'glossyPlastic' ? 1.65 : 1.05,
    map: surface?.map ?? (colorMapMode === 'replace' ? null : source.map as Texture | null | undefined),
    metalness: 0.02,
    normalMap: surface?.normalMap ?? source.normalMap as Texture | null | undefined,
    normalScale: new Vector2(materialKey === 'mesh' ? 1.15 : materialKey === 'textile' ? 0.9 : finish === 'glossyPlastic' ? 0.28 : 0.72),
    opacity: base.opacity,
    roughness: preset.roughness,
    roughnessMap: surface?.roughnessMap ?? source.roughnessMap as Texture | null | undefined,
    sheen: preset.sheen,
    sheenColor: new Color(color ?? '#ffffff'),
    sheenRoughness: materialKey === 'textile' ? 0.82 : 0.48,
    side: base.side,
    transparent: base.transparent,
  })
}

function applyWholeMesh(
  mesh: Mesh,
  component: ResolvedComponent,
  isActive: boolean,
  materialKey?: string,
  finish?: ComponentVisualBinding['finish'],
  colorMapMode?: 'colorize' | 'multiply' | 'replace',
  colorizeDetail?: {
    max: number
    min: number
    sourceHigh: number
    sourceLow: number
  },
) {
  mesh.material = mapMaterial(mesh.material, (base) => {
    const material = physicalMaterial(base, component.color, materialKey, finish, colorMapMode)
    const shouldColorizeMap = colorMapMode === 'colorize' && Boolean((base as Material & { map?: Texture | null }).map)
    const fixedColorMasks = component.binding.fixedColorMasks ?? []
    const linkedColor = component.linkedColor ? new Color(component.linkedColor) : undefined
    const linkedMask = component.linkedColor && component.linkedColorMaskPath
      ? loadSurfaceTexture(
        `linked-color:${component.linkedColorMaskPath}`,
        component.linkedColorMaskPath,
        NoColorSpace,
      )
      : undefined
    if (shouldColorizeMap || linkedColor || fixedColorMasks.length) {
      const fixedColors = fixedColorMasks.map((mask) => new Color(mask.color))
      material.onBeforeCompile = (shader) => {
        if (linkedColor && linkedMask) {
          shader.uniforms.dimensionGearLinkedColor = { value: linkedColor }
          shader.uniforms.dimensionGearLinkedColorMask = { value: linkedMask }
        }
        fixedColors.forEach((color, index) => {
          shader.uniforms[`dimensionGearFixedColor${index}`] = { value: color }
        })
        const linkedUniforms = linkedColor && linkedMask
          ? `
            uniform vec3 dimensionGearLinkedColor;
            uniform sampler2D dimensionGearLinkedColorMask;
          `
          : ''
        const fixedUniforms = fixedColors
          .map((_, index) => `uniform vec3 dimensionGearFixedColor${index};`)
          .join('\n')
        const linkedColorExpression = shouldColorizeMap
          ? 'dimensionGearLinkedColor * dimensionGearDetail'
          : 'dimensionGearLinkedColor * sampledDiffuseColor.rgb'
        const linkedShader = linkedColor && linkedMask
          ? `
            float dimensionGearLinkedMask = step(
              0.5,
              texture2D(dimensionGearLinkedColorMask, vMapUv).r
            );
            diffuseColor.rgb = mix(
              diffuseColor.rgb,
              ${linkedColorExpression},
              dimensionGearLinkedMask
            );
          `
          : ''
        const mapShader = shouldColorizeMap
          ? `
            #ifdef USE_MAP
              vec4 sampledDiffuseColor = texture2D(map, vMapUv);
              float dimensionGearDetailLuminance = dot(
                sampledDiffuseColor.rgb,
                vec3(0.2126, 0.7152, 0.0722)
              );
              float dimensionGearDetail = mix(
                ${(colorizeDetail?.min ?? 0.52).toFixed(4)},
                ${(colorizeDetail?.max ?? 1.08).toFixed(4)},
                smoothstep(
                  ${(colorizeDetail?.sourceLow ?? 0.015).toFixed(4)},
                  ${(colorizeDetail?.sourceHigh ?? 0.19).toFixed(4)},
                  dimensionGearDetailLuminance
                )
              );
              diffuseColor.rgb *= dimensionGearDetail;
              diffuseColor.a *= sampledDiffuseColor.a;
              ${linkedShader}
              ${fixedColorMaskShader(fixedColorMasks)}
            #endif
          `
          : `
            #include <map_fragment>
            #ifdef USE_MAP
              ${linkedShader}
              ${fixedColorMaskShader(fixedColorMasks)}
            #endif
          `
        shader.fragmentShader = `
          ${linkedUniforms}
          ${fixedUniforms}
        ${shader.fragmentShader}`.replace('#include <map_fragment>', mapShader)
      }
      material.customProgramCacheKey = () => (
        `dimension-gear-whole-mesh:${colorMapMode ?? ''}:${component.linkedColorMaskPath ?? ''}:${linkedColor?.getHexString() ?? ''}:${JSON.stringify(fixedColorMasks)}`
      )
    }
    if (component.binding.emissive && component.color) {
      material.emissive.set(component.color)
      material.emissiveIntensity = 1.7
    } else if (isActive && component.color) {
      material.emissive.set(component.color)
      material.emissiveIntensity = 0.08
    }
    material.name = base.name
    material.needsUpdate = true
    return material
  })
}

function inRange(value: number, range?: [number, number]) {
  return !range || (value >= range[0] && value <= range[1])
}

function inBox(point: Vector3, box: NormalizedBox) {
  return inRange(point.x, box.x) && inRange(point.y, box.y) && inRange(point.z, box.z)
}

function inEllipseRegion(point: Vector3, ellipse: NormalizedEllipse) {
  if (!inRange(point.y, ellipse.y)) return false
  const outerX = (point.x - ellipse.center[0]) / ellipse.radius[0]
  const outerZ = (point.z - ellipse.center[1]) / ellipse.radius[1]
  if ((outerX * outerX) + (outerZ * outerZ) > 1) return false
  if (!ellipse.innerRadius) return true
  const innerX = (point.x - ellipse.center[0]) / ellipse.innerRadius[0]
  const innerZ = (point.z - ellipse.center[1]) / ellipse.innerRadius[1]
  return (innerX * innerX) + (innerZ * innerZ) >= 1
}

function textureMaskRegions(mask: NonNullable<ComponentVisualBinding['textureMask']>) {
  if (mask.regions?.length) return mask.regions
  return mask.u && mask.v ? [{ u: mask.u, v: mask.v }] : []
}

function textureMaskHasArea(mask: NonNullable<ComponentVisualBinding['textureMask']>) {
  return Boolean(textureMaskRegions(mask).length || mask.ellipses?.length)
}

function textureMaskBoundsShader(mask: NonNullable<ComponentVisualBinding['textureMask']>) {
  const rectangles = textureMaskRegions(mask).map((region) => `(
    step(${region.u[0].toFixed(4)}, vMapUv.x) *
    step(vMapUv.x, ${region.u[1].toFixed(4)}) *
    step(${region.v[0].toFixed(4)}, vMapUv.y) *
    step(vMapUv.y, ${region.v[1].toFixed(4)})
  )`)
  const ellipses = (mask.ellipses ?? []).map((ellipse) => {
    const outer = `1.0 - step(1.0, dot(
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.radius[0].toFixed(4)}, ${ellipse.radius[1].toFixed(4)}),
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.radius[0].toFixed(4)}, ${ellipse.radius[1].toFixed(4)})
    ))`
    if (!ellipse.innerRadius) return `(${outer})`
    const inner = `step(1.0, dot(
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.innerRadius[0].toFixed(4)}, ${ellipse.innerRadius[1].toFixed(4)}),
      (vMapUv - vec2(${ellipse.center[0].toFixed(4)}, ${ellipse.center[1].toFixed(4)})) /
        vec2(${ellipse.innerRadius[0].toFixed(4)}, ${ellipse.innerRadius[1].toFixed(4)})
    ))`
    return `((${outer}) * (${inner}))`
  })

  return [...rectangles, ...ellipses].join(' + ') || '0.0'
}

function inTextureMask(point: Vector2, mask: NonNullable<ComponentVisualBinding['textureMask']>) {
  const inRegion = textureMaskRegions(mask).some((region) => (
    inRange(point.x, region.u) && inRange(point.y, region.v)
  ))
  const inEllipse = (mask.ellipses ?? []).some((ellipse) => {
    const outerX = (point.x - ellipse.center[0]) / ellipse.radius[0]
    const outerY = (point.y - ellipse.center[1]) / ellipse.radius[1]
    if ((outerX * outerX) + (outerY * outerY) > 1) return false
    if (!ellipse.innerRadius) return true
    const innerX = (point.x - ellipse.center[0]) / ellipse.innerRadius[0]
    const innerY = (point.y - ellipse.center[1]) / ellipse.innerRadius[1]
    return (innerX * innerX) + (innerY * innerY) >= 1
  })

  return inRegion || inEllipse
}

function connectedComponentCenters(
  geometry: BufferGeometry,
  bounds: Box3,
  size: Vector3,
) {
  const position = geometry.getAttribute('position')
  const triangleCount = Math.floor(position.count / 3)
  const parent = Array.from({ length: triangleCount }, (_, index) => index)
  const vertexOwners = new Map<string, number>()
  const find = (value: number): number => {
    if (parent[value] !== value) parent[value] = find(parent[value])
    return parent[value]
  }
  const union = (left: number, right: number) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = triangle * 3 + vertex
      const key = `${position.getX(offset).toFixed(5)}:${position.getY(offset).toFixed(5)}:${position.getZ(offset).toFixed(5)}`
      const owner = vertexOwners.get(key)
      if (owner === undefined) vertexOwners.set(key, triangle)
      else union(triangle, owner)
    }
  }

  const sums = new Map<number, { count: number; point: Vector3 }>()
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangle)
    const entry = sums.get(root) ?? { count: 0, point: new Vector3() }
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = triangle * 3 + vertex
      entry.point.x += position.getX(offset)
      entry.point.y += position.getY(offset)
      entry.point.z += position.getZ(offset)
      entry.count += 1
    }
    sums.set(root, entry)
  }

  const centers = new Map<number, Vector3>()
  for (const [root, entry] of sums) {
    entry.point.divideScalar(entry.count)
    entry.point.set(
      size.x ? (entry.point.x - bounds.min.x) / size.x : 0.5,
      size.y ? (entry.point.y - bounds.min.y) / size.y : 0.5,
      size.z ? (entry.point.z - bounds.min.z) / size.z : 0.5,
    )
    centers.set(root, entry.point)
  }

  return Array.from({ length: triangleCount }, (_, triangle) => centers.get(find(triangle)) ?? new Vector3(0.5, 0.5, 0.5))
}

function applyRegions(
  mesh: Mesh,
  entries: ResolvedComponent[],
  colorMapMode?: 'colorize' | 'multiply' | 'replace',
) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox ?? new Box3()
  const size = bounds.getSize(new Vector3())
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const colors = new Float32Array(position.count * 3)
  const ordered = entries
    .filter((entry) => entry.binding.region || entry.binding.regionEllipses?.length)
    .sort((left, right) => (right.binding.priority ?? 0) - (left.binding.priority ?? 0))
  const textureFallbacks = entries
    .filter((entry) => entry.color && entry.binding.textureMask?.geometryFallback)
    .sort((left, right) => (left.binding.priority ?? 0) - (right.binding.priority ?? 0))
  const fallback = ordered.find((entry) => entry.binding.region === 'fallback')
  const currentColor = (materialList(mesh.material)[0] as Material & { color?: Color }).color
  const baseColor = new Color(fallback?.color ?? currentColor ?? '#ffffff')
  const point = new Vector3()
  const uvPoint = new Vector2()
  const componentCenters = ordered.some((entry) => entry.binding.regionMode === 'component')
    ? connectedComponentCenters(geometry, bounds, size)
    : []

  for (let offset = 0; offset < position.count; offset += 3) {
    point.set(
      (position.getX(offset) + position.getX(offset + 1) + position.getX(offset + 2)) / 3,
      (position.getY(offset) + position.getY(offset + 1) + position.getY(offset + 2)) / 3,
      (position.getZ(offset) + position.getZ(offset + 1) + position.getZ(offset + 2)) / 3,
    )
    point.set(
      size.x ? (point.x - bounds.min.x) / size.x : 0.5,
      size.y ? (point.y - bounds.min.y) / size.y : 0.5,
      size.z ? (point.z - bounds.min.z) / size.z : 0.5,
    )
    const triangle = offset / 3
    const match = ordered.find((entry) => {
      const sample = entry.binding.regionMode === 'component' ? componentCenters[triangle] : point
      const boxMatch = Array.isArray(entry.binding.region) && entry.binding.region.some((box) => inBox(sample, box))
      const ellipseMatch = entry.binding.regionEllipses?.some((ellipse) => inEllipseRegion(sample, ellipse))
      return boxMatch || ellipseMatch
    }) ?? fallback
    const color = new Color(match?.color ?? baseColor)
    if (uv && textureFallbacks.length) {
      uvPoint.set(
        (uv.getX(offset) + uv.getX(offset + 1) + uv.getX(offset + 2)) / 3,
        (uv.getY(offset) + uv.getY(offset + 1) + uv.getY(offset + 2)) / 3,
      )
      const normalY = normal
        ? Math.abs((normal.getY(offset) + normal.getY(offset + 1) + normal.getY(offset + 2)) / 3)
        : 1
      for (const textureFallback of textureFallbacks) {
        const mask = textureFallback.binding.textureMask
        if (
          mask
          && textureFallback.color
          && inRange(normalY, mask.geometryNormalY)
          && (!mask.geometryFallbackRegions?.length || mask.geometryFallbackRegions.some((box) => inBox(point, box)))
          && inTextureMask(uvPoint, mask)
        ) {
          color.set(textureFallback.color)
        }
      }
    }
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors[(offset + vertex) * 3] = color.r
      colors[(offset + vertex) * 3 + 1] = color.g
      colors[(offset + vertex) * 3 + 2] = color.b
    }
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  mesh.geometry = geometry
  mesh.material = mapMaterial(mesh.material, (base) => {
    const material = physicalMaterial(base, '#ffffff', undefined, ordered[0]?.binding.finish, colorMapMode)
    material.vertexColors = true
    const textureMaskEntry = entries.find((entry) => entry.binding.textureMask && entry.color)
    const textureColorizeMasks = entries.flatMap((entry) => {
      const mask = entry.binding.textureMask
      if (!mask || !entry.color) return []
      return textureMaskHasArea(mask) ? [{ color: new Color(entry.color), mask, priority: entry.binding.priority ?? 0 }] : []
    }).sort((left, right) => left.priority - right.priority)
    const sourceMap = (base as Material & { map?: Texture | null }).map
    if (colorMapMode === 'colorize' && sourceMap) {
      material.map = sourceMap
      material.onBeforeCompile = (shader) => {
        textureColorizeMasks.forEach((entry, index) => {
          shader.uniforms[`dimensionGearTextureMaskColor${index}`] = { value: entry.color }
        })
        const textureMaskUniforms = textureColorizeMasks
          .map((_, index) => `uniform vec3 dimensionGearTextureMaskColor${index};`)
          .join('\n')
        const textureMaskShader = textureColorizeMasks.map((entry, index) => {
          const bounds = textureMaskBoundsShader(entry.mask)
          const shape = entry.mask.brightness
            ? `${entry.mask.invertBrightness ? '(1.0 - ' : ''}smoothstep(
                ${entry.mask.brightness[0].toFixed(4)},
                ${entry.mask.brightness[1].toFixed(4)},
                dimensionGearMaskBrightness
              )${entry.mask.invertBrightness ? ')' : ''}`
            : '1.0'
          return `
            float dimensionGearMaskBounds${index} = clamp(${bounds}, 0.0, 1.0);
            float dimensionGearMaskShape${index} = dimensionGearMaskBounds${index} * ${shape};
            dimensionGearConfiguredColor = mix(
              dimensionGearConfiguredColor,
              dimensionGearTextureMaskColor${index},
              dimensionGearMaskShape${index}
            );
          `
        }).join('\n')
        shader.fragmentShader = `${textureMaskUniforms ? `${textureMaskUniforms}\n` : ''}${shader.fragmentShader}`
          .replace('#include <map_fragment>', `
            #ifdef USE_MAP
              vec4 dimensionGearSourceColor = texture2D(map, vMapUv);
              float dimensionGearDetailLuminance = dot(
                dimensionGearSourceColor.rgb,
                vec3(0.2126, 0.7152, 0.0722)
              );
              float dimensionGearDetail = mix(
                0.42,
                1.0,
                smoothstep(0.0025, 0.0220, dimensionGearDetailLuminance)
              );
              vec3 dimensionGearConfiguredColor = diffuseColor.rgb;
              ${textureColorizeMasks.some((entry) => entry.mask.brightness) ? `
                float dimensionGearMaskBrightness = max(
                  dimensionGearSourceColor.r,
                  max(dimensionGearSourceColor.g, dimensionGearSourceColor.b)
                );
              ` : ''}
              ${textureMaskShader}
              diffuseColor.rgb = dimensionGearConfiguredColor * dimensionGearDetail;
              diffuseColor.a *= dimensionGearSourceColor.a;
            #endif
          `)
      }
      material.customProgramCacheKey = () => `dimension-gear-colorize:${JSON.stringify(textureColorizeMasks.map((entry) => ({
        color: entry.color.getHexString(),
        mask: entry.mask,
      })))}`
    } else if (textureMaskEntry?.binding.textureMask && textureMaskEntry.color && sourceMap) {
      const mask = textureMaskEntry.binding.textureMask
      const [region] = textureMaskRegions(mask)
      if (!region || !mask.brightness) return material
      const brightness = mask.brightness
      const maskColor = new Color(textureMaskEntry.color)
      material.map = sourceMap
      material.onBeforeCompile = (shader) => {
        shader.uniforms.dimensionGearMaskColor = { value: maskColor }
        shader.fragmentShader = `uniform vec3 dimensionGearMaskColor;\n${shader.fragmentShader}`
          .replace('#include <map_fragment>', `
            #ifdef USE_MAP
              vec4 dimensionGearMaskSample = texture2D(map, vMapUv);
              float dimensionGearMaskBounds =
                step(${region.u[0].toFixed(4)}, vMapUv.x) *
                step(vMapUv.x, ${region.u[1].toFixed(4)}) *
                step(${region.v[0].toFixed(4)}, vMapUv.y) *
                step(vMapUv.y, ${region.v[1].toFixed(4)});
              float dimensionGearMaskBrightness = max(
                dimensionGearMaskSample.r,
                max(dimensionGearMaskSample.g, dimensionGearMaskSample.b)
              );
              float dimensionGearMaskShape = smoothstep(
                ${brightness[0].toFixed(4)},
                ${brightness[1].toFixed(4)},
                dimensionGearMaskBrightness
              );
              ${mask.invertBrightness ? 'dimensionGearMaskShape = 1.0 - dimensionGearMaskShape;' : ''}
              diffuseColor.rgb = mix(
                diffuseColor.rgb,
                dimensionGearMaskColor,
                dimensionGearMaskBounds * dimensionGearMaskShape
              );
            #endif
          `)
          .replace('#include <emissivemap_fragment>', `
            #include <emissivemap_fragment>
            #ifdef USE_MAP
              totalEmissiveRadiance += dimensionGearMaskColor *
                dimensionGearMaskBounds * dimensionGearMaskShape *
                ${(mask.emissiveStrength ?? 0).toFixed(4)};
            #endif
          `)
      }
      material.customProgramCacheKey = () => `dimension-gear-texture-mask:${JSON.stringify(mask)}:${maskColor.getHexString()}`
    }
    // Region-based components share one material. Applying emissive here would
    // illuminate every region on the mesh, so their selected color is represented
    // by vertex or texture-mask colors only.
    material.name = base.name
    material.needsUpdate = true
    return material
  })
}

export function applySceneConfiguration(scene: Object3D, input: ApplyConfigurationInput) {
  restoreScene(scene)
  const productBinding = productModelBindings[input.productId]
  const resolved = resolveComponents(input)
  if (!productBinding || !resolved.length) return

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const matching = resolved.filter((component) => matchesBinding(object, component.binding))
    if (!matching.length) return
    const surface = resolved.find((component) => {
      if (!component.materialKey || !component.binding.materialSurface) return false
      const selectors = component.binding.materialSelectors ?? component.binding.selectors
      return selectors.some((selector) => matchesSelector(object, selector))
    })
    const wholeMesh = matching.filter((component) => !component.binding.region && !component.binding.textureMask)
    for (const component of wholeMesh) {
      applyWholeMesh(
        object,
        component,
        component.key === input.activeComponentKey,
        surface?.materialKey,
        component.binding.finish,
        productBinding.colorMapMode,
        productBinding.colorizeDetail,
      )
    }
    const regions = matching.filter((component) => (
      component.binding.region || component.binding.regionEllipses?.length || component.binding.textureMask
    ))
    if (regions.length) applyRegions(object, regions, productBinding.colorMapMode)
  })
}
