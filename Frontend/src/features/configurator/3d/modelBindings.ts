export type NormalizedBox = {
  x?: [number, number]
  y?: [number, number]
  z?: [number, number]
}

export type NormalizedEllipse = {
  center: [number, number]
  innerRadius?: [number, number]
  radius: [number, number]
  y?: [number, number]
}

export type MeshSelector = {
  ancestorIncludes?: string[]
  materialNames?: string[]
  nameIncludes?: string[]
}

export type FixedColorMask = {
  brightness?: [number, number]
  color: string
  ellipses?: Array<{
    center: [number, number]
    innerRadius?: [number, number]
    radius: [number, number]
  }>
  invertBrightness?: boolean
  regions?: Array<{
    u: [number, number]
    v: [number, number]
  }>
}

export type ComponentVisualBinding = {
  emissive?: boolean
  finish?: 'glossyPlastic'
  fixedColorMasks?: FixedColorMask[]
  materialSelectors?: MeshSelector[]
  materialSurface?: boolean
  linkedColorComponentKey?: string
  linkedColorMaskPath?: string
  priority?: number
  region?: NormalizedBox[] | 'fallback'
  regionEllipses?: NormalizedEllipse[]
  regionMode?: 'component' | 'triangle'
  selectors: MeshSelector[]
  textureMask?: {
    brightness?: [number, number]
    emissiveStrength?: number
    ellipses?: Array<{
      center: [number, number]
      innerRadius?: [number, number]
      radius: [number, number]
    }>
    geometryFallback?: boolean
    geometryFallbackRegions?: NormalizedBox[]
    geometryNormalY?: [number, number]
    invertBrightness?: boolean
    regions?: Array<{
      u: [number, number]
      v: [number, number]
    }>
    u?: [number, number]
    v?: [number, number]
  }
}

export type ProductModelBinding = {
  colorMapMode?: 'colorize' | 'multiply' | 'replace'
  colorizeDetail?: {
    max: number
    min: number
    sourceHigh: number
    sourceLow: number
  }
  components: Record<string, ComponentVisualBinding>
}

const allOfModel = (name: string): MeshSelector[] => [{ nameIncludes: [name] }]
const iceClawMouseSurface: MeshSelector[] = [
  { nameIncludes: ['Plane001'] },
  { nameIncludes: ['Plane.001'] },
]

export const productModelBindings: Record<string, ProductModelBinding> = {
  'skullcandy-crusher-custom': {
    colorizeDetail: {
      max: 1,
      min: 1,
      sourceHigh: 0.22,
      sourceLow: 0.012,
    },
    colorMapMode: 'colorize',
    components: {
      'base-frame': {
        selectors: [{ nameIncludes: ['schelet'] }],
      },
      'audio-cups': {
        fixedColorMasks: [{
          brightness: [0.12, 0.34],
          color: '#050505',
          ellipses: [{
            center: [0.535, 0.37],
            radius: [0.24, 0.31],
          }],
          invertBrightness: true,
        }],
        selectors: [{ nameIncludes: ['boxa'] }],
      },
      'ear-cushions': {
        fixedColorMasks: [{
          color: '#050505',
          ellipses: [{
            center: [0.38, 0.26],
            radius: [0.1, 0.09],
          }],
        }],
        selectors: [{ nameIncludes: ['bureti'] }],
      },
      'headband-cushion': {
        selectors: [{ nameIncludes: ['burete'] }],
      },
    },
  },
  'vertex-k87-3d-custom-wireless': {
    components: {
      case: { selectors: allOfModel('Keyboard_Base') },
      keycaps: { selectors: allOfModel('Keys_S') },
      'decorative-frame': { selectors: allOfModel('Slice_Default') },
      'rotary-knob': { selectors: allOfModel('Slice001') },
    },
  },
  'vertex-k68-pastel-3d-custom': {
    components: {
      case: {
        selectors: [{ materialNames: ['Chassis'] }],
      },
      keycaps: { selectors: [{ materialNames: ['Small_Buttons'] }] },
      'accent-keys': { selectors: [{ materialNames: ['Big_Buttons'] }] },
    },
  },
  'aether-m9-oled-3d-custom-wireless': {
    components: {
      shell: { finish: 'glossyPlastic', selectors: [{ materialNames: ['black'] }] },
      'side-panels': { finish: 'glossyPlastic', selectors: [{ materialNames: ['grey'] }] },
      'scroll-wheel': { finish: 'glossyPlastic', selectors: [{ materialNames: ['green'] }] },
      accents: { finish: 'glossyPlastic', selectors: [{ materialNames: ['grill1'] }] },
      'rgb-zones': { emissive: true, finish: 'glossyPlastic', selectors: [{ materialNames: ['grill2'] }] },
    },
  },
  'nova-s6-air-3d-custom-wireless': {
    // This model ships with a strongly green-tinted base-color texture. Multiplying
    // custom colors by it makes every selection look like a translucent overlay.
    // Keep the normal/roughness detail, but let the configured colors replace albedo.
    colorMapMode: 'replace',
    components: {
      shell: {
        priority: 1,
        region: 'fallback',
        regionMode: 'component',
        selectors: iceClawMouseSurface,
      },
      'side-panel': {
        priority: 20,
        regionMode: 'component',
        region: [
          { x: [0, 0.3], y: [0.25, 0.65], z: [0, 0.7] },
          { x: [0.7, 1], y: [0.25, 0.65], z: [0, 0.7] },
        ],
        selectors: iceClawMouseSurface,
      },
      'scroll-wheel': {
        priority: 50,
        regionMode: 'component',
        region: [{ x: [0.44, 0.52], y: [0.76, 0.84], z: [0.63, 0.84] }],
        selectors: iceClawMouseSurface,
      },
      buttons: {
        priority: 30,
        regionMode: 'component',
        region: [
          { x: [0.28, 0.34], y: [0.66, 0.71], z: [0.62, 0.79] },
          { x: [0.58, 0.64], y: [0.66, 0.71], z: [0.64, 0.81] },
        ],
        selectors: iceClawMouseSurface,
      },
      'illuminated-logo': {
        priority: 60,
        selectors: iceClawMouseSurface,
        textureMask: {
          brightness: [0.04, 0.12],
          emissiveStrength: 0.75,
          u: [0.27, 0.47],
          v: [0.12, 0.3],
        },
      },
    },
  },
  'vortex-x7-racing-3d-custom': {
    components: {
      seat: {
        materialSurface: true,
        materialSelectors: [{
          ancestorIncludes: ['Sezut', 'Spatar', 'Perna gat', 'Perna_Gat', 'Perna spate', 'Perna_spate'],
        }],
        selectors: [{ ancestorIncludes: ['Sezut'] }],
      },
      backrest: { selectors: [{ ancestorIncludes: ['Spatar'] }] },
      'neck-pillow': {
        selectors: [
          { ancestorIncludes: ['Perna gat'] },
          { ancestorIncludes: ['Perna_Gat'] },
        ],
      },
      'back-pillow': {
        selectors: [
          { ancestorIncludes: ['Perna spate'] },
          { ancestorIncludes: ['Perna_spate'] },
        ],
      },
      accents: { selectors: [{ ancestorIncludes: ['Accent'] }] },
    },
  },
  'aero-comfort-z9-3d-custom': {
    components: {
      upholstery: {
        materialSurface: true,
        selectors: [{ nameIncludes: ['butt_', 'back2_'] }],
      },
      'side-supports': { selectors: [{ nameIncludes: ['back_bone_'] }] },
      stitching: {
        priority: 40,
        region: [
          { x: [0.47, 0.53] },
          { x: [0.08, 0.13] },
          { x: [0.87, 0.92] },
        ],
        selectors: [{ nameIncludes: ['back2_', 'butt_'] }],
      },
      'lumbar-panel': {
        priority: 30,
        region: [{ y: [0.12, 0.48] }],
        selectors: [{ nameIncludes: ['back2_'] }],
      },
      'head-cushion': {
        priority: 50,
        region: [{ y: [0.78, 1] }],
        selectors: [{ nameIncludes: ['back2_'] }],
      },
      armrests: { selectors: [{ nameIncludes: ['L_handle_', 'R_handle_'] }] },
      wheelbase: {
        selectors: [{
          ancestorIncludes: ['base', 'wheel1'],
          nameIncludes: ['adjustment_', 'pCube', 'pPlane', 'pCylinder', 'Bolt', 'polySurface', 'wheel'],
        }],
      },
    },
  },
}
