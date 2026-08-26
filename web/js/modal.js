// ── DOM helpers ──
const g = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const isSvg =
    tag === "svg" ||
    tag === "use" ||
    tag === "path" ||
    tag === "circle" ||
    tag === "symbol" ||
    tag === "g" ||
    tag === "defs";
  const node = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tag)
    : document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") {
      if (isSvg) node.setAttribute("class", v);
      else node.className = v;
    } else if (k === "text") {
      node.textContent = v;
    } else if (k === "href" && isSvg) {
      node.setAttribute("href", v);
      node.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", v);
    } else {
      node.setAttribute(k, v);
    }
  }

  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function helpIcon(help, id) {
  const svgUse = el("use", { href: "img/main.svg#infoIcon" });
  const svg = el("svg", { class: "help-icon-svg" }, svgUse);

  const btn = el(
    "button",
    {
      type: "button",
      class: "help-icon",
      title: `Clic para ver en la guía: ${help || "Más información"}`,
      "aria-label": `Ver en guía de opciones: ${help || ""}`,
    },
    svg,
  );

  if (id) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const library = id.startsWith("moz-") ? "mozjpeg" : "jpegli";
      if (typeof openGuideModal === "function") {
        openGuideModal(library, id);
      }
    });
  }
  return btn;
}

// Slider con etiqueta y valor en tiempo real
function sliderGroup({
  id,
  label,
  help,
  min,
  max,
  value,
  step,
  divisor,
  extraAttrs = {},
  extraClass = "",
}) {
  const valueId = `${id}-value`;
  const displayVal = divisor ? (value / divisor).toFixed(2) : String(value);

  const lbl = el("label");
  lbl.append(
    label,
    " ",
    helpIcon(help, id),
    " ",
    el("span", { id: valueId }, displayVal),
  );

  const inputAttrs = {
    type: "range",
    id,
    min: String(min),
    max: String(max),
    value: String(value),
    class: "slider",
    ...extraAttrs,
  };
  if (step !== undefined) inputAttrs.step = String(step);

  return el(
    "div",
    { class: `form-group${extraClass ? " " + extraClass : ""}` },
    lbl,
    el("input", inputAttrs),
  );
}

// Checkbox con etiqueta
function checkboxGroup({ id, label, help, checked = false, extraClass = "" }) {
  const cb = el("input", { type: "checkbox", id });
  cb.checked = checked; // propiedad, no atributo, para evitar problemas con el estado actual vs default
  const lbl = el("label");
  lbl.append(cb, " ", label, " ", helpIcon(help, id));
  return el(
    "div",
    { class: `form-group${extraClass ? " " + extraClass : ""}` },
    lbl,
  );
}

// Select con opciones
function selectGroup({ id, label, help, options }) {
  const lbl = el("label");
  lbl.append(label, " ", helpIcon(help, id));

  const select = el("select", { id });
  for (const { value, text, selected } of options) {
    const opt = el("option", { value: String(value) }, text);
    if (selected) opt.selected = true;
    select.append(opt);
  }
  return el("div", { class: "form-group" }, lbl, select);
}

// Sección acordeón colapsable
function accordion(title, ...children) {
  const header = el(
    "button",
    { type: "button", class: "accordion-header", "aria-expanded": "false" },
    el("span", { class: "accordion-title" }, title),
    el("span", { class: "accordion-arrow" }),
  );
  const body = el("div", { class: "accordion-body" }, ...children);
  return el("div", { class: "accordion-section" }, header, body);
}

// Párrafo de instrucciones que encabeza cada modal
function modalSubtitle() {
  const p = el("p", { class: "modal-subtitle" });
  p.append(
    "Ajusta los parámetros de compresión. Pulsa sobre el icono ",
    el(
      "span",
      { class: "help-icon", style: "cursor:default; pointer-events:none;" },
      el("svg", { class: "help-icon-svg" }, el("use", { href: "img/main.svg#infoIcon" })),
    ),
    " de cualquier opción para ver su entrada en la guía.",
  );
  return p;
}

// Estructura completa de una modal
function makeModal(id, title, bodyChildren, { cancelId, applyId }) {
  const content = el(
    "div",
    { class: "modal-content" },
    el("h2", {}, title),
    modalSubtitle(),
    el("div", { class: "modal-body" }, ...bodyChildren),
    el(
      "div",
      { class: "modal-footer" },
      el("button", { id: cancelId, class: "modal-btn cancel" }, "Cancelar"),
      el("button", { id: applyId, class: "modal-btn" }, "Aplicar"),
    ),
  );
  return el("div", { id, class: "modal" }, content);
}

// ── Modal MozJPEG ──
function buildMozjpegModal() {
  const chromaOpts = [
    { value: 0, text: "4:4:4 (mejor calidad)" },
    { value: 1, text: "4:2:2" },
    { value: 2, text: "4:2:0 (mejor compresión)", selected: true },
  ];
  const dctOpts = [
    { value: 0, text: "ISLOW (preciso, recomendado)", selected: true },
    { value: 1, text: "IFAST (rápido, menos preciso)" },
    { value: 2, text: "FLOAT (coma flotante)" },
  ];
  const tuneOpts = [
    { value: 0, text: "0 — PSNR-HVS-M (Default MozJPEG)", selected: true },
    { value: 1, text: "1 — MS-SSIM (Similitud multi-escala)" },
    { value: 2, text: "2 — SSIM (Similitud estructural)" },
    { value: 3, text: "3 — PSNR (Ratio señal-ruido)" },
    { value: 4, text: "4 — Personalizado / Manual" },
  ];
  const quantOpts = [
    { value: 0, text: "0 — JPEG Annex K (estándar)" },
    { value: 1, text: "1 — Flat (uniforme)" },
    { value: 2, text: "2 — MS-SSIM (ringing reducido)" },
    { value: 3, text: "3 — ImageMagick (alta frecuencia)", selected: true },
    { value: 4, text: "4 — PSNR-HVS-M Kodak" },
    { value: 5, text: "5 — HVS (visión humana)" },
    { value: 6, text: "6 — HVS + PSNR" },
    { value: 7, text: "7 — Klein et al." },
    { value: 8, text: "8 — Watson et al." },
  ];
  const dcScanOpts = [
    { value: 0, text: "0 — DC+AC juntos (compatible)" },
    { value: 1, text: "1 — DC separado (default mozjpeg)", selected: true },
    { value: 2, text: "2 — DC luma/croma separados" },
  ];

  // Clase compartida por los tres sliders de escala RD
  const LAMBDA_CLASS = "moz-lambda-manual moz-lambda-disabled";

  const colorDct = accordion(
    "Color y DCT",
    selectGroup({
      id: "moz-dct-method",
      label: "Método DCT",
      help: "Algoritmo matemático para calcular la Transformada Discreta del Coseno. ISLOW proporciona la mayor precisión y menor ruido en gradientes.",
      options: dctOpts,
    }),
    checkboxGroup({
      id: "moz-fancy-downsampling",
      label: "Fancy downsampling",
      checked: true,
      help: "Aplica un filtro de interpolación suave de alta calidad en el submuestreo de color (4:2:0 / 4:2:2), mitigando artefactos dentados y color bleeding.",
    }),
    checkboxGroup({
      id: "moz-grayscale",
      label: "Modo escala de grises (monocromo)",
      help: "Elimina los canales de crominancia y genera un JPEG de 1 canal. Reduce el peso entre un 30% y un 50% para fotos en blanco y negro o documentos.",
    }),
  );

  const trellis = accordion(
    "Trellis quantization",
    checkboxGroup({
      id: "moz-trellis",
      label: "Trellis AC",
      checked: true,
      help: "Optimización rate-distortion de coeficientes AC. Mayor reducción de tamaño a misma calidad percibida. Aumenta el tiempo de compresión ~20%.",
    }),
    checkboxGroup({
      id: "moz-trellis-dc",
      label: "Trellis DC",
      checked: true,
      help: "Aplica trellis también a los coeficientes DC (componente de brillo promedio de cada bloque 8x8). Ligera mejora de compresión adicional.",
    }),
    checkboxGroup({
      id: "moz-trellis-eob-opt",
      label: "Optimizar posición EOB",
      checked: true,
      help: "Optimiza la posición del marcador End-Of-Block durante trellis. Mejora la compresión del stream de coeficientes.",
    }),
    checkboxGroup({
      id: "moz-use-scans-in-trellis",
      label: "Usar múltiples scans en trellis",
      help: "Optimiza la cuantización basándose en cómo se dividen los datos en las pasadas progresivas. Reduce el tamaño del archivo aún más, pero es extremadamente lento.",
    }),
    checkboxGroup({
      id: "moz-trellis-q-opt",
      label: "Reajustar tabla de cuantización post-trellis",
      help: "Deriva una tabla de cuantización revisada tras el trellis para minimizar el error de reconstrucción. Mejora leve, mayor coste de CPU.",
    }),
    sliderGroup({
      id: "moz-trellis-freq-split",
      label: "Punto de corte frecuencial",
      help: "Divide los coeficientes AC en dos grupos por frecuencia para el trellis. Valores más altos = más coeficientes en el grupo de alta frecuencia.",
      min: 0,
      max: 63,
      value: 8,
    }),
    sliderGroup({
      id: "moz-trellis-num-loops",
      label: "Iteraciones trellis",
      help: "Número de pasadas del algoritmo trellis. Más iteraciones = potencialmente mejor compresión, mucho más lento.",
      min: 1,
      max: 10,
      value: 1,
    }),
  );

  const scanOpt = accordion(
    "Optimización de scans",
    checkboxGroup({
      id: "moz-optimize-scans",
      label: "Optimizar parámetros de scan",
      checked: true,
      help: "Busca la partición óptima del espectro DCT en scans separados. Hace archivos progresivos más pequeños. Requiere modo progresivo.",
    }),
    selectGroup({
      id: "moz-dc-scan-opt-mode",
      label: "Modo optimización DC",
      help: "Define cómo se codifican los datos base de la imagen. El modo 1 es el más eficiente; el 0 maximiza la compatibilidad.",
      options: dcScanOpts,
    }),
  );

  const perceptual = accordion(
    "Calidad perceptual",
    selectGroup({
      id: "moz-tune-preset",
      label: "Perfil perceptual (Tune)",
      help: "Perfiles optimizados de fábrica para diferentes métricas de calidad. Al seleccionar un perfil se ajustan automáticamente la tabla de cuantización base y los pesos lambda de Trellis.",
      options: tuneOpts,
    }),
    selectGroup({
      id: "moz-base-quant-tbl",
      label: "Tabla de cuantización base",
      help: "Las tablas de cuantización determinan cuánto detalle se descarta en cada frecuencia espacial al comprimir. Las opciones estándar priorizan compatibilidad; las optimizadas (HVS, PSNR) preservan mejor la calidad visual percibida.",
      options: quantOpts,
    }),
    checkboxGroup({
      id: "moz-overshoot-deringing",
      label: "Overshoot deringing",
      checked: true,
      help: "Preprocesa píxeles con valores extremos (p.ej. 0 y 255) para reducir el efecto ringing. Especialmente útil en texto negro sobre fondo blanco. No afecta al tamaño.",
    }),
  );

  const rdAdvanced = accordion(
    "Avanzado — escalas RD y formato",
    el(
      "p",
      { class: "rd-hint" },
      "Control fino del balance rate-distortion interno de Trellis y parámetros de compatibilidad binaria.",
    ),
    checkboxGroup({
      id: "moz-lambda-auto",
      label: "Usar valores por defecto (auto)",
      checked: true,
      help: "Si está marcado, las tres escalas de abajo se calculan automáticamente según el perfil perceptual elegido o valores internos de MozJPEG.",
    }),
    sliderGroup({
      id: "moz-lambda1",
      label: "lambda_log_scale1",
      help: "Escala logarítmica que pondera la fidelidad (distorsión). Default interno ≈ 14.75 en tune PSNR-HVS.",
      min: 0,
      max: 3000,
      value: 1475,
      step: 25,
      divisor: 100,
      extraClass: LAMBDA_CLASS,
    }),
    sliderGroup({
      id: "moz-lambda2",
      label: "lambda_log_scale2",
      help: "Escala logarítmica que pondera el tamaño (rate). Default interno ≈ 16.5.",
      min: 0,
      max: 3000,
      value: 1650,
      step: 25,
      divisor: 100,
      extraClass: LAMBDA_CLASS,
    }),
    sliderGroup({
      id: "moz-delta-dc",
      label: "trellis_delta_dc_weight",
      help: "Peso del gradiente DC en la función de coste trellis. Default interno ≈ 1.0.",
      min: 0,
      max: 500,
      value: 100,
      step: 5,
      divisor: 100,
      extraClass: LAMBDA_CLASS,
    }),
    checkboxGroup({
      id: "moz-quant-baseline",
      label: "Forzar compatibilidad baseline de 8 bits",
      checked: true,
      help: "Limita las matrices de cuantización a valores de 8 bits (1–255). Desactivarlo permite cuantizadores de 16 bits para mayor rango dinámico en calidades extremas.",
    }),
    sliderGroup({
      id: "moz-restart-in-rows",
      label: "Intervalo de reinicio (filas MCU)",
      help: "Inserta marcadores RST cada N filas de bloques MCU. Facilita la descompresión paralela multinúcleo y resistencia a errores de transmisión. 0 = desactivado.",
      min: 0,
      max: 64,
      value: 0,
    }),
    checkboxGroup({
      id: "moz-write-jfif",
      label: "Incluir cabecera JFIF",
      checked: true,
      help: "La cabecera JFIF ocupa 18 bytes. Desactivarla ahorra ese espacio pero incumple el estándar (compatible con todos los navegadores web modernos).",
    }),
    checkboxGroup({
      id: "moz-write-adobe",
      label: "Incluir marcador Adobe APP14",
      checked: false,
      help: "Inserta el bloque de metadatos Adobe APP14 en la cabecera. Mantenerlo desactivado ahorra bytes redundantes en la web.",
    }),
  );

  return makeModal(
    "modal-mozjpeg",
    "Configuración MozJPEG",
    [
      sliderGroup({
        id: "moz-quality",
        label: "Calidad (Luma)",
        help: "Relación calidad/tamaño principal para el canal de brillo (Y). 60-85 es el rango recomendado.",
        min: 0,
        max: 100,
        value: 85,
      }),
      checkboxGroup({
        id: "moz-separate-chroma-quality",
        label: "Calidad de color independiente (Croma)",
        help: "Permite asignar un nivel de calidad de compresión diferente a los canales de color (Cb/Cr). Como el ojo humano es menos sensible al color, bajar este valor reduce tamaño sin pérdida apreciable de nitidez.",
        checked: false,
      }),
      sliderGroup({
        id: "moz-chroma-quality",
        label: "Calidad de Croma (Color)",
        help: "Nivel de calidad exclusivo para la información de color. Recomendado entre 65 y 75 cuando está activo.",
        min: 0,
        max: 100,
        value: 75,
        extraClass: "moz-hidden",
      }),
      selectGroup({
        id: "moz-chroma-subsample",
        label: "Chroma subsampling",
        help: "4:4:4 = máxima calidad de color, sin pérdida de croma. 4:2:2 = compresión horizontal. 4:2:0 = mejor compresión.",
        options: chromaOpts,
      }),
      checkboxGroup({
        id: "moz-progressive",
        label: "Progresivo",
        checked: true,
        help: "Codifica la imagen en múltiples pasadas. Archivos ligeramente más pequeños, mejor experiencia de carga en web. Necesario para optimize_scans.",
      }),
      checkboxGroup({
        id: "moz-optimize-coding",
        label: "Optimizar codificación Huffman",
        checked: true,
        help: "Genera tablas Huffman óptimas para cada imagen (2 pasadas). Reduce tamaño a costa de más tiempo.",
      }),
      sliderGroup({
        id: "moz-smoothing",
        label: "Suavizado",
        help: "Filtra el input para eliminar ruido de alta frecuencia. 0 = ninguno, 100 = máximo. Útil para reducir artefactos en imágenes ruidosas.",
        min: 0,
        max: 100,
        value: 0,
      }),
      colorDct,
      perceptual,
      scanOpt,
      trellis,
      rdAdvanced,
    ],
    { cancelId: "moz-cancel", applyId: "moz-apply" },
  );
}

// ── Modal Jpegli ──
function buildJpegliModal() {
  const subsamplingOpts = [
    { value: 0, text: "4:4:4 (mejor calidad)" },
    { value: 1, text: "4:2:2" },
    { value: 2, text: "4:2:0 (mejor compresión)", selected: true },
  ];
  const progressiveOpts = [
    { value: 0, text: "0 — Secuencial" },
    { value: 1, text: "1 — Básico" },
    { value: 2, text: "2 — Fino (default Jpegli)", selected: true },
  ];
  const dctOpts = [
    { value: 0, text: "ISLOW (preciso, recomendado)", selected: true },
    { value: 1, text: "IFAST (rápido, menos preciso)" },
    { value: 2, text: "FLOAT" },
  ];
  const cicpOpts = [
    { value: 2, text: "Desconocida / SDR (default)", selected: true },
    { value: 1, text: "BT.709 (video SDR)" },
    { value: 16, text: "PQ — HDR10" },
    { value: 18, text: "HLG — HDR broadcast" },
  ];

  const optimizationAccordion = accordion(
    "Optimización",
    checkboxGroup({
      id: "jpegli-adaptive-quant",
      label: "Cuantización adaptativa",
      checked: true,
      help: "Exclusivo de Jpegli (heredado de JPEG XL). Analiza la imagen bloque a bloque y ajusta la cuantización según el contenido local. Mejora la calidad percibida sin aumentar el tamaño. Recomendado activado.",
    }),
    checkboxGroup({
      id: "jpegli-optimize-coding",
      label: "Optimizar codificación Huffman",
      checked: true,
      help: "Genera tablas Huffman óptimas para cada imagen en lugar de usar las estándar. Reduce el tamaño a costa de una segunda pasada de codificación.",
    }),
    checkboxGroup({
      id: "jpegli-use-std-tables",
      label: "Tablas de cuantización estándar",
      help: "Usa las tablas del Anexo K del estándar JPEG en lugar de las tablas optimizadas de Jpegli. Actívalo si necesitas máxima compatibilidad con software antiguo. Normalmente peor calidad al mismo tamaño.",
    }),
  );

  const colorAccordion = accordion(
    "Color avanzado",
    checkboxGroup({
      id: "jpegli-xyb-mode",
      label: "Modo XYB",
      help: "(No recomendable activar, puede afectar los colores y detalles de la imagen) Usa el espacio de color XYB de JPEG XL en lugar de YCbCr estándar. Aplica tablas de cuantización especializadas para los canales X/Y/B que explotan mejor la sensibilidad visual humana. Solo disponible para imágenes RGB.",
    }),
    selectGroup({
      id: "jpegli-cicp-transfer",
      label: "Función de transferencia (CICP)",
      help: "Indica la función de transferencia del contenido. Para fotos SDR normales usar 'Desconocida'. Útil si procesas imágenes HDR: PQ = HDR10 (Dolby Vision), HLG = HDR broadcast. Afecta las tablas de cuantización por defecto.",
      options: cicpOpts,
    }),
  );

  const advancedAccordion = accordion(
    "Avanzado",
    sliderGroup({
      id: "jpegli-smoothing-factor",
      label: "Suavizado",
      help: "Aplica un filtro al input antes de comprimir (0 = ninguno, 100 = máximo). Reduce artefactos en imágenes ruidosas a costa de borrar detalle fino.",
      min: 0,
      max: 100,
      value: 0,
    }),
    selectGroup({
      id: "jpegli-dct-method",
      label: "Método DCT",
      help: "Algoritmo de la transformada coseno discreta. ISLOW = más lento y más preciso (recomendado). IFAST = más rápido, pequeña pérdida de precisión. FLOAT = usa punto flotante, resultados intermedios pero depende de la FPU.",
      options: dctOpts,
    }),
    checkboxGroup({
      id: "jpegli-baseline",
      label: "Forzar coeficientes baseline",
      help: "Limita los coeficientes de cuantización a 8 bits (≤255) según la especificación baseline. Necesario para máxima compatibilidad con software muy antiguo. Puede reducir ligeramente la calidad a calidades bajas.",
    }),
    checkboxGroup({
      id: "jpegli-write-jfif",
      label: "Incluir cabecera JFIF",
      checked: true,
      help: "La cabecera JFIF ocupa 18 bytes. Jpegli a veces la omite por defecto. Activarlo asegura compatibilidad total con software antiguo.",
    }),
  );

  // quality-row empieza oculto porque use_distance es true por defecto
  const qualityRow = sliderGroup({
    id: "jpegli-quality",
    label: "Calidad",
    help: "Escala las matrices de cuantización de forma no lineal para maximizar la calidad visual. El rango útil es 60-95.",
    min: 0,
    max: 100,
    value: 85,
  });
  qualityRow.id = "jpegli-quality-row";
  qualityRow.classList.add("jpegli-hidden");

  const distanceRow = sliderGroup({
    id: "jpegli-distance",
    label: "Distance",
    help: "Distancia perceptual butteraugli (heredada de JPEG XL). Menor = mayor calidad. 0.5 = casi sin pérdidas, 1.0 ≈ calidad 90, 2.0 ≈ calidad 80, 3.0 = compresión agresiva.",
    min: 0.1,
    max: 5.0,
    value: 1.5,
    extraAttrs: { step: "0.1" },
  });
  distanceRow.id = "jpegli-distance-row";
  // El valor inicial debe mostrarse con 1 decimal (sliderGroup usa toFixed(2) solo con divisor)
  distanceRow.querySelector("#jpegli-distance-value").textContent = "1.5";

  return makeModal(
    "modal-jpegli",
    "Configuración Jpegli",
    [
      qualityRow,
      distanceRow,
      checkboxGroup({
        id: "jpegli-use-distance",
        label: "Usar métrica Distance (recomendado)",
        checked: true,
        help: "Distance es la métrica nativa de Jpegli (de JPEG XL) y produce mejores resultados. Desmárcalo si prefieres el parámetro “quality” tradicional de libjpeg.",
      }),
      selectGroup({
        id: "jpegli-subsampling",
        label: "Chroma subsampling",
        help: "Reduce la resolución del canal de color. 4:4:4 = sin pérdida de croma (recomendado con XYB). 4:2:0 = mayor compresión (puede verse borroso en bordes coloreados).",
        options: subsamplingOpts,
      }),
      selectGroup({
        id: "jpegli-progressive-level",
        label: "Progresivo",
        help: "0 = secuencial (más compatible). 1 = progresivo básico. 2 = progresivo fino con más pasadas (default de Jpegli, generalmente produce archivos más pequeños).",
        options: progressiveOpts,
      }),
      optimizationAccordion,
      colorAccordion,
      advancedAccordion,
    ],
    { cancelId: "jpegli-cancel", applyId: "jpegli-apply" },
  );
}

// ── Inyectar modales en el DOM ──
document.body.append(buildMozjpegModal(), buildJpegliModal());

// ── Referencias a elementos del DOM ──
// MozJPEG
const modalMoz = g("modal-mozjpeg");
const mozQuality = g("moz-quality");
const mozQualityVal = g("moz-quality-value");
const mozSeparateChroma = g("moz-separate-chroma-quality");
const mozChromaQuality = g("moz-chroma-quality");
const mozChromaQualityVal = g("moz-chroma-quality-value");
const mozChromaSubsample = g("moz-chroma-subsample");
const mozProgressive = g("moz-progressive");
const mozOptimizeCoding = g("moz-optimize-coding");
const mozSmoothing = g("moz-smoothing");
const mozSmoothingVal = g("moz-smoothing-value");
const mozDctMethod = g("moz-dct-method");
const mozFancyDownsampling = g("moz-fancy-downsampling");
const mozGrayscale = g("moz-grayscale");
const mozTunePreset = g("moz-tune-preset");
const mozBaseQuantTbl = g("moz-base-quant-tbl");
const mozOvershootDeringing = g("moz-overshoot-deringing");
const mozOptimizeScans = g("moz-optimize-scans");
const mozDcScanOptMode = g("moz-dc-scan-opt-mode");
const mozTrellis = g("moz-trellis");
const mozTrellisDc = g("moz-trellis-dc");
const mozTrellisEobOpt = g("moz-trellis-eob-opt");
const mozUseScansInTrellis = g("moz-use-scans-in-trellis");
const mozTrellisQOpt = g("moz-trellis-q-opt");
const mozTrellisFreqSplit = g("moz-trellis-freq-split");
const mozTrellisFreqSplitVal = g("moz-trellis-freq-split-value");
const mozTrellisNumLoops = g("moz-trellis-num-loops");
const mozTrellisNumLoopsVal = g("moz-trellis-num-loops-value");
const mozLambdaAuto = g("moz-lambda-auto");
const mozLambda1 = g("moz-lambda1");
const mozLambda1Val = g("moz-lambda1-value");
const mozLambda2 = g("moz-lambda2");
const mozLambda2Val = g("moz-lambda2-value");
const mozDeltaDc = g("moz-delta-dc");
const mozDeltaDcVal = g("moz-delta-dc-value");
const mozQuantBaseline = g("moz-quant-baseline");
const mozRestartInRows = g("moz-restart-in-rows");
const mozRestartInRowsVal = g("moz-restart-in-rows-value");
const mozWriteJfif = g("moz-write-jfif");
const mozWriteAdobe = g("moz-write-adobe");
const mozApply = g("moz-apply");
const mozCancel = g("moz-cancel");

// Jpegli
const modalJpegli = g("modal-jpegli");
const jpegliQuality = g("jpegli-quality");
const jpegliQualityVal = g("jpegli-quality-value");
const jpegliUseDistance = g("jpegli-use-distance");
const jpegliDistance = g("jpegli-distance");
const jpegliDistanceVal = g("jpegli-distance-value");
const jpegliSubsampling = g("jpegli-subsampling");
const jpegliXybMode = g("jpegli-xyb-mode");
const jpegliCicpTransfer = g("jpegli-cicp-transfer");
const jpegliOptimizeCoding = g("jpegli-optimize-coding");
const jpegliProgressiveLevel = g("jpegli-progressive-level");
const jpegliSmoothingFactor = g("jpegli-smoothing-factor");
const jpegliSmoothingVal = g("jpegli-smoothing-factor-value");
const jpegliDctMethod = g("jpegli-dct-method");
const jpegliUseStdTables = g("jpegli-use-std-tables");
const jpegliBaseline = g("jpegli-baseline");
const jpegliAdaptiveQuant = g("jpegli-adaptive-quant");
const jpegliWriteJfif = g("jpegli-write-jfif");
const jpegliApply = g("jpegli-apply");
const jpegliCancel = g("jpegli-cancel");

// ── Lógica de acordeón ──
document.querySelectorAll(".accordion-header").forEach((header) => {
  header.addEventListener("click", function () {
    const expanded = this.getAttribute("aria-expanded") === "true";
    this.setAttribute("aria-expanded", String(!expanded));
    const body = this.nextElementSibling;
    body.style.maxHeight = expanded ? "0" : body.scrollHeight + "px";
  });
});

// ── Helpers de actualización de UI MozJPEG ──
function updateMozjpegChromaMode() {
  const isSep = mozSeparateChroma?.checked;
  const row = mozChromaQuality?.closest(".form-group");
  if (row) row.classList.toggle("moz-hidden", !isSep);
}

function applyMozjpegTunePreset(presetVal) {
  const preset = parseInt(presetVal, 10);
  if (preset === 0) { // PSNR-HVS-M (MozJPEG default)
    if (mozBaseQuantTbl) mozBaseQuantTbl.value = "3";
    if (mozLambda1) { mozLambda1.value = "1475"; mozLambda1Val.textContent = "14.75"; }
    if (mozLambda2) { mozLambda2.value = "1650"; mozLambda2Val.textContent = "16.50"; }
    if (mozDeltaDc) { mozDeltaDc.value = "100"; mozDeltaDcVal.textContent = "1.00"; }
  } else if (preset === 1) { // MS-SSIM
    if (mozBaseQuantTbl) mozBaseQuantTbl.value = "3";
    if (mozLambda1) { mozLambda1.value = "1200"; mozLambda1Val.textContent = "12.00"; }
    if (mozLambda2) { mozLambda2.value = "1300"; mozLambda2Val.textContent = "13.00"; }
    if (mozDeltaDc) { mozDeltaDc.value = "100"; mozDeltaDcVal.textContent = "1.00"; }
  } else if (preset === 2) { // SSIM
    if (mozBaseQuantTbl) mozBaseQuantTbl.value = "1";
    if (mozLambda1) { mozLambda1.value = "1150"; mozLambda1Val.textContent = "11.50"; }
    if (mozLambda2) { mozLambda2.value = "1275"; mozLambda2Val.textContent = "12.75"; }
    if (mozDeltaDc) { mozDeltaDc.value = "100"; mozDeltaDcVal.textContent = "1.00"; }
  } else if (preset === 3) { // PSNR
    if (mozBaseQuantTbl) mozBaseQuantTbl.value = "1";
    if (mozLambda1) { mozLambda1.value = "900"; mozLambda1Val.textContent = "9.00"; }
    if (mozLambda2) { mozLambda2.value = "0"; mozLambda2Val.textContent = "0.00"; }
    if (mozDeltaDc) { mozDeltaDc.value = "100"; mozDeltaDcVal.textContent = "1.00"; }
  }
}

// ── Listeners internos de la modal MozJPEG ──
function initMozjpegModalListeners() {
  // Sliders enteros: sincroniza etiqueta con el valor del slider
  for (const [sliderId, labelId] of Object.entries({
    "moz-quality": "moz-quality-value",
    "moz-chroma-quality": "moz-chroma-quality-value",
    "moz-smoothing": "moz-smoothing-value",
    "moz-trellis-freq-split": "moz-trellis-freq-split-value",
    "moz-trellis-num-loops": "moz-trellis-num-loops-value",
    "moz-restart-in-rows": "moz-restart-in-rows-value",
  })) {
    const slider = g(sliderId),
      label = g(labelId);
    if (slider && label)
      slider.addEventListener("input", () => {
        label.textContent = slider.value;
      });
  }

  // Sliders flotantes: el valor se almacena ×100 como entero, se muestra dividido
  for (const [sliderId, { labelId, divisor }] of Object.entries({
    "moz-lambda1": { labelId: "moz-lambda1-value", divisor: 100 },
    "moz-lambda2": { labelId: "moz-lambda2-value", divisor: 100 },
    "moz-delta-dc": { labelId: "moz-delta-dc-value", divisor: 100 },
  })) {
    const slider = g(sliderId),
      label = g(labelId);
    if (slider && label)
      slider.addEventListener("input", () => {
        label.textContent = (slider.value / divisor).toFixed(2);
        if (mozTunePreset) mozTunePreset.value = "4"; // Cambia a Manual al editar
      });
  }

  mozBaseQuantTbl?.addEventListener("change", () => {
    if (mozTunePreset) mozTunePreset.value = "4"; // Cambia a Manual al editar tabla
  });

  mozSeparateChroma?.addEventListener("change", updateMozjpegChromaMode);
  mozTunePreset?.addEventListener("change", (e) => {
    applyMozjpegTunePreset(e.target.value);
  });

  // Cuando "auto" está activo, los sliders lambda se muestran deshabilitados visualmente
  mozLambdaAuto?.addEventListener("change", (e) => {
    document.querySelectorAll(".moz-lambda-manual").forEach((el) => {
      el.classList.toggle("moz-lambda-disabled", e.target.checked);
    });
  });
}

// ── Listeners internos de la modal Jpegli ──
function initJpegliModalListeners() {
  jpegliQuality.addEventListener("input", () => {
    jpegliQualityVal.textContent = jpegliQuality.value;
  });
  jpegliSmoothingFactor.addEventListener("input", () => {
    jpegliSmoothingVal.textContent = jpegliSmoothingFactor.value;
  });
  jpegliDistance.addEventListener("input", () => {
    jpegliDistanceVal.textContent = parseFloat(jpegliDistance.value).toFixed(1);
  });
  jpegliUseDistance.addEventListener("change", updateJpegliQualityMode);
}

// ── Lógica de configuración MozJPEG ──
function applyMozjpegConfig() {
  if (typeof mozjpegConfig === "undefined") return;

  mozjpegConfig.quality = parseInt(mozQuality.value, 10);
  mozjpegConfig.separate_chroma_quality = mozSeparateChroma.checked;
  mozjpegConfig.chroma_quality = parseInt(mozChromaQuality.value, 10);
  mozjpegConfig.chroma_subsample = parseInt(mozChromaSubsample.value, 10);
  mozjpegConfig.progressive = mozProgressive.checked;
  mozjpegConfig.optimize_coding = mozOptimizeCoding.checked;
  mozjpegConfig.smoothing = parseInt(mozSmoothing.value, 10);
  mozjpegConfig.dct_method = parseInt(mozDctMethod.value, 10);
  mozjpegConfig.do_fancy_downsampling = mozFancyDownsampling.checked;
  mozjpegConfig.grayscale = mozGrayscale.checked;
  mozjpegConfig.tune_preset = parseInt(mozTunePreset.value, 10);
  mozjpegConfig.base_quant_tbl = parseInt(mozBaseQuantTbl.value, 10);
  mozjpegConfig.overshoot_deringing = mozOvershootDeringing.checked;
  mozjpegConfig.optimize_scans = mozOptimizeScans.checked;
  mozjpegConfig.dc_scan_opt_mode = parseInt(mozDcScanOptMode.value, 10);
  mozjpegConfig.trellis = mozTrellis.checked;
  mozjpegConfig.trellis_dc = mozTrellisDc.checked;
  mozjpegConfig.trellis_eob_opt = mozTrellisEobOpt.checked;
  mozjpegConfig.use_scans_in_trellis = mozUseScansInTrellis.checked;
  mozjpegConfig.trellis_q_opt = mozTrellisQOpt.checked;
  mozjpegConfig.trellis_freq_split = parseInt(mozTrellisFreqSplit.value, 10);
  mozjpegConfig.trellis_num_loops = parseInt(mozTrellisNumLoops.value, 10);
  mozjpegConfig.quant_baseline = mozQuantBaseline.checked;
  mozjpegConfig.restart_in_rows = parseInt(mozRestartInRows.value, 10);
  mozjpegConfig.write_jfif = mozWriteJfif.checked;
  mozjpegConfig.write_adobe_marker = mozWriteAdobe.checked;

  if (mozLambdaAuto?.checked) {
    mozjpegConfig.lambda_log_scale1 = null;
    mozjpegConfig.lambda_log_scale2 = null;
    mozjpegConfig.trellis_delta_dc_weight = null;
  } else {
    mozjpegConfig.lambda_log_scale1 = parseFloat(mozLambda1.value) / 100;
    mozjpegConfig.lambda_log_scale2 = parseFloat(mozLambda2.value) / 100;
    mozjpegConfig.trellis_delta_dc_weight = parseFloat(mozDeltaDc.value) / 100;
  }
}

// ── Lógica de configuración Jpegli ──
function updateJpegliQualityMode() {
  const useDistMode = jpegliUseDistance.checked;
  g("jpegli-quality-row").classList.toggle("jpegli-hidden", useDistMode);
  g("jpegli-distance-row").classList.toggle("jpegli-hidden", !useDistMode);
}

// ── Apertura y cierre de modales ──
g("config-mozjpeg-btn").addEventListener("click", () => {
  if (typeof mozjpegConfig === "undefined") return;
  mozQuality.value = mozjpegConfig.quality;
  mozQualityVal.textContent = mozjpegConfig.quality;
  mozSeparateChroma.checked = mozjpegConfig.separate_chroma_quality;
  mozChromaQuality.value = mozjpegConfig.chroma_quality;
  mozChromaQualityVal.textContent = mozjpegConfig.chroma_quality;
  mozChromaSubsample.value = mozjpegConfig.chroma_subsample;
  mozProgressive.checked = mozjpegConfig.progressive;
  mozOptimizeCoding.checked = mozjpegConfig.optimize_coding;
  mozSmoothing.value = mozjpegConfig.smoothing;
  mozSmoothingVal.textContent = mozjpegConfig.smoothing;
  mozDctMethod.value = mozjpegConfig.dct_method;
  mozFancyDownsampling.checked = mozjpegConfig.do_fancy_downsampling;
  mozGrayscale.checked = mozjpegConfig.grayscale;
  mozTunePreset.value = mozjpegConfig.tune_preset;
  mozBaseQuantTbl.value = mozjpegConfig.base_quant_tbl;
  mozOvershootDeringing.checked = mozjpegConfig.overshoot_deringing;
  mozOptimizeScans.checked = mozjpegConfig.optimize_scans;
  mozDcScanOptMode.value = mozjpegConfig.dc_scan_opt_mode;
  mozTrellis.checked = mozjpegConfig.trellis;
  mozTrellisDc.checked = mozjpegConfig.trellis_dc;
  mozTrellisEobOpt.checked = mozjpegConfig.trellis_eob_opt;
  mozUseScansInTrellis.checked = mozjpegConfig.use_scans_in_trellis;
  mozTrellisQOpt.checked = mozjpegConfig.trellis_q_opt;
  mozTrellisFreqSplit.value = mozjpegConfig.trellis_freq_split;
  mozTrellisFreqSplitVal.textContent = mozjpegConfig.trellis_freq_split;
  mozTrellisNumLoops.value = mozjpegConfig.trellis_num_loops;
  mozTrellisNumLoopsVal.textContent = mozjpegConfig.trellis_num_loops;
  mozQuantBaseline.checked = mozjpegConfig.quant_baseline;
  mozRestartInRows.value = mozjpegConfig.restart_in_rows;
  mozRestartInRowsVal.textContent = mozjpegConfig.restart_in_rows;
  mozWriteJfif.checked = mozjpegConfig.write_jfif;
  mozWriteAdobe.checked = mozjpegConfig.write_adobe_marker;

  const isLambdaAuto =
    mozjpegConfig.lambda_log_scale1 == null &&
    mozjpegConfig.lambda_log_scale2 == null &&
    mozjpegConfig.trellis_delta_dc_weight == null;
  if (mozLambdaAuto) mozLambdaAuto.checked = isLambdaAuto;
  if (mozjpegConfig.lambda_log_scale1 != null) {
    mozLambda1.value = Math.round(mozjpegConfig.lambda_log_scale1 * 100);
    mozLambda1Val.textContent = mozjpegConfig.lambda_log_scale1.toFixed(2);
  }
  if (mozjpegConfig.lambda_log_scale2 != null) {
    mozLambda2.value = Math.round(mozjpegConfig.lambda_log_scale2 * 100);
    mozLambda2Val.textContent = mozjpegConfig.lambda_log_scale2.toFixed(2);
  }
  if (mozjpegConfig.trellis_delta_dc_weight != null) {
    mozDeltaDc.value = Math.round(mozjpegConfig.trellis_delta_dc_weight * 100);
    mozDeltaDcVal.textContent = mozjpegConfig.trellis_delta_dc_weight.toFixed(2);
  }
  document.querySelectorAll(".moz-lambda-manual").forEach((el) => {
    el.classList.toggle("moz-lambda-disabled", isLambdaAuto);
  });

  updateMozjpegChromaMode();
  modalMoz.classList.add("show");
});

mozApply.addEventListener("click", () => {
  applyMozjpegConfig();
  modalMoz.classList.remove("show");
});
mozCancel.addEventListener("click", () => modalMoz.classList.remove("show"));
modalMoz.addEventListener("click", (e) => {
  if (e.target === modalMoz) modalMoz.classList.remove("show");
});

g("config-jpegli-btn").addEventListener("click", () => {
  if (typeof jpegliConfig === "undefined") return;
  jpegliQuality.value = jpegliConfig.quality;
  jpegliQualityVal.textContent = jpegliConfig.quality;
  jpegliUseDistance.checked = jpegliConfig.use_distance;
  jpegliDistance.value = jpegliConfig.distance;
  jpegliDistanceVal.textContent = jpegliConfig.distance.toFixed(1);
  jpegliSubsampling.value = jpegliConfig.subsampling;
  jpegliXybMode.checked = jpegliConfig.xyb_mode;
  jpegliCicpTransfer.value = jpegliConfig.cicp_transfer_function;
  jpegliProgressiveLevel.value = jpegliConfig.progressive_level;
  jpegliOptimizeCoding.checked = jpegliConfig.optimize_coding;
  jpegliAdaptiveQuant.checked = jpegliConfig.adaptive_quantization;
  jpegliUseStdTables.checked = jpegliConfig.use_standard_tables;
  jpegliSmoothingFactor.value = jpegliConfig.smoothing_factor;
  jpegliSmoothingVal.textContent = jpegliConfig.smoothing_factor;
  jpegliDctMethod.value = jpegliConfig.dct_method;
  jpegliBaseline.checked = jpegliConfig.baseline;
  jpegliWriteJfif.checked = jpegliConfig.write_jfif ?? true;
  updateJpegliQualityMode();
  modalJpegli.classList.add("show");
});

jpegliApply.addEventListener("click", () => {
  if (typeof jpegliConfig === "undefined") return;
  jpegliConfig.quality = parseInt(jpegliQuality.value, 10);
  jpegliConfig.use_distance = jpegliUseDistance.checked;
  jpegliConfig.distance = parseFloat(jpegliDistance.value);
  jpegliConfig.subsampling = parseInt(jpegliSubsampling.value, 10);
  jpegliConfig.xyb_mode = jpegliXybMode.checked;
  jpegliConfig.cicp_transfer_function = parseInt(jpegliCicpTransfer.value, 10);
  jpegliConfig.progressive_level = parseInt(jpegliProgressiveLevel.value, 10);
  jpegliConfig.optimize_coding = jpegliOptimizeCoding.checked;
  jpegliConfig.adaptive_quantization = jpegliAdaptiveQuant.checked;
  jpegliConfig.use_standard_tables = jpegliUseStdTables.checked;
  jpegliConfig.smoothing_factor = parseInt(jpegliSmoothingFactor.value, 10);
  jpegliConfig.dct_method = parseInt(jpegliDctMethod.value, 10);
  jpegliConfig.baseline = jpegliBaseline.checked;
  jpegliConfig.write_jfif = jpegliWriteJfif.checked;
  modalJpegli.classList.remove("show");
});
jpegliCancel.addEventListener("click", () =>
  modalJpegli.classList.remove("show"),
);
modalJpegli.addEventListener("click", (e) => {
  if (e.target === modalJpegli) modalJpegli.classList.remove("show");
});

// ── Arranque ──
initMozjpegModalListeners();
initJpegliModalListeners();
