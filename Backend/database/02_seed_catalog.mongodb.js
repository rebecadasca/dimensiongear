use("dimensiongear_db");

/*
 * Seed pentru catalogul actual DimensionGear.
 *
 * Ruleaza dupa 01_create_schema.mongodb.js.
 * Scriptul este idempotent: categoriile si produsele sunt create sau
 * actualizate pe baza de denumire categorie si SKU produs.
 */

const now = new Date();

function money(value) {
  return NumberDecimal(String(value));
}

function gallery(slug, productName, imageCount) {
  return Array.from({ length: imageCount }, (_, index) => {
    const imageNumber = index + 1;
    const id = `image-${String(imageNumber).padStart(2, "0")}`;

    return {
      id,
      label: `Imagine ${imageNumber}`,
      src: `/product-images/${slug}/${id}.png`,
      alt: `${productName} imagine ${imageNumber}`,
      isPrimary: index === 0
    };
  });
}

function color(id, nume, codHex, inStoc = true, pretOverride = null) {
  const baseColor = { id, nume, codHex, inStoc };

  if (pretOverride === null) {
    return baseColor;
  }

  return {
    ...baseColor,
    pretOverride: money(pretOverride)
  };
}

const categories = [
  { key: "headset", denumire: "Căști", denumireVeche: "Headsets" },
  { key: "keyboard", denumire: "Tastaturi", denumireVeche: "Keyboards" },
  { key: "mouse", denumire: "Mouse", denumireVeche: "Mice" },
  { key: "gaming-chair", denumire: "Scaune", denumireVeche: "Chairs" }
];

const categoryIds = {};

for (const category of categories) {
  const existingCategory = db.categoriiProduse.findOne({
    denumire: { $in: [category.denumire, category.denumireVeche] }
  });

  if (existingCategory) {
    db.categoriiProduse.updateOne(
      { _id: existingCategory._id },
      {
        $set: {
          denumire: category.denumire,
          status: "ACTIVA",
          actualizatLa: now
        }
      }
    );
    categoryIds[category.key] = existingCategory._id;
  } else {
    const insertResult = db.categoriiProduse.insertOne({
      denumire: category.denumire,
      status: "ACTIVA",
      creatLa: now,
      actualizatLa: now
    });
    categoryIds[category.key] = insertResult.insertedId;
  }
}

function product(input) {
  const productGallery = gallery(input.slug, input.name, input.imageCount).map((image, index) => (
    input.galleryColorIds?.[index] ? { ...image, colorId: input.galleryColorIds[index] } : image
  )).map((image) => ({
    ...image,
    isPrimary: image.id === (input.primaryImageId ?? "image-01")
  }));
  const baseProduct = {
    categorieId: categoryIds[input.category],
    sku: input.sku,
    slug: input.slug,
    denumire: input.name,
    descriere: input.longDescription,
    descriereScurta: input.shortDescription,
    descriereLunga: input.longDescription,
    tipProdus: input.customization ? "PERSONALIZABIL" : "SIMPLU",
    pretBaza: money(input.currentPrice),
    moneda: "RON",
    rating: 0,
    numarReviewuri: 0,
    status: "ACTIV",
    imagini: productGallery.map((image) => image.src),
    galerie: productGallery,
    culori: input.colors,
    taguri: input.tags,
    specificatii: input.specifications,
    actualizatLa: now
  };

  if (input.previousPrice) {
    baseProduct.pretVechi = money(input.previousPrice);
  }

  if (input.customization) {
    baseProduct.detaliiPersonalizare = {
      model3DUrl: input.customization.model3DUrl,
      durataProductieEstimataZile: input.customization.estimatedProductionDays,
      pretMinimEstimat: money(input.customization.startingPrice),
      pretMaximEstimat: money(input.customization.maxEstimatedPrice)
    };
  } else {
    baseProduct.detaliiProdusSimplu = {
      stocDisponibil: 20,
      stocRezervat: 0,
      pragMinimStoc: 3
    };
  }

  return baseProduct;
}

const catalog = [
  product({
    category: "headset",
    colors: [
      color("quartz", "Quartz", "#E5A3B0"),
      color("black", "Negru", "#161314")
    ],
    currentPrice: "323.19",
    galleryColorIds: ["quartz", "quartz", "quartz", "quartz", "black", "black", "black", "black"],
    imageCount: 8,
    longDescription: "Se poate conecta simultan la un dispozitiv 2.4 GHz și la unul Bluetooth, iar SmartSwitch permite trecerea rapidă între surse. Apelurile de pe dispozitivul Bluetooth pot intra automat, astfel încât utilizatorul poate răspunde și reveni la sunetul jocului fără să dea jos căștile. Modul Nu deranja poate fi activat din aplicația Razer Audio, iar butonul dedicat permite comutarea manuală între HyperSpeed Wireless și Bluetooth.",
    name: "Căști gaming wireless RAZER Barracuda X",
    previousPrice: "359.10",
    rating: 4.57,
    reviewCount: 53,
    shortDescription: "Căști gaming wireless ușoare și versatile pentru PC, consolă și dispozitive mobile.",
    sku: "HST-RAZER-BARRACUDA-X",
    slug: "razer-barracuda-x-wireless",
    specifications: {
      frequencyResponse: "20 Hz - 20 kHz",
      microphoneIncluded: true,
      warrantyMonths: 24
    },
    tags: ["wireless", "bluetooth", "hyperspeed", "lightweight"]
  }),
  product({
    category: "headset",
    colors: [color("white", "Alb", "#FFFFFF")],
    currentPrice: "799.90",
    imageCount: 4,
    longDescription: "Depășește competiția cu tehnologie wireless optimizată pentru latență foarte redusă, de până la 10 ms, oferind sunet aproape instantaneu pentru momente decisive. Microfonul detașabil de generație nouă acoperă o plajă de frecvențe mai largă și redă vocea clar, pentru comunicare naturală și precisă în echipă.",
    name: "Căști gaming wireless RAZER BlackShark V3 licențiate PlayStation",
    previousPrice: "849.95",
    rating: 0,
    reviewCount: 0,
    shortDescription: "Căști wireless de esports pentru PlayStation, cu latență redusă și microfon de nivel profesionist.",
    sku: "HST-RAZER-BLACKSHARK-V3-PS",
    slug: "razer-blackshark-v3-playstation-wireless",
    specifications: {
      frequencyResponse: "20 Hz - 28000 Hz",
      microphoneIncluded: true,
      warrantyMonths: 24
    },
    tags: ["wireless", "playstation", "low-latency", "detachable-mic"]
  }),
  product({
    category: "headset",
    colors: [
      color("gunmetal", "Gunmetal", "#4B4949"),
      color("white", "Alb", "#FFFFFF", true, "599.99")
    ],
    currentPrice: "1399.90",
    galleryColorIds: ["gunmetal", "gunmetal", "gunmetal", "gunmetal", "white", "white", "white", "white"],
    imageCount: 8,
    longDescription: "Construcția din aluminiu prelucrat oferă modelului VIRTUOSO RGB Wireless un echilibru solid între greutate redusă, durabilitate și confort. Microfonul omnidirecțional detașabil are o plajă largă de frecvențe pentru claritate vocală superioară și include indicator LED pentru status activ sau mut.",
    name: "Căști gaming wireless Corsair Virtuoso SE",
    rating: 3.64,
    reviewCount: 11,
    shortDescription: "Căști wireless premium cu difuzoare de 50 mm, construcție din aluminiu și microfon detașabil.",
    sku: "HST-CORSAIR-VIRTUOSO-SE",
    slug: "corsair-virtuoso-se-wireless",
    specifications: {
      frequencyResponse: "20 Hz - 40000 Hz",
      microphoneIncluded: true,
      warrantyMonths: 24
    },
    tags: ["wireless", "rgb", "detachable-mic", "aluminium"]
  }),
  product({
    category: "headset",
    colors: [color("matte-black", "Negru mat", "#1A1A1A")],
    currentPrice: "899.99",
    customization: {
      estimatedProductionDays: 7,
      maxEstimatedPrice: "1199.99",
      model3DUrl: "/models/optimized/casti_skull_x10.glb",
      startingPrice: "899.99"
    },
    imageCount: 4,
    longDescription: "Skullcandy Crusher Wireless Custom este o cască premium de gaming pentru utilizatorii care vor să personalizeze produsul înainte de comandă. Prin configuratorul 3D, clienții pot alege culori separate pentru cadrul de bază, cupele audio rigide, pernuțele pentru urechi și banda de susținere, apoi pot previzualiza designul final în timp real. Logo-ul urmează culoarea cadrului. Căștile includ difuzoare de neodim de 50 mm reglate precis, conexiune wireless cu latență redusă, sunet surround imersiv și microfon omnidirecțional detașabil.",
    name: "Skullcandy Crusher Wireless Custom",
    primaryImageId: "image-04",
    previousPrice: "999.99",
    rating: 4.8,
    reviewCount: 126,
    shortDescription: "Căști gaming wireless personalizabile, cu configurare 3D, sunet surround și iluminare RGB.",
    sku: "HST-VX3D-WL-001",
    slug: "skullcandy-crusher-custom",
    specifications: {
      frequencyResponse: "20 Hz - 30000 Hz",
      microphoneIncluded: true,
      warrantyMonths: 24
    },
    tags: ["customizable", "wireless", "surround-sound", "rgb"]
  }),
  product({
    category: "keyboard",
    colors: [color("black", "Negru", "#000000")],
    currentPrice: "249.90",
    imageCount: 4,
    longDescription: "MYRIA MG7530 este o tastatură mecanică de gaming compactă pentru utilizatorii care vor mai mult spațiu pe birou fără să renunțe la răspuns rapid. Layoutul US cu 68 de taste elimină tastatura numerică dedicată, iar iluminarea RGB oferă setupului un aspect modern de gaming. Tastatura suportă conexiune wireless Bluetooth și USB pentru sesiuni cu fir.",
    name: "Tastatură gaming mecanică wireless MYRIA MG7530",
    rating: 4.67,
    reviewCount: 6,
    shortDescription: "Tastatură gaming mecanică wireless compactă, layout US cu 68 de taste și iluminare RGB.",
    sku: "TASMG7530",
    slug: "myria-mg7530-wireless-mechanical",
    specifications: {
      hasNumericKeys: false,
      isMechanical: true,
      isWireless: true,
      warrantyMonths: 24
    },
    tags: ["wireless", "mechanical", "rgb", "compact"]
  }),
  product({
    category: "keyboard",
    colors: [color("black", "Negru", "#000000")],
    currentPrice: "237.16",
    imageCount: 4,
    longDescription: "Logitech G213 Prodigy este o tastatură gaming full-size cu fir pentru utilizare zilnică și sesiuni lungi. Tastele tactile Mech-Dome oferă tastare silențioasă și receptivă printr-o construcție pe membrană. Include iluminare LIGHTSYNC RGB pe cinci zone, suport integrat pentru palmă, picioare ajustabile, controale media dedicate și design rezistent la stropire.",
    name: "Tastatură gaming Logitech G213 Prodigy",
    previousPrice: "424.95",
    rating: 4.67,
    reviewCount: 60,
    shortDescription: "Tastatură gaming RGB full-size cu fir, taste tactile Mech-Dome și suport pentru palmă.",
    sku: "TAS920008093",
    slug: "logitech-g213-prodigy-gaming",
    specifications: {
      hasNumericKeys: true,
      isMechanical: false,
      isWireless: false,
      warrantyMonths: 24
    },
    tags: ["wired", "rgb", "full-size", "media-controls"]
  }),
  product({
    category: "keyboard",
    colors: [color("black", "Negru", "#000000")],
    currentPrice: "132.51",
    imageCount: 4,
    longDescription: "Trust GXT 867 Acira este o tastatură mecanică de gaming cu fir, în format ultra-compact 60%. Switch-urile mecanice Outemu Red oferă apăsări line și rapide, iar iluminarea RGB completă adaugă personalizare vizuală. Layoutul redus creează spațiu suplimentar pentru mouse și se potrivește birourilor compacte sau setupurilor portabile.",
    name: "Tastatură gaming mecanică Trust GXT 867 Acira",
    rating: 4.13,
    reviewCount: 8,
    shortDescription: "Tastatură gaming mecanică 60% cu fir, switch-uri Outemu Red și iluminare RGB.",
    sku: "TAS24882",
    slug: "trust-gxt-867-acira-mechanical",
    specifications: {
      hasNumericKeys: false,
      isMechanical: true,
      isWireless: false,
      warrantyMonths: 24
    },
    tags: ["wired", "mechanical", "rgb", "compact"]
  }),
  product({
    category: "keyboard",
    colors: [color("arctic-white", "Alb arctic", "#F2F2F0")],
    currentPrice: "649.99",
    customization: {
      estimatedProductionDays: 6,
      maxEstimatedPrice: "899.99",
      model3DUrl: "/models/custom_keyboard.glb",
      startingPrice: "649.99"
    },
    imageCount: 4,
    longDescription: "Vertex K87 3D Custom Wireless este o tastatură mecanică premium pentru utilizatorii care vor să personalizeze atât aspectul, cât și configurația tehnică. Prin configuratorul 3D, clienții pot alege carcasa, keycapurile, rama decorativă, butonul rotativ și tipul de switch, apoi pot previzualiza configurația finală în timp real.",
    name: "Tastatură gaming wireless Vertex K87 3D Custom",
    previousPrice: "729.99",
    rating: 4.8,
    reviewCount: 42,
    shortDescription: "Tastatură gaming mecanică wireless personalizabilă, cu layout TKL compact și configurare 3D în timp real.",
    sku: "KBD-VK87-CUSTOM-001",
    slug: "vertex-k87-3d-custom-wireless",
    specifications: {
      hasNumericKeys: false,
      isMechanical: true,
      isWireless: true,
      warrantyMonths: 24
    },
    tags: ["customizable", "wireless", "mechanical", "hot-swap"]
  }),
  product({
    category: "keyboard",
    colors: [color("lavender-purple", "Mov lavandă", "#B8A2C8")],
    currentPrice: "579.99",
    customization: {
      estimatedProductionDays: 6,
      maxEstimatedPrice: "849.99",
      model3DUrl: "/models/optimized/mechanical_keyboard_-_aesthetic.optimized.glb",
      startingPrice: "579.99"
    },
    imageCount: 4,
    longDescription: "Vertex K68 Pastel 3D Custom este o tastatură mecanică compactă pentru utilizatorii care vor să personalizeze atât aspectul, cât și funcționalitatea. Clienții pot configura în timp real culorile carcasei, keycapurile și tastele de accent. Layoutul compact 65% păstrează săgețile și controalele esențiale de navigare, eliminând tastatura numerică.",
    name: "Tastatură wireless Vertex K68 Pastel 3D Custom",
    previousPrice: "649.99",
    rating: 4.8,
    reviewCount: 37,
    shortDescription: "Tastatură gaming mecanică compactă, personalizabilă, cu design pastel și conectivitate wireless.",
    sku: "KBD-VK68-3DC-001",
    slug: "vertex-k68-pastel-3d-custom",
    specifications: {
      hasNumericKeys: false,
      isMechanical: true,
      isWireless: true,
      warrantyMonths: 24
    },
    tags: ["customizable", "wireless", "mechanical", "pastel"]
  }),
  product({
    category: "mouse",
    colors: [color("black", "Negru", "#171717")],
    currentPrice: "89",
    imageCount: 4,
    longDescription: "Logitech G102 LIGHTSYNC este un mouse de gaming cu fir, creat pentru jucătorii care au nevoie de control avansat și personalizare extinsă. Senzorul optic suportă până la 24.000 DPI. Mouse-ul include 11 butoane programabile, greutăți ajustabile, rotiță cu două moduri, iluminare LIGHTSYNC RGB și stocare pentru profiluri.",
    name: "Mouse gaming Logitech G102 LIGHTSYNC",
    previousPrice: "135",
    rating: 4.74,
    reviewCount: 116,
    shortDescription: "Mouse gaming performant cu fir, senzor de 24.000 DPI, butoane programabile și RGB.",
    sku: "MOU910005823",
    slug: "logitech-g102-lightsync-gaming",
    specifications: {
      buttonCount: 11,
      hasRgbLighting: true,
      maxDpi: 24000,
      sensorType: "optic",
      warrantyMonths: 24,
      wireless: false
    },
    tags: ["wired", "rgb", "programmable-buttons", "high-dpi"]
  }),
  product({
    category: "mouse",
    colors: [color("black", "Negru", "#111111")],
    currentPrice: "135",
    imageCount: 4,
    longDescription: "Razer Viper V3 HyperSpeed este un mouse gaming wireless ușor, pentru gameplay competitiv rapid și precis. Senzorul optic Razer Focus Pro ajunge la 30.000 DPI și suportă ajustări detaliate pentru stiluri diferite de joc. Designul simetric pentru mâna dreaptă este optimizat pentru grip claw și fingertip, iar cele șase controale programabile pot fi personalizate prin Razer Synapse.",
    name: "Mouse gaming wireless Razer Viper V3 HyperSpeed",
    previousPrice: "190",
    rating: 4.54,
    reviewCount: 13,
    shortDescription: "Mouse gaming wireless ușor, cu senzor de 30.000 DPI și conectivitate HyperSpeed.",
    sku: "MOURZ0149101R3M",
    slug: "razer-viper-v3-hyperspeed-wireless",
    specifications: {
      buttonCount: 6,
      hasRgbLighting: false,
      maxDpi: 30000,
      sensorType: "optic",
      warrantyMonths: 24,
      wireless: true
    },
    tags: ["wireless", "hyperspeed", "competitive", "high-dpi"]
  }),
  product({
    category: "mouse",
    colors: [color("pale-gray", "Gri deschis", "#E5E5E1")],
    currentPrice: "330",
    imageCount: 4,
    longDescription: "Logitech MX Master 3S este un mouse wireless premium pentru productivitate, precizie și utilizare zilnică extinsă. Senzorul optic Darkfield de 8.000 DPI urmărește precis aproape orice suprafață, inclusiv sticla. Tehnologia Quiet Click reduce zgomotul clickurilor, iar rotița electromagnetică MagSpeed oferă derulare precisă și rapidă. Mouse-ul suportă Bluetooth și Logi Bolt și se poate conecta la până la trei dispozitive.",
    name: "Mouse wireless Logitech MX Master 3S - Gri deschis",
    previousPrice: "380",
    rating: 4.9,
    reviewCount: 86,
    shortDescription: "Mouse wireless ergonomic premium, cu senzor Darkfield de 8.000 DPI și clickuri silențioase.",
    sku: "910-006558",
    slug: "logitech-mx-master-3s-pale-gray",
    specifications: {
      buttonCount: 7,
      hasRgbLighting: false,
      maxDpi: 8000,
      sensorType: "optic Darkfield",
      warrantyMonths: 24,
      wireless: true
    },
    tags: ["wireless", "ergonomic", "productivity", "darkfield"]
  }),
  product({
    category: "mouse",
    colors: [color("obsidian-black", "Negru obsidian", "#111315")],
    currentPrice: "749.99",
    customization: {
      estimatedProductionDays: 7,
      maxEstimatedPrice: "1099.99",
      model3DUrl: "/models/configurable/aether-m9-glossy.glb",
      startingPrice: "749.99"
    },
    imageCount: 4,
    longDescription: "Aether M9 OLED 3D Custom este un mouse gaming wireless premium pentru utilizatorii care cer performanță avansată, confort ergonomic și personalizare extinsă. Prin configuratorul 3D, clienții pot personaliza carcasa, panourile laterale, rotița, accentele decorative și zonele RGB pe un corp 3D lucios din plastic de calitate. Include senzor optic de 26.000 DPI, butoane programabile, ecran OLED integrat, conexiune wireless 2.4 GHz, Bluetooth și USB-C cu fir.",
    name: "Mouse gaming wireless Aether M9 OLED 3D Custom",
    previousPrice: "829.99",
    rating: 4.8,
    reviewCount: 54,
    shortDescription: "Mouse gaming wireless ergonomic, personalizabil, cu ecran OLED și configurare 3D în timp real.",
    sku: "MOU-AM9-3DC-001",
    slug: "aether-m9-oled-3d-custom-wireless",
    specifications: {
      buttonCount: 9,
      hasRgbLighting: true,
      maxDpi: 26000,
      sensorType: "optic",
      warrantyMonths: 24,
      wireless: true
    },
    tags: ["customizable", "wireless", "oled", "rgb"]
  }),
  product({
    category: "mouse",
    currentPrice: "270",
    colors: [
      color("black", "Negru", "#111827")
    ],
    customization: {
      estimatedProductionDays: 5,
      maxEstimatedPrice: "339",
      model3DUrl: "/models/optimized/ice_claw_mouse.optimized.glb",
      startingPrice: "270"
    },
    imageCount: 3,
    longDescription: "Mouse gaming wireless Ice Claw 3D Custom este un mouse gaming wireless ușor pentru mișcare rapidă, țintire precisă și control personalizat. Prin configuratorul 3D, clienții pot previzualiza finisajul negru al carcasei, panourilor laterale, rotiței, butoanelor și logo-ului iluminat. Mouse-ul suportă wireless 2.4 GHz, Bluetooth și USB-C cu fir.",
    name: "Mouse gaming wireless Ice Claw 3D Custom",
    previousPrice: "339",
    rating: 4.7,
    reviewCount: 39,
    shortDescription: "Mouse gaming wireless ușor, personalizabil, cu iluminare RGB și configurare 3D în timp real.",
    sku: "MOU-NS6-3DC-001",
    slug: "nova-s6-air-3d-custom-wireless",
    specifications: {
      buttonCount: 6,
      hasRgbLighting: true,
      maxDpi: 20000,
      sensorType: "optic",
      warrantyMonths: 24,
      wireless: true
    },
    tags: ["customizable", "wireless", "lightweight", "rgb"]
  }),
  product({
    category: "gaming-chair",
    colors: [color("gray", "Gri", "#858789")],
    currentPrice: "999.90",
    imageCount: 3,
    longDescription: "MYRIA MG7437 este un scaun ergonomic de gaming creat pentru confort și suport în sesiuni lungi de joc, lucru sau studiu. Tapițeria din material respirabil îmbunătățește circulația aerului, iar cadrul metalic solid crește stabilitatea. Suportul lombar reglabil, brațele 3D, spătarul rabatabil și perna magnetică din spumă cu memorie oferă susținere suplimentară pentru postură.",
    name: "Scaun gaming MYRIA MG7437",
    rating: 4.86,
    reviewCount: 7,
    shortDescription: "Scaun gaming ergonomic cu material respirabil, brațe 3D și suport lombar.",
    sku: "GAMMG7437GRI",
    slug: "myria-mg7437-gaming-chair-gray",
    specifications: {
      adjustableArmrests: true,
      adjustableLumbarSupport: true,
      armrestType: "3D",
      frameMaterial: "metal",
      hasHeadrestPillow: true,
      hasLumbarSupport: true,
      maxReclineDegrees: 150,
      maxWeightKg: 150,
      recliningBackrest: true,
      upholsteryMaterial: "breathable fabric",
      warrantyMonths: 24
    },
    tags: ["ergonomic", "fabric", "lumbar-support", "3d-armrests"]
  }),
  product({
    category: "gaming-chair",
    colors: [
      color("quartz-pink", "Quartz Pink", "#E8B8C7"),
      color("black", "Negru", "#383838")
    ],
    currentPrice: "1699.90",
    galleryColorIds: ["quartz-pink", "quartz-pink", "quartz-pink", "quartz-pink", "black", "black", "black", "black"],
    imageCount: 8,
    longDescription: "Razer Iskur V2 X NewGen este un scaun ergonomic de gaming conceput pentru sesiuni lungi de joc și lucru. Suportul lombar integrat urmărește curba naturală a spatelui inferior. Pielea Razer Gen-2 EPU cu tehnologie CoolTouch rămâne confortabilă în utilizare prelungită, iar spuma densă turnată la rece distribuie uniform presiunea. Arcurile late pentru umeri, baza extinsă, brațele 2D și spătarul rabatabil susțin poziții multiple.",
    name: "Scaun gaming Razer Iskur V2 X NewGen",
    previousPrice: "1781.45",
    rating: 0,
    reviewCount: 0,
    shortDescription: "Scaun gaming ergonomic cu suport lombar integrat și piele EPU CoolTouch.",
    sku: "RZ3805311000R3G1",
    slug: "razer-iskur-v2-x-newgen-quartz",
    specifications: {
      adjustableArmrests: true,
      adjustableLumbarSupport: false,
      armrestType: "2D",
      hasHeadrestPillow: false,
      hasLumbarSupport: true,
      maxReclineDegrees: 152,
      maxWeightKg: 136,
      recliningBackrest: true,
      seatMaterial: "high-density cold-cured foam",
      upholsteryMaterial: "Razer Gen-2 EPU Leather with CoolTouch Technology",
      warrantyMonths: 36
    },
    tags: ["ergonomic", "epu-leather", "lumbar-support", "2d-armrests"]
  }),
  product({
    category: "gaming-chair",
    colors: [color("obsidian-black", "Negru obsidian", "#121416")],
    currentPrice: "1399.99",
    customization: {
      estimatedProductionDays: 8,
      maxEstimatedPrice: "1899.99",
      model3DUrl: "/models/optimized/gaming_chair.glb",
      startingPrice: "1399.99"
    },
    imageCount: 4,
    longDescription: "Vortex X7 Racing 3D Custom este un scaun ergonomic de gaming pentru utilizatorii care vor să personalizeze aspectul și setările de confort. Prin configuratorul 3D, clienții pot alege culori separate pentru șezut, spătar, perna de gât, perna de spate și accente, plus tapițerie textilă, mesh sau piele sintetică. Cadrul rămâne într-un finisaj fix realist și nu este inclus în personalizare. Designul inspirat de racing include spătar înalt, suporturi laterale ranforsate, zonă căptușită pentru cap, șezut lat, brațe ajustabile, spătar rabatabil, suport lombar și construcție durabilă.",
    name: "Scaun gaming Vortex X7 Racing 3D Custom",
    previousPrice: "1549.99",
    rating: 4.8,
    reviewCount: 46,
    shortDescription: "Scaun gaming personalizabil în stil racing, cu suport ergonomic și configurare 3D în timp real.",
    sku: "GCH-VX7-3DC-001",
    slug: "vortex-x7-racing-3d-custom",
    specifications: {
      adjustableArmrests: true,
      adjustableLumbarSupport: true,
      armrestType: "4D",
      baseMaterial: "aluminium alloy",
      frameMaterial: "reinforced steel",
      hasHeadrestPillow: true,
      hasLumbarSupport: true,
      maxReclineDegrees: 160,
      maxWeightKg: 150,
      recliningBackrest: true,
      seatMaterial: "high-density cold-cured foam",
      upholsteryMaterial: "premium synthetic leather and breathable mesh fabric",
      warrantyMonths: 36
    },
    tags: ["customizable", "racing", "4d-armrests", "lumbar-support"]
  }),
  product({
    category: "gaming-chair",
    colors: [color("graphite-gray", "Gri grafit", "#44484D")],
    currentPrice: "1699.99",
    customization: {
      estimatedProductionDays: 10,
      maxEstimatedPrice: "2299.99",
      model3DUrl: "/models/gaming_chair(1).glb",
      startingPrice: "1699.99"
    },
    imageCount: 4,
    longDescription: "Aero Comfort Z9 3D Custom este un scaun ergonomic premium de gaming pentru utilizatorii care vor confort avansat, materiale durabile și personalizare vizuală extinsă. Prin configuratorul 3D, clienții pot modifica tapițeria, suporturile laterale, cusăturile, panoul lombar, perna pentru cap, detaliile brațelor și accentele bazei. Scaunul include suport lombar adaptiv, material tehnic respirabil, brațe 4D, spătar rabatabil, balans sincronizat, pernă magnetică din spumă cu memorie, cadru ranforsat din oțel și bază din aluminiu.",
    name: "Scaun gaming Aero Comfort Z9 3D Custom",
    previousPrice: "1849.99",
    rating: 4.9,
    reviewCount: 31,
    shortDescription: "Scaun gaming premium personalizabil, cu material respirabil, suport lombar adaptiv și brațe 4D.",
    sku: "GCH-ACZ9-3DC-001",
    slug: "aero-comfort-z9-3d-custom",
    specifications: {
      adjustableArmrests: true,
      adjustableLumbarSupport: true,
      armrestType: "4D",
      baseMaterial: "aluminium alloy",
      frameMaterial: "reinforced steel",
      hasHeadrestPillow: true,
      hasLumbarSupport: true,
      maxReclineDegrees: 165,
      maxWeightKg: 160,
      recliningBackrest: true,
      seatMaterial: "high-density cold-cured foam",
      upholsteryMaterial: "breathable technical fabric",
      warrantyMonths: 36
    },
    tags: ["customizable", "premium", "technical-fabric", "4d-armrests"]
  })
];

const removedProductSkus = [
  "GCH-ACZ9-3DC-001",
  "KBD-VK87-CUSTOM-001",
  "MOU-AM9-3DC-001",
  "TAS920008093"
];

const removedProducts = db.produse.find({ sku: { $in: removedProductSkus } }).toArray();
const removedProductIds = removedProducts.map((item) => item._id);

if (removedProductIds.length > 0) {
  const removedComponents = db.componentePersonalizabile
    .find({ produsId: { $in: removedProductIds } })
    .toArray();
  const removedComponentIds = removedComponents.map((item) => item._id);
  const removedOptions = db.optiuniPersonalizare
    .find({ componentaPersonalizabilaId: { $in: removedComponentIds } })
    .toArray();
  const removedOptionIds = removedOptions.map((item) => item._id);

  if (removedOptionIds.length > 0) {
    db.valoriOptiuniPersonalizare.deleteMany({ optiunePersonalizareId: { $in: removedOptionIds } });
  }

  if (removedComponentIds.length > 0) {
    db.optiuniPersonalizare.deleteMany({ componentaPersonalizabilaId: { $in: removedComponentIds } });
    db.componentePersonalizabile.deleteMany({ _id: { $in: removedComponentIds } });
  }

  db.produse.deleteMany({ _id: { $in: removedProductIds } });
}

for (const item of catalog.filter((productItem) => !removedProductSkus.includes(productItem.sku))) {
  db.produse.updateOne(
    { sku: item.sku },
    {
      $set: item,
      $setOnInsert: {
        creatLa: now
      }
    },
    { upsert: true }
  );
}

if (db.getCollectionNames().includes("recenziiProduse")) {
  const activeProductSkus = catalog
    .filter((productItem) => !removedProductSkus.includes(productItem.sku))
    .map((productItem) => productItem.sku);
  const activeProductIds = db.produse
    .find({ sku: { $in: activeProductSkus } }, { projection: { _id: 1 } })
    .toArray()
    .map((item) => item._id);

  db.recenziiProduse.aggregate([
    { $match: { produsId: { $in: activeProductIds } } },
    {
      $group: {
        _id: "$produsId",
        rating: { $avg: "$rating" },
        numarReviewuri: { $sum: 1 }
      }
    }
  ]).forEach((stats) => {
    db.produse.updateOne(
      { _id: stats._id },
      {
        $set: {
          actualizatLa: now,
          numarReviewuri: stats.numarReviewuri,
          rating: Math.round(Number(stats.rating) * 100) / 100
        }
      }
    );
  });
}

print(`Catalog seed finalizat: ${categories.length} categorii si ${catalog.length - removedProductSkus.length} produse active.`);
