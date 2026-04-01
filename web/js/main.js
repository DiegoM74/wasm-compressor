// ── Elementos del DOM ──
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
const statusPillMoz = document.getElementById("status-mozjpeg");
const statusPillJpegli = document.getElementById("status-jpegli");
const listActions = document.getElementById("list-actions");
const clearAllBtn = document.getElementById("clear-all-btn");

// ── Configuración por defecto ──
let mozjpegConfig = {
  quality: 85,
  progressive: true,
  optimize_coding: true,
  smoothing: 0,
  chroma_subsample: 2, // 0=4:4:4  1=4:2:2  2=4:2:0
  write_jfif: true,
  trellis: true,
  trellis_dc: true,
  trellis_eob_opt: true,
  use_scans_in_trellis: false,
  trellis_q_opt: false,
  overshoot_deringing: true,
  optimize_scans: true,
  base_quant_tbl: 0,
  trellis_freq_split: 8,
  trellis_num_loops: 1,
  dc_scan_opt_mode: 1,
  lambda_log_scale1: null, // null = usar default interno
  lambda_log_scale2: null,
  trellis_delta_dc_weight: null,
};

let jpegliConfig = {
  quality: 85,
  use_distance: true,
  distance: 1.5,
  subsampling: 2,
  xyb_mode: false,
  cicp_transfer_function: 2,
  progressive_level: 2,
  optimize_coding: true,
  adaptive_quantization: true,
  use_standard_tables: false,
  smoothing_factor: 0,
  dct_method: 0,
  baseline: false,
  write_jfif: true,
};

// ── Estado global ──
let filesData = [];
let workerMoz = null;
let workerJpegli = null;
let isCompressing = false;
let isMozReady = false;
let isJpegliReady = false;
let mozHasError = false;
let jpegliHasError = false;

// ── Helpers de UI ──
function updateStatus(text, type = "default") {
  statusText.textContent = text;
  statusText.className = type !== "default" ? `status-${type}` : "";
}

function updateLibPill(pill, isReady, hasError, name) {
  if (!pill) return;
  const icon = pill.querySelector("use");
  const span = pill.querySelector("span");
  pill.className = "lib-status-pill";

  if (isReady) {
    pill.classList.add("ready");
    icon.setAttribute("href", "img/main.svg#checkIcon");
    span.textContent = `${name} disponible`;
  } else if (hasError) {
    pill.classList.add("error");
    icon.setAttribute("href", "img/main.svg#errorIcon");
    span.textContent = `${name} no disponible`;
  } else {
    pill.classList.add("loading");
    icon.setAttribute("href", "img/main.svg#refreshIcon");
    span.textContent = `${name} cargando...`;
  }
}

function updateUI() {
  // Pills de estado de cada librería
  updateLibPill(statusPillMoz, isMozReady, mozHasError, "MozJPEG");
  updateLibPill(statusPillJpegli, isJpegliReady, jpegliHasError, "Jpegli");

  const validFiles = filesData.filter((f) => !f.isUnsupported);
  const hasFiles = validFiles.length > 0;

  // Botones de compresión (solo se tocan cuando no estamos comprimiendo)
  if (!isCompressing) {
    compressBtn.disabled = !(hasFiles && (isMozReady || isJpegliReady));
    compressMozBtn.disabled = !(hasFiles && isMozReady);
    compressJpegliBtn.disabled = !(hasFiles && isJpegliReady);
  }

  // Botones de descarga
  downloadBtn.disabled = !validFiles.some((f) => f.bestBuffer) || isCompressing;
  downloadMozBtn.disabled =
    !validFiles.some((f) => f.mozjpegBuffer) || isCompressing;
  downloadJpegliBtn.disabled =
    !validFiles.some((f) => f.jpegliBuffer) || isCompressing;

  // Barra de acciones de lista
  listActions.style.display = filesData.length > 0 ? "flex" : "none";
  clearAllBtn.disabled = isCompressing;

  // Actualizar botones de elementos individuales en la lista
  document.querySelectorAll(".image-item").forEach((item) => {
    const id = item.id.replace("item-", "");
    const f = filesData.find((file) => file.id === id);
    if (!f) return;

    const actionsDiv = item.querySelector(".item-actions");
    if (actionsDiv) {
      const compareBtn = actionsDiv.querySelector(".compare-btn");
      const deleteBtn = actionsDiv.querySelector(".delete-btn");
      if (compareBtn) {
        compareBtn.disabled =
          isCompressing || (!f.mozjpegBuffer && !f.jpegliBuffer);
      }
      if (deleteBtn) {
        deleteBtn.disabled = isCompressing;
      }
    }
  });

  document.querySelectorAll(".unsupported-item .delete-btn").forEach((btn) => {
    btn.disabled = isCompressing;
  });

  // Stats globales
  updateTotalStats(validFiles);
}

// ── Stats globales ──
function updateTotalStats(validFiles) {
  let totalOriginal = 0,
    totalBest = 0,
    totalMoz = 0,
    totalJpegli = 0;
  let hasBest = false,
    hasMoz = false,
    hasJpegli = false;

  for (const f of validFiles) {
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

  const toMB = (b) => (b / (1024 * 1024)).toFixed(2);
  const toPct = (b) => ((1 - b / totalOriginal) * 100).toFixed(1);

  let html = `<b>Total Original</b>: ${toMB(totalOriginal)} MB<br/>`;
  if (hasBest)
    html += `<b>General (Mejor)</b>: ${toMB(totalBest)} MB | <b>Ahorro</b>: ${toPct(totalBest)}%<br/>`;
  if (hasMoz)
    html += `<span style="color:var(--accent-secondary)">MozJPEG</span>: ${toMB(totalMoz)} MB | Ahorro: ${toPct(totalMoz)}%<br/>`;
  if (hasJpegli)
    html += `<span style="color:var(--accent-secondary)">Jpegli</span>: ${toMB(totalJpegli)} MB | Ahorro: ${toPct(totalJpegli)}%<br/>`;

  statsDiv.innerHTML = html;
}

// ── Workers ──
function initWorkers() {
  // Timestamp único para forzar recarga y evitar caché de service worker
  const v = Date.now();

  workerMoz = new Worker(`./mozjpeg/worker.js?v=${v}`);
  workerMoz.onmessage = (e) => {
    if (e.data.type === "ready") {
      isMozReady = true;
      updateUI();
    }
  };
  workerMoz.onerror = (e) => {
    console.error("MozJPEG worker error:", e);
    mozHasError = true;
    updateUI();
  };

  workerJpegli = new Worker(`./jpegli/worker.js?v=${v}`);
  workerJpegli.onmessage = (e) => {
    if (e.data.type === "ready") {
      isJpegliReady = true;
      updateUI();
    } else if (e.data.type === "error") {
      // Errores de inicialización llegan por mensaje, no por onerror
      console.error("Jpegli worker error:", e.data.message);
      jpegliHasError = true;
      updateUI();
    }
  };
  workerJpegli.onerror = (e) => {
    console.error("Jpegli worker error:", e);
    jpegliHasError = true;
    updateUI();
  };

  updateUI();
}

// ── Compresión con MozJPEG ──
function compressImageMoz(buffer) {
  return new Promise((resolve, reject) => {
    const cfg = mozjpegConfig;

    const handler = (e) => {
      if (e.data.type !== "done" && e.data.type !== "error") return;
      workerMoz.removeEventListener("message", handler);
      e.data.type === "done"
        ? resolve({
            buffer: e.data.buffer,
            originalSize: e.data.originalSize,
            compressedSize: e.data.compressedSize,
          })
        : reject(new Error(e.data.message));
    };

    workerMoz.addEventListener("message", handler);

    workerMoz.postMessage(
      {
        imageBuffer: buffer,
        quality: cfg.quality,
        progressive: cfg.progressive ? 1 : 0,
        optimize_coding: cfg.optimize_coding ? 1 : 0,
        smoothing: cfg.smoothing,
        chroma_subsample: cfg.chroma_subsample,
        write_jfif: cfg.write_jfif ? 1 : 0,
        trellis: cfg.trellis ? 1 : 0,
        trellis_dc: cfg.trellis_dc ? 1 : 0,
        trellis_eob_opt: cfg.trellis_eob_opt ? 1 : 0,
        use_scans_in_trellis: cfg.use_scans_in_trellis ? 1 : 0,
        trellis_q_opt: cfg.trellis_q_opt ? 1 : 0,
        overshoot_deringing: cfg.overshoot_deringing ? 1 : 0,
        optimize_scans: cfg.optimize_scans ? 1 : 0,
        base_quant_tbl: cfg.base_quant_tbl,
        trellis_freq_split: cfg.trellis_freq_split,
        trellis_num_loops: cfg.trellis_num_loops,
        dc_scan_opt_mode: cfg.dc_scan_opt_mode,
        lambda_log_scale1: cfg.lambda_log_scale1,
        lambda_log_scale2: cfg.lambda_log_scale2,
        trellis_delta_dc_weight: cfg.trellis_delta_dc_weight,
      },
      [buffer], // transferable: evita copiar el ArrayBuffer
    );
  });
}

// ── Compresión con Jpegli ──
function compressImageJpegli(buffer) {
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      if (e.data.type !== "done" && e.data.type !== "error") return;
      workerJpegli.removeEventListener("message", handler);
      e.data.type === "done"
        ? resolve({
            buffer: e.data.buffer,
            originalSize: e.data.originalSize,
            compressedSize: e.data.compressedSize,
          })
        : reject(new Error(e.data.message));
    };

    workerJpegli.addEventListener("message", handler);

    workerJpegli.postMessage(
      { imageBuffer: buffer, config: jpegliConfig },
      [buffer], // transferable: evita copiar el ArrayBuffer
    );
  });
}

// ── Manejo de archivos ──
function handleFiles(newFiles) {
  if (isCompressing) return;

  for (const file of newFiles) {
    const fileId = crypto.randomUUID();

    if (file.type !== "image/jpeg") {
      filesData.push({
        id: fileId,
        originalFile: file,
        isUnsupported: true,
        errorMessage: `Omitido "${file.name}": formato no soportado`,
      });
      renderList();
      continue;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      filesData.push({
        id: fileId,
        originalFile: file,
        originalBuffer: ev.target.result,
        originalSize: file.size,
        previewUrl: URL.createObjectURL(file),
        mozjpegBuffer: null,
        mozjpegSize: null,
        jpegliBuffer: null,
        jpegliSize: null,
        bestBuffer: null,
        bestSize: null,
        bestLib: null,
      });

      renderList();
      updateUI();

      const validCount = filesData.filter((f) => !f.isUnsupported).length;
      updateStatus(`Imágenes cargadas: ${validCount}`, "info");
    };
    reader.readAsArrayBuffer(file);
  }
}

function removeFile(id) {
  if (isCompressing) return;

  const idx = filesData.findIndex((f) => f.id === id);
  if (idx === -1) return;

  const f = filesData[idx];
  if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
  filesData.splice(idx, 1);

  renderList();
  updateUI();

  const validFiles = filesData.filter((f) => !f.isUnsupported);
  if (filesData.length === 0) {
    updateStatus("Esperando imágenes...", "default");
  } else if (validFiles.length > 0) {
    updateStatus(`Imágenes cargadas: ${validFiles.length}`, "info");
  } else {
    updateStatus("Esperando imágenes válidas...", "default");
  }
}

// ── Renderizado de lista ──
function renderList() {
  imageList.innerHTML = "";

  for (const file of filesData) {
    if (file.isUnsupported) {
      const item = document.createElement("div");
      item.className = "unsupported-item";

      const info = document.createElement("div");
      info.className = "image-info";
      info.textContent = file.errorMessage;

      const btn = document.createElement("button");
      btn.className = "delete-btn";
      btn.textContent = "X";
      btn.disabled = isCompressing;
      btn.onclick = () => removeFile(file.id);

      item.append(info, btn);
      imageList.appendChild(item);
      continue;
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

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "item-actions";

    const compareBtn = document.createElement("button");
    compareBtn.className = "compare-btn";
    compareBtn.textContent = "Comparar";
    compareBtn.disabled =
      isCompressing || (!file.mozjpegBuffer && !file.jpegliBuffer);
    compareBtn.onclick = () => {
      if (window.openCompareModal) window.openCompareModal(file.id);
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.disabled = isCompressing;
    deleteBtn.onclick = () => removeFile(file.id);

    actionsDiv.append(compareBtn, deleteBtn);
    info.append(name, stats);
    item.append(img, info, actionsDiv);
    imageList.appendChild(item);

    updateFileDOM(file);
  }
}

function updateFileDOM(file) {
  const item = document.getElementById(`item-${file.id}`);
  if (!item) return;
  const statsEl = item.querySelector(".image-stats");
  if (!statsEl) return;

  const toKB = (b) => (b / 1024).toFixed(2);
  const toPct = (b) => ((1 - b / file.originalSize) * 100).toFixed(1);

  let html = `<div class="stats-primary"><span>Original: ${toKB(file.originalSize)} KB</span>`;
  if (file.bestSize) {
    html += `<span><b>Mejor (${file.bestLib}): ${toKB(file.bestSize)} KB</b> (-${toPct(file.bestSize)}%)</span>`;
  }
  html += `</div>`;

  if (file.mozjpegSize) {
    html += `<div style="font-size:0.85em;color:var(--text-secondary)">MozJPEG: ${toKB(file.mozjpegSize)} KB (-${toPct(file.mozjpegSize)}%)</div>`;
  }
  if (file.jpegliSize) {
    html += `<div style="font-size:0.85em;color:var(--text-secondary)">Jpegli: ${toKB(file.jpegliSize)} KB (-${toPct(file.jpegliSize)}%)</div>`;
  }

  statsEl.innerHTML = html;

  const actionsDiv = item.querySelector(".item-actions");
  if (actionsDiv) {
    const compareBtn = actionsDiv.querySelector(".compare-btn");
    if (compareBtn) {
      compareBtn.disabled =
        isCompressing || (!file.mozjpegBuffer && !file.jpegliBuffer);
    }
  }
}

// ── Compresión ──
async function doCompression(mode) {
  const validFiles = filesData.filter((f) => !f.isUnsupported);
  if (validFiles.length === 0) return;

  isCompressing = true;
  updateUI();

  let successCount = 0;

  for (let i = 0; i < validFiles.length; i++) {
    const f = validFiles[i];
    updateStatus(
      `Comprimiendo (${i + 1}/${validFiles.length}): ${f.originalFile.name}...`,
      "warning",
    );

    try {
      if ((mode === "mozjpeg" || mode === "general") && isMozReady) {
        const result = await compressImageMoz(f.originalBuffer.slice(0));
        f.mozjpegBuffer = result.buffer;
        f.mozjpegSize = result.compressedSize;
      }

      if ((mode === "jpegli" || mode === "general") && isJpegliReady) {
        try {
          const result = await compressImageJpegli(f.originalBuffer.slice(0));
          f.jpegliBuffer = result.buffer;
          f.jpegliSize = result.compressedSize;
        } catch (e) {
          console.warn(`Jpegli falló para "${f.originalFile.name}":`, e);
        }
      }

      // Determinar el mejor resultado disponible entre los obtenidos
      f.bestSize = f.bestBuffer = f.bestLib = null;

      if (f.mozjpegSize && f.jpegliSize) {
        const jpegliWins = f.jpegliSize < f.mozjpegSize;
        f.bestSize = jpegliWins ? f.jpegliSize : f.mozjpegSize;
        f.bestBuffer = jpegliWins ? f.jpegliBuffer : f.mozjpegBuffer;
        f.bestLib = jpegliWins ? "Jpegli" : "MozJPEG";
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
    } catch (err) {
      console.error(`Error comprimiendo "${f.originalFile.name}":`, err);
    }
  }

  isCompressing = false;
  updateUI();

  if (successCount > 0) {
    updateStatus(
      `¡Completado! ${successCount} de ${validFiles.length} imágenes comprimidas.`,
      "success",
    );
  } else {
    updateStatus("Ocurrió un error al comprimir las imágenes.", "error");
    renderList();
  }
}

// ── Descarga ──

// Tabla de acceso a buffers según el modo de descarga
const BUFFER_GETTER = {
  general: (f) => f.bestBuffer && { buffer: f.bestBuffer, lib: f.bestLib },
  mozjpeg: (f) =>
    f.mozjpegBuffer && { buffer: f.mozjpegBuffer, lib: "MozJPEG" },
  jpegli: (f) => f.jpegliBuffer && { buffer: f.jpegliBuffer, lib: "Jpegli" },
};

// Crea un <a> temporal, dispara la descarga y libera la URL.
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function doDownload(mode) {
  const getter = BUFFER_GETTER[mode];
  const filesToDownload = filesData
    .map((f) => ({ name: f.originalFile.name, ...getter(f) }))
    .filter((f) => f.buffer);

  if (filesToDownload.length === 0) return;

  if (filesToDownload.length === 1) {
    const f = filesToDownload[0];
    const base =
      f.name.lastIndexOf(".") > 0
        ? f.name.slice(0, f.name.lastIndexOf("."))
        : f.name;
    const suffix = f.lib ? `-${f.lib.toLowerCase()}` : "";
    const url = URL.createObjectURL(
      new Blob([f.buffer], { type: "image/jpeg" }),
    );
    triggerDownload(url, `${base}${suffix}-compressed.jpg`);
    return;
  }

  updateStatus("Generando ZIP...", "warning");
  try {
    const zip = new JSZip();
    filesToDownload.forEach((f) => zip.file(f.name, f.buffer));
    const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    triggerDownload(url, `compressed-${mode}.zip`);
    updateStatus(`¡ZIP ${mode} descargado!`, "success");
  } catch (err) {
    console.error(err);
    updateStatus("Error al generar el ZIP", "error");
  }
}

// ── Eventos ──
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("dragover"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length)
    handleFiles(Array.from(e.dataTransfer.files));
});
dropZone.addEventListener("click", () => {
  if (!isCompressing) fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFiles(Array.from(e.target.files));
  fileInput.value = "";
});

clearAllBtn.addEventListener("click", () => {
  if (isCompressing) return;
  filesData.forEach((f) => {
    if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
  });
  filesData = [];
  renderList();
  updateUI();
  updateStatus("Esperando imágenes...", "default");
});

compressBtn.addEventListener("click", () => doCompression("general"));
compressMozBtn.addEventListener("click", () => doCompression("mozjpeg"));
compressJpegliBtn.addEventListener("click", () => doCompression("jpegli"));

downloadBtn.addEventListener("click", () => doDownload("general"));
downloadMozBtn.addEventListener("click", () => doDownload("mozjpeg"));
downloadJpegliBtn.addEventListener("click", () => doDownload("jpegli"));

// ── Arranque ──
initWorkers();
