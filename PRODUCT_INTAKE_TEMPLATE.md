# Product intake template

Complete one block per product. You can paste the filled blocks in chat, or edit
this file directly and tell Codex to import them into `products.ts`.

## Required product fields

```md
## Product
id / slug:
sku:
name:
category: gaming-chair | headset | keyboard | mouse
productType: classic | customizable
status: active | inactive | unavailable

currentPriceRON:
previousPriceRON:
rating:
reviewCount:

shortDescription:
longDescription:

colors:
- id:
  label:
  hex:
  inStock: true | false

tags:
- 

gallery PNG files:
- front.png:
- side.png:
- detail.png:
- lifestyle.png:

customization, only if productType is customizable:
model3DUrl:
estimatedProductionDays:
startingPriceRON:
maxEstimatedPriceRON:
```

## Image placement

Put product PNG files here:

```txt
Frontend/public/product-images/<product-id>/front.png
Frontend/public/product-images/<product-id>/side.png
Frontend/public/product-images/<product-id>/detail.png
Frontend/public/product-images/<product-id>/lifestyle.png
```

Example:

```txt
Frontend/public/product-images/pulse-core-mouse/front.png
Frontend/public/product-images/pulse-core-mouse/side.png
Frontend/public/product-images/pulse-core-mouse/detail.png
Frontend/public/product-images/pulse-core-mouse/lifestyle.png
```

The frontend path stored in `products.ts` will be:

```txt
/product-images/pulse-core-mouse/front.png
```

## Notes

- Keep `id` lowercase, without spaces, using hyphens.
- `sku` should be unique.
- Product details page uses PNG gallery only.
- 3D model URLs belong only to customizable products and are used only by the
  configurator page.
