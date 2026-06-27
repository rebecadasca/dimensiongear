use("dimensiongear_db");

/* Seed idempotent pentru fiecare relație de personalizare vizibilă clientului. */
function money(value) {
  return NumberDecimal(String(value));
}

const palette = [
  { key: "black", label: "Negru", hex: "#111827", inStock: true, price: "0.00" },
  { key: "white", label: "Alb", hex: "#F9FAFB", inStock: true, price: "0.00" },
  { key: "red", label: "Roșu", hex: "#DC2626", inStock: false, price: "65.00" },
  { key: "orange", label: "Portocaliu", hex: "#E27800", inStock: true, price: "0.00" },
  { key: "yellow", label: "Galben", hex: "#D6B000", inStock: true, price: "0.00" },
  { key: "green", label: "Verde", hex: "#05A907", inStock: true, price: "0.00" },
  { key: "blue", label: "Albastru", hex: "#1F7DE0", inStock: true, price: "0.00" },
  { key: "purple", label: "Mov", hex: "#8A12D9", inStock: true, price: "0.00" },
  { key: "pastel-red", label: "Rosu pastel", hex: "#F8A6A6", inStock: true, price: "0.00" },
  { key: "pastel-orange", label: "Portocaliu pastel", hex: "#FFC18A", inStock: true, price: "0.00" },
  { key: "pastel-yellow", label: "Galben pastel", hex: "#FBEA8C", inStock: true, price: "0.00" },
  { key: "pastel-green", label: "Verde pastel", hex: "#A8E6B0", inStock: true, price: "0.00" },
  { key: "pastel-blue", label: "Albastru pastel", hex: "#9DCCFF", inStock: true, price: "0.00" },
  { key: "pastel-purple", label: "Mov pastel", hex: "#CDB4F6", inStock: true, price: "0.00" },
  { key: "pastel-pink", label: "Roz pastel", hex: "#F7B7D2", inStock: true, price: "0.00" }
];

const materials = [
  { key: "textile", label: "Textile", price: "0.00" },
  { key: "mesh", label: "Mesh", price: "90.00" },
  { key: "leather", label: "Piele", price: "180.00" }
];

const products = [
  {
    sku: "HST-VX3D-WL-001",
    components: ["base-frame", "audio-cups", "ear-cushions", "headband-cushion"]
  },
  {
    sku: "KBD-VK87-CUSTOM-001",
    components: ["case", "keycaps", "decorative-frame", "rotary-knob"],
    switches: true
  },
  {
    sku: "KBD-VK68-3DC-001",
    components: ["case", "keycaps", "accent-keys"]
  },
  {
    sku: "MOU-AM9-3DC-001",
    components: ["shell", "side-panels", "scroll-wheel", "accents", "rgb-zones"]
  },
  {
    sku: "MOU-NS6-3DC-001",
    components: ["shell", "side-panel", "scroll-wheel", "buttons", "illuminated-logo"]
  },
  {
    sku: "GCH-VX7-3DC-001",
    chair: true,
    materialComponent: "seat",
    components: ["seat", "backrest", "neck-pillow", "back-pillow", "accents"]
  },
  {
    sku: "GCH-ACZ9-3DC-001",
    chair: true,
    materialComponent: "upholstery",
    components: ["upholstery", "side-supports", "stitching", "lumbar-panel", "head-cushion", "armrests", "wheelbase"]
  }
];

function labelFromKey(key) {
  const fixedLabels = {
    "base-frame": "Cadru",
    "audio-cups": "Cupele audio",
    "ear-cushions": "Bureții pentru urechi",
    "headband-cushion": "Buretele benzii"
  };
  Object.assign(fixedLabels, {
    "ear-cushions": "Bureții pentru urechi",
    "case": "Carcasă",
    "keycaps": "Keycapuri",
    "decorative-frame": "Ramă decorativă",
    "rotary-knob": "Buton rotativ",
    "accent-keys": "Taste de accent",
    "decorative-elements": "Elemente decorative",
    "shell": "Carcasă",
    "side-panels": "Panouri laterale",
    "side-panel": "Panou lateral",
    "scroll-wheel": "Rotiță",
    "accents": "Accente",
    "rgb-zones": "Zone RGB",
    "buttons": "Butoane",
    "illuminated-logo": "Logo iluminat",
    "seat": "Șezut",
    "backrest": "Spătar",
    "pillow": "Pernă",
    "neck-pillow": "Pernă gât",
    "back-pillow": "Pernă spate",
    "upholstery": "Tapițerie",
    "side-supports": "Suporturi laterale",
    "stitching": "Cusături",
    "lumbar-panel": "Panou lombar",
    "head-cushion": "Pernă pentru cap",
    "armrests": "Brațe",
    "wheelbase": "Bază"
  });
  if (fixedLabels[key]) return fixedLabels[key];
  return key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function upsertOption(componentId, key, name, type, order) {
  db.optiuniPersonalizare.updateOne(
    { componentaPersonalizabilaId: componentId, cheie: key },
    {
      $set: {
        esteObligatorie: true,
        nume: name,
        ordineAfisare: order,
        status: "ACTIVA",
        tipOptiune: type
      },
      $setOnInsert: { cheie: key, componentaPersonalizabilaId: componentId }
    },
    { upsert: true }
  );
  return db.optiuniPersonalizare.findOne({ componentaPersonalizabilaId: componentId, cheie: key })._id;
}

function upsertValue(optionId, value, order) {
  const fields = {
    inStoc: value.inStock !== false,
    ordineAfisare: order,
    pretSuplimentar: money(value.price ?? "0.00"),
    status: "ACTIVA",
    valoare: value.label
  };

  if (value.hex) {
    fields.codCuloare = value.hex;
  }

  db.valoriOptiuniPersonalizare.updateOne(
    { optiunePersonalizareId: optionId, cheie: value.key },
    {
      $set: fields,
      $setOnInsert: { cheie: value.key, optiunePersonalizareId: optionId }
    },
    { upsert: true }
  );
}

for (const definition of products) {
  const product = db.produse.findOne({ sku: definition.sku, tipProdus: "PERSONALIZABIL" });
  if (!product) {
    print(`Produs personalizabil lipsa pentru ${definition.sku}; seed omis.`);
    continue;
  }

  if (definition.sku === "HST-VX3D-WL-001") {
    ["frame", "cushions", "accents", "logo"].forEach((legacyKey) => {
      db.componentePersonalizabile.updateOne(
        { produsId: product._id, cheie: legacyKey },
        {
          $set: {
            cheie: `legacy-v1-${legacyKey}`,
            denumire: `Versiune veche ${labelFromKey(legacyKey)}`,
            status: "INACTIVA"
          }
        }
      );
    });
  }

  if (definition.sku === "GCH-VX7-3DC-001") {
    ["pillow"].forEach((legacyKey) => {
      db.componentePersonalizabile.updateOne(
        { produsId: product._id, cheie: legacyKey },
        {
          $set: {
            cheie: `legacy-v1-${legacyKey}`,
            denumire: `Versiune veche ${labelFromKey(legacyKey)}`,
            status: "INACTIVA"
          }
        }
      );
    });
  }

  definition.components.forEach((key, componentIndex) => {
    const permitsMaterial = Boolean(definition.chair && key === definition.materialComponent);
    db.componentePersonalizabile.updateOne(
      { produsId: product._id, cheie: key },
      {
        $set: {
          denumire: key === "illuminated-logo" ? "Logo" : labelFromKey(key),
          descriere: `Componentă personalizabilă: ${(key === "illuminated-logo" ? "Logo" : labelFromKey(key)).toLowerCase()}`,
          ordineAfisare: componentIndex,
          permiteCuloare: true,
          permiteDimensiune: false,
          permiteMaterial: permitsMaterial,
          status: "ACTIVA"
        },
        $setOnInsert: { cheie: key, produsId: product._id }
      },
      { upsert: true }
    );

    const component = db.componentePersonalizabile.findOne({ produsId: product._id, cheie: key });
    const colorOptionId = upsertOption(component._id, "color", "Culoare", "CULOARE", 0);
    palette.forEach((value, index) => upsertValue(colorOptionId, value, index));

    if (permitsMaterial) {
      const materialOptionId = upsertOption(component._id, "material", "Material", "MATERIAL", 1);
      materials.forEach((value, index) => upsertValue(materialOptionId, value, index));
    }

    if (definition.switches && key === "case") {
      const switchOptionId = upsertOption(component._id, "switch-type", "Tip switch", "VARIANTA", 2);
      [
        { key: "red-switch", label: "Switch roșu" },
        { key: "brown-switch", label: "Switch maro" },
        { key: "blue-switch", label: "Switch albastru" }
      ].forEach((value, index) => upsertValue(switchOptionId, value, index));
    }
  });

  db.componentePersonalizabile.updateMany(
    { produsId: product._id, cheie: { $nin: definition.components } },
    { $set: { status: "INACTIVA" } }
  );

  if (definition.sku === "MOU-NS6-3DC-001") {
    const iceClawComponents = db.componentePersonalizabile
      .find({ produsId: product._id, cheie: { $in: definition.components } })
      .toArray();
    const iceClawColorOptions = db.optiuniPersonalizare
      .find({
        componentaPersonalizabilaId: { $in: iceClawComponents.map((component) => component._id) },
        cheie: "color"
      })
      .toArray();

    db.valoriOptiuniPersonalizare.updateMany(
      {
        optiunePersonalizareId: { $in: iceClawColorOptions.map((option) => option._id) },
        cheie: { $in: palette.map((value) => value.key) }
      },
      { $set: { status: "ACTIVA" } }
    );
  }
}

print("Seedul de personalizare a fost finalizat pentru toate produsele personalizabile.");
