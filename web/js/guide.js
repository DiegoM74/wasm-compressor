// ── Guía completa de opciones para MozJPEG y Jpegli ──

const mozjpegGuideData = [
  {
    section: "Parámetros Principales",
    entries: [
      {
        id: "moz-quality",
        name: "Calidad (Luma)",
        description:
          "Factor general que escala las matrices de cuantización DCT para equilibrar la compresión y la fidelidad visual del canal de brillo/nitidez (luminancia Y).",
        pros: "Control directo y predecible entre tamaño del archivo y nitidez visual.",
        cons: "Valores superiores a 90 aumentan significativamente el peso con mejoras casi imperceptibles; valores inferiores a 60 provocan artefactos de bloque.",
        recommended: "85 (Rango óptimo: 70 - 85)",
      },
      {
        id: "moz-separate-chroma-quality",
        name: "Calidad de color independiente (Croma)",
        description:
          "Habilita una escala de calidad separada para los canales de color (Cb/Cr) independiente de la calidad de brillo (Y).",
        pros: "Ahorra entre un 10% y un 20% de tamaño adicional comprimiendo el color más agresivamente sin afectar la nitidez de los bordes.",
        cons: "Requiere ajustar un control adicional.",
        recommended: "Desactivado por defecto (o activado con Croma en 70-75 para máxima compresión)",
      },
      {
        id: "moz-chroma-quality",
        name: "Calidad de Croma",
        description:
          "Nivel de compresión exclusivo para las componentes de color Cb y Cr cuando la calidad independiente está activada.",
        pros: "Permite una granularidad total sobre la preservación de matices y gradientes de color.",
        cons: "Valores inferiores a 50 pueden producir decoloración o 'color banding' en fondos uniformes.",
        recommended: "70 - 75",
      },
      {
        id: "moz-chroma-subsample",
        name: "Chroma subsampling",
        description:
          "Determina la resolución espacial del color (canales Cb y Cr) en comparación con el canal de brillo (luminancia Y).",
        pros: "El modo 4:2:0 ahorra entre un 20% y un 30% de peso respecto a 4:4:4 sin apenas pérdida perceptible en fotografías.",
        cons: "En tipografías de color rojo intenso sobre fondo oscuro o líneas finas coloreadas, 4:2:0 puede generar una ligera borrosidad en los bordes.",
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
        id: "moz-smoothing",
        name: "Suavizado",
        description:
          "Aplica un filtro espacial para atenuar el ruido de alta frecuencia o el grano antes de la compresión DCT.",
        pros: "Reduce drásticamente el tamaño final en fotos con alto ISO o ruido digital.",
        cons: "Valores elevados (>20) borran texturas finas, poros y bordes nítidos.",
        recommended: "0 (5 - 15 únicamente en fotos ruidosas)",
      },
    ],
  },
  {
    section: "Color y DCT",
    entries: [
      {
        id: "moz-dct-method",
        name: "Método DCT",
        description:
          "Algoritmo matemático utilizado para el cálculo de la Transformada Discreta del Coseno directa en bloques 8x8. ISLOW utiliza enteros de alta precisión de 32 bits, IFAST usa aproximaciones enteras rápidas y FLOAT emplea coma flotante.",
        pros: "ISLOW garantiza exactitud matemática absoluta y fidelidad tonal estricta. IFAST acelera el proceso.",
        cons: "IFAST puede introducir sutiles discrepancias de redondeo en gradientes muy suaves.",
        recommended: "ISLOW (preciso)",
      },
      {
        id: "moz-fancy-downsampling",
        name: "Fancy downsampling",
        description:
          "Aplica un filtro de convolución suave y ponderado durante el submuestreo espacial de crominancia (en modos 4:2:0 y 4:2:2) en lugar de una decimación simple.",
        pros: "Previene bordes escalonados (aliasing) y aberraciones cromáticas en transiciones contrastadas de color.",
        cons: "Impacto computacional infinitesimal.",
        recommended: "Activado",
      },
      {
        id: "moz-grayscale",
        name: "Modo escala de grises (monocromo)",
        description:
          "Fuerza el espacio de color de salida a monocromo (1 canal Y), descartando completamente los canales de crominancia Cb y Cr.",
        pros: "Reduce drásticamente el peso del archivo (30% a 50%) para fotografías en blanco y negro, bocetos, escaneos o documentos.",
        cons: "Descarta la información de color de la imagen.",
        recommended: "Desactivado (activar solo para imágenes monocromáticas)",
      },
    ],
  },
  {
    section: "Calidad perceptual",
    entries: [
      {
        id: "moz-tune-preset",
        name: "Perfil perceptual (Tune)",
        description:
          "Aplica los perfiles de optimización rate-distortion oficiales de MozJPEG desarrollados por Mozilla (-tune-psnr, -tune-ssim, -tune-ms-ssim, -tune-hvs-psnr). Configura automáticamente la tabla de cuantización recomendada y las constantes de peso lambda de Trellis.",
        pros: "Ajuste instantáneo y comprobado científicamente para maximizar métricas visuales humanas (SSIM/HVS) o matemáticas (PSNR).",
        cons: "Seleccionar 'Manual' permite sobreescribir los pesos libremente para experimentación.",
        recommended: "0 — PSNR-HVS-M (Default MozJPEG) o 1 — MS-SSIM",
      },
      {
        id: "moz-base-quant-tbl",
        name: "Tabla de cuantización base",
        description:
          "Matriz de pesos de frecuencia que determina qué frecuencias espaciales conservar o eliminar dentro de cada bloque de 8x8 píxeles.",
        pros: "Las tablas avanzadas (ImageMagick 3, PSNR-HVS-M 4, MS-SSIM 2) preservan el detalle perceptivo humano mucho mejor que la tabla estándar JPEG Annex K 0.",
        cons: "La tabla 0 (Annex K) es la más tradicional para compatibilidad con visores de los 90.",
        recommended: "3 — ImageMagick (o la asignada por el perfil perceptual)",
      },
      {
        id: "moz-overshoot-deringing",
        name: "Overshoot deringing",
        description:
          "Preprocesa áreas con contrastes extremos (como texto negro sobre fondo blanco puro) permitiendo un ligero sobreimpulso que cancela el halo visual ('ringing') tras la transformada DCT.",
        pros: "Elimina halos y rebordes molestos en tipografías, logotipos e ilustraciones sin alterar el tamaño.",
        cons: "Ninguna desventaja apreciable.",
        recommended: "Activado",
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
          "Busca la distribución de espectro más eficiente en archivos progresivos para dividir los coeficientes entre diferentes pasadas (estilo jpgcrush).",
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
    section: "Avanzado — escalas RD y formato",
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
        recommended: "14.75 (automático según perfil)",
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
          "Multiplicador de importancia relativa asignado al gradiente espacial DC durante Trellis.",
        pros: "Equilibra de manera óptima el error del brillo de fondo respecto a los detalles de alta frecuencia.",
        cons: "Valores fuera del rango óptimo causan oscilaciones de contraste en gradientes.",
        recommended: "1.00",
      },
      {
        id: "moz-quant-baseline",
        name: "Forzar compatibilidad baseline de 8 bits",
        description:
          "Limita los coeficientes de las tablas de cuantización calculadas a un rango de 8 bits (1 a 255). Desactivarlo permite precisión de 16 bits para mayor rango dinámico en calidades extremas.",
        pros: "Activado asegura compatibilidad con cualquier visor JPEG clásico; desactivado mejora la precisión tonal en calidades muy altas.",
        cons: "Poco impacto en calidades estándar (60-85).",
        recommended: "Activado",
      },
      {
        id: "moz-restart-in-rows",
        name: "Intervalo de reinicio (filas MCU)",
        description:
          "Inserta marcadores RST periódicos cada N filas de bloques MCU. Permite decodificación multihilo en decodificadores paralelos y acota la corrupción ante pérdidas en red.",
        pros: "Mejora la tolerancia a fallos y permite descompresión paralela.",
        cons: "Añade un ligero incremento de bytes por marcador.",
        recommended: "0 (desactivado)",
      },
      {
        id: "moz-write-jfif",
        name: "Incluir cabecera JFIF",
        description:
          "Inserta el bloque de metadatos de cabecera JFIF APP0 (18 bytes) al inicio del archivo JPEG.",
        pros: "Garantiza compatibilidad absoluta con indexadores y software antiguo.",
        cons: "Omitirlo ahorra 18 bytes por imagen (compatible con navegadores web modernos).",
        recommended: "Activado",
      },
      {
        id: "moz-write-adobe",
        name: "Incluir marcador Adobe APP14",
        description:
          "Inserta el marcador de metadatos APP14 de Adobe que especifica transformaciones de color históricas.",
        pros: "Compatibilidad con aplicaciones antiguas de Adobe.",
        cons: "Añade bytes redundantes no requeridos en la web moderna.",
        recommended: "Desactivado",
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

// ── Guía de opciones para libimagequant (PNG) ──

const imagequantGuideData = [
  {
    section: "Parámetros Principales de Cuantización",
    entries: [
      {
        id: "imagequant-quality",
        name: "Calidad objetivo / máxima",
        description:
          "Nivel de calidad visual objetivo deseado (escala 1-100). libimagequant busca la paleta más compacta que logre esta fidelidad visual sin exceder los colores máximos configurados.",
        pros: "Ajuste directo entre fidelidad visual y peso. Menores valores reducen el tamaño final dinámicamente.",
        cons: "Valores por debajo de 60 en imágenes con degradados sutiles pueden introducir bandeado si no se acompaña de tramado.",
        recommended: "85 (Rango óptimo para web: 75 - 90).",
      },
      {
        id: "imagequant-min-quality",
        name: "Calidad mínima aceptable",
        description:
          "Cota inferior de fidelidad tolerable (0-100). Si la imagen requeriría superar los colores máximos para cumplir este umbral, el motor lo detecta para aplicar la política seleccionada.",
        pros: "Garantiza un control estricto de calidad impidiendo que la imagen se degrade por debajo de lo deseado.",
        cons: "Si se configura un valor muy alto (ej: >80) junto a pocos colores, el proceso podría rechazar imágenes complejas.",
        recommended: "55 (Rango recomendado: 40 - 65).",
      },
      {
        id: "imagequant-strict-quality",
        name: "Calidad mínima estricta",
        description:
          "Define el comportamiento cuando la imagen no puede alcanzar la calidad mínima exigida con el límite de colores permitido.",
        pros: "En modo desactivado (Mejor esfuerzo / Fallback), garantiza que siempre se obtenga un PNG con la mejor aproximación posible. Activado, sirve para pipelines que exigen no degradar imágenes.",
        cons: "Si está activado y la calidad mínima no se cumple, la compresión de ese archivo fallará.",
        recommended: "Desactivado (Mejor esfuerzo).",
      },
      {
        id: "imagequant-max-colors",
        name: "Colores máximos (Paleta indexada)",
        description:
          "Límite máximo de colores únicos en la paleta indexada (formato PNG-8). Cada color cuenta con su propio canal alfa independiente de 8 bits (0-255).",
        pros: "Reducir a 128, 64 o 16 colores disminuye notablemente el peso en iconos, ilustraciones, capturas y gráficos.",
        cons: "Valores menores a 128 en fotos o sombras continuas pueden producir pérdida de matices sutiles.",
        recommended: "256 para máxima fidelidad; 64-128 para iconos y capturas.",
      },
    ],
  },
  {
    section: "Algoritmos de Cuantización y Color",
    entries: [
      {
        id: "imagequant-dithering",
        name: "Nivel de tramado (Dithering)",
        description:
          "Difusión de error espacial Floyd-Steinberg que dispersa sutilmente los píxeles vecinos para simular gradientes suaves y transiciones continuas.",
        pros: "Elimina eficazmente el 'color banding' en degradados, cielos y sombras transparentes.",
        cons: "En diagramas con textos finos o líneas nítidas puede añadir un sutil granulado; se puede bajar a 0 en esos casos.",
        recommended: "1.0 (100% activado) para la mayoría de imágenes; 0.0 para gráficos con texto o colores planos.",
      },
      {
        id: "imagequant-posterization",
        name: "Posterización mínima (Truncamiento de bits)",
        description:
          "Trunca los bits menos significativos de los canales RGB antes de la cuantización (0 = 8 bits completos, 1 = 7 bits, 2 = 6 bits / RGB565, 3 = 5 bits, 4 = 4 bits / RGBA4444).",
        pros: "Reduce el ruido de alta frecuencia y agrupa colores similares, logrando reducciones colosales de tamaño (20% a 45%) en capturas de pantalla, cómics y dibujos.",
        cons: "Valores altos (3 o 4) introducen saltos visibles de tono en fotografías.",
        recommended: "0 para fotografías y logos con degradados; 1 o 2 para capturas de pantalla y arte plano.",
      },
      {
        id: "imagequant-gamma",
        name: "Corrección Gamma y Balance Tonal",
        description:
          "Ajusta el exponente gamma usado durante el cálculo perceptivo de distancias de color. sRGB (2.2) equilibra tonos medios; Lineal (1.0) da igual peso a luces y sombras.",
        pros: "Permite afinar la distribución de paleta dando mayor peso visual a áreas oscuras o claras según la composición.",
        cons: "Variar de sRGB estándar puede alterar la densidad de color en áreas periféricas.",
        recommended: "sRGB Estándar (Gamma 2.2).",
      },
      {
        id: "imagequant-last-index-transparent",
        name: "Transparencia al final de la paleta",
        description:
          "Por defecto, el color completamente transparente se asigna al índice 0. Al activar esta opción, se desplaza al último índice disponible.",
        pros: "Compatibilidad con motores gráficos, juegos retro o visores de imagen que esperan la transparencia en el índice final.",
        cons: "Innecesario para navegadores web estándar.",
        recommended: "Desactivado.",
      },
      {
        id: "imagequant-auto-bit-depth",
        name: "Reducción automática de profundidad de bits",
        description:
          "Si la paleta final resultante usa ≤ 16 colores, el PNG se codifica a 4 bits; si usa ≤ 4 colores, a 2 bits; si usa ≤ 2 colores, a 1 bit por píxel.",
        pros: "Reduce el tamaño del búfer de píxeles sin comprimir a la mitad (o un cuarto) antes del algoritmo Deflate, logrando ahorros masivos en imágenes simples.",
        cons: "Ninguno; totalmente estándar y compatible con todos los navegadores modernos.",
        recommended: "Activado.",
      },
    ],
  },
  {
    section: "Compresión del Contenedor PNG (Deflate / LodePNG)",
    entries: [
      {
        id: "imagequant-filter-strategy",
        name: "Estrategia de filtrado PNG",
        description:
          "Algoritmo de predicción diferencial previo a la compresión Deflate. En imágenes indexadas (paleta), el Filtro 0 suele ser óptimo ya que los índices numéricos no representan gradientes contiguos.",
        pros: "Filtro 0 maximiza la velocidad y la compresión en datos de paleta. Búsqueda exhaustiva puede rascar algún byte extra en casos atípicos.",
        cons: "Filtros diferenciales (Sub/Up/Paeth) aplicados a índices aleatorios pueden empeorar la compresión.",
        recommended: "Filtro 0 (Recomendado para paletas PNG-8).",
      },
      {
        id: "imagequant-filter-palette-zero",
        name: "Forzar Filtro Cero en paleta",
        description:
          "Sigue la recomendación oficial del consorcio W3C PNG: obliga a aplicar Filtro 0 en scanlines de imágenes paletizadas independientemente de la estrategia global.",
        pros: "Previene artefactos de compresión y garantiza el mejor ratio en imágenes de paleta.",
        cons: "Ninguno para PNG-8.",
        recommended: "Activado.",
      },
      {
        id: "imagequant-zlib-windowsize",
        name: "Tamaño de ventana LZ77 (Deflate)",
        description:
          "Tamaño del búfer de historial deslizante donde el compresor busca secuencias repetidas. LodePNG usa 2 KB por defecto; 32 KB es el estándar industrial máximo de oxipng y zlib.",
        pros: "32 KB permite encontrar patrones repetidos a lo largo de toda la imagen, logrando entre 5% y 15% de reducción adicional.",
        cons: "Requiere ligeramente más memoria durante la codificación (despreciable en navegadores modernos).",
        recommended: "32 KB (Máxima compresión).",
      },
      {
        id: "imagequant-zlib-nicematch",
        name: "LZ77 Nicematch",
        description:
          "Longitud de coincidencia a partir de la cual el compresor da por buena la búsqueda y emite el código Deflate (máximo 258 según RFC 1951).",
        pros: "258 encuentra las cadenas más largas posibles, maximizando el ratio de compresión.",
        cons: "Incremento marginal en el tiempo de procesamiento.",
        recommended: "258.",
      },
      {
        id: "imagequant-zlib-lazymatching",
        name: "Evaluación perezosa (Lazy Matching)",
        description:
          "Comprueba si en el byte siguiente existe una coincidencia más larga antes de emitir la coincidencia actual.",
        pros: "Mejora la compresión Deflate de forma consistente.",
        cons: "Ligero costo computacional adicional.",
        recommended: "Activado.",
      },
      {
        id: "imagequant-interlace",
        name: "Entrelazado progresivo Adam7",
        description:
          "Distribuye los píxeles en 7 pasadas para que la imagen se visualice de forma progresiva mientras se descarga en la web.",
        pros: "Excelente experiencia de visualización en redes móviles o conexiones lentas.",
        cons: "El entrelazado suele aumentar el tamaño final del archivo entre un 5% y un 15% debido a la fragmentación de patrones.",
        recommended: "Desactivado (activar solo si se necesita carga progresiva en web).",
      },
    ],
  },
  {
    section: "Avanzado y Metadatos",
    entries: [
      {
        id: "imagequant-speed",
        name: "Velocidad de procesamiento (Speed)",
        description:
          "Ajusta el equilibrio entre pasadas de análisis K-means y precisión de color (1 = Máxima precisión / Lento, 10 = Rápido).",
        pros: "Velocidad 4 ofrece el balance idóneo. Velocidad 1 maximiza la calidad matemática a costa de ciclos de CPU.",
        cons: "Velocidad 10 reduce ligeramente la precisión en degradados complejos.",
        recommended: "4 (valor oficial recomendado de pngquant).",
      },
      {
        id: "imagequant-strip-metadata",
        name: "Descartar metadatos auxiliares",
        description:
          "Elimina fragmentos no indispensables del PNG (comentarios de texto tEXt/zTXt/iTXt, fecha tIME, resolución pHYs y metadatos editor).",
        pros: "Ahorro garantizado del 2% al 10% adicional sin alteración visual de los píxeles ni de la transparencia.",
        cons: "Descarta información de autoría o comentarios embebidos.",
        recommended: "Activado.",
      },
      {
        id: "imagequant-write-srgb-chunk",
        name: "Incluir chunks de espacio de color sRGB/gAMA",
        description:
          "Inserta los bloques estándar sRGB y gAMA (17 bytes) para indicar de forma explícita que la paleta debe renderizarse en el espacio de color sRGB estándar.",
        pros: "Garantiza fidelidad tonal exacta en navegadores con gestión de color avanzada y monitores Wide Gamut (DCI-P3).",
        cons: "Añade apenas 17 bytes al archivo.",
        recommended: "Activado.",
      },
    ],
  },
];

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
  const imagequantModal = buildGuideModal(
    "imagequant",
    "Guía de opciones libimagequant (PNG)",
    imagequantGuideData,
  );

  document.body.append(mozModal, jpegliModal, imagequantModal);

  // Conectar botones principales de UI
  g("guide-mozjpeg-btn")?.addEventListener("click", () => {
    openGuideModal("mozjpeg");
  });

  g("guide-jpegli-btn")?.addEventListener("click", () => {
    openGuideModal("jpegli");
  });

  g("guide-imagequant-btn")?.addEventListener("click", () => {
    openGuideModal("imagequant");
  });
}

// Inicializar de inmediato si el DOM ya cargó, o en DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGuides);
} else {
  initGuides();
}

