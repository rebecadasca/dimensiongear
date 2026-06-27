use("dimensiongear_db");

/*
 * Schema MongoDB pentru DimensionGear.
 *
 * Decizii de modelare:
 * - liniile de cos/comanda sunt documente incorporate;
 * - stocul 1-la-1 este incorporat in produs sau materie prima;
 * - configuratia 3D finala este separata de sesiunea de editare;
 * - comenzile pastreaza snapshot-uri, astfel incat istoricul sa nu fie
 *   modificat cand produsul, adresa sau configuratia se schimba ulterior;
 * - valorile monetare folosesc Decimal128, nu double.
 *
 * Atentie: collMod actualizeaza validatorul, dar nu migreaza documentele
 * existente. Pentru o baza deja populata este necesara o migrare separata.
 *
 * Regulile dintre colectii trebuie aplicate in serviciul backend, in
 * tranzactii: existenta referintelor, egalitatea totalurilor si
 * rezervarea/scaderea atomica a stocurilor.
 */

function rootSchema(required, properties, extra = {}) {
  return {
    bsonType: "object",
    required,
    additionalProperties: false,
    properties: {
      _id: { bsonType: "objectId" },
      ...properties
    },
    ...extra
  };
}

function embeddedSchema(required, properties, extra = {}) {
  return {
    bsonType: "object",
    required,
    additionalProperties: false,
    properties,
    ...extra
  };
}

function createOrUpdateCollection(collectionName, schema) {
  const validationOptions = {
    validator: { $jsonSchema: schema },
    validationLevel: "strict",
    validationAction: "error"
  };

  if (db.getCollectionNames().includes(collectionName)) {
    db.runCommand({
      collMod: collectionName,
      ...validationOptions
    });
    print(`Colectia ${collectionName} a fost actualizata.`);
    return;
  }

  db.createCollection(collectionName, validationOptions);
  print(`Colectia ${collectionName} a fost creata.`);
}

function sameDocument(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function sameCollation(existing, desired) {
  if (!desired) {
    return !existing;
  }

  return Boolean(existing)
    && existing.locale === desired.locale
    && existing.strength === desired.strength;
}

function ensureIndex(collectionName, key, options = {}) {
  const collection = db.getCollection(collectionName);
  const desiredName = options.name;
  const indexes = collection.getIndexes();
  const existingByName = indexes.find((index) => index.name === desiredName);
  const legacyWithSameKey = indexes.find((index) => {
    const isManagedIndex = index.name.startsWith("ix_")
      || index.name.startsWith("uq_");

    return !isManagedIndex && sameDocument(index.key, key);
  });
  const existing = existingByName ?? legacyWithSameKey;

  if (existing) {
    const compatible = sameDocument(existing.key, key)
      && Boolean(existing.unique) === Boolean(options.unique)
      && sameDocument(
        existing.partialFilterExpression,
        options.partialFilterExpression
      )
      && sameCollation(existing.collation, options.collation);

    if (compatible && existing.name === desiredName) {
      return;
    }

    if (existing.name !== "_id_") {
      collection.dropIndex(existing.name);
    }
  }

  collection.createIndex(key, options);
}

const obsoleteCollections = [
  "curieri",
  "livrari",
  "furnizoriProduse",
  "oferteProduseFurnizori",
  "oferteMateriiPrimeFurnizori",
  "ordineProductie",
  "comenziAprovizionareProduse",
  "comenziAprovizionareMateriiPrime",
  "furnizoriMateriiPrime"
];

for (const collectionName of obsoleteCollections) {
  if (db.getCollectionNames().includes(collectionName)) {
    db.getCollection(collectionName).drop();
    print(`Colectia ${collectionName} a fost eliminata.`);
  }
}

const quantityTypes = ["double", "int", "long", "decimal"];
const unitatiMasura = ["buc", "m", "mp", "g", "kg", "ml", "l"];

const requiredString = {
  bsonType: "string",
  minLength: 1
};

const hexColor = {
  bsonType: "string",
  pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$"
};

const emailSchema = {
  bsonType: "string",
  minLength: 3,
  pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
};

const nonNegativeQuantity = {
  bsonType: quantityTypes,
  minimum: 0
};

const positiveQuantity = {
  bsonType: quantityTypes,
  minimum: 0,
  exclusiveMinimum: true
};

const nonNegativeMoney = {
  bsonType: "decimal",
  minimum: NumberDecimal("0.00")
};

const positiveMoney = {
  bsonType: "decimal",
  minimum: NumberDecimal("0.00"),
  exclusiveMinimum: true
};

const selectieConfiguratieSchema = embeddedSchema(
  [
    "componentaPersonalizabilaId",
    "optiunePersonalizareId",
    "valoareOptiuneId",
    "componenta",
    "optiune",
    "valoare",
    "pretSuplimentar"
  ],
  {
    componentaPersonalizabilaId: { bsonType: "objectId" },
    optiunePersonalizareId: { bsonType: "objectId" },
    valoareOptiuneId: { bsonType: "objectId" },
    componenta: requiredString,
    optiune: requiredString,
    valoare: requiredString,
    codCuloare: { bsonType: "string" },
    pretSuplimentar: nonNegativeMoney,
    dataSelectare: { bsonType: "date" }
  }
);

const adresaSnapshotSchema = embeddedSchema(
  ["numeFacturare", "tara", "judet", "localitate", "strada", "codPostal"],
  {
    numeFacturare: requiredString,
    telefonContact: { bsonType: "string" },
    tara: requiredString,
    judet: requiredString,
    localitate: requiredString,
    strada: requiredString,
    codPostal: requiredString
  }
);

const imagineProdusSchema = embeddedSchema(
  ["id", "src", "alt"],
  {
    id: requiredString,
    label: { bsonType: "string" },
    src: requiredString,
    alt: requiredString,
    colorId: { bsonType: "string" },
    isPrimary: { bsonType: "bool" }
  }
);

const culoareProdusSchema = embeddedSchema(
  ["id", "nume", "codHex", "inStoc"],
  {
    id: requiredString,
    nume: requiredString,
    codHex: hexColor,
    inStoc: { bsonType: "bool" },
    pretOverride: nonNegativeMoney
  }
);

const raspunsRecenzieSchema = embeddedSchema(
  ["raspunsId", "userId", "numeUtilizatorSnapshot", "text", "creatLa"],
  {
    raspunsId: { bsonType: "objectId" },
    userId: { bsonType: "objectId" },
    numeUtilizatorSnapshot: requiredString,
    text: requiredString,
    creatLa: { bsonType: "date" }
  }
);

createOrUpdateCollection(
  "utilizatori",
  rootSchema(
    ["nume", "email", "rol", "status", "creatLa"],
    {
      nume: requiredString,
      email: emailSchema,
      parolaHash: {
        bsonType: "string",
        minLength: 20
      },
      googleSub: {
        bsonType: "string",
        minLength: 3
      },
      telefon: { bsonType: "string" },
      rol: { enum: ["CLIENT", "ADMIN"] },
      status: { enum: ["ACTIV", "INACTIV", "BLOCAT"] },
      puncteFidelitate: {
        bsonType: "int",
        minimum: 0
      },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    },
    {
      anyOf: [
        { required: ["parolaHash"] },
        { required: ["googleSub"] }
      ]
    }
  )
);

createOrUpdateCollection(
  "adrese",
  rootSchema(
    [
      "userId",
      "numeFacturare",
      "tara",
      "judet",
      "localitate",
      "strada",
      "codPostal",
      "creatLa"
    ],
    {
      userId: { bsonType: "objectId" },
      eticheta: { bsonType: "string" },
      numeFacturare: requiredString,
      telefonContact: { bsonType: "string" },
      tara: requiredString,
      judet: requiredString,
      localitate: requiredString,
      strada: requiredString,
      codPostal: requiredString,
      implicita: { bsonType: "bool" },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "categoriiProduse",
  rootSchema(
    ["denumire", "status", "creatLa"],
    {
      denumire: requiredString,
      status: { enum: ["ACTIVA", "INACTIVA"] },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "produse",
  rootSchema(
    [
      "categorieId",
      "sku",
      "denumire",
      "descriere",
      "tipProdus",
      "pretBaza",
      "status",
      "creatLa"
    ],
    {
      categorieId: { bsonType: "objectId" },
      sku: requiredString,
      slug: requiredString,
      denumire: requiredString,
      descriere: requiredString,
      descriereScurta: { bsonType: "string" },
      descriereLunga: { bsonType: "string" },
      tipProdus: { enum: ["SIMPLU", "PERSONALIZABIL"] },
      pretBaza: nonNegativeMoney,
      pretVechi: nonNegativeMoney,
      moneda: { enum: ["RON"] },
      rating: {
        bsonType: ["double", "int"],
        minimum: 0,
        maximum: 5
      },
      numarReviewuri: {
        bsonType: "int",
        minimum: 0
      },
      status: { enum: ["ACTIV", "INACTIV", "INDISPONIBIL"] },
      imagini: {
        bsonType: "array",
        uniqueItems: true,
        items: requiredString
      },
      galerie: {
        bsonType: "array",
        minItems: 1,
        items: imagineProdusSchema
      },
      culori: {
        bsonType: "array",
        items: culoareProdusSchema
      },
      taguri: {
        bsonType: "array",
        uniqueItems: true,
        items: requiredString
      },
      specificatii: {
        bsonType: "object",
        additionalProperties: {
          bsonType: ["string", "bool", "int", "long", "double", "decimal"]
        }
      },
      detaliiProdusSimplu: embeddedSchema(
        ["stocDisponibil", "stocRezervat", "pragMinimStoc"],
        {
          stocDisponibil: {
            bsonType: "int",
            minimum: 0
          },
          stocRezervat: {
            bsonType: "int",
            minimum: 0
          },
          pragMinimStoc: {
            bsonType: "int",
            minimum: 0
          },
          greutateGrame: nonNegativeQuantity
        }
      ),
      detaliiPersonalizare: embeddedSchema(
        ["model3DUrl", "durataProductieEstimataZile"],
        {
          model3DUrl: requiredString,
          durataProductieEstimataZile: {
            bsonType: "int",
            minimum: 1
          },
          pretMinimEstimat: nonNegativeMoney,
          pretMaximEstimat: nonNegativeMoney
        }
      ),
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    },
    {
      oneOf: [
        {
          required: ["detaliiProdusSimplu"],
          properties: {
            tipProdus: { enum: ["SIMPLU"] }
          },
          not: {
            required: ["detaliiPersonalizare"]
          }
        },
        {
          required: ["detaliiPersonalizare"],
          properties: {
            tipProdus: { enum: ["PERSONALIZABIL"] }
          },
          not: {
            required: ["detaliiProdusSimplu"]
          }
        }
      ]
    }
  )
);

createOrUpdateCollection(
  "recenziiProduse",
  rootSchema(
    [
      "produsId",
      "userId",
      "numeUtilizatorSnapshot",
      "rating",
      "text",
      "raspunsuri",
      "creatLa",
      "actualizatLa"
    ],
    {
      produsId: { bsonType: "objectId" },
      userId: { bsonType: "objectId" },
      numeUtilizatorSnapshot: requiredString,
      rating: {
        bsonType: "int",
        minimum: 1,
        maximum: 5
      },
      text: requiredString,
      raspunsuri: {
        bsonType: "array",
        items: raspunsRecenzieSchema
      },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "componentePersonalizabile",
  rootSchema(
    [
      "produsId",
      "cheie",
      "denumire",
      "permiteCuloare",
      "permiteMaterial",
      "permiteDimensiune",
      "status"
    ],
    {
      produsId: { bsonType: "objectId" },
      cheie: requiredString,
      denumire: requiredString,
      descriere: { bsonType: "string" },
      permiteCuloare: { bsonType: "bool" },
      permiteMaterial: { bsonType: "bool" },
      permiteDimensiune: { bsonType: "bool" },
      ordineAfisare: {
        bsonType: "int",
        minimum: 0
      },
      status: { enum: ["ACTIVA", "INACTIVA"] }
    },
    {
      anyOf: [
        { properties: { permiteCuloare: { enum: [true] } } },
        { properties: { permiteMaterial: { enum: [true] } } },
        { properties: { permiteDimensiune: { enum: [true] } } }
      ]
    }
  )
);

createOrUpdateCollection(
  "optiuniPersonalizare",
  rootSchema(
    [
      "componentaPersonalizabilaId",
      "cheie",
      "nume",
      "tipOptiune",
      "esteObligatorie",
      "status"
    ],
    {
      componentaPersonalizabilaId: { bsonType: "objectId" },
      cheie: requiredString,
      nume: requiredString,
      tipOptiune: { enum: ["CULOARE", "MATERIAL", "DIMENSIUNE", "VARIANTA"] },
      esteObligatorie: { bsonType: "bool" },
      ordineAfisare: {
        bsonType: "int",
        minimum: 0
      },
      status: { enum: ["ACTIVA", "INACTIVA"] }
    }
  )
);

createOrUpdateCollection(
  "valoriOptiuniPersonalizare",
  rootSchema(
    [
      "optiunePersonalizareId",
      "cheie",
      "valoare",
      "inStoc",
      "pretSuplimentar",
      "status"
    ],
    {
      optiunePersonalizareId: { bsonType: "objectId" },
      cheie: requiredString,
      valoare: requiredString,
      inStoc: { bsonType: "bool" },
      codCuloare: {
        bsonType: "string",
        pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$"
      },
      pretSuplimentar: nonNegativeMoney,
      ordineAfisare: {
        bsonType: "int",
        minimum: 0
      },
      status: { enum: ["ACTIVA", "INACTIVA"] }
    }
  )
);

createOrUpdateCollection(
  "sesiuniPersonalizare3D",
  rootSchema(
    [
      "userId",
      "produsId",
      "status",
      "selectii",
      "estimareCost",
      "creatLa",
      "actualizatLa"
    ],
    {
      userId: { bsonType: "objectId" },
      produsId: { bsonType: "objectId" },
      status: {
        enum: ["ACTIVA", "FINALIZATA", "ABANDONATA", "EXPIRATA"]
      },
      selectii: {
        bsonType: "array",
        items: selectieConfiguratieSchema
      },
      estimareCost: embeddedSchema(
        [
          "costMateriale",
          "costOptiuni",
          "costProductie",
          "adaosComercial",
          "pretEstimativ",
          "calculatLa"
        ],
        {
          costMateriale: nonNegativeMoney,
          costOptiuni: nonNegativeMoney,
          costProductie: nonNegativeMoney,
          adaosComercial: nonNegativeMoney,
          pretEstimativ: nonNegativeMoney,
          calculatLa: { bsonType: "date" },
          valabilPanaLa: { bsonType: "date" }
        }
      ),
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" },
      expiraLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "configuratii3D",
  rootSchema(
    [
      "sesiunePersonalizareId",
      "userId",
      "produsId",
      "modelFinalUrl",
      "status",
      "selectiiSnapshot",
      "pretConfigurare",
      "creatLa",
      "actualizatLa"
    ],
    {
      sesiunePersonalizareId: { bsonType: "objectId" },
      configuratieSursaId: { bsonType: "objectId" },
      userId: { bsonType: "objectId" },
      produsId: { bsonType: "objectId" },
      modelFinalUrl: requiredString,
      status: {
        enum: [
          "IN_LUCRU",
          "SALVATA",
          "ADAUGATA_IN_COS",
          "COMANDATA",
          "INVALIDA"
        ]
      },
      selectiiSnapshot: {
        bsonType: "array",
        minItems: 1,
        items: selectieConfiguratieSchema
      },
      pretConfigurare: nonNegativeMoney,
      creatLa: { bsonType: "date" },
      salvatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "cosuri",
  rootSchema(
    ["userId", "status", "linii", "creatLa", "actualizatLa"],
    {
      userId: { bsonType: "objectId" },
      status: {
        enum: ["ACTIV", "TRANSFORMAT_IN_COMANDA", "ABANDONAT"]
      },
      linii: {
        bsonType: "array",
        items: embeddedSchema(
          [
            "linieId",
            "produsId",
            "tipProdus",
            "cantitate",
            "pretUnitate",
            "subtotal"
          ],
          {
            linieId: { bsonType: "objectId" },
            produsId: { bsonType: "objectId" },
            configuratie3DId: { bsonType: "objectId" },
            tipProdus: { enum: ["SIMPLU", "PERSONALIZABIL"] },
            cantitate: {
              bsonType: "int",
              minimum: 1
            },
            pretUnitate: nonNegativeMoney,
            subtotal: nonNegativeMoney
          },
          {
            oneOf: [
              {
                properties: {
                  tipProdus: { enum: ["SIMPLU"] }
                },
                not: {
                  required: ["configuratie3DId"]
                }
              },
              {
                required: ["configuratie3DId"],
                properties: {
                  tipProdus: { enum: ["PERSONALIZABIL"] }
                }
              }
            ]
          }
        )
      },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "comenzi",
  rootSchema(
    [
      "userId",
      "adresaLivrareSnapshot",
      "statusComanda",
      "linii",
      "subtotalProduse",
      "costLivrare",
      "discount",
      "total",
      "creatLa"
    ],
    {
      userId: { bsonType: "objectId" },
      cosSursaId: { bsonType: "objectId" },
      adresaLivrareId: { bsonType: "objectId" },
      adresaLivrareSnapshot: adresaSnapshotSchema,
      statusComanda: {
        enum: [
          "CREATA",
          "IN_ASTEPTARE_PLATA",
          "PLATITA",
          "IN_PROCESARE",
          "IN_PRODUCTIE",
          "EXPEDIATA",
          "FINALIZATA",
          "ANULATA"
        ]
      },
      linii: {
        bsonType: "array",
        minItems: 1,
        items: embeddedSchema(
          [
            "linieId",
            "produsId",
            "sku",
            "denumireProdus",
            "tipProdus",
            "cantitate",
            "pretUnitate",
            "subtotal"
          ],
          {
            linieId: { bsonType: "objectId" },
            produsId: { bsonType: "objectId" },
            configuratie3DId: { bsonType: "objectId" },
            sku: requiredString,
            denumireProdus: requiredString,
            tipProdus: { enum: ["SIMPLU", "PERSONALIZABIL"] },
            cantitate: {
              bsonType: "int",
              minimum: 1
            },
            pretUnitate: nonNegativeMoney,
            subtotal: nonNegativeMoney,
            configuratieSnapshot: embeddedSchema(
              ["modelFinalUrl", "selectii", "pretConfigurare"],
              {
                modelFinalUrl: requiredString,
                selectii: {
                  bsonType: "array",
                  minItems: 1,
                  items: selectieConfiguratieSchema
                },
                pretConfigurare: nonNegativeMoney
              }
            )
          },
          {
            oneOf: [
              {
                properties: {
                  tipProdus: { enum: ["SIMPLU"] }
                },
                not: {
                  anyOf: [
                    { required: ["configuratie3DId"] },
                    { required: ["configuratieSnapshot"] }
                  ]
                }
              },
              {
                required: ["configuratie3DId", "configuratieSnapshot"],
                properties: {
                  tipProdus: { enum: ["PERSONALIZABIL"] }
                }
              }
            ]
          }
        )
      },
      subtotalProduse: nonNegativeMoney,
      costLivrare: nonNegativeMoney,
      discount: nonNegativeMoney,
      puncteFidelitateFolosite: {
        bsonType: "int",
        minimum: 0
      },
      puncteFidelitateAcordate: {
        bsonType: "int",
        minimum: 0
      },
      puncteFidelitateRestaurate: { bsonType: "bool" },
      total: nonNegativeMoney,
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" },
      anulataLa: { bsonType: "date" },
      finalizataLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "plati",
  rootSchema(
    [
      "comandaId",
      "tipPlata",
      "metodaPlataInitiala",
      "statusPlata",
      "sumaTotala",
      "sumaAchitata",
      "sumaRamasa",
      "tranzactii",
      "creatLa",
      "actualizatLa"
    ],
    {
      comandaId: { bsonType: "objectId" },
      tipPlata: {
        enum: ["INTEGRALA", "AVANS_PLUS_REST_LA_LIVRARE"]
      },
      metodaPlataInitiala: {
        enum: ["CARD", "RAMBURS", "TRANSFER_BANCAR"]
      },
      metodaPlataRest: {
        enum: ["CARD", "RAMBURS", "TRANSFER_BANCAR"]
      },
      statusPlata: {
        enum: [
          "INITIATA",
          "IN_ASTEPTARE",
          "AUTORIZATA",
          "CONFIRMATA",
          "ESUATA",
          "ANULATA",
          "RAMBURSATA_PARTIAL",
          "RAMBURSATA"
        ]
      },
      sumaTotala: nonNegativeMoney,
      sumaDeIncasatAcum: nonNegativeMoney,
      sumaAchitata: nonNegativeMoney,
      sumaRamasa: nonNegativeMoney,
      sumaRamasaDupaPlata: nonNegativeMoney,
      stripePaymentIntentId: { bsonType: "string" },
      tranzactii: {
        bsonType: "array",
        items: embeddedSchema(
          ["tranzactieId", "tip", "metodaPlata", "status", "suma", "creatLa"],
          {
            tranzactieId: { bsonType: "objectId" },
            tip: { enum: ["PLATA", "RAMBURSARE"] },
            metodaPlata: {
              enum: ["CARD", "RAMBURS", "TRANSFER_BANCAR"]
            },
            status: {
              enum: [
                "INITIATA",
                "AUTORIZATA",
                "CONFIRMATA",
                "ESUATA",
                "ANULATA"
              ]
            },
            suma: positiveMoney,
            referintaProcesator: { bsonType: "string" },
            creatLa: { bsonType: "date" }
          }
        )
      },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    },
    {
      oneOf: [
        {
          properties: {
            tipPlata: { enum: ["INTEGRALA"] }
          },
          not: {
            required: ["metodaPlataRest"]
          }
        },
        {
          required: ["metodaPlataRest"],
          properties: {
            tipPlata: { enum: ["AVANS_PLUS_REST_LA_LIVRARE"] }
          }
        }
      ]
    }
  )
);

createOrUpdateCollection(
  "evenimenteStripe",
  rootSchema(
    ["eventId", "tip", "creatLa"],
    {
      eventId: requiredString,
      tip: requiredString,
      creatLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "materiiPrime",
  rootSchema(
    [
      "denumire",
      "tipMaterial",
      "unitateMasura",
      "stoc",
      "status",
      "creatLa"
    ],
    {
      denumire: requiredString,
      tipMaterial: requiredString,
      unitateMasura: { enum: unitatiMasura },
      costMediuPonderat: nonNegativeMoney,
      stoc: embeddedSchema(
        ["cantitateDisponibila", "cantitateRezervata", "pragMinim"],
        {
          cantitateDisponibila: nonNegativeQuantity,
          cantitateRezervata: nonNegativeQuantity,
          pragMinim: nonNegativeQuantity
        }
      ),
      status: { enum: ["ACTIVA", "INACTIVA"] },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    }
  )
);

createOrUpdateCollection(
  "reteteProductie",
  rootSchema(
    [
      "produsPersonalizabilId",
      "tipReteta",
      "denumire",
      "versiune",
      "timpProductieEstimatOre",
      "instructiuniProductie",
      "costTotalMateriale",
      "statusReteta",
      "materiiPrimeNecesare",
      "creatLa"
    ],
    {
      produsPersonalizabilId: { bsonType: "objectId" },
      configuratie3DId: { bsonType: "objectId" },
      tipReteta: {
        enum: ["SABLON", "GENERATA_DIN_CONFIGURATIE"]
      },
      denumire: requiredString,
      versiune: {
        bsonType: "int",
        minimum: 1
      },
      timpProductieEstimatOre: positiveQuantity,
      instructiuniProductie: requiredString,
      costTotalMateriale: nonNegativeMoney,
      statusReteta: { enum: ["ACTIVA", "INACTIVA"] },
      materiiPrimeNecesare: {
        bsonType: "array",
        minItems: 1,
        items: embeddedSchema(
          ["materiePrimaId", "cantitateNecesara", "unitateMasura"],
          {
            materiePrimaId: { bsonType: "objectId" },
            cantitateNecesara: positiveQuantity,
            unitateMasura: { enum: unitatiMasura },
            costUnitarSnapshot: nonNegativeMoney,
            costCalculat: nonNegativeMoney
          }
        )
      },
      creatLa: { bsonType: "date" },
      actualizatLa: { bsonType: "date" }
    },
    {
      oneOf: [
        {
          properties: {
            tipReteta: { enum: ["SABLON"] }
          },
          not: {
            required: ["configuratie3DId"]
          }
        },
        {
          required: ["configuratie3DId"],
          properties: {
            tipReteta: { enum: ["GENERATA_DIN_CONFIGURATIE"] }
          }
        }
      ]
    }
  )
);

ensureIndex(
  "utilizatori",
  { email: 1 },
  {
    name: "uq_utilizatori_email",
    unique: true,
    collation: { locale: "en", strength: 2 }
  }
);
ensureIndex(
  "utilizatori",
  { googleSub: 1 },
  {
    name: "uq_utilizatori_google_sub",
    unique: true,
    partialFilterExpression: { googleSub: { $type: "string" } }
  }
);
ensureIndex("adrese", { userId: 1 }, { name: "ix_adrese_user" });
ensureIndex(
  "adrese",
  { userId: 1 },
  {
    name: "uq_adresa_implicita_user",
    unique: true,
    partialFilterExpression: { implicita: true }
  }
);
ensureIndex(
  "categoriiProduse",
  { denumire: 1 },
  {
    name: "uq_categorii_denumire",
    unique: true,
    collation: { locale: "ro", strength: 2 }
  }
);
ensureIndex(
  "produse",
  { sku: 1 },
  {
    name: "uq_produse_sku",
    unique: true,
    collation: { locale: "en", strength: 2 }
  }
);
ensureIndex(
  "produse",
  { slug: 1 },
  {
    name: "uq_produse_slug",
    unique: true,
    partialFilterExpression: {
      slug: { $type: "string" }
    },
    collation: { locale: "en", strength: 2 }
  }
);
ensureIndex(
  "produse",
  { categorieId: 1, status: 1 },
  { name: "ix_produse_categorie_status" }
);
ensureIndex(
  "recenziiProduse",
  { produsId: 1, userId: 1 },
  {
    name: "uq_recenzii_produs_user",
    unique: true
  }
);
ensureIndex(
  "recenziiProduse",
  { produsId: 1, creatLa: -1 },
  { name: "ix_recenzii_produs_data" }
);
ensureIndex(
  "componentePersonalizabile",
  { produsId: 1, denumire: 1 },
  {
    name: "uq_componente_produs_denumire",
    unique: true,
    collation: { locale: "ro", strength: 2 }
  }
);
ensureIndex(
  "optiuniPersonalizare",
  { componentaPersonalizabilaId: 1, tipOptiune: 1, nume: 1 },
  {
    name: "uq_optiuni_componenta_tip_nume",
    unique: true,
    collation: { locale: "ro", strength: 2 }
  }
);
ensureIndex(
  "valoriOptiuniPersonalizare",
  { optiunePersonalizareId: 1, valoare: 1 },
  {
    name: "uq_valori_optiune_valoare",
    unique: true,
    collation: { locale: "ro", strength: 2 }
  }
);
ensureIndex(
  "sesiuniPersonalizare3D",
  { userId: 1, produsId: 1, status: 1 },
  { name: "ix_sesiuni_user_produs_status" }
);
ensureIndex(
  "configuratii3D",
  { userId: 1, produsId: 1, status: 1 },
  { name: "ix_configuratii_user_produs_status" }
);
ensureIndex(
  "configuratii3D",
  { configuratieSursaId: 1 },
  {
    name: "ix_configuratii_sursa",
    partialFilterExpression: { configuratieSursaId: { $type: "objectId" } }
  }
);
ensureIndex(
  "configuratii3D",
  { sesiunePersonalizareId: 1 },
  { name: "ix_configuratii_sesiune" }
);
ensureIndex(
  "cosuri",
  { userId: 1 },
  {
    name: "uq_cos_activ_user",
    unique: true,
    partialFilterExpression: { status: "ACTIV" }
  }
);
ensureIndex(
  "cosuri",
  { userId: 1, status: 1 },
  { name: "ix_cosuri_user_status" }
);
ensureIndex(
  "comenzi",
  { userId: 1, creatLa: -1 },
  { name: "ix_comenzi_user_data" }
);
ensureIndex(
  "comenzi",
  { statusComanda: 1, creatLa: 1 },
  { name: "ix_comenzi_status_data" }
);
ensureIndex(
  "plati",
  { comandaId: 1 },
  {
    name: "uq_plati_comanda",
    unique: true
  }
);
ensureIndex(
  "plati",
  { stripePaymentIntentId: 1 },
  {
    name: "uq_plati_stripe_intent",
    unique: true,
    partialFilterExpression: { stripePaymentIntentId: { $type: "string" } }
  }
);
ensureIndex(
  "evenimenteStripe",
  { eventId: 1 },
  { name: "uq_evenimente_stripe_event", unique: true }
);
ensureIndex(
  "materiiPrime",
  { denumire: 1 },
  {
    name: "uq_materii_prime_denumire",
    unique: true,
    collation: { locale: "ro", strength: 2 }
  }
);
ensureIndex(
  "reteteProductie",
  {
    produsPersonalizabilId: 1,
    tipReteta: 1,
    versiune: 1,
    configuratie3DId: 1
  },
  {
    name: "uq_retete_identitate",
    unique: true
  }
);
ensureIndex(
  "reteteProductie",
  { produsPersonalizabilId: 1 },
  {
    name: "uq_reteta_sablon_activa_produs",
    unique: true,
    partialFilterExpression: {
      tipReteta: "SABLON",
      statusReteta: "ACTIVA"
    }
  }
);
ensureIndex(
  "reteteProductie",
  { configuratie3DId: 1 },
  {
    name: "uq_reteta_generata_configuratie",
    unique: true,
    partialFilterExpression: {
      configuratie3DId: { $type: "objectId" }
    }
  }
);

print("Schema si indexurile DimensionGear au fost verificate.");
