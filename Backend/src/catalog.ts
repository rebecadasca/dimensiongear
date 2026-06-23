import { Decimal128, ObjectId, type ClientSession } from 'mongodb'
import { AppError } from './errors.js'
import { getDatabase } from './database.js'
import { decimal128, moneyString, sumMoney } from './money.js'

const categoryKeys: Record<string, string> = {
  Chairs: 'gaming-chair',
  Headsets: 'headset',
  Keyboards: 'keyboard',
  Mice: 'mouse',
  Scaune: 'gaming-chair',
  Căști: 'headset',
  Tastaturi: 'keyboard',
  Mouse: 'mouse',
}

export type SelectionInput = { componentId: string; optionId: string; valueId: string }

export function mapProduct(product: any, categoryName: string) {
  return {
    category: categoryKeys[categoryName] ?? categoryName.toLowerCase(),
    colors: (product.culori ?? []).map((color: any) => ({
      hex: color.codHex,
      id: color.id,
      inStock: color.inStoc,
      label: color.nume,
      priceOverride: color.pretOverride ? moneyString(color.pretOverride) : undefined,
    })),
    customization: product.detaliiPersonalizare
      ? {
          estimatedProductionDays: product.detaliiPersonalizare.durataProductieEstimataZile,
          maxEstimatedPrice: product.detaliiPersonalizare.pretMaximEstimat
            ? moneyString(product.detaliiPersonalizare.pretMaximEstimat)
            : undefined,
          model3DUrl: product.detaliiPersonalizare.model3DUrl,
          startingPrice: product.detaliiPersonalizare.pretMinimEstimat
            ? moneyString(product.detaliiPersonalizare.pretMinimEstimat)
            : undefined,
        }
      : undefined,
    databaseId: product._id.toHexString(),
    description: {
      long: product.descriereLunga ?? product.descriere,
      short: product.descriereScurta ?? product.descriere,
    },
    gallery: product.galerie ?? [],
    id: product.slug,
    name: product.denumire,
    pricing: {
      currency: product.moneda ?? 'RON',
      current: moneyString(product.pretBaza),
      previous: product.pretVechi ? moneyString(product.pretVechi) : undefined,
    },
    productType: product.tipProdus === 'PERSONALIZABIL' ? 'customizable' : 'classic',
    rating: product.rating ?? 0,
    reviewCount: product.numarReviewuri ?? 0,
    sku: product.sku,
    specifications: product.specificatii ?? {},
    status: ({ ACTIV: 'active', INACTIV: 'inactive', INDISPONIBIL: 'unavailable' } as Record<string, string>)[product.status],
    tags: product.taguri ?? [],
  }
}

export async function findProductBySlug(slug: string, session?: ClientSession) {
  const db = getDatabase()
  const product = await db.collection('produse').findOne({ slug }, { session })
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produsul nu a fost găsit')
  const category = await db.collection('categoriiProduse').findOne({ _id: product.categorieId }, { session })
  return { category, product }
}

export async function getCustomization(slug: string) {
  const { category, product } = await findProductBySlug(slug)
  if (product.tipProdus !== 'PERSONALIZABIL') {
    throw new AppError(400, 'PRODUCT_NOT_CUSTOMIZABLE', 'Produsul nu este personalizabil')
  }
  const db = getDatabase()
  const activeComponents = await db.collection('componentePersonalizabile')
    .find({ produsId: product._id, status: 'ACTIVA' })
    .sort({ ordineAfisare: 1 })
    .toArray()
  const components = activeComponents
  const componentIds = components.map((component) => component._id)
  const options = await db.collection('optiuniPersonalizare')
    .find({ componentaPersonalizabilaId: { $in: componentIds }, status: 'ACTIVA' })
    .sort({ ordineAfisare: 1 })
    .toArray()
  const values = await db.collection('valoriOptiuniPersonalizare')
    .find({ optiunePersonalizareId: { $in: options.map((option) => option._id) } })
    .sort({ ordineAfisare: 1 })
    .toArray()

  return {
    components: components.map((component) => ({
      id: component._id.toHexString(),
      key: component.cheie,
      label: component.denumire,
      options: options
        .filter((option) => option.componentaPersonalizabilaId.equals(component._id))
        .map((option) => ({
          id: option._id.toHexString(),
          key: option.cheie,
          label: option.nume,
          required: option.esteObligatorie,
          type: ({ CULOARE: 'color', MATERIAL: 'material', DIMENSIUNE: 'size', VARIANTA: 'variant' } as Record<string, string>)[option.tipOptiune],
          values: values
            .filter((value) => value.optiunePersonalizareId.equals(option._id))
            .map((value) => ({
              available: value.status === 'ACTIVA',
              hex: value.codCuloare,
              id: value._id.toHexString(),
              inStock: value.inStoc ?? true,
              key: value.cheie,
              label: value.valoare,
              priceModifier: moneyString(value.pretSuplimentar),
            })),
        })),
    })),
    product: mapProduct(product, category?.denumire ?? ''),
  }
}

export async function getDefaultConfigurationSelections(slug: string, session?: ClientSession) {
  const { product } = await findProductBySlug(slug, session)
  if (product.tipProdus !== 'PERSONALIZABIL') {
    throw new AppError(400, 'PRODUCT_NOT_CUSTOMIZABLE', 'Produsul nu este personalizabil')
  }
  const db = getDatabase()
  const components = await db.collection('componentePersonalizabile')
    .find({ produsId: product._id, status: 'ACTIVA' }, { session })
    .sort({ ordineAfisare: 1 })
    .toArray()
  const componentIds = components.map((component) => component._id)
  const options = await db.collection('optiuniPersonalizare')
    .find({ componentaPersonalizabilaId: { $in: componentIds }, status: 'ACTIVA' }, { session })
    .sort({ ordineAfisare: 1 })
    .toArray()
  const values = await db.collection('valoriOptiuniPersonalizare')
    .find({ optiunePersonalizareId: { $in: options.map((option) => option._id) }, status: 'ACTIVA' }, { session })
    .sort({ ordineAfisare: 1 })
    .toArray()

  return options.flatMap<SelectionInput>((option) => {
    const component = components.find((item) => item._id.equals(option.componentaPersonalizabilaId))
    const value = values.find((item) => item.optiunePersonalizareId.equals(option._id))
    if (!component || !value) {
      if (option.esteObligatorie) {
        throw new AppError(400, 'DEFAULT_CONFIGURATION_UNAVAILABLE', 'Configurația implicită nu este disponibilă')
      }
      return []
    }
    return [{
      componentId: component._id.toHexString(),
      optionId: option._id.toHexString(),
      valueId: value._id.toHexString(),
    }]
  })
}

export async function quoteConfiguration(slug: string, inputs: SelectionInput[], session?: ClientSession) {
  const { category, product } = await findProductBySlug(slug, session)
  if (product.tipProdus !== 'PERSONALIZABIL') {
    throw new AppError(400, 'PRODUCT_NOT_CUSTOMIZABLE', 'Produsul nu este personalizabil')
  }
  const db = getDatabase()
  const componentIds = inputs.map((input) => new ObjectId(input.componentId))
  const optionIds = inputs.map((input) => new ObjectId(input.optionId))
  const valueIds = inputs.map((input) => new ObjectId(input.valueId))
  const activeProductComponents = await db.collection('componentePersonalizabile')
    .find({ produsId: product._id, status: 'ACTIVA' }, { session })
    .toArray()
  const activeProductComponentIds = activeProductComponents.map((component) => component._id)
  const [selectedComponents, options, values, requiredOptions] = await Promise.all([
    db.collection('componentePersonalizabile').find({ _id: { $in: componentIds }, produsId: product._id, status: 'ACTIVA' }, { session }).toArray(),
    db.collection('optiuniPersonalizare').find({ _id: { $in: optionIds }, status: 'ACTIVA' }, { session }).toArray(),
    db.collection('valoriOptiuniPersonalizare').find({ _id: { $in: valueIds }, status: 'ACTIVA' }, { session }).toArray(),
    db.collection('optiuniPersonalizare').find({
      componentaPersonalizabilaId: { $in: activeProductComponentIds },
      esteObligatorie: true,
      status: 'ACTIVA',
    }, { session }).toArray(),
  ])
  const components = selectedComponents

  if (components.length !== new Set(inputs.map((input) => input.componentId)).size ||
      options.length !== inputs.length || values.length !== inputs.length) {
    throw new AppError(400, 'INVALID_CONFIGURATION', 'Configurația conține selecții indisponibile')
  }

  const snapshots = inputs.map((input) => {
    const component = components.find((item) => item._id.equals(input.componentId))
    const option = options.find((item) => item._id.equals(input.optionId))
    const value = values.find((item) => item._id.equals(input.valueId))
    if (!component || !option || !value ||
        !option.componentaPersonalizabilaId.equals(component._id) ||
        !value.optiunePersonalizareId.equals(option._id)) {
      throw new AppError(400, 'INVALID_CONFIGURATION', 'Relațiile configurației sunt invalide')
    }
    if (option.tipOptiune === 'MATERIAL' &&
        (!['Chairs', 'Scaune'].includes(category?.denumire ?? '') || component.permiteMaterial !== true)) {
      throw new AppError(400, 'MATERIAL_NOT_ALLOWED', 'Materialul nu este disponibil pentru această componentă')
    }
    return {
      ...(value.codCuloare ? { codCuloare: value.codCuloare } : {}),
      componenta: component.denumire,
      componentaPersonalizabilaId: component._id,
      dataSelectare: new Date(),
      optiune: option.nume,
      optiunePersonalizareId: option._id,
      pretSuplimentar: value.pretSuplimentar as Decimal128,
      valoare: value.valoare,
      valoareOptiuneId: value._id,
    }
  })

  const supplied = new Set(inputs.map((input) => input.optionId))
  if (requiredOptions.some((option) => !supplied.has(option._id.toHexString()))) {
    throw new AppError(400, 'INCOMPLETE_CONFIGURATION', 'Toate opțiunile obligatorii trebuie selectate')
  }
  const duplicateOption = inputs.some((input, index) => inputs.findIndex((candidate) => candidate.optionId === input.optionId) !== index)
  if (duplicateOption) throw new AppError(400, 'DUPLICATE_OPTION', 'O opțiune poate fi selectată o singură dată')

  const optionsTotal = sumMoney(snapshots.map((snapshot) => snapshot.pretSuplimentar))
  const total = sumMoney([product.pretBaza, optionsTotal])
  return {
    optionPrice: decimal128(optionsTotal),
    price: decimal128(total),
    product,
    snapshots,
  }
}
