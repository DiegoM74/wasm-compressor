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

// ── Constantes y tipos de mensajes ──
const BYTES_PER_KB = 1024;
const ENGINE_MOZJPEG = "MozJPEG";
const ENGINE_JPEGLI = "Jpegli";
const MODE_MOZJPEG = "mozjpeg";
const MODE_JPEGLI = "jpegli";
const MODE_GENERAL = "general";
const MSG_READY = "ready";
const MSG_DONE = "done";
const MSG_ERROR = "error";

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
  tune_ssim: true,
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
let mozPool = null;
let jpegliPool = null;
let isCompressing = false;
let isMozReady = false;
let isJpegliReady = false;
let mozHasError = false;
let jpegliHasError = false;
let lastMozTime = null;
let lastJpegliTime = null;

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
  if (hasMoz) {
    const mozTimeStr = lastMozTime ? ` | Terminado en ${lastMozTime}s` : "";
    html += `<span style="color:var(--accent-secondary)">MozJPEG</span>: ${toMB(totalMoz)} MB | Ahorro: ${toPct(totalMoz)}%${mozTimeStr}<br/>`;
  }
  if (hasJpegli) {
    const jpegliTimeStr = lastJpegliTime ? ` | Terminado en ${lastJpegliTime}s` : "";
    html += `<span style="color:var(--accent-secondary)">Jpegli</span>: ${toMB(totalJpegli)} MB | Ahorro: ${toPct(totalJpegli)}%${jpegliTimeStr}<br/>`;
  }

  statsDiv.innerHTML = html;
}

// ── Arquitectura de Concurrencia: WorkerPool ──
// Gestiona múltiples instancias de Web Workers por motor para procesar imágenes en
// paralelo aprovechando los núcleos disponibles en navigator.hardwareConcurrency.
class WorkerPool {
  constructor(scriptUrl, size, onStatusChange) {
    this.scriptUrl = scriptUrl;
    this.size = size;
    this.onStatusChange = onStatusChange;
    this.workers = []; // { id, worker, busy: boolean }
    this.queue = [];   // { message, transfer, resolve, reject }
    this.readyCount = 0;
    this.hasError = false;
    this.init();
  }

  init() {
    const v = Date.now();
    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(`${this.scriptUrl}?v=${v}`);
      const entry = { id: i, worker, busy: false };

      worker.onmessage = (e) => {
        if (e.data.type === "ready") {
          this.readyCount++;
          if (this.onStatusChange) this.onStatusChange();
        } else if (e.data.type === "error" && !entry.busy) {
          console.error(`Error de inicialización en worker (${this.scriptUrl}):`, e.data.message);
          this.hasError = true;
          if (this.onStatusChange) this.onStatusChange();
        }
      };

      worker.onerror = (err) => {
        console.error(`Error en worker (${this.scriptUrl}):`, err);
        this.hasError = true;
        if (this.onStatusChange) this.onStatusChange();
      };

      this.workers.push(entry);
    }
  }

  isReady() {
    return this.readyCount > 0;
  }

  runTask(message, transfer = []) {
    return new Promise((resolve, reject) => {
      this.queue.push({ message, transfer, resolve, reject });
      this.dispatch();
    });
  }

  dispatch() {
    if (this.queue.length === 0) return;
    const available = this.workers.find((w) => !w.busy);
    if (!available) return;

    const task = this.queue.shift();
    available.busy = true;

    const handler = (e) => {
      if (e.data.type !== "done" && e.data.type !== "error") return;
      available.worker.removeEventListener("message", handler);
      available.busy = false;

      if (e.data.type === "done") {
        task.resolve({
          buffer: e.data.buffer,
          originalSize: e.data.originalSize,
          compressedSize: e.data.compressedSize,
        });
      } else {
        task.reject(new Error(e.data.message));
      }

      // Procesar la siguiente tarea en la cola
      this.dispatch();
    };

    available.worker.addEventListener("message", handler);
    available.worker.postMessage(task.message, task.transfer);
  }
}

// ── Inicialización de Pools de Workers ──
function initWorkers() {
  const POOL_SIZE = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 4));

  mozPool = new WorkerPool("./mozjpeg/worker.js", POOL_SIZE, () => {
    isMozReady = mozPool.isReady();
    mozHasError = mozPool.hasError;
    updateUI();
  });

  jpegliPool = new WorkerPool("./jpegli/worker.js", POOL_SIZE, () => {
    isJpegliReady = jpegliPool.isReady();
    jpegliHasError = jpegliPool.hasError;
    updateUI();
  });

  updateUI();
}

// ── Compresión con MozJPEG vía WorkerPool ──
function compressImageMoz(buffer) {
  const cfg = mozjpegConfig;
  return mozPool.runTask(
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
}

// ── Compresión con Jpegli vía WorkerPool ──
function compressImageJpegli(buffer) {
  return jpegliPool.runTask(
    { imageBuffer: buffer, config: jpegliConfig },
    [buffer], // transferable: evita copiar el ArrayBuffer
  );
}

// ── Manejo de archivos ──
function handleFiles(newFiles) {
  if (isCompressing) return;

  const seenInBatch = new Set();
  for (const file of newFiles) {
    const fileKey = `${file.name}_${file.size}`;
    if (
      seenInBatch.has(fileKey) ||
      filesData.some(
        (f) =>
          f.originalFile.name === file.name &&
          f.originalFile.size === file.size,
      )
    ) {
      continue;
    }
    seenInBatch.add(fileKey);

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

function createFileElement(file) {
  const item = document.createElement("div");
  item.id = `item-${file.id}`;

  if (file.isUnsupported) {
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
    return item;
  }

  item.className = "image-item";

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

  return item;
}

// ── Renderizado de lista ──
function renderList() {
  const currentIds = new Set(filesData.map((f) => `item-${f.id}`));
  Array.from(imageList.children).forEach((child) => {
    if (!currentIds.has(child.id)) {
      child.remove();
    }
  });

  for (const file of filesData) {
    let item = document.getElementById(`item-${file.id}`);
    if (!item) {
      item = createFileElement(file);
      imageList.appendChild(item);
    }
    const deleteBtn = item.querySelector(".delete-btn");
    if (deleteBtn) deleteBtn.disabled = isCompressing;

    if (!file.isUnsupported) {
      updateFileDOM(file);
    }
  }
}

function updateFileDOM(file) {
  const item = document.getElementById(`item-${file.id}`);
  if (!item) return;
  const statsEl = item.querySelector(".image-stats");
  if (!statsEl) return;

  const toKB = (b) => (b / BYTES_PER_KB).toFixed(2);
  const toPct = (b) => ((1 - b / file.originalSize) * 100).toFixed(1);

  let html = `<div class="stats-primary"><span>Original: ${toKB(file.originalSize)} KB</span>`;
  if (file.bestSize) {
    html += `<span><b>Mejor (${file.bestLib}): ${toKB(file.bestSize)} KB</b> (-${toPct(file.bestSize)}%)</span>`;
  }
  html += `</div>`;

  if (file.mozjpegSize) {
    html += `<div style="font-size:0.85em;color:var(--text-secondary)">${ENGINE_MOZJPEG}: ${toKB(file.mozjpegSize)} KB (-${toPct(file.mozjpegSize)}%)</div>`;
  }
  if (file.jpegliSize) {
    html += `<div style="font-size:0.85em;color:var(--text-secondary)">${ENGINE_JPEGLI}: ${toKB(file.jpegliSize)} KB (-${toPct(file.jpegliSize)}%)</div>`;
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

// ── Helper para determinar mejor resultado ──
function updateBestResult(f) {
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
}

// ── Compresión ──
async function doCompression(mode) {
  const validFiles = filesData.filter((f) => !f.isUnsupported);
  if (validFiles.length === 0) return;

  isCompressing = true;
  if (mode === "general" || mode === "mozjpeg") lastMozTime = null;
  if (mode === "general" || mode === "jpegli") lastJpegliTime = null;
  updateUI();

  const totalCount = validFiles.length;
  updateStatus(`Comprimiendo ${totalCount} imágenes en paralelo...`, "warning");

  const startTime = performance.now();

  const mozPromise =
    (mode === "mozjpeg" || mode === "general") && isMozReady
      ? Promise.allSettled(
          validFiles.map(async (f) => {
            try {
              const res = await compressImageMoz(f.originalBuffer.slice(0));
              f.mozjpegBuffer = res.buffer;
              f.mozjpegSize = res.compressedSize;
              updateBestResult(f);
              updateFileDOM(f);
              updateTotalStats(validFiles);
              return res;
            } catch (err) {
              console.warn(`MozJPEG falló para "${f.originalFile.name}":`, err);
              throw err;
            }
          }),
        ).then(() => {
          lastMozTime = ((performance.now() - startTime) / 1000).toFixed(2);
          updateTotalStats(validFiles);
        })
      : Promise.resolve();

  const jpegliPromise =
    (mode === "jpegli" || mode === "general") && isJpegliReady
      ? Promise.allSettled(
          validFiles.map(async (f) => {
            try {
              const res = await compressImageJpegli(f.originalBuffer.slice(0));
              f.jpegliBuffer = res.buffer;
              f.jpegliSize = res.compressedSize;
              updateBestResult(f);
              updateFileDOM(f);
              updateTotalStats(validFiles);
              return res;
            } catch (err) {
              console.warn(`Jpegli falló para "${f.originalFile.name}":`, err);
              throw err;
            }
          }),
        ).then(() => {
          lastJpegliTime = ((performance.now() - startTime) / 1000).toFixed(2);
          updateTotalStats(validFiles);
        })
      : Promise.resolve();

  await Promise.all([mozPromise, jpegliPromise]);

  const successCount = validFiles.filter((f) => f.bestBuffer).length;
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
  const hasInvalid = Array.from(e.dataTransfer.items || []).some(
    (item) => item.kind === "file" && item.type && item.type !== "image/jpeg",
  );
  if (hasInvalid) {
    dropZone.classList.add("dragover-error");
    dropZone.classList.remove("dragover");
  } else {
    dropZone.classList.add("dragover");
    dropZone.classList.remove("dragover-error");
  }
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover", "dragover-error");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover", "dragover-error");
  if (e.dataTransfer.files.length) {
    const files = Array.from(e.dataTransfer.files);
    const hasInvalid = files.some((f) => f.type !== "image/jpeg");
    if (hasInvalid) {
      dropZone.classList.add("drop-error-flash");
      setTimeout(() => dropZone.classList.remove("drop-error-flash"), 1200);
      updateStatus(
        "Advertencia: Se omitieron archivos no válidos (solo se soportan imágenes JPEG)",
        "warning",
      );
    }
    handleFiles(files);
  }
});
dropZone.addEventListener("click", () => {
  if (!isCompressing) fileInput.click();
});
dropZone.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && !isCompressing) {
    e.preventDefault();
    fileInput.click();
  }
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
  lastMozTime = null;
  lastJpegliTime = null;
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
