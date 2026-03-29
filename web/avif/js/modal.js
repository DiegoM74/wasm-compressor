// ── DOM helpers ──
const g = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function helpIcon(title) {
  return el("span", { class: "help-icon", title }, "?");
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
  cb.checked = checked;
  const lbl = el("label");
  lbl.append(cb, " ", label, " ", helpIcon(help));
  return el(
    "div",
    { class: `form-group${extraClass ? " " + extraClass : ""}` },
    lbl,
  );
}

// Select con opciones
function selectGroup({ id, label, help, options }) {
  const lbl = el("label");
  lbl.append(label, " ", helpIcon(help));

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

// Párrafo de instrucciones
function modalSubtitle() {
  const p = el("p", { class: "modal-subtitle" });
  p.append(
    "Ajusta los parámetros de compresión. Pasa el cursor sobre ",
    el("span", { class: "help-icon" }, "?"),
    " para más detalles.",
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

// ── Modal libavif ──
function buildAvifModal() {
  const chromaOpts = [
    { value: 0, text: "4:4:4 (mayor calidad de color)" },
    { value: 1, text: "4:2:0 (mejor compresión)", selected: true },
    { value: 2, text: "4:2:2" },
    { value: 3, text: "4:0:0 (escala de grises)" },
  ];

  const bitDepthOpts = [
    { value: 8, text: "8 bits (estándar)", selected: true },
    { value: 10, text: "10 bits (mayor gradación)" },
    { value: 12, text: "12 bits (HDR/profesional)" },
  ];

  const tilingAccordion = accordion(
    "Tiling (segmentación en baldosas)",
    checkboxGroup({
      id: "avif-tiling",
      label: "Habilitar tiling",
      help: "Divide la imagen en baldosas (tiles) que se codifican independientemente. Mejora la decodificación paralela y es útil para imágenes muy grandes (>4K). Puede aumentar ligeramente el tamaño del archivo.",
    }),
    sliderGroup({
      id: "avif-tile-rows",
      label: "Filas (log2)",
      help: "Número de filas de tiles en potencias de 2. 0=1 fila, 1=2 filas, 2=4 filas, hasta 6=64 filas.",
      min: 0,
      max: 6,
      value: 0,
      extraClass: "avif-tiling-option avif-tiling-disabled",
    }),
    sliderGroup({
      id: "avif-tile-cols",
      label: "Columnas (log2)",
      help: "Número de columnas de tiles en potencias de 2. 0=1 columna, 1=2 columnas, hasta 6=64 columnas.",
      min: 0,
      max: 6,
      value: 0,
      extraClass: "avif-tiling-option avif-tiling-disabled",
    }),
  );

  const qualityRow = sliderGroup({
    id: "avif-quality",
    label: "Calidad",
    help: "Controla la relación calidad/tamaño. 0 = Lossless (sin pérdida, ignora esta opción). 1 = máxima calidad con pérdida. 100 = máxima compresión (mínima calidad). Rango recomendado: 25-60.",
    min: 0,
    max: 100,
    value: 25,
  });

  const alphaQualityRow = sliderGroup({
    id: "avif-quality-alpha",
    label: "Calidad canal Alpha",
    help: "Calidad para el canal de transparencia (alpha). auto = igual que la calidad principal. 0 = sin pérdida en alpha. Solo aplica si la imagen tiene transparencia (PNG con alpha).",
    min: -1,
    max: 100,
    value: -1,
    extraAttrs: { step: "1" },
  });
  alphaQualityRow.id = "avif-quality-alpha-row";

  return makeModal(
    "modal-avif",
    "Configuración libavif",
    [
      qualityRow,
      alphaQualityRow,
      sliderGroup({
        id: "avif-speed",
        label: "Velocidad (encoder speed)",
        help: "0 = más lento, máxima compresión. 10 = más rápido, menor compresión. Para uso general se recomienda entre 4 y 8. Los valores bajos pueden tardar mucho tiempo en imágenes grandes.",
        min: 0,
        max: 10,
        value: 6,
      }),
      selectGroup({
        id: "avif-chroma-subsampling",
        label: "Chroma subsampling",
        help: "Controla la resolución del canal de color. 4:4:4 preserva máxima calidad de color. 4:2:0 es el estándar para la mayoría de contenido y produce archivos más pequeños. 4:0:0 convierte a escala de grises.",
        options: chromaOpts,
      }),
      selectGroup({
        id: "avif-bit-depth",
        label: "Profundidad de bits",
        help: "Número de bits por canal de color. 8 bits es el estándar para la web. 10 bits ofrece más gradaciones de color (HDR suave). 12 bits es para uso profesional/HDR.",
        options: bitDepthOpts,
      }),
      checkboxGroup({
        id: "avif-lossless",
        label: "Lossless (sin pérdida)",
        help: "Codifica la imagen sin ninguna pérdida de calidad. El archivo resultante será mucho más grande. Cuando se activa, 'Calidad', 'Calidad Alpha' y 'Chroma subsampling' se ignoran.",
      }),
      tilingAccordion,
    ],
    { cancelId: "avif-cancel", applyId: "avif-apply" },
  );
}

// ── Inyectar modal en el DOM ──
document.body.append(buildAvifModal());

// ── Referencias a elementos del DOM ──
const modalAvif = g("modal-avif");
const avifQuality = g("avif-quality");
const avifQualityVal = g("avif-quality-value");
const avifQualityAlpha = g("avif-quality-alpha");
const avifQualityAlphaVal = g("avif-quality-alpha-value");
const avifSpeed = g("avif-speed");
const avifSpeedVal = g("avif-speed-value");
const avifChroma = g("avif-chroma-subsampling");
const avifBitDepth = g("avif-bit-depth");
const avifLossless = g("avif-lossless");
const avifTiling = g("avif-tiling");
const avifTileRows = g("avif-tile-rows");
const avifTileRowsVal = g("avif-tile-rows-value");
const avifTileCols = g("avif-tile-cols");
const avifTileColsVal = g("avif-tile-cols-value");
const avifApply = g("avif-apply");
const avifCancel = g("avif-cancel");

// ── Lógica de acordeón ──
document.querySelectorAll(".accordion-header").forEach((header) => {
  header.addEventListener("click", function () {
    const expanded = this.getAttribute("aria-expanded") === "true";
    this.setAttribute("aria-expanded", String(!expanded));
    const body = this.nextElementSibling;
    body.style.maxHeight = expanded ? "0" : body.scrollHeight + "px";
  });
});

// ── Listeners internos de la modal libavif ──
function initAvifModalListeners() {
  // Sincronizar labels de sliders
  const sliderMap = {
    "avif-quality": "avif-quality-value",
    "avif-speed": "avif-speed-value",
    "avif-tile-rows": "avif-tile-rows-value",
    "avif-tile-cols": "avif-tile-cols-value",
  };
  for (const [sliderId, labelId] of Object.entries(sliderMap)) {
    const slider = g(sliderId);
    const label = g(labelId);
    if (slider && label) {
      slider.addEventListener("input", () => {
        label.textContent = slider.value;
      });
    }
  }

  // Alpha quality muestra -1 como "auto"
  avifQualityAlpha?.addEventListener("input", () => {
    avifQualityAlphaVal.textContent =
      avifQualityAlpha.value === "-1" ? "auto" : avifQualityAlpha.value;
  });

  // Lossless deshabilita visualmente calidad y chroma
  avifLossless?.addEventListener("change", (e) => {
    document.querySelectorAll(".avif-lossless-dep").forEach((el) => {
      el.classList.toggle("avif-option-disabled", e.target.checked);
    });
  });

  // Tiling habilita/deshabilita las opciones de filas y columnas
  avifTiling?.addEventListener("change", (e) => {
    document.querySelectorAll(".avif-tiling-option").forEach((el) => {
      el.classList.toggle("avif-tiling-disabled", !e.target.checked);
    });
  });
}

// ── Apertura de la modal ──
g("config-libavif-btn")?.addEventListener("click", () => {
  if (typeof avifConfig === "undefined") return;

  avifQuality.value = avifConfig.quality;
  avifQualityVal.textContent = avifConfig.quality;

  avifQualityAlpha.value = avifConfig.qualityAlpha;
  avifQualityAlphaVal.textContent =
    avifConfig.qualityAlpha === -1 ? "auto" : String(avifConfig.qualityAlpha);

  avifSpeed.value = avifConfig.speed;
  avifSpeedVal.textContent = avifConfig.speed;

  avifChroma.value = avifConfig.chromaSubsampling;
  avifBitDepth.value = avifConfig.bitDepth;
  avifLossless.checked = avifConfig.lossless;
  avifTiling.checked = avifConfig.tiling;

  avifTileRows.value = avifConfig.tileRowsLog2;
  avifTileRowsVal.textContent = avifConfig.tileRowsLog2;
  avifTileCols.value = avifConfig.tileColsLog2;
  avifTileColsVal.textContent = avifConfig.tileColsLog2;

  // Sincronizar estado visual inicial
  document.querySelectorAll(".avif-lossless-dep").forEach((el) => {
    el.classList.toggle("avif-option-disabled", avifConfig.lossless);
  });
  document.querySelectorAll(".avif-tiling-option").forEach((el) => {
    el.classList.toggle("avif-tiling-disabled", !avifConfig.tiling);
  });

  modalAvif.classList.add("show");
});

// ── Aplicar configuración ──
avifApply?.addEventListener("click", () => {
  if (typeof avifConfig === "undefined") return;

  avifConfig.quality = parseInt(avifQuality.value, 10);
  avifConfig.qualityAlpha = parseInt(avifQualityAlpha.value, 10);
  avifConfig.speed = parseInt(avifSpeed.value, 10);
  avifConfig.chromaSubsampling = parseInt(avifChroma.value, 10);
  avifConfig.bitDepth = parseInt(avifBitDepth.value, 10);
  avifConfig.lossless = avifLossless.checked;
  avifConfig.tiling = avifTiling.checked;
  avifConfig.tileRowsLog2 = parseInt(avifTileRows.value, 10);
  avifConfig.tileColsLog2 = parseInt(avifTileCols.value, 10);

  modalAvif.classList.remove("show");
});

avifCancel?.addEventListener("click", () => modalAvif.classList.remove("show"));
modalAvif?.addEventListener("click", (e) => {
  if (e.target === modalAvif) modalAvif.classList.remove("show");
});

// ── Arranque ──
initAvifModalListeners();
