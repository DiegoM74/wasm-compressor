// ── DOM helpers ────────────────────────────────────────────────────────────────
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child) node.append(typeof child === "string" ? child : child);
  }
  return node;
}

function helpIcon(title) {
  return el("span", { class: "help-icon", title }, "?");
}

/** Full slider form-group */
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
}) {
  const valueId = `${id}-value`;
  const displayVal = divisor ? (value / divisor).toFixed(2) : String(value);

  const lbl = el("label");
  lbl.append(
    label,
    " ",
    helpIcon(help),
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
  const input = el("input", inputAttrs);

  const group = el("div", { class: "form-group" }, lbl, input);
  return group;
}

/** Checkbox form-group */
function checkboxGroup({ id, label, help, checked = false, extraClass = "" }) {
  const lbl = el("label");
  const cb = el("input", {
    type: "checkbox",
    id,
    ...(checked ? { checked: "" } : {}),
  });
  lbl.append(cb, " ", label, " ", helpIcon(help));
  return el(
    "div",
    { class: `form-group${extraClass ? " " + extraClass : ""}` },
    lbl,
  );
}

/** Select form-group */
function selectGroup({ id, label, help, options }) {
  const lbl = el("label");
  lbl.append(label, " ", helpIcon(help));

  const select = el("select", { id });
  for (const { value, text, selected } of options) {
    const opt = el(
      "option",
      { value: String(value), ...(selected ? { selected: "" } : {}) },
      text,
    );
    select.append(opt);
  }
  return el("div", { class: "form-group" }, lbl, select);
}

/** Accordion section */
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

/** Subtitle paragraph shown at top of each modal */
function modalSubtitle() {
  const p = el("p", { class: "modal-subtitle" });
  p.append(
    "Ajusta los parámetros de compresión. Pasa el cursor sobre ",
    el("span", { class: "help-icon" }, "?"),
    " para más detalles.",
  );
  return p;
}

/** Full modal shell */
function makeModal(id, title, bodyChildren, footerIds) {
  const { cancelId, applyId } = footerIds;
  const modalBody = el("div", { class: "modal-body" }, ...bodyChildren);
  const footer = el(
    "div",
    { class: "modal-footer" },
    el("button", { id: cancelId, class: "modal-btn cancel" }, "Cancelar"),
    el("button", { id: applyId, class: "modal-btn" }, "Aplicar"),
  );
  const content = el(
    "div",
    { class: "modal-content" },
    el("h2", {}, title),
    modalSubtitle(),
    modalBody,
    footer,
  );
  return el("div", { id, class: "modal" }, content);
}

// ── MozJPEG modal ──────────────────────────────────────────────────────────────

function buildMozjpegModal() {
  const chromaOpts = [
    { value: 0, text: "4:4:4 (mejor calidad)" },
    { value: 1, text: "4:2:2" },
    { value: 2, text: "4:2:0 (mejor compresión)", selected: true },
  ];
  const quantOpts = [
    { value: 0, text: "0 — JPEG Annex K (estándar)", selected: true },
    { value: 1, text: "1 — Flat (uniforme)" },
    { value: 2, text: "2 — MS-SSIM (ringing reducido)" },
    { value: 3, text: "3 — ImageMagick (alta frecuencia)" },
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

  const trellis = accordion(
    "Trellis quantization",
    checkboxGroup({
      id: "moz-trellis",
      label: "Trellis AC",
      help: "Optimización rate-distortion de coeficientes AC. Mayor reducción de tamaño a misma calidad percibida. Aumenta el tiempo de compresión ~20%.",
      checked: true,
    }),
    checkboxGroup({
      id: "moz-trellis-dc",
      label: "Trellis DC",
      help: "Aplica trellis también a los coeficientes DC (componente de brillo promedio de cada bloque 8x8). Ligera mejora de compresión adicional.",
      checked: true,
    }),
    checkboxGroup({
      id: "moz-trellis-eob-opt",
      label: "Optimizar posición EOB",
      help: "Optimiza la posición del marcador End-Of-Block durante trellis. Mejora la compresión del stream de coeficientes.",
      checked: true,
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
      help: "Busca la partición óptima del espectro DCT en scans separados. Hace archivos progresivos más pequeños. Requiere modo progresivo.",
      checked: true,
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
    checkboxGroup({
      id: "moz-tune-ssim",
      label: "Optimizar para SSIM",
      help: "Ajusta internamente los pesos de trellis para maximizar el índice SSIM (similitud estructural). Produce resultados visualmente más agradables.",
      checked: true,
    }),
    checkboxGroup({
      id: "moz-overshoot-deringing",
      label: "Overshoot deringing",
      help: "Preprocesa píxeles con valores extremos (p.ej. 0 y 255) para reducir el efecto ringing. Especialmente útil en texto negro sobre fondo blanco. No afecta al tamaño.",
      checked: true,
    }),
  );

  const rdHint = el(
    "p",
    { class: "rd-hint" },
    "Estos parámetros controlan el balance rate-distortion interno del trellis. Déjalos en “auto” salvo que sepas lo que haces.",
  );
  const rdAdvanced = accordion(
    "Avanzado — escalas RD",
    rdHint,
    checkboxGroup({
      id: "moz-lambda-auto",
      label: "Usar valores por defecto (auto)",
      help: "Si está marcado, las tres escalas de abajo se ignoran y MozJPEG usa sus valores internos.",
      checked: true,
    }),
    el(
      "div",
      { class: "form-group moz-lambda-manual moz-lambda-disabled" },
      (() => {
        const lbl = el("label");
        lbl.append(
          "lambda_log_scale1 ",
          helpIcon(
            "Escala logarítmica que pondera la fidelidad (distorsión). Default interno ≈ 14.75 en tune PSNR-HVS.",
          ),
          " ",
          el("span", { id: "moz-lambda1-value" }, "14.75"),
        );
        return lbl;
      })(),
      el("input", {
        type: "range",
        id: "moz-lambda1",
        min: "0",
        max: "3000",
        value: "1475",
        step: "25",
        class: "slider",
      }),
    ),
    el(
      "div",
      { class: "form-group moz-lambda-manual moz-lambda-disabled" },
      (() => {
        const lbl = el("label");
        lbl.append(
          "lambda_log_scale2 ",
          helpIcon(
            "Escala logarítmica que pondera el tamaño (rate). Default interno ≈ 16.5.",
          ),
          " ",
          el("span", { id: "moz-lambda2-value" }, "16.50"),
        );
        return lbl;
      })(),
      el("input", {
        type: "range",
        id: "moz-lambda2",
        min: "0",
        max: "3000",
        value: "1650",
        step: "25",
        class: "slider",
      }),
    ),
    el(
      "div",
      { class: "form-group moz-lambda-manual moz-lambda-disabled" },
      (() => {
        const lbl = el("label");
        lbl.append(
          "trellis_delta_dc_weight ",
          helpIcon(
            "Peso del componente DC en la función de coste trellis. Default interno ≈ 1.0.",
          ),
          " ",
          el("span", { id: "moz-delta-dc-value" }, "1.00"),
        );
        return lbl;
      })(),
      el("input", {
        type: "range",
        id: "moz-delta-dc",
        min: "0",
        max: "500",
        value: "100",
        step: "5",
        class: "slider",
      }),
    ),
  );

  return makeModal(
    "modal-mozjpeg",
    "Configuración MozJPEG",
    [
      sliderGroup({
        id: "moz-quality",
        label: "Calidad",
        help: "Relación calidad/tamaño. 60-85 es el rango recomendado.",
        min: 0,
        max: 100,
        value: 85,
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
        help: "Codifica la imagen en múltiples pasadas. Archivos ligeramente más pequeños, mejor experiencia de carga en web. Necesario para optimize_scans.",
        checked: true,
      }),
      checkboxGroup({
        id: "moz-optimize-coding",
        label: "Optimizar codificación Huffman",
        help: "Genera tablas Huffman óptimas para cada imagen (2 pasadas). Reduce tamaño a costa de más tiempo.",
        checked: true,
      }),
      selectGroup({
        id: "moz-base-quant-tbl",
        label: "Tabla de cuantización base",
        help: "Las tablas de cuantización determinan cuánto detalle se descarta en cada frecuencia espacial al comprimir. Las opciones estándar priorizan compatibilidad; las optimizadas (HVS, PSNR) preservan mejor la calidad visual percibida.",
        options: quantOpts,
      }),
      sliderGroup({
        id: "moz-smoothing",
        label: "Suavizado",
        help: "Filtra el input para eliminar ruido de alta frecuencia. 0 = ninguno, 100 = máximo. Útil para reducir artefactos en imágenes ruidosas.",
        min: 0,
        max: 100,
        value: 0,
      }),
      checkboxGroup({
        id: "moz-write-jfif",
        label: "Incluir cabecera JFIF",
        help: "La cabecera JFIF ocupa 18 bytes. Desactivarla ahorra ese espacio pero incumple el estándar (compatible con todos los navegadores web modernos).",
        checked: true,
      }),
      trellis,
      scanOpt,
      perceptual,
      rdAdvanced,
    ],
    { cancelId: "moz-cancel", applyId: "moz-apply" },
  );
}

// ── Jpegli modal ───────────────────────────────────────────────────────────────

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
      help: "Exclusivo de Jpegli (heredado de JPEG XL). Analiza la imagen bloque a bloque y ajusta la cuantización según el contenido local. Mejora la calidad percibida sin aumentar el tamaño. Recomendado activado.",
      checked: true,
    }),
    checkboxGroup({
      id: "jpegli-optimize-coding",
      label: "Optimizar codificación Huffman",
      help: "Genera tablas Huffman óptimas para cada imagen en lugar de usar las estándar. Reduce el tamaño a costa de una segunda pasada de codificación.",
      checked: true,
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
      help: "Usa el espacio de color XYB de JPEG XL en lugar de YCbCr estándar. Aplica tablas de cuantización especializadas para los canales X/Y/B que explotan mejor la sensibilidad visual humana. Produce archivos JPEG normales compatibles con cualquier visor. Solo disponible para imágenes RGB.",
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
      help: "Aplica un filtro al input antes de comprimir (0 = ninguno, 100 = máximo). Reduce artefactos en imágenes ruidosas a costa de borrar detalle fino. En la mayoría de casos dejarlo en 0.",
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
  );

  // quality-row starts hidden because use_distance defaults to true
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
    help: "Distancia perceptual butteraugli (heredada de JPEG XL). Menor = mayor calidad. 0.5 = casi sin pérdidas, 1.0 ≈ calidad 90, 1.5 ≈ calidad 85, 2.0 ≈ calidad 80, 3.0 = compresión agresiva.",
    min: 0.1,
    max: 5.0,
    value: 1.5,
    extraAttrs: { step: "0.1" },
  });
  distanceRow.id = "jpegli-distance-row";
  // override display value
  distanceRow.querySelector(`#jpegli-distance-value`).textContent = "1.5";

  return makeModal(
    "modal-jpegli",
    "Configuración Jpegli",
    [
      qualityRow,
      distanceRow,
      checkboxGroup({
        id: "jpegli-use-distance",
        label: "Usar métrica Distance (recomendado)",
        help: "Distance es la métrica nativa de Jpegli (de JPEG XL) y produce mejores resultados. Desmárcalo si prefieres el parámetro 'quality' tradicional de libjpeg.",
        checked: true,
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

// ── Inject modals ──────────────────────────────────────────────────────────────

document.body.append(buildMozjpegModal(), buildJpegliModal());

// ── Element refs ───────────────────────────────────────────────────────────────

const g = (id) => document.getElementById(id);

// MozJPEG
const modalMoz = g("modal-mozjpeg");
const mozQuality = g("moz-quality");
const mozQualityVal = g("moz-quality-value");
const mozProgressive = g("moz-progressive");
const mozTrellis = g("moz-trellis");
const mozTrellisDc = g("moz-trellis-dc");
const mozTuneSsim = g("moz-tune-ssim");
const mozOptimizeScans = g("moz-optimize-scans");
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
const jpegliApply = g("jpegli-apply");
const jpegliCancel = g("jpegli-cancel");

// ── Accordion logic ────────────────────────────────────────────────────────────

document.querySelectorAll(".accordion-header").forEach((header) => {
  header.addEventListener("click", function () {
    const expanded = this.getAttribute("aria-expanded") === "true";
    this.setAttribute("aria-expanded", String(!expanded));
    const body = this.nextElementSibling;
    body.style.maxHeight = expanded ? "0" : body.scrollHeight + "px";
  });
});

// ── MozJPEG logic ──────────────────────────────────────────────────────────────

function initMozjpegModalListeners() {
  // Integer sliders
  for (const [sliderId, labelId] of Object.entries({
    "moz-quality": "moz-quality-value",
    "moz-smoothing": "moz-smoothing-value",
    "moz-trellis-freq-split": "moz-trellis-freq-split-value",
    "moz-trellis-num-loops": "moz-trellis-num-loops-value",
  })) {
    const slider = g(sliderId),
      label = g(labelId);
    if (slider && label)
      slider.addEventListener("input", () => {
        label.textContent = slider.value;
      });
  }

  // Float sliders
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
      });
  }

  // Lambda auto toggle
  g("moz-lambda-auto")?.addEventListener("change", (e) => {
    document.querySelectorAll(".moz-lambda-manual").forEach((el) => {
      el.classList.toggle("moz-lambda-disabled", e.target.checked);
    });
  });
}

function applyMozjpegConfig() {
  if (typeof mozjpegConfig === "undefined") return;
  mozjpegConfig.quality = parseInt(g("moz-quality").value);
  mozjpegConfig.progressive = g("moz-progressive").checked;
  mozjpegConfig.optimize_coding = g("moz-optimize-coding").checked;
  mozjpegConfig.smoothing = parseInt(g("moz-smoothing").value);
  mozjpegConfig.chroma_subsample = parseInt(g("moz-chroma-subsample").value);
  mozjpegConfig.write_jfif = g("moz-write-jfif").checked;
  mozjpegConfig.trellis = g("moz-trellis").checked;
  mozjpegConfig.trellis_dc = g("moz-trellis-dc").checked;
  mozjpegConfig.trellis_eob_opt = g("moz-trellis-eob-opt").checked;
  mozjpegConfig.use_scans_in_trellis = g("moz-use-scans-in-trellis").checked;
  mozjpegConfig.trellis_q_opt = g("moz-trellis-q-opt").checked;
  mozjpegConfig.overshoot_deringing = g("moz-overshoot-deringing").checked;
  mozjpegConfig.optimize_scans = g("moz-optimize-scans").checked;
  mozjpegConfig.tune_ssim = g("moz-tune-ssim").checked;
  mozjpegConfig.base_quant_tbl = parseInt(g("moz-base-quant-tbl").value);
  mozjpegConfig.trellis_freq_split = parseInt(
    g("moz-trellis-freq-split").value,
  );
  mozjpegConfig.trellis_num_loops = parseInt(g("moz-trellis-num-loops").value);
  mozjpegConfig.dc_scan_opt_mode = parseInt(g("moz-dc-scan-opt-mode").value);

  const lambdaAuto = g("moz-lambda-auto")?.checked;
  if (lambdaAuto) {
    mozjpegConfig.lambda_log_scale1 = null;
    mozjpegConfig.lambda_log_scale2 = null;
    mozjpegConfig.trellis_delta_dc_weight = null;
  } else {
    mozjpegConfig.lambda_log_scale1 = parseFloat(g("moz-lambda1").value) / 100;
    mozjpegConfig.lambda_log_scale2 = parseFloat(g("moz-lambda2").value) / 100;
    mozjpegConfig.trellis_delta_dc_weight =
      parseFloat(g("moz-delta-dc").value) / 100;
  }
}

function applyTuneSsimPreset(enabled) {
  if (!enabled || typeof mozjpegConfig === "undefined") return;
  mozjpegConfig.base_quant_tbl = 3;
  mozjpegConfig.lambda_log_scale1 = 14.75;
  mozjpegConfig.lambda_log_scale2 = 16.5;
}

// ── Jpegli logic ───────────────────────────────────────────────────────────────

function updateJpegliQualityMode() {
  const useDistMode = jpegliUseDistance.checked;
  g("jpegli-quality-row").classList.toggle("jpegli-hidden", useDistMode);
  g("jpegli-distance-row").classList.toggle("jpegli-hidden", !useDistMode);
}

// ── Slider bindings ────────────────────────────────────────────────────────────

mozQuality.addEventListener("input", () => {
  mozQualityVal.textContent = mozQuality.value;
});
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

// ── Modal open/close ───────────────────────────────────────────────────────────

g("config-mozjpeg-btn").addEventListener("click", () => {
  if (typeof mozjpegConfig === "undefined") return;
  mozQuality.value = mozjpegConfig.quality;
  mozQualityVal.textContent = mozjpegConfig.quality;
  mozProgressive.checked = mozjpegConfig.progressive;
  mozTrellis.checked = mozjpegConfig.trellis;
  mozTrellisDc.checked = mozjpegConfig.trellis_dc;
  mozTuneSsim.checked = mozjpegConfig.tune_ssim;
  mozOptimizeScans.checked = mozjpegConfig.optimize_scans;
  modalMoz.classList.add("show");
});

mozApply.addEventListener("click", () => {
  applyMozjpegConfig();
  if (mozjpegConfig.tune_ssim) applyTuneSsimPreset(true);
  modalMoz.classList.remove("show");
});
mozCancel.addEventListener("click", () => {
  modalMoz.classList.remove("show");
});
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
  modalJpegli.classList.remove("show");
});
jpegliCancel.addEventListener("click", () => {
  modalJpegli.classList.remove("show");
});
modalJpegli.addEventListener("click", (e) => {
  if (e.target === modalJpegli) modalJpegli.classList.remove("show");
});

// ── Init ───────────────────────────────────────────────────────────────────────

initMozjpegModalListeners();
