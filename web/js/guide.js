// ── Guía completa de opciones para MozJPEG y Jpegli ──

const mozjpegGuideData = [
  {
    section: "Parámetros Principales",
    entries: [
      {
        id: "moz-quality",
        name: "Calidad",
        description:
          "Factor general que escala las matrices de cuantización DCT para equilibrar la compresión y la fidelidad visual de la imagen.",
        pros: "Control directo y predecible entre tamaño del archivo y nitidez visual.",
        cons: "Valores superiores a 90 aumentan significativamente el peso con mejoras casi imperceptibles; valores inferiores a 60 provocan artefactos de bloque.",
        recommended: "85 (Rango óptimo: 70 - 85)",
      },
      {
        id: "moz-chroma-subsample",
        name: "Chroma subsampling",
        description:
          "Determina la resolución espacial del color (canales Cb y Cr) en comparación con el canal de brillo (luminancia Y).",
        pros: "El modo 4:2:0 ahorra entre un 20% y un 30% de peso respecto a 4:4:4 sin apenas pérdida perceptible en fotografías.",
        cons: "En tipografías de color rojo intenso sobre fondo oscuro o líneas finas coloreadas, 4:2:0 puede generar un ligero borrosidad en los bordes.",
        recommended: "4:2:0 para uso web; 4:4:4 solo para gráficos con texto en color",
      },
      {
        id: "moz-progressive",
        name: "Progresivo",
        description:
          "Codifica la imagen en múltiples pasadas (scans), mostrando primero una vista general difusa que se define progresivamente al descargar.",
        pros: "Mejora la experiencia de carga en conexiones lentas, suele reducir el tamaño final un 2-5% y es indispensable para activar la optimización de scans.",
        cons: "Requiere ligeramente más memoria en navegadores muy antiguos (prácticamente nulo hoy en día).",
        recommended: "Activado",
      },
      {
        id: "moz-optimize-coding",
        name: "Optimizar codificación Huffman",
        description:
          "Calcula y construye tablas de codificación entrópica Huffman personalizadas para la estadística exacta de cada imagen en lugar de usar tablas predeterminadas.",
        pros: "Reducción de tamaño del 1% al 5% sin ninguna pérdida visual ni alteración de píxeles (compresión sin pérdida del contenedor).",
        cons: "Requiere una segunda pasada de codificación (tiempo extra de CPU moderado).",
        recommended: "Activado",
      },
      {
        id: "moz-base-quant-tbl",
        name: "Tabla de cuantización base",
        description:
          "Matriz de pesos de frecuencia que determina qué frecuencias espaciales conservar o eliminar dentro de cada bloque de 8x8 píxeles.",
        pros: "Las tablas avanzadas (PSNR-HVS-M, MS-SSIM o ImageMagick) preservan el detalle perceptivo humano mucho mejor que la tabla estándar JPEG Annex K.",
        cons: "La tabla 0 (Annex K) es la más tradicional y predecible para flujos de trabajo convencionales.",
        recommended: "0 — JPEG Annex K (o 3 — ImageMagick si se busca optimización perceptual)",
      },
      {
        id: "moz-smoothing",
        name: "Suavizado",
        description:
          "Aplica un filtro espacial para atenuar el ruido de alta frecuencia o el grano antes de la compresión DCT.",
        pros: "Reduce drásticamente el tamaño final en fotos con alto ISO o ruido digital.",
        cons: "Valores elevados (>20) borran texturas finas, poros y bordes nítidos.",
        recommended: "0 (5 - 15 únicamente en fotos ruidosas)",
      },
      {
        id: "moz-write-jfif",
        name: "Incluir cabecera JFIF",
        description:
          "Inserta el bloque de metadatos de cabecera JFIF (18 bytes) al inicio del archivo JPEG.",
        pros: "Garantiza compatibilidad absoluta al 100% con programas de visualización e indexadores antiguos.",
        cons: "Omitirlo solo ahorra 18 bytes por archivo.",
        recommended: "Activado",
      },
    ],
  },
  {
    section: "Trellis quantization",
    entries: [
      {
        id: "moz-trellis",
        name: "Trellis AC",
        description:
          "Optimización por programación dinámica (algoritmo Trellis) que busca la secuencia ideal de coeficientes AC para minimizar la ecuación de costo Rate-Distortion.",
        pros: "Reduce considerablemente el peso del archivo (5% - 15%) conservando exactamente la misma fidelidad visual percibida.",
        cons: "Aumenta el tiempo de compresión aproximadamente en un 20%.",
        recommended: "Activado",
      },
      {
        id: "moz-trellis-dc",
        name: "Trellis DC",
        description:
          "Extiende el algoritmo Trellis a los coeficientes DC (la luminancia y crominancia base promedio de cada bloque 8x8).",
        pros: "Aporta compresión adicional en zonas con degradados suaves con un impacto computacional mínimo.",
        cons: "En casos extremos muy raros podría generar mínimas oscilaciones de tono en bloques adyacentes si la calidad es muy baja.",
        recommended: "Activado",
      },
      {
        id: "moz-trellis-eob-opt",
        name: "Optimizar posición EOB",
        description:
          "Reubica dinámicamente el marcador End-Of-Block (EOB) acortando las cadenas de ceros finales en los bloques DCT.",
        pros: "Ahorro directo de bits en áreas lisas o de baja frecuencia sin pérdida perceptible.",
        cons: "Ninguna desventaja apreciable en calidad.",
        recommended: "Activado",
      },
      {
        id: "moz-use-scans-in-trellis",
        name: "Usar múltiples scans en trellis",
        description:
          "Hace que el evaluador de Trellis calcule la optimización teniendo en cuenta el reparto de datos de las pasadas progresivas.",
        pros: "Puede rascar bytes de ahorro adicionales en archivos progresivos complejos.",
        cons: "Multiplica el tiempo de compresión de forma agresiva (3x a 4x más lento).",
        recommended: "Desactivado (salvo que el tiempo no sea una limitación)",
      },
      {
        id: "moz-trellis-q-opt",
        name: "Reajustar tabla de cuantización post-trellis",
        description:
          "Recalcula los divisores de la tabla de cuantización después de aplicar Trellis para adaptarse a los coeficientes reales resultantes.",
        pros: "Ligera mejora adicional en el balance de ratio-distorsión.",
        cons: "Incrementa el tiempo de procesamiento y no siempre produce mejoras importantes.",
        recommended: "Desactivado",
      },
      {
        id: "moz-trellis-freq-split",
        name: "Punto de corte frecuencial",
        description:
          "Índice DCT de frecuencia (entre 0 y 63) a partir del cual se dividen y optimizan de forma separada los coeficientes en Trellis.",
        pros: "Un corte entre 8 y 16 aísla idealmente las bajas frecuencias de los detalles de alta frecuencia para su ponderación.",
        cons: "Valores extremos innecesarios pueden desequilibrar la distribución de bits.",
        recommended: "8 (valor por defecto)",
      },
      {
        id: "moz-trellis-num-loops",
        name: "Iteraciones trellis",
        description:
          "Número de pasadas de refinamiento de la programación dinámica Trellis por cada bloque de imagen.",
        pros: "1 iteración captura más del 95% del beneficio total de compresión.",
        cons: "Subir a 2 o más iteraciones añade lentitud lineal sin beneficios notables.",
        recommended: "1",
      },
    ],
  },
  {
    section: "Optimización de scans",
    entries: [
      {
        id: "moz-optimize-scans",
        name: "Optimizar parámetros de scan",
        description:
          "Busca la distribución de espectro más eficiente en archivos progresivos para dividir los coeficientes entre diferentes pasadas.",
        pros: "Genera archivos progresivos significativamente más pequeños y con mejor progresión visual.",
        cons: "Requiere tener activada la opción 'Progresivo'.",
        recommended: "Activado",
      },
      {
        id: "moz-dc-scan-opt-mode",
        name: "Modo optimización DC",
        description:
          "Controla la emisión y agrupación de coeficientes DC durante el escaneo progresivo del archivo JPEG.",
        pros: "El modo 1 (DC separado) consigue la mejor velocidad de decodificación en navegadores web con un tamaño mínimo.",
        cons: "El modo 0 (DC+AC juntos) es ligeramente menos eficiente pero compatible con hardware muy antiguo.",
        recommended: "1 — DC separado",
      },
    ],
  },
  {
    section: "Calidad perceptual",
    entries: [
      {
        id: "moz-tune-ssim",
        name: "Optimizar para SSIM",
        description:
          "Ajusta internamente las constantes de peso de Trellis y tablas base para favorecer la métrica de similitud estructural SSIM por encima del error PSNR.",
        pros: "Consigue que las texturas y bordes se sientan visualmente más naturales, mitigando distorsiones molestas para el ojo humano.",
        cons: "Al activarse sobreescribe de forma predeterminada la tabla base a ImageMagick (3) y los pesos de escala RD.",
        recommended: "Activado",
      },
      {
        id: "moz-overshoot-deringing",
        name: "Overshoot deringing",
        description:
          "Preprocesa áreas con contrastes muy altos (como texto negro sobre fondo blanco puro) para minimizar el artefacto de halo ('ringing').",
        pros: "Elimina halos y rebordes molestos en tipografías e ilustraciones sin aumentar el peso del archivo.",
        cons: "Ninguna desventaja aplicable en la práctica.",
        recommended: "Activado",
      },
    ],
  },
  {
    section: "Avanzado — escalas RD",
    entries: [
      {
        id: "moz-lambda-auto",
        name: "Usar valores por defecto (auto)",
        description:
          "Permite que MozJPEG determine de forma automática los pesos Lambda del algoritmo de optimización Lagrange según el perfil seleccionado.",
        pros: "Evita desajustes manuales que puedan degradar la compresión o crear artefactos.",
        cons: "Bloquea el ajuste fino manual para experimentación avanzada.",
        recommended: "Activado",
      },
      {
        id: "moz-lambda1",
        name: "lambda_log_scale1",
        description:
          "Factor logarítmico que pondera la fidelidad visual (distorsión) dentro de la función de costo del Trellis.",
        pros: "Permite priorizar la preservación de detalle visual si se desactiva el modo auto.",
        cons: "Valores mal elegidos pueden provocar pérdida de detalle en zonas de transición.",
        recommended: "14.75 (automático en tune SSIM)",
      },
      {
        id: "moz-lambda2",
        name: "lambda_log_scale2",
        description:
          "Factor logarítmico que pondera la penalización por emisión de bits (tasa de bits) en el algoritmo Trellis.",
        pros: "Un valor mayor fuerza al compresor a priorizar el ahorro de tamaño.",
        cons: "Un exceso de penalización puede borrar texturas sutiles.",
        recommended: "16.50",
      },
      {
        id: "moz-delta-dc",
        name: "trellis_delta_dc_weight",
        description:
          "Multiplicador de importancia relativa asignado a los componentes DC (luminancia base) durante Trellis.",
        pros: "Equilibra de manera óptima el error del brillo de fondo respecto a los detalles de alta frecuencia.",
        cons: "Valores fuera del rango óptimo causan parpadeo de contraste en gradientes.",
        recommended: "1.00",
      },
    ],
  },
];

const jpegliGuideData = [
  {
    section: "Parámetros Principales",
    entries: [
      {
        id: "jpegli-quality",
        name: "Calidad",
        description:
          "Métrica clásica del 0 al 100 semejante a libjpeg para escalar las tablas de cuantización. Se ignora si el modo 'Usar métrica Distance' está activo.",
        pros: "Útil para comparar directamente con codificadores tradicionales bajo la misma calidad nominal.",
        cons: "Menos consistente visualmente entre imágenes de diferente naturaleza que la métrica Distance.",
        recommended: "85 (cuando no se utiliza Distance)",
      },
      {
        id: "jpegli-distance",
        name: "Distance",
        description:
          "Métrica psico-visual nativa heredada de JPEG XL (Butteraugli) que expresa el error de reconstrucción en diferencias apenas perceptibles (JND).",
        pros: "Mucho más uniforme y preciso en calidad visual. Menor distancia = mayor fidelidad (0.5 ≈ casi sin pérdida, 1.0 ≈ calidad 90, 1.5 ≈ calidad 85, 2.0 ≈ calidad 80).",
        cons: "Escala inversa respecto a la calidad clásica (valores menores indican mayor calidad).",
        recommended: "1.5 (óptimo para compresión web de alta calidad)",
      },
      {
        id: "jpegli-use-distance",
        name: "Usar métrica Distance (recomendado)",
        description:
          "Conmuta el motor de codificación para usar la métrica Butteraugli (Distance) en lugar de la calidad estándar.",
        pros: "Garantiza el aprovechamiento de las ventajas psico-visuales de última generación de Jpegli.",
        cons: "Ninguna; es el modo recomendado de funcionamiento.",
        recommended: "Activado",
      },
      {
        id: "jpegli-subsampling",
        name: "Chroma subsampling",
        description:
          "Determina si se disminuye la resolución espacial de los canales de color en relación con la luminancia.",
        pros: "En Jpegli, 4:4:4 preserva colores intensos con una penalización mínima en tamaño; 4:2:0 maximiza la reducción en fotos convencionales.",
        cons: "4:2:0 puede atenuar los bordes en textos o gráficos con color fuerte.",
        recommended: "4:2:0 para máximo ahorro; 4:4:4 si se trabaja en Modo XYB",
      },
      {
        id: "jpegli-progressive-level",
        name: "Progresivo",
        description:
          "Controla la estructura y el número de pasadas progresivas (scans) incluidas en el archivo.",
        pros: "El nivel 2 (progresivo fino de Jpegli) organiza la información eficientemente consiguiendo una reducción de tamaño superior y una precarga fluida en el navegador.",
        cons: "Ninguna; el decodificador de cualquier navegador moderno lo soporta.",
        recommended: "2 — Fino (default de Jpegli)",
      },
    ],
  },
  {
    section: "Optimización",
    entries: [
      {
        id: "jpegli-adaptive-quant",
        name: "Cuantización adaptativa",
        description:
          "Tecnología avanzada procedente de JPEG XL que mide la complejidad de cada bloque 8x8 y varía localmente el nivel de compresión.",
        pros: "Asigna más bits a zonas planas (cielo, piel) para evitar escalones de color (banding) y enmascara ruido en áreas con detalle complejo, obteniendo una calidad visual superior.",
        cons: "Ninguna; mejora sustancialmente la calidad visual para un mismo tamaño de archivo.",
        recommended: "Activado",
      },
      {
        id: "jpegli-optimize-coding",
        name: "Optimizar codificación Huffman",
        description:
          "Calcula árboles de entropía Huffman personalizados para los símbolos de cada imagen particular.",
        pros: "Ahorra peso en el archivo de forma garantizada sin sacrificar ningún píxel ni calidad.",
        cons: "Pequeño incremento en el tiempo computacional.",
        recommended: "Activado",
      },
      {
        id: "jpegli-use-std-tables",
        name: "Tablas de cuantización estándar",
        description:
          "Fuerza a Jpegli a utilizar las matrices de cuantización heredadas del estándar JPEG original (Anexo K) en vez de sus tablas psico-visuales optimizadas.",
        pros: "Útil únicamente con fines de auditoría o para compatibilidad de hardware extremadamente antiguo.",
        cons: "Pierde una de las principales ventajas cualitativas del motor Jpegli.",
        recommended: "Desactivado",
      },
    ],
  },
  {
    section: "Color avanzado",
    entries: [
      {
        id: "jpegli-xyb-mode",
        name: "Modo XYB",
        description:
          "Transforma el color de entrada al modelo psico-visual XYB de JPEG XL en lugar de YCbCr, modelando de forma fidedigna los conos de la retina humana.",
        pros: "Altísima eficiencia de color y nitidez en bordes coloreados cuando el cliente receptor lo decodifica correctamente.",
        cons: "Puede alterar ligeramente las tonalidades si el visor o software de terceros no interpreta de forma estándar las tablas XYB incrustadas.",
        recommended: "Desactivado por defecto (usar bajo experimentación)",
      },
      {
        id: "jpegli-cicp-transfer",
        name: "Función de transferencia (CICP)",
        description:
          "Define la curva gamma o función de transferencia del material de entrada (SDR estándar, BT.709, o formatos HDR como PQ o HLG).",
        pros: "Adapta la métrica de compresión a la luminosidad real de la escena en contenidos HDR.",
        cons: "En fotos convencionales para la web debe mantenerse en SDR para evitar conversiones erróneas.",
        recommended: "2 — Desconocida / SDR",
      },
    ],
  },
  {
    section: "Avanzado",
    entries: [
      {
        id: "jpegli-smoothing-factor",
        name: "Suavizado",
        description:
          "Aplica un filtrado espacial para difuminar texturas y ruido en la imagen original antes de transformarla con la DCT.",
        pros: "Ayuda a comprimir imágenes escaneadas o con excesivo ruido del sensor fotográfico.",
        cons: "Cualquier valor superior a 0 comienza a borrar el microdetalle.",
        recommended: "0",
      },
      {
        id: "jpegli-dct-method",
        name: "Método DCT",
        description:
          "Algoritmo numérico utilizado para ejecutar la Transformada Discreta del Coseno (ISLOW preciso, IFAST rápido, o FLOAT).",
        pros: "El método ISLOW garantiza la máxima precisión computacional sin acumular error de redondeo en WebAssembly.",
        cons: "IFAST es ligeramente más veloz a cambio de perder una fracción de precisión matemática.",
        recommended: "0 — ISLOW (preciso, recomendado)",
      },
      {
        id: "jpegli-baseline",
        name: "Forzar coeficientes baseline",
        description:
          "Limita el rango matemático de los coeficientes de cuantización al intervalo estricto de 8 bits del estándar Baseline de 1992.",
        pros: "Asegura compatibilidad absoluta con decodificadores antiguos o dispositivos integrados que no soportan JPEG extendido.",
        cons: "Puede ocasionar una pérdida marginal de precisión en áreas de alto contraste a baja calidad.",
        recommended: "Desactivado (salvo requerimiento de retrocompatibilidad)",
      },
      {
        id: "jpegli-write-jfif",
        name: "Incluir cabecera JFIF",
        description:
          "Añade el marcador formal de formato JFIF al encabezado del archivo JPEG generado por Jpegli.",
        pros: "Garantiza el reconocimiento del archivo por visores de imágenes antiguos o primitivos.",
        cons: "Su impacto es insignificante (18 bytes).",
        recommended: "Activado",
      },
    ],
  },
];

// ── Constructor de tarjetas y modales de guía ──

function buildGuideEntryCard(entry) {
  const header = el(
    "div",
    { class: "guide-entry-header" },
    el("h3", { class: "guide-entry-title" }, entry.name),
    el("span", { class: "guide-rec-tag" }, `Recomendado: ${entry.recommended}`),
  );

  const desc = el("p", { class: "guide-description" }, entry.description);

  const proEl = el("div", { class: "guide-pro" });
  proEl.append(el("span", { class: "pro-con-label" }, "Pros: "), entry.pros);

  const conEl = el("div", { class: "guide-con" });
  conEl.append(el("span", { class: "pro-con-label" }, "Contras: "), entry.cons);

  const prosCons = el("div", { class: "guide-pros-cons" }, proEl, conEl);

  return el(
    "div",
    {
      id: `guide-entry-${entry.id}`,
      class: "guide-entry",
    },
    header,
    desc,
    prosCons,
  );
}

function buildGuideModal(library, titleText, data) {
  const modalId = `modal-guide-${library}`;
  const closeBtnId = `guide-${library}-close`;

  const sectionsNodes = data.map((sectionObj) => {
    const sectionTitle = el(
      "h3",
      { class: "guide-section-title" },
      sectionObj.section,
    );
    const entryCards = sectionObj.entries.map(buildGuideEntryCard);

    return el(
      "div",
      { class: "guide-section" },
      sectionTitle,
      ...entryCards,
    );
  });

  const subtitle = el("p", { class: "modal-subtitle" });
  subtitle.append(
    "Guía completa de parámetros y recomendaciones. Presiona sobre cualquier botón ",
    el(
      "span",
      { class: "help-icon", style: "cursor:default; pointer-events:none;" },
      el("svg", { class: "help-icon-svg" }, el("use", { href: "img/main.svg#infoIcon" })),
    ),
    " en los ajustes para saltar directo a su explicación.",
  );

  const content = el(
    "div",
    { class: "modal-content" },
    el("h2", {}, titleText),
    subtitle,
    el("div", { class: "modal-body" }, ...sectionsNodes),
    el(
      "div",
      { class: "modal-footer" },
      el("button", { id: closeBtnId, class: "modal-btn" }, "Cerrar"),
    ),
  );

  const modal = el("div", { id: modalId, class: "modal modal-guide" }, content);

  // Cerrar al hacer clic en el botón Cerrar o en el fondo de la modal
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.id === closeBtnId) {
      modal.classList.remove("show");
    }
  });

  return modal;
}

// ── Función pública para abrir y navegar dentro de la Guía ──

function openGuideModal(library, targetId) {
  const modalId = `modal-guide-${library}`;
  const modal = g(modalId);
  if (!modal) return;

  modal.classList.add("show");

  if (targetId) {
    const entryId = `guide-entry-${targetId}`;
    const entryEl = g(entryId);
    if (entryEl) {
      setTimeout(() => {
        entryEl.scrollIntoView({ behavior: "smooth", block: "start" });
        entryEl.classList.remove("highlight-entry");
        void entryEl.offsetWidth; // Forzar reflow para reiniciar la animación CSS
        entryEl.classList.add("highlight-entry");
      }, 80);
    }
  } else {
    // Si se abre desde el botón principal de la UI, ir al principio
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
  }
}

// ── Inicialización e inyección en el DOM ──

function initGuides() {
  const mozModal = buildGuideModal(
    "mozjpeg",
    "Guía de opciones MozJPEG",
    mozjpegGuideData,
  );
  const jpegliModal = buildGuideModal(
    "jpegli",
    "Guía de opciones Jpegli",
    jpegliGuideData,
  );

  document.body.append(mozModal, jpegliModal);

  // Conectar botones principales de UI (si existen en index.html)
  g("guide-mozjpeg-btn")?.addEventListener("click", () => {
    openGuideModal("mozjpeg");
  });

  g("guide-jpegli-btn")?.addEventListener("click", () => {
    openGuideModal("jpegli");
  });
}

// Inicializar de inmediato si el DOM ya cargó, o en DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGuides);
} else {
  initGuides();
}
