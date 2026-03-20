const modalHtml = `
    <!-- Modal para configuración de MozJPEG -->
    <div id="modal-mozjpeg" class="modal">
      <div class="modal-content">
        <h2>Configuración MozJPEG</h2>
        <p
          style="
            color: var(--text-secondary);
            margin-bottom: 20px;
            font-size: 0.9rem;
          "
        >
          Ajusta los parámetros de compresión. Pasa el cursor sobre
          <span
            style="
              display: inline-block;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: var(--text-secondary);
              color: var(--bg-color);
              text-align: center;
              line-height: 18px;
              font-size: 12px;
              font-weight: bold;
            "
            >?</span
          >
          para más detalles.
        </p>
        <div class="modal-body">
          <!-- Calidad -->
          <div class="form-group">
            <label for="moz-quality">
              Calidad
              <span
                class="help-icon"
                title="Relación calidad/tamaño. 60-85 es el rango recomendado."
                >?</span
              >
              <span id="moz-quality-value">85</span>
            </label>
            <input
              type="range"
              id="moz-quality"
              min="0"
              max="100"
              value="85"
              class="slider"
            />
          </div>

          <!-- Chroma subsampling -->
          <div class="form-group">
            <label>
              Chroma subsampling
              <span
                class="help-icon"
                title="4:4:4 = máxima calidad de color, sin pérdida de croma. 4:2:2 = compresión horizontal. 4:2:0 = mejor compresión."
                >?</span
              >
            </label>
            <select id="moz-chroma-subsample">
              <option value="0">4:4:4 (mejor calidad)</option>
              <option value="1">4:2:2</option>
              <option value="2" selected>4:2:0 (mejor compresión)</option>
            </select>
          </div>

          <!-- Progresivo -->
          <div class="form-group">
            <label>
              <input type="checkbox" id="moz-progressive" checked />
              Progresivo
              <span
                class="help-icon"
                title="Codifica la imagen en múltiples pasadas. Archivos ligeramente más pequeños, mejor experiencia de carga en web. Necesario para optimize_scans."
                >?</span
              >
            </label>
          </div>

          <!-- Optimizar codificación Huffman -->
          <div class="form-group">
            <label>
              <input type="checkbox" id="moz-optimize-coding" checked />
              Optimizar codificación Huffman
              <span
                class="help-icon"
                title="Genera tablas Huffman óptimas para cada imagen (2 pasadas). Reduce tamaño a costa de más tiempo."
                >?</span
              >
            </label>
          </div>

          <!-- Tabla de cuantización base -->
          <div class="form-group">
            <label>
              Tabla de cuantización base
              <span
                class="help-icon"
                title="Las tablas de cuantización determinan cuánto detalle se descarta en cada frecuencia espacial al comprimir. Las opciones estándar priorizan compatibilidad; las optimizadas (HVS, PSNR) preservan mejor la calidad visual percibida."
                >?</span
              >
            </label>
            <select id="moz-base-quant-tbl">
              <option value="0" selected>0 — JPEG Annex K (estándar)</option>
              <option value="1">1 — Flat (uniforme)</option>
              <option value="2">2 — MS-SSIM (ringing reducido)</option>
              <option value="3">3 — ImageMagick (alta frecuencia)</option>
              <option value="4">4 — PSNR-HVS-M Kodak</option>
              <option value="5">5 — HVS (visión humana)</option>
              <option value="6">6 — HVS + PSNR</option>
              <option value="7">7 — Klein et al.</option>
              <option value="8">8 — Watson et al.</option>
            </select>
          </div>

          <!-- Suavizado -->
          <div class="form-group">
            <label>
              Suavizado
              <span
                class="help-icon"
                title="Filtra el input para eliminar ruido de alta frecuencia. 0 = ninguno, 100 = máximo. Útil para reducir artefactos en imágenes ruidosas."
                >?</span
              >
              <span id="moz-smoothing-value">0</span>
            </label>
            <input
              type="range"
              id="moz-smoothing"
              min="0"
              max="100"
              value="0"
              class="slider"
            />
          </div>

          <!-- Cabecera JFIF -->
          <div class="form-group">
            <label>
              <input type="checkbox" id="moz-write-jfif" checked />
              Incluir cabecera JFIF
              <span
                class="help-icon"
                title="La cabecera JFIF ocupa 18 bytes. Desactivarla ahorra ese espacio pero incumple el estándar (compatible con todos los navegadores web modernos)."
                >?</span
              >
            </label>
          </div>

          <!-- Trellis (colapsable) -->
          <div class="accordion-section">
            <button
              type="button"
              class="accordion-header"
              aria-expanded="false"
            >
              <span style="font-weight: bold; color: var(--accent-primary)"
                >Trellis quantization</span
              >
              <span class="accordion-arrow"></span>
            </button>
            <div class="accordion-body">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-trellis" checked />
                  Trellis AC
                  <span
                    class="help-icon"
                    title="Optimización rate-distortion de coeficientes AC. Mayor reducción de tamaño a misma calidad percibida. Aumenta el tiempo de compresión ~20%."
                    >?</span
                  >
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-trellis-dc" checked />
                  Trellis DC
                  <span
                    class="help-icon"
                    title="Aplica trellis también a los coeficientes DC (componente de brillo promedio de cada bloque 8x8). Ligera mejora de compresión adicional."
                    >?</span
                  >
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-trellis-eob-opt" checked />
                  Optimizar posición EOB
                  <span
                    class="help-icon"
                    title="Optimiza la posición del marcador End-Of-Block durante trellis. Mejora la compresión del stream de coeficientes."
                    >?</span
                  >
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-use-scans-in-trellis" />
                  Usar múltiples scans en trellis
                  <span
                    class="help-icon"
                    title="Optimiza la cuantización basándose en cómo se dividen los datos en las pasadas progresivas. Reduce el tamaño del archivo aún más, pero es extremadamente lento."
                    >?</span
                  >
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-trellis-q-opt" />
                  Reajustar tabla de cuantización post-trellis
                  <span
                    class="help-icon"
                    title="Deriva una tabla de cuantización revisada tras el trellis para minimizar el error de reconstrucción. Mejora leve, mayor coste de CPU."
                    >?</span
                  >
                </label>
              </div>
              <div class="form-group">
                <label>
                  Punto de corte frecuencial
                  <span
                    class="help-icon"
                    title="Divide los coeficientes AC en dos grupos por frecuencia para el trellis. Valores más altos = más coeficientes en el grupo de alta frecuencia."
                    >?</span
                  >
                  <span id="moz-trellis-freq-split-value">8</span>
                </label>
                <input
                  type="range"
                  id="moz-trellis-freq-split"
                  min="0"
                  max="63"
                  value="8"
                  class="slider"
                />
              </div>
              <div class="form-group">
                <label>
                  Iteraciones trellis
                  <span
                    class="help-icon"
                    title="Número de pasadas del algoritmo trellis. Más iteraciones = potencialmente mejor compresión, mucho más lento."
                    >?</span
                  >
                  <span id="moz-trellis-num-loops-value">1</span>
                </label>
                <input
                  type="range"
                  id="moz-trellis-num-loops"
                  min="1"
                  max="10"
                  value="1"
                  class="slider"
                />
              </div>
            </div>
          </div>

          <!-- Optimización de scans (colapsable) -->
          <div class="accordion-section">
            <button
              type="button"
              class="accordion-header"
              aria-expanded="false"
            >
              <span style="font-weight: bold; color: var(--accent-primary)"
                >Optimización de scans</span
              >
              <span class="accordion-arrow"></span>
            </button>
            <div class="accordion-body">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-optimize-scans" checked />
                  Optimizar parámetros de scan
                  <span
                    class="help-icon"
                    title="Busca la partición óptima del espectro DCT en scans separados. Hace archivos progresivos más pequeños. Requiere modo progresivo."
                    >?</span
                  >
                </label>
              </div>
              <div class="form-group">
                <label>
                  Modo optimización DC
                  <span
                    class="help-icon"
                    title="Define cómo se codifican los datos base de la imagen. El modo 1 es el más eficiente; el 0 maximiza la compatibilidad."
                    >?</span
                  >
                </label>
                <select id="moz-dc-scan-opt-mode">
                  <option value="0">0 — DC+AC juntos (compatible)</option>
                  <option value="1" selected>
                    1 — DC separado (default mozjpeg)
                  </option>
                  <option value="2">2 — DC luma/croma separados</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Tune / calidad perceptual (colapsable) -->
          <div class="accordion-section">
            <button
              type="button"
              class="accordion-header"
              aria-expanded="false"
            >
              <span style="font-weight: bold; color: var(--accent-primary)"
                >Calidad perceptual</span
              >
              <span class="accordion-arrow"></span>
            </button>
            <div class="accordion-body">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-tune-ssim" checked />
                  Optimizar para SSIM
                  <span
                    class="help-icon"
                    title="Ajusta internamente los pesos de trellis para maximizar el índice SSIM (similitud estructural). Produce resultados visualmente más agradables."
                    >?</span
                  >
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-overshoot-deringing" checked />
                  Overshoot deringing
                  <span
                    class="help-icon"
                    title="Preprocesa píxeles con valores extremos (p.ej. 0 y 255) para reducir el efecto ringing. Especialmente útil en texto negro sobre fondo blanco. No afecta al tamaño."
                    >?</span
                  >
                </label>
              </div>
            </div>
          </div>

          <!-- Avanzado RD (colapsable) -->
          <div class="accordion-section">
            <button
              type="button"
              class="accordion-header"
              aria-expanded="false"
            >
              <span style="font-weight: bold; color: var(--accent-primary)"
                >Avanzado — escalas RD</span
              >
              <span class="accordion-arrow"></span>
            </button>
            <div class="accordion-body">
              <p
                style="
                  color: var(--text-secondary);
                  font-size: 0.85rem;
                  margin-bottom: 12px;
                "
              >
                Estos parámetros controlan el balance rate-distortion interno
                del trellis. Déjalos en "auto" salvo que sepas lo que haces.
              </p>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="moz-lambda-auto" checked />
                  Usar valores por defecto (auto)
                  <span
                    class="help-icon"
                    title="Si está marcado, las tres escalas de abajo se ignoran y MozJPEG usa sus valores internos."
                    >?</span
                  >
                </label>
              </div>
              <div
                class="form-group moz-lambda-manual"
                style="opacity: 0.4; pointer-events: none"
              >
                <label>
                  lambda_log_scale1
                  <span
                    class="help-icon"
                    title="Escala logarítmica que pondera la fidelidad (distorsión). Default interno ≈ 14.75 en tune PSNR-HVS."
                    >?</span
                  >
                  <span id="moz-lambda1-value">14.75</span>
                </label>
                <input
                  type="range"
                  id="moz-lambda1"
                  min="0"
                  max="3000"
                  value="1475"
                  step="25"
                  class="slider"
                />
              </div>
              <div
                class="form-group moz-lambda-manual"
                style="opacity: 0.4; pointer-events: none"
              >
                <label>
                  lambda_log_scale2
                  <span
                    class="help-icon"
                    title="Escala logarítmica que pondera el tamaño (rate). Default interno ≈ 16.5."
                    >?</span
                  >
                  <span id="moz-lambda2-value">16.50</span>
                </label>
                <input
                  type="range"
                  id="moz-lambda2"
                  min="0"
                  max="3000"
                  value="1650"
                  step="25"
                  class="slider"
                />
              </div>
              <div
                class="form-group moz-lambda-manual"
                style="opacity: 0.4; pointer-events: none"
              >
                <label>
                  trellis_delta_dc_weight
                  <span
                    class="help-icon"
                    title="Peso del componente DC en la función de coste trellis. Default interno ≈ 1.0."
                    >?</span
                  >
                  <span id="moz-delta-dc-value">1.00</span>
                </label>
                <input
                  type="range"
                  id="moz-delta-dc"
                  min="0"
                  max="500"
                  value="100"
                  step="5"
                  class="slider"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="moz-cancel" class="modal-btn cancel">Cancelar</button>
          <button id="moz-apply" class="modal-btn">Aplicar</button>
        </div>
      </div>
    </div>

    <!-- Modal para configuración de Jpegli -->
    <div id="modal-jpegli" class="modal">
      <div class="modal-content">
        <h2>Configuración Jpegli</h2>
        <p
          style="
            color: var(--text-secondary);
            margin-bottom: 20px;
            font-size: 0.9rem;
          "
        >
          Ajusta los parámetros de compresión. Pasa el cursor sobre
          <span
            style="
              display: inline-block;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: var(--text-secondary);
              color: var(--bg-color);
              text-align: center;
              line-height: 18px;
              font-size: 12px;
              font-weight: bold;
            "
            >?</span
          >
          para más detalles.
        </p>
        <div class="modal-body">
          <!-- ── Calidad ──────────────────────────────────────────────────── -->
          <div class="form-group" id="jpegli-quality-row" style="display: none">
            <label>
              Calidad
              <span
                class="help-icon"
                title="Escala las matrices de cuantización de forma no lineal para maximizar la calidad visual. El rango útil es 60-95."
                >?</span
              >
              <span id="jpegli-quality-value">85</span>
            </label>
            <input
              type="range"
              id="jpegli-quality"
              min="0"
              max="100"
              value="85"
              class="slider"
            />
          </div>

          <!-- ── Distance ────────────────────────────────────────────────── -->
          <div class="form-group" id="jpegli-distance-row">
            <label>
              Distance
              <span
                class="help-icon"
                title="Distancia perceptual butteraugli (heredada de JPEG XL). Menor = mayor calidad. 0.5 = casi sin pérdidas, 1.0 ≈ calidad 90, 1.5 ≈ calidad 85, 2.0 ≈ calidad 80, 3.0 = compresión agresiva."
                >?</span
              >
              <span id="jpegli-distance-value">1.5</span>
            </label>
            <input
              type="range"
              id="jpegli-distance"
              min="0.1"
              max="5.0"
              step="0.1"
              value="1.5"
              class="slider"
            />
          </div>

          <!-- Toggle quality ↔ distance -->
          <div class="form-group">
            <label>
              <input type="checkbox" id="jpegli-use-distance" checked />
              Usar métrica Distance (recomendado)
              <span
                class="help-icon"
                title="Distance es la métrica nativa de Jpegli (de JPEG XL) y produce mejores resultados. Desmárcalo si prefieres el parámetro 'quality' tradicional de libjpeg."
                >?</span
              >
            </label>
          </div>

          <!-- ── Chroma subsampling ───────────────────────────────────────── -->
          <div class="form-group">
            <label>
              Chroma subsampling
              <span
                class="help-icon"
                title="Reduce la resolución del canal de color. 4:4:4 = sin pérdida de croma (recomendado con XYB). 4:2:0 = mayor compresión (puede verse borroso en bordes coloreados)."
                >?</span
              >
            </label>
            <select id="jpegli-subsampling">
              <option value="0">4:4:4 (mejor calidad)</option>
              <option value="1">4:2:2</option>
              <option value="2" selected>4:2:0 (mejor compresión)</option>
            </select>
          </div>

          <!-- ── Progresivo ──────────────────────────────────────────────── -->
          <div class="form-group">
            <label>
              Progresivo
              <span
                class="help-icon"
                title="0 = secuencial (más compatible). 1 = progresivo básico. 2 = progresivo fino con más pasadas (default de Jpegli, generalmente produce archivos más pequeños)."
                >?</span
              >
            </label>
            <select id="jpegli-progressive-level">
              <option value="0">0 — Secuencial</option>
              <option value="1">1 — Básico</option>
              <option value="2" selected>2 — Fino (default Jpegli)</option>
            </select>
          </div>

          <!-- ── Optimización (colapsable) ──────────────────────────────── -->
          <div class="accordion-section">
            <button
              type="button"
              class="accordion-header"
              aria-expanded="false"
            >
              <span style="font-weight: bold; color: var(--accent-primary)"
                >Optimización</span
              >
              <span class="accordion-arrow"></span>
            </button>
            <div class="accordion-body">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="jpegli-adaptive-quant" checked />
                  Cuantización adaptativa
                  <span
                    class="help-icon"
                    title="Exclusivo de Jpegli (heredado de JPEG XL). Analiza la imagen bloque a bloque y ajusta la cuantización según el contenido local. Mejora la calidad percibida sin aumentar el tamaño. Recomendado activado."
                    >?</span
                  >
                </label>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="jpegli-optimize-coding" checked />
                  Optimizar codificación Huffman
                  <span
                    class="help-icon"
                    title="Genera tablas Huffman óptimas para cada imagen en lugar de usar las estándar. Reduce el tamaño a costa de una segunda pasada de codificación."
                    >?</span
                  >
                </label>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="jpegli-use-std-tables" />
                  Tablas de cuantización estándar
                  <span
                    class="help-icon"
                    title="Usa las tablas del Anexo K del estándar JPEG en lugar de las tablas optimizadas de Jpegli. Actívalo si necesitas máxima compatibilidad con software antiguo. Normalmente peor calidad al mismo tamaño."
                    >?</span
                  >
                </label>
              </div>
            </div>
          </div>

          <!-- ── Color avanzado (colapsable) ────────────────────────────── -->
          <div class="accordion-section">
            <button
              type="button"
              class="accordion-header"
              aria-expanded="false"
            >
              <span style="font-weight: bold; color: var(--accent-primary)"
                >Color avanzado</span
              >
              <span class="accordion-arrow"></span>
            </button>
            <div class="accordion-body">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="jpegli-xyb-mode" />
                  Modo XYB
                  <span
                    class="help-icon"
                    title="Usa el espacio de color XYB de JPEG XL en lugar de YCbCr estándar. Aplica tablas de cuantización especializadas para los canales X/Y/B que explotan mejor la sensibilidad visual humana. Produce archivos JPEG normales compatibles con cualquier visor. Solo disponible para imágenes RGB."
                    >?</span
                  >
                </label>
              </div>

              <div class="form-group">
                <label>
                  Función de transferencia (CICP)
                  <span
                    class="help-icon"
                    title="Indica la función de transferencia del contenido. Para fotos SDR normales usar 'Desconocida'. Útil si procesas imágenes HDR: PQ = HDR10 (Dolby Vision), HLG = HDR broadcast. Afecta las tablas de cuantización por defecto."
                    >?</span
                  >
                </label>
                <select id="jpegli-cicp-transfer">
                  <option value="2" selected>
                    Desconocida / SDR (default)
                  </option>
                  <option value="1">BT.709 (video SDR)</option>
                  <option value="16">PQ — HDR10</option>
                  <option value="18">HLG — HDR broadcast</option>
                </select>
              </div>
            </div>
          </div>

          <!-- ── Avanzado (colapsable) ───────────────────────────────────── -->
          <div class="accordion-section">
            <button
              type="button"
              class="accordion-header"
              aria-expanded="false"
            >
              <span style="font-weight: bold; color: var(--accent-primary)"
                >Avanzado</span
              >
              <span class="accordion-arrow"></span>
            </button>
            <div class="accordion-body">
              <div class="form-group">
                <label>
                  Suavizado
                  <span
                    class="help-icon"
                    title="Aplica un filtro al input antes de comprimir (0 = ninguno, 100 = máximo). Reduce artefactos en imágenes ruidosas a costa de borrar detalle fino. En la mayoría de casos dejarlo en 0."
                    >?</span
                  >
                  <span id="jpegli-smoothing-value">0</span>
                </label>
                <input
                  type="range"
                  id="jpegli-smoothing-factor"
                  min="0"
                  max="100"
                  value="0"
                  class="slider"
                />
              </div>

              <div class="form-group">
                <label>
                  Método DCT
                  <span
                    class="help-icon"
                    title="Algoritmo de la transformada coseno discreta. ISLOW = más lento y más preciso (recomendado). IFAST = más rápido, pequeña pérdida de precisión. FLOAT = usa punto flotante, resultados intermedios pero depende de la FPU."
                    >?</span
                  >
                </label>
                <select id="jpegli-dct-method">
                  <option value="0" selected>
                    ISLOW (preciso, recomendado)
                  </option>
                  <option value="1">IFAST (rápido, menos preciso)</option>
                  <option value="2">FLOAT</option>
                </select>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="jpegli-baseline" />
                  Forzar coeficientes baseline
                  <span
                    class="help-icon"
                    title="Limita los coeficientes de cuantización a 8 bits (≤255) según la especificación baseline. Necesario para máxima compatibilidad con software muy antiguo. Puede reducir ligeramente la calidad a calidades bajas."
                    >?</span
                  >
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="jpegli-cancel" class="modal-btn cancel">Cancelar</button>
          <button id="jpegli-apply" class="modal-btn">Aplicar</button>
        </div>
      </div>
    </div>
`;

// Inyectar HTML al final del body
document.body.insertAdjacentHTML("beforeend", modalHtml);

// ---- Elementos de los modales ----
// MozJPEG
const modalMoz = document.getElementById("modal-mozjpeg");
const mozQuality = document.getElementById("moz-quality");
const mozQualityVal = document.getElementById("moz-quality-value");
const mozProgressive = document.getElementById("moz-progressive");
const mozTrellis = document.getElementById("moz-trellis");
const mozTrellisDc = document.getElementById("moz-trellis-dc");
const mozTuneSsim = document.getElementById("moz-tune-ssim");
const mozOptimizeScans = document.getElementById("moz-optimize-scans");
const mozApply = document.getElementById("moz-apply");
const mozCancel = document.getElementById("moz-cancel");

// Jpegli
const modalJpegli = document.getElementById("modal-jpegli");
const jpegliQuality = document.getElementById("jpegli-quality");
const jpegliQualityVal = document.getElementById("jpegli-quality-value");
const jpegliUseDistance = document.getElementById("jpegli-use-distance");
const jpegliDistance = document.getElementById("jpegli-distance");
const jpegliDistanceVal = document.getElementById("jpegli-distance-value");
const jpegliSubsampling = document.getElementById("jpegli-subsampling");
const jpegliXybMode = document.getElementById("jpegli-xyb-mode");
const jpegliCicpTransfer = document.getElementById("jpegli-cicp-transfer");
const jpegliOptimizeCoding = document.getElementById("jpegli-optimize-coding");
const jpegliProgressiveLevel = document.getElementById(
  "jpegli-progressive-level",
);
const jpegliSmoothingFactor = document.getElementById(
  "jpegli-smoothing-factor",
);
const jpegliSmoothingVal = document.getElementById("jpegli-smoothing-value");
const jpegliDctMethod = document.getElementById("jpegli-dct-method");
const jpegliUseStdTables = document.getElementById("jpegli-use-std-tables");
const jpegliBaseline = document.getElementById("jpegli-baseline");
const jpegliAdaptiveQuant = document.getElementById("jpegli-adaptive-quant");
const jpegliApply = document.getElementById("jpegli-apply");
const jpegliCancel = document.getElementById("jpegli-cancel");

// ---- Lógica de Accordions ----
document.querySelectorAll(".accordion-header").forEach(function (header) {
  header.addEventListener("click", function () {
    var expanded = this.getAttribute("aria-expanded") === "true";
    this.setAttribute("aria-expanded", !expanded);
    var body = this.nextElementSibling;
    if (!expanded) {
      body.style.maxHeight = body.scrollHeight + "px";
    } else {
      body.style.maxHeight = "0";
    }
  });
});

// ---- Lógica de MozJPEG ----
function initMozjpegModalListeners() {
  const sliderMap = {
    "moz-quality": "moz-quality-value",
    "moz-smoothing": "moz-smoothing-value",
    "moz-trellis-freq-split": "moz-trellis-freq-split-value",
    "moz-trellis-num-loops": "moz-trellis-num-loops-value",
  };
  for (const [sliderId, labelId] of Object.entries(sliderMap)) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (slider && label) {
      slider.addEventListener("input", () => {
        label.textContent = slider.value;
      });
    }
  }

  // Sliders de flotantes
  const floatSliderMap = {
    "moz-lambda1": { labelId: "moz-lambda1-value", divisor: 100 },
    "moz-lambda2": { labelId: "moz-lambda2-value", divisor: 100 },
    "moz-delta-dc": { labelId: "moz-delta-dc-value", divisor: 100 },
  };
  for (const [sliderId, cfg] of Object.entries(floatSliderMap)) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(cfg.labelId);
    if (slider && label) {
      slider.addEventListener("input", () => {
        label.textContent = (slider.value / cfg.divisor).toFixed(2);
      });
    }
  }

  // Checkbox "auto" para lambdas
  const lambdaAuto = document.getElementById("moz-lambda-auto");
  if (lambdaAuto) {
    lambdaAuto.addEventListener("change", () => {
      const manualControls = document.querySelectorAll(".moz-lambda-manual");
      manualControls.forEach((el) => {
        el.style.opacity = lambdaAuto.checked ? "0.4" : "1";
        el.style.pointerEvents = lambdaAuto.checked ? "none" : "auto";
      });
    });
  }
}

function applyMozjpegConfig() {
  const g = (id) => document.getElementById(id);
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

// ---- Lógica de Jpegli ----
function updateJpegliQualityMode() {
  const useDistMode = jpegliUseDistance.checked;
  document.getElementById("jpegli-quality-row").style.display = useDistMode
    ? "none"
    : "";
  document.getElementById("jpegli-distance-row").style.display = useDistMode
    ? ""
    : "none";
}

// Sliders básicos
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

// Toggle quality/distance Jpegli
jpegliUseDistance.addEventListener("change", updateJpegliQualityMode);

// Eventos MozJPEG
document.getElementById("config-mozjpeg-btn").addEventListener("click", () => {
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
  if (mozjpegConfig.tune_ssim) {
    applyTuneSsimPreset(true);
  }
  modalMoz.classList.remove("show");
  if (typeof updateStatus === "function")
    updateStatus("Configuración MozJPEG actualizada", "info");
});

mozCancel.addEventListener("click", () => {
  modalMoz.classList.remove("show");
});

modalMoz.addEventListener("click", (e) => {
  if (e.target === modalMoz) modalMoz.classList.remove("show");
});

// Eventos Jpegli
document.getElementById("config-jpegli-btn").addEventListener("click", () => {
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
  if (typeof updateStatus === "function")
    updateStatus("Configuración Jpegli actualizada", "info");
});

jpegliCancel.addEventListener("click", () => {
  modalJpegli.classList.remove("show");
});

modalJpegli.addEventListener("click", (e) => {
  if (e.target === modalJpegli) modalJpegli.classList.remove("show");
});

// Inicializar listeners adicionales
initMozjpegModalListeners();
