const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const compressBtn = document.getElementById("compress-btn");
const downloadBtn = document.getElementById("download-btn");

const compressMozBtn = document.getElementById("compress-mozjpeg-btn");
const downloadMozBtn = document.getElementById("download-mozjpeg-btn");
const compressJpegliBtn = document.getElementById("compress-jpegli-btn");
const downloadJpegliBtn = document.getElementById("download-jpegli-btn");

const statusText = document.getElementById("status");
const statsDiv = document.getElementById("stats");
const imageList = document.getElementById("image-list");
const listActions = document.getElementById("list-actions");
const clearAllBtn = document.getElementById("clear-all-btn");

// Configuración por defecto (coincide con los valores fijos originales)
let mozjpegConfig = {
  // Estándar libjpeg
  quality: 85,
  progressive: true,
  optimize_coding: true,
  smoothing: 0,
  chroma_subsample: 2, // 0=4:4:4 1=4:2:2 2=4:2:0
  write_jfif: true,
  // Booleanos MozJPEG
  trellis: true,
  trellis_dc: true,
  trellis_eob_opt: true,
  use_scans_in_trellis: false,
  trellis_q_opt: false,
  overshoot_deringing: true,
  optimize_scans: true,
  tune_ssim: true,
  // Enteros MozJPEG
  base_quant_tbl: 0,
  trellis_freq_split: 8,
  trellis_num_loops: 1,
  dc_scan_opt_mode: 1,
  // Flotantes MozJPEG (null = usar default interno)
  lambda_log_scale1: null,
  lambda_log_scale2: null,
  trellis_delta_dc_weight: null,
};

let jpegliConfig = {
  // Calidad
  quality: 85,
  use_distance: true,
  distance: 1.5,
  // Color
  subsampling: 2,
  xyb_mode: false,
  cicp_transfer_function: 2,
  // Escaneo
  progressive_level: 2,
  // Optimización
  optimize_coding: true,
  adaptive_quantization: true,
  use_standard_tables: false,
  // Avanzado
  smoothing_factor: 0,
  dct_method: 0,
  baseline: false,
};

// Elementos del modal MozJPEG
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

// Elementos del modal Jpegli
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

// Actualizar valores mostrados en los sliders
mozQuality.addEventListener("input", () => {
  mozQualityVal.textContent = mozQuality.value;
});
jpegliQuality.addEventListener("input", () => {
  jpegliQualityVal.textContent = jpegliQuality.value;
});

let filesData = [];
let workerMoz = null;
let workerJpegli = null;
let isCompressing = false;
let isMozReady = false;
let isJpegliReady = false;

function updateStatus(text, type = "default") {
  statusText.textContent = text;
  statusText.className = "";
  if (type !== "default") {
    statusText.classList.add(`status-${type}`);
  }
}

function checkWorkerStatus() {
  if (filesData.length > 0) return;
  let msg = [];
  if (isMozReady) msg.push("MozJPEG listo");
  else msg.push("MozJPEG no disponible");

  if (isJpegliReady) msg.push("Jpegli listo");
  else msg.push("Jpegli no disponible");

  updateStatus(`${msg.join(" | ")}`, "info");
}

function compressImageMoz(buffer) {
  return new Promise((resolve, reject) => {
    const cfg = mozjpegConfig;

    const handler = (e) => {
      if (e.data.type === "done") {
        workerMoz.removeEventListener("message", handler);
        resolve({
          buffer: e.data.buffer,
          originalSize: e.data.originalSize,
          compressedSize: e.data.compressedSize,
        });
      } else if (e.data.type === "error") {
        workerMoz.removeEventListener("message", handler);
        reject(new Error(e.data.message));
      }
      // Ignorar "ready"
    };

    workerMoz.addEventListener("message", handler);
    workerMoz.onerror = (e) => reject(e);

    // Enviar TODOS los parámetros de configuración
    workerMoz.postMessage(
      {
        imageBuffer: buffer,
        // Estándar libjpeg
        quality: cfg.quality,
        progressive: cfg.progressive ? 1 : 0,
        optimize_coding: cfg.optimize_coding ? 1 : 0,
        smoothing: cfg.smoothing,
        chroma_subsample: cfg.chroma_subsample,
        write_jfif: cfg.write_jfif ? 1 : 0,
        // Booleanos MozJPEG
        trellis: cfg.trellis ? 1 : 0,
        trellis_dc: cfg.trellis_dc ? 1 : 0,
        trellis_eob_opt: cfg.trellis_eob_opt ? 1 : 0,
        use_scans_in_trellis: cfg.use_scans_in_trellis ? 1 : 0,
        trellis_q_opt: cfg.trellis_q_opt ? 1 : 0,
        overshoot_deringing: cfg.overshoot_deringing ? 1 : 0,
        optimize_scans: cfg.optimize_scans ? 1 : 0,
        tune_ssim: cfg.tune_ssim ? 1 : 0,
        // Enteros MozJPEG
        base_quant_tbl: cfg.base_quant_tbl,
        trellis_freq_split: cfg.trellis_freq_split,
        trellis_num_loops: cfg.trellis_num_loops,
        dc_scan_opt_mode: cfg.dc_scan_opt_mode,
        // Flotantes MozJPEG (null = usar default interno en worker)
        lambda_log_scale1: cfg.lambda_log_scale1,
        lambda_log_scale2: cfg.lambda_log_scale2,
        trellis_delta_dc_weight: cfg.trellis_delta_dc_weight,
      },
      [buffer],
    );
  });
}

function compressImageJpegli(buffer) {
  return new Promise((resolve, reject) => {
    workerJpegli.onmessage = (e) => {
      if (e.data.type === "done") {
        resolve({
          buffer: e.data.buffer,
          originalSize: e.data.originalSize,
          compressedSize: e.data.compressedSize,
        });
      } else if (e.data.type === "error") {
        reject(new Error(e.data.message));
      }
    };
    workerJpegli.onerror = (e) => reject(e);
    workerJpegli.postMessage({
      imageBuffer: buffer,
      config: jpegliConfig,
    });
  });
}

function initWorkers() {
  const workerUrl = "./mozjpeg/worker.js?v=" + Date.now();
  workerMoz = new Worker(workerUrl);
  workerMoz.onmessage = (e) => {
    if (e.data.type === "ready") {
      isMozReady = true;
      checkWorkerStatus();
      updateButtonsState();
    }
  };

  // Jpegli Worker
  const workerJpegliUrl = "./jpegli/worker.js?v=" + Date.now();
  workerJpegli = new Worker(workerJpegliUrl);
  workerJpegli.onmessage = (e) => {
    if (e.data.type === "ready") {
      isJpegliReady = true;
      checkWorkerStatus();
      updateButtonsState();
    } else if (e.data.type === "error") {
      console.error("Jpegli worker error:", e.data.message);
    }
  };
  workerJpegli.onerror = (e) => {
    console.error("Jpegli worker error:", e);
  };

  checkWorkerStatus();
  updateButtonsState();
}

initWorkers();
initMozjpegModalListeners();

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES PARA MOZJPEG
// ─────────────────────────────────────────────────────────────────────────────

// Sincronizar sliders con etiquetas en el modal MozJPEG
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

  // Sliders de flotantes (valor real = slider / 100)
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

// Leer valores del modal y actualizar mozjpegConfig
function applyMozjpegConfig() {
  const g = (id) => document.getElementById(id);

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

// Helper para preset tune_ssim
function applyTuneSsimPreset(enabled) {
  if (!enabled) return;
  mozjpegConfig.base_quant_tbl = 3;
  mozjpegConfig.lambda_log_scale1 = 14.75;
  mozjpegConfig.lambda_log_scale2 = 16.5;
}

function updateButtonsState() {
  const validFiles = filesData.filter((f) => !f.isUnsupported);
  const hasFiles = validFiles.length > 0;

  if (!isCompressing) {
    if (isMozReady || isJpegliReady) compressBtn.disabled = !hasFiles;
    compressMozBtn.disabled = !(hasFiles && isMozReady);
    compressJpegliBtn.disabled = !(hasFiles && isJpegliReady);
  }

  const hasMoz = validFiles.some((f) => f.mozjpegBuffer);
  const hasJpegli = validFiles.some((f) => f.jpegliBuffer);
  const hasBest = validFiles.some((f) => f.bestBuffer);

  if (filesData.length > 0) {
    listActions.style.display = "flex";
  } else {
    listActions.style.display = "none";
  }

  if (clearAllBtn) clearAllBtn.disabled = isCompressing;

  downloadBtn.disabled = !hasBest || isCompressing;
  downloadMozBtn.disabled = !hasMoz || isCompressing;
  downloadJpegliBtn.disabled = !hasJpegli || isCompressing;
}

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length) {
    handleFiles(Array.from(e.dataTransfer.files));
  }
});

dropZone.addEventListener("click", () => {
  if (!isCompressing) fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) {
    handleFiles(Array.from(e.target.files));
  }
  fileInput.value = "";
});

if (clearAllBtn) {
  clearAllBtn.addEventListener("click", () => {
    if (isCompressing) return;
    filesData.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    filesData = [];
    renderList();
    updateTotalStats();
    updateButtonsState();
    checkWorkerStatus();
  });
}

function handleFiles(newFiles) {
  if (isCompressing) return;

  for (const file of newFiles) {
    const fileId =
      Date.now().toString() + Math.random().toString(36).substr(2, 5);

    if (file.type !== "image/jpeg") {
      filesData.push({
        id: fileId,
        originalFile: file,
        isUnsupported: true,
        errorMessage: `Omitido ${file.name}: formato no soportado`,
      });
      renderList();
      continue;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      filesData.push({
        id: fileId,
        originalFile: file,
        originalBuffer: e.target.result,
        originalSize: file.size,

        mozjpegBuffer: null,
        mozjpegSize: null,

        jpegliBuffer: null,
        jpegliSize: null,

        bestBuffer: null,
        bestSize: null,
        bestLib: null,

        previewUrl: URL.createObjectURL(file),
      });
      renderList();
      updateTotalStats();
      updateButtonsState();

      const validFiles = filesData.filter((f) => !f.isUnsupported);
      updateStatus(`Imágenes cargadas: ${validFiles.length}`, "info");
    };
    reader.readAsArrayBuffer(file);
  }
}

function removeFile(id) {
  if (isCompressing) return;
  const idx = filesData.findIndex((f) => f.id === id);
  if (idx !== -1) {
    if (filesData[idx].previewUrl) {
      URL.revokeObjectURL(filesData[idx].previewUrl);
    }
    filesData.splice(idx, 1);
    renderList();
    updateTotalStats();
    updateButtonsState();

    const validFiles = filesData.filter((f) => !f.isUnsupported);
    if (filesData.length === 0) {
      checkWorkerStatus();
    } else if (validFiles.length > 0) {
      updateStatus(`Imágenes cargadas: ${validFiles.length}`, "info");
    } else {
      updateStatus("Esperando imágenes válidas...", "default");
    }
  }
}

function updateTotalStats() {
  let totalOriginal = 0;

  let totalBest = 0;
  let totalMoz = 0;
  let totalJpegli = 0;

  let hasBest = false;
  let hasMoz = false;
  let hasJpegli = false;

  for (const f of filesData) {
    if (f.isUnsupported) continue;
    totalOriginal += f.originalSize;

    if (f.bestSize) {
      totalBest += f.bestSize;
      hasBest = true;
    }
    if (f.mozjpegSize) {
      totalMoz += f.mozjpegSize;
      hasMoz = true;
    }
    if (f.jpegliSize) {
      totalJpegli += f.jpegliSize;
      hasJpegli = true;
    }
  }

  if (totalOriginal === 0) {
    statsDiv.innerHTML = "";
    return;
  }

  const origMB = (totalOriginal / (1024 * 1024)).toFixed(2);
  let html = `<b>Total Original:</b> ${origMB} MB<br/>`;

  if (hasBest) {
    const compMB = (totalBest / (1024 * 1024)).toFixed(2);
    const ratio = ((1 - totalBest / totalOriginal) * 100).toFixed(1);
    html += `<b>General (Mejor):</b> ${compMB} MB | <b>Ahorro:</b> ${ratio}%<br/>`;
  }

  if (hasMoz) {
    const compMB = (totalMoz / (1024 * 1024)).toFixed(2);
    const ratio = ((1 - totalMoz / totalOriginal) * 100).toFixed(1);
    html += `<span style="color:var(--accent-secondary)">MozJPEG:</span> ${compMB} MB | Ahorro: ${ratio}%<br/>`;
  }

  if (hasJpegli) {
    const compMB = (totalJpegli / (1024 * 1024)).toFixed(2);
    const ratio = ((1 - totalJpegli / totalOriginal) * 100).toFixed(1);
    html += `<span style="color:var(--accent-secondary)">Jpegli:</span> ${compMB} MB | Ahorro: ${ratio}%<br/>`;
  }

  statsDiv.innerHTML = html;
}

function renderList() {
  imageList.innerHTML = "";
  filesData.forEach((file) => {
    if (file.isUnsupported) {
      const item = document.createElement("div");
      item.className = "unsupported-item";
      const info = document.createElement("div");
      info.className = "image-info";
      info.textContent = file.errorMessage;
      const btn = document.createElement("button");
      btn.className = "delete-btn";
      btn.textContent = "X";
      btn.onclick = () => removeFile(file.id);
      btn.disabled = isCompressing;
      item.appendChild(info);
      item.appendChild(btn);
      imageList.appendChild(item);
      return;
    }

    const item = document.createElement("div");
    item.className = "image-item";
    item.id = `item-${file.id}`;

    const img = document.createElement("img");
    img.src = file.previewUrl;

    const info = document.createElement("div");
    info.className = "image-info";

    const name = document.createElement("div");
    name.className = "image-name";
    name.textContent = file.originalFile.name;

    const stats = document.createElement("div");
    stats.className = "image-stats";

    // Will be populated by updateFileDOM
    info.appendChild(name);
    info.appendChild(stats);
    item.appendChild(img);
    item.appendChild(info);

    const btn = document.createElement("button");
    btn.className = "delete-btn";
    btn.textContent = "Eliminar";
    btn.onclick = () => removeFile(file.id);
    btn.disabled = isCompressing;

    item.appendChild(btn);
    imageList.appendChild(item);

    updateFileDOM(file);
  });
}

function updateFileDOM(file) {
  const item = document.getElementById(`item-${file.id}`);
  if (item) {
    const statsEl = item.querySelector(".image-stats");
    if (statsEl) {
      const origKB = (file.originalSize / 1024).toFixed(2);
      let html = `<div class="stats-primary"><span>Original: ${origKB} KB</span>`;

      if (file.bestSize) {
        const compKB = (file.bestSize / 1024).toFixed(2);
        const ratio = ((1 - file.bestSize / file.originalSize) * 100).toFixed(
          1,
        );
        html += `<span><b>Mejor (${file.bestLib}): ${compKB} KB</b> (-${ratio}%)</span>`;
      }
      html += `</div>`;

      let detailsHtml = "";
      if (file.mozjpegSize) {
        const compKB = (file.mozjpegSize / 1024).toFixed(2);
        const ratio = (
          (1 - file.mozjpegSize / file.originalSize) *
          100
        ).toFixed(1);
        detailsHtml += `<div style="font-size:0.85em;color:var(--text-secondary)">MozJPEG: ${compKB} KB (-${ratio}%)</div>`;
      }

      if (file.jpegliSize) {
        const compKB = (file.jpegliSize / 1024).toFixed(2);
        const ratio = ((1 - file.jpegliSize / file.originalSize) * 100).toFixed(
          1,
        );
        detailsHtml += `<div style="font-size:0.85em;color:var(--text-secondary)">Jpegli: ${compKB} KB (-${ratio}%)</div>`;
      }

      statsEl.innerHTML = html + detailsHtml;
    }
  }
}

async function doCompression(mode) {
  const validFiles = filesData.filter((f) => !f.isUnsupported);
  if (validFiles.length === 0) return;

  isCompressing = true;
  updateButtonsState();

  const btns = document.querySelectorAll(".delete-btn");
  btns.forEach((b) => (b.disabled = true));

  let successCount = 0;

  for (let i = 0; i < validFiles.length; i++) {
    const f = validFiles[i];
    updateStatus(
      `Comprimiendo (${i + 1}/${validFiles.length}): ${f.originalFile.name}...`,
      "warning",
    );

    try {
      if (mode === "mozjpeg" || mode === "general") {
        if (isMozReady) {
          const bufferCopy = f.originalBuffer.slice(0);
          const result = await compressImageMoz(bufferCopy);
          f.mozjpegBuffer = result.buffer;
          f.mozjpegSize = result.compressedSize;
        }
      }

      if (mode === "jpegli" || mode === "general") {
        if (isJpegliReady) {
          const bufferCopy = f.originalBuffer.slice(0);
          try {
            const result = await compressImageJpegli(bufferCopy);
            f.jpegliBuffer = result.buffer;
            f.jpegliSize = result.compressedSize;
          } catch (e) {
            console.warn("Jpegli error", e);
          }
        }
      }

      // Determine best
      f.bestSize = null;
      f.bestBuffer = null;
      f.bestLib = null;

      if (f.mozjpegSize && f.jpegliSize) {
        if (f.jpegliSize < f.mozjpegSize) {
          f.bestSize = f.jpegliSize;
          f.bestBuffer = f.jpegliBuffer;
          f.bestLib = "Jpegli";
        } else {
          f.bestSize = f.mozjpegSize;
          f.bestBuffer = f.mozjpegBuffer;
          f.bestLib = "MozJPEG";
        }
      } else if (f.mozjpegSize) {
        f.bestSize = f.mozjpegSize;
        f.bestBuffer = f.mozjpegBuffer;
        f.bestLib = "MozJPEG";
      } else if (f.jpegliSize) {
        f.bestSize = f.jpegliSize;
        f.bestBuffer = f.jpegliBuffer;
        f.bestLib = "Jpegli";
      }

      if (f.bestBuffer) successCount++;

      updateFileDOM(f);
      updateTotalStats();
    } catch (err) {
      console.error(err);
    }
  }

  isCompressing = false;
  updateButtonsState();

  if (successCount > 0) {
    updateStatus(
      `¡Completado! Se comprimieron ${successCount} de ${validFiles.length} imágenes.`,
      "success",
    );
  } else {
    updateStatus("Ocurrió un error al comprimir las imágenes.", "error");
    renderList();
  }
}

compressBtn.addEventListener("click", () => doCompression("general"));
compressMozBtn.addEventListener("click", () => doCompression("mozjpeg"));
compressJpegliBtn.addEventListener("click", () => doCompression("jpegli"));

async function doDownload(mode) {
  let filesToDownload = [];

  if (mode === "general") {
    filesToDownload = filesData
      .filter((f) => f.bestBuffer)
      .map((f) => ({
        name: f.originalFile.name,
        buffer: f.bestBuffer,
        lib: f.bestLib,
      }));
  } else if (mode === "mozjpeg") {
    filesToDownload = filesData
      .filter((f) => f.mozjpegBuffer)
      .map((f) => ({
        name: f.originalFile.name,
        buffer: f.mozjpegBuffer,
        lib: "MozJPEG",
      }));
  } else if (mode === "jpegli") {
    filesToDownload = filesData
      .filter((f) => f.jpegliBuffer)
      .map((f) => ({
        name: f.originalFile.name,
        buffer: f.jpegliBuffer,
        lib: "Jpegli",
      }));
  }

  if (filesToDownload.length === 0) return;

  if (filesToDownload.length === 1) {
    const f = filesToDownload[0];
    const originalName = f.name.substring(0, f.name.lastIndexOf(".")) || f.name;
    const suffix = f.lib ? `-${f.lib.toLowerCase()}` : "";
    const blob = new Blob([f.buffer], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${originalName}${suffix}-compressed.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    statusText.textContent = "Generando ZIP...";
    try {
      const zip = new JSZip();
      filesToDownload.forEach((f) => {
        zip.file(f.name, f.buffer);
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compressed-${mode}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      updateStatus(`¡ZIP ${mode} Descargado!`, "success");
    } catch (err) {
      console.error(err);
      updateStatus("Error al generar el ZIP", "error");
    }
  }
}

downloadBtn.addEventListener("click", () => doDownload("general"));
downloadMozBtn.addEventListener("click", () => doDownload("mozjpeg"));
downloadJpegliBtn.addEventListener("click", () => doDownload("jpegli"));

// ---- Lógica de modales ----

// Abrir modal MozJPEG
document.getElementById("config-mozjpeg-btn").addEventListener("click", () => {
  // Cargar valores actuales en el modal
  mozQuality.value = mozjpegConfig.quality;
  mozQualityVal.textContent = mozjpegConfig.quality;
  mozProgressive.checked = mozjpegConfig.progressive;
  mozTrellis.checked = mozjpegConfig.trellis;
  mozTrellisDc.checked = mozjpegConfig.trellis_dc;
  mozTuneSsim.checked = mozjpegConfig.tune_ssim;
  mozOptimizeScans.checked = mozjpegConfig.optimize_scans;
  modalMoz.classList.add("show");
});

// Aplicar cambios MozJPEG (versión completa)
mozApply.addEventListener("click", () => {
  applyMozjpegConfig();

  // Si tune_ssim está activado, aplicar preset
  if (mozjpegConfig.tune_ssim) {
    applyTuneSsimPreset(true);
  }

  modalMoz.classList.remove("show");
  updateStatus("Configuración MozJPEG actualizada", "info");
});

// Cancelar MozJPEG
mozCancel.addEventListener("click", () => {
  modalMoz.classList.remove("show");
});

// Cerrar modal al hacer clic fuera del contenido
modalMoz.addEventListener("click", (e) => {
  if (e.target === modalMoz) modalMoz.classList.remove("show");
});

// Abrir modal Jpegli
document.getElementById("config-jpegli-btn").addEventListener("click", () => {
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

  // Mostrar/ocultar controles de calidad según modo activo
  updateJpegliQualityMode();

  modalJpegli.classList.add("show");
});

// Aplicar cambios Jpegli
jpegliApply.addEventListener("click", () => {
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
  updateStatus("Configuración Jpegli actualizada", "info");
});

// Actualizar etiquetas de sliders Jpegli
jpegliSmoothingFactor.addEventListener("input", () => {
  jpegliSmoothingVal.textContent = jpegliSmoothingFactor.value;
});
jpegliDistance.addEventListener("input", () => {
  jpegliDistanceVal.textContent = parseFloat(jpegliDistance.value).toFixed(1);
});

// Toggle quality/distance: mostrar solo el control activo
jpegliUseDistance.addEventListener("change", updateJpegliQualityMode);

function updateJpegliQualityMode() {
  const useDistMode = jpegliUseDistance.checked;
  document.getElementById("jpegli-quality-row").style.display = useDistMode
    ? "none"
    : "";
  document.getElementById("jpegli-distance-row").style.display = useDistMode
    ? ""
    : "none";
}

// Cancelar Jpegli
jpegliCancel.addEventListener("click", () => {
  modalJpegli.classList.remove("show");
});

// Cerrar modal al hacer clic fuera
modalJpegli.addEventListener("click", (e) => {
  if (e.target === modalJpegli) modalJpegli.classList.remove("show");
});
