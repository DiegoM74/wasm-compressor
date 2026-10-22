// ── Elementos del DOM ──
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const compressBtn = document.getElementById("compress-btn");
const downloadBtn = document.getElementById("download-btn");
const compressMozBtn = document.getElementById("compress-mozjpeg-btn");
const downloadMozBtn = document.getElementById("download-mozjpeg-btn");
const compressJpegliBtn = document.getElementById("compress-jpegli-btn");
const downloadJpegliBtn = document.getElementById("download-jpegli-btn");
const compressImagequantBtn = document.getElementById("compress-imagequant-btn");
const downloadImagequantBtn = document.getElementById("download-imagequant-btn");
const statusText = document.getElementById("status");
const statsDiv = document.getElementById("stats");
const imageList = document.getElementById("image-list");
const statusPillMoz = document.getElementById("status-mozjpeg");
const statusPillJpegli = document.getElementById("status-jpegli");
const statusPillImagequant = document.getElementById("status-imagequant");
const listActions = document.getElementById("list-actions");
const clearAllBtn = document.getElementById("clear-all-btn");

// ── Constantes y tipos de mensajes ──
const BYTES_PER_KB = 1024;
const ENGINE_MOZJPEG = "MozJPEG";
const ENGINE_JPEGLI = "Jpegli";
const ENGINE_IMAGEQUANT = "libimagequant";
const MODE_MOZJPEG = "mozjpeg";
const MODE_JPEGLI = "jpegli";
const MODE_IMAGEQUANT = "imagequant";
const MODE_GENERAL = "general";
const MSG_READY = "ready";
const MSG_DONE = "done";
const MSG_ERROR = "error";

// ── Configuración por defecto ──
let mozjpegConfig = {
  quality: 85,
  separate_chroma_quality: false,
  chroma_quality: 75,
  progressive: true,
  optimize_coding: true,
  smoothing: 0,
  chroma_subsample: 2, // 0=4:4:4  1=4:2:2  2=4:2:0
  write_jfif: true,
  dct_method: 0, // 0=ISLOW, 1=IFAST, 2=FLOAT
  do_fancy_downsampling: true,
  grayscale: false,
  quant_baseline: true,
  restart_in_rows: 0,
  write_adobe_marker: false,
  tune_preset: 0, // 0=PSNR-HVS-M (default), 1=MS-SSIM, 2=SSIM, 3=PSNR, 4=Manual
  trellis: true,
  trellis_dc: true,
  trellis_eob_opt: true,
  use_scans_in_trellis: false,
  trellis_q_opt: false,
  overshoot_deringing: true,
  optimize_scans: true,
  base_quant_tbl: 3,
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

let imagequantConfig = {
  quality: 85,
  min_quality: 55,
  max_quality: 85,
  strict_quality: false,
  max_colors: 256,
  speed: 4,
  dithering: 1.0,
  posterization: 0,
  gamma: 0.0,
  last_index_transparent: false,
  auto_bit_depth: true,
  filter_strategy: 0,
  filter_palette_zero: true,
  zlib_windowsize: 32768,
  zlib_nicematch: 258,
  zlib_lazymatching: true,
  interlace: false,
  strip_metadata: true,
  write_srgb_chunk: true,
};

// ── Estado global ──
let filesData = [];
let mozPool = null;
let jpegliPool = null;
let imagequantPool = null;
let isCompressing = false;
let isMozReady = false;
let isJpegliReady = false;
let isImagequantReady = false;
let mozHasError = false;
let jpegliHasError = false;
let imagequantHasError = false;
let lastMozTime = null;
let lastJpegliTime = null;
let lastImagequantTime = null;
let opaquePreference = null; // 'convert' | 'keep' | null

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
  updateLibPill(
    statusPillImagequant,
    isImagequantReady,
    imagequantHasError,
    "libimagequant",
  );

  const validFiles = filesData.filter((f) => !f.isUnsupported);
  const hasFiles = validFiles.length > 0;
  const hasJpegs = validFiles.some((f) => !f.isPng || f.convertToJpeg);
  const hasPngs = validFiles.some((f) => f.isPng && !f.convertToJpeg);

  // Botones de compresión (solo se tocan cuando no estamos comprimiendo)
  if (!isCompressing) {
    compressBtn.disabled = !(
      hasFiles &&
      (isMozReady || isJpegliReady || isImagequantReady)
    );
    compressMozBtn.disabled = !(hasJpegs && isMozReady);
    compressJpegliBtn.disabled = !(hasJpegs && isJpegliReady);
    compressImagequantBtn.disabled = !(hasPngs && isImagequantReady);
  }

  // Botones de descarga
  downloadBtn.disabled = !validFiles.some((f) => f.bestBuffer) || isCompressing;
  downloadMozBtn.disabled =
    !validFiles.some((f) => f.mozjpegBuffer) || isCompressing;
  downloadJpegliBtn.disabled =
    !validFiles.some((f) => f.jpegliBuffer) || isCompressing;
  downloadImagequantBtn.disabled =
    !validFiles.some((f) => f.imagequantBuffer) || isCompressing;

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
        const canCompare = (f.isPng && !f.convertToJpeg)
          ? !!f.imagequantBuffer
          : !!(f.mozjpegBuffer || f.jpegliBuffer);
        compareBtn.disabled = isCompressing || !canCompare;
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
  let totalOriginal = 0;
  let totalOriginalBest = 0,
    totalBest = 0;
  let totalOriginalMoz = 0,
    totalMoz = 0;
  let totalOriginalJpegli = 0,
    totalJpegli = 0;
  let totalOriginalImagequant = 0,
    totalImagequant = 0;

  let hasBest = false,
    hasMoz = false,
    hasJpegli = false,
    hasImagequant = false;

  for (const f of validFiles) {
    totalOriginal += f.originalSize;
    if (f.bestSize) {
      totalOriginalBest += f.originalSize;
      totalBest += f.bestSize;
      hasBest = true;
    }
    if (f.mozjpegSize) {
      totalOriginalMoz += f.originalSize;
      totalMoz += f.mozjpegSize;
      hasMoz = true;
    }
    if (f.jpegliSize) {
      totalOriginalJpegli += f.originalSize;
      totalJpegli += f.jpegliSize;
      hasJpegli = true;
    }
    if (f.imagequantSize) {
      totalOriginalImagequant += f.originalSize;
      totalImagequant += f.imagequantSize;
      hasImagequant = true;
    }
  }

  if (totalOriginal === 0) {
    statsDiv.innerHTML = "";
    return;
  }

  const toMB = (b) => (b / (1024 * 1024)).toFixed(2);
  const toPct = (compressed, original) =>
    original > 0 ? ((1 - compressed / original) * 100).toFixed(1) : "0.0";

  let html = `<b>Total Original</b>: ${toMB(totalOriginal)} MB<br/>`;
  if (hasBest)
    html += `<b>General (Mejor)</b>: ${toMB(totalBest)} MB | <b>Ahorro</b>: ${toPct(totalBest, totalOriginalBest)}%<br/>`;
  if (hasMoz) {
    const mozTimeStr = lastMozTime ? ` | Terminado en ${lastMozTime}s` : "";
    html += `<span style="color:var(--accent-secondary)">MozJPEG</span>: ${toMB(totalMoz)} MB | Ahorro: ${toPct(totalMoz, totalOriginalMoz)}%${mozTimeStr}<br/>`;
  }
  if (hasJpegli) {
    const jpegliTimeStr = lastJpegliTime ? ` | Terminado en ${lastJpegliTime}s` : "";
    html += `<span style="color:var(--accent-secondary)">Jpegli</span>: ${toMB(totalJpegli)} MB | Ahorro: ${toPct(totalJpegli, totalOriginalJpegli)}%${jpegliTimeStr}<br/>`;
  }
  if (hasImagequant) {
    const iqTimeStr = lastImagequantTime ? ` | Terminado en ${lastImagequantTime}s` : "";
    html += `<span style="color:var(--accent-secondary)">libimagequant (PNG)</span>: ${toMB(totalImagequant)} MB | Ahorro: ${toPct(totalImagequant, totalOriginalImagequant)}%${iqTimeStr}<br/>`;
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
        task.resolve(e.data);
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

  mozPool = new WorkerPool("./engines/mozjpeg/worker.js", POOL_SIZE, () => {
    isMozReady = mozPool.isReady();
    mozHasError = mozPool.hasError;
    updateUI();
  });

  jpegliPool = new WorkerPool("./engines/jpegli/worker.js", POOL_SIZE, () => {
    isJpegliReady = jpegliPool.isReady();
    jpegliHasError = jpegliPool.hasError;
    updateUI();
  });

  imagequantPool = new WorkerPool(
    "./engines/imagequant/worker.js",
    POOL_SIZE,
    () => {
      isImagequantReady = imagequantPool.isReady();
      imagequantHasError = imagequantPool.hasError;
      updateUI();
    },
  );

  updateUI();
}

// ── Compresión con MozJPEG vía WorkerPool ──
function compressImageMoz(buffer, width = 0, height = 0, isRaw = false) {
  const cfg = mozjpegConfig;
  return mozPool.runTask(
    {
      imageBuffer: buffer,
      width,
      height,
      isRaw,
      quality: cfg.quality,
      progressive: cfg.progressive ? 1 : 0,
      optimize_coding: cfg.optimize_coding ? 1 : 0,
      smoothing: cfg.smoothing,
      chroma_subsample: cfg.chroma_subsample,
      write_jfif: cfg.write_jfif ? 1 : 0,
      dct_method: cfg.dct_method,
      do_fancy_downsampling: cfg.do_fancy_downsampling ? 1 : 0,
      grayscale: cfg.grayscale ? 1 : 0,
      quant_baseline: cfg.quant_baseline ? 1 : 0,
      restart_in_rows: cfg.restart_in_rows || 0,
      write_adobe_marker: cfg.write_adobe_marker ? 1 : 0,
      separate_chroma_quality: cfg.separate_chroma_quality ? 1 : 0,
      chroma_quality: cfg.chroma_quality,
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
function compressImageJpegli(buffer, width = 0, height = 0, isRaw = false) {
  return jpegliPool.runTask(
    { imageBuffer: buffer, config: jpegliConfig, width, height, isRaw },
    [buffer], // transferable: evita copiar el ArrayBuffer
  );
}

// ── Compresión con libimagequant vía WorkerPool ──
function compressImagequant(buffer) {
  return imagequantPool.runTask(
    { imageBuffer: buffer, config: imagequantConfig },
    [buffer], // transferable: evita copiar el ArrayBuffer
  );
}

// ── Manejo de archivos ──
function handleFiles(newFiles) {
  if (isCompressing) return;

  const seenInBatch = new Set();
  const pendingOpaquePngs = [];

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
    const isJpeg = file.type === "image/jpeg";
    const isPng = file.type === "image/png";

    if (!isJpeg && !isPng) {
      filesData.push({
        id: fileId,
        originalFile: file,
        isUnsupported: true,
        errorMessage: `Omitido "${file.name}": formato no soportado (solo JPEG y PNG)`,
      });
      renderList();
      continue;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const originalBuffer = ev.target.result;
      const previewUrl = URL.createObjectURL(file);

      if (isJpeg) {
        filesData.push({
          id: fileId,
          originalFile: file,
          originalBuffer,
          originalSize: file.size,
          previewUrl,
          isPng: false,
          hasAlpha: false,
          mozjpegBuffer: null,
          mozjpegSize: null,
          jpegliBuffer: null,
          jpegliSize: null,
          imagequantBuffer: null,
          imagequantSize: null,
          bestBuffer: null,
          bestSize: null,
          bestLib: null,
        });

        renderList();
        updateUI();

        const validCount = filesData.filter((f) => !f.isUnsupported).length;
        updateStatus(`Imágenes cargadas: ${validCount}`, "info");
        return;
      }

      // Es archivo PNG: analizamos si contiene capa de transparencia
      let hasAlpha = false;
      let canvas = null;
      try {
        const img = new Image();
        img.src = previewUrl;
        await img.decode();
        canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] < 255) {
            hasAlpha = true;
            break;
          }
        }
      } catch (err) {
        console.warn("No se pudo inspeccionar canal alfa, asumiendo con transparencia:", err);
        hasAlpha = true;
      }

      // Si es PNG opaco y el usuario ya eligió recordar convertir a JPG
      if (!hasAlpha && opaquePreference === "convert") {
        filesData.push({
          id: fileId,
          originalFile: file,
          originalBuffer,
          originalSize: file.size,
          previewUrl,
          isPng: true,
          hasAlpha: false,
          convertToJpeg: true,
          mozjpegBuffer: null,
          mozjpegSize: null,
          jpegliBuffer: null,
          jpegliSize: null,
          imagequantBuffer: null,
          imagequantSize: null,
          imagequantQuality: null,
          imagequantColors: null,
          imagequantBitDepth: null,
          imagequantMse: null,
          bestBuffer: null,
          bestSize: null,
          bestLib: null,
        });

        renderList();
        updateUI();
        const validCount = filesData.filter((f) => !f.isUnsupported).length;
        updateStatus(`Imágenes cargadas: ${validCount}`, "info");
        return;
      }

      // Guardar entrada como PNG
      const fileEntry = {
        id: fileId,
        originalFile: file,
        originalBuffer,
        originalSize: file.size,
        previewUrl,
        isPng: true,
        hasAlpha,
        convertToJpeg: false,
        mozjpegBuffer: null,
        mozjpegSize: null,
        jpegliBuffer: null,
        jpegliSize: null,
        imagequantBuffer: null,
        imagequantSize: null,
        imagequantQuality: null,
        imagequantColors: null,
        imagequantBitDepth: null,
        imagequantMse: null,
        bestBuffer: null,
        bestSize: null,
        bestLib: null,
      };
      filesData.push(fileEntry);

      if (!hasAlpha && opaquePreference === null) {
        pendingOpaquePngs.push({ fileEntry });
      }

      renderList();
      updateUI();

      const validCount = filesData.filter((f) => !f.isUnsupported).length;
      updateStatus(`Imágenes cargadas: ${validCount}`, "info");

      // Si hay PNGs opacos y no hay preferencia guardada, preguntar al usuario
      if (pendingOpaquePngs.length > 0 && typeof window.showOpaquePngModal === "function") {
        setTimeout(() => {
          if (pendingOpaquePngs.length === 0) return;
          const count = pendingOpaquePngs.length;
          window.showOpaquePngModal(
            count,
            (remember) => {
              if (remember) opaquePreference = "convert";
              for (const { fileEntry } of pendingOpaquePngs) {
                fileEntry.convertToJpeg = true;
                updateFileDOM(fileEntry);
              }
              pendingOpaquePngs.length = 0;
              renderList();
              updateUI();
            },
            (remember) => {
              if (remember) opaquePreference = "keep";
              for (const { fileEntry } of pendingOpaquePngs) {
                fileEntry.convertToJpeg = false;
                updateFileDOM(fileEntry);
              }
              pendingOpaquePngs.length = 0;
              renderList();
              updateUI();
            },
          );
        }, 120);
      }
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
  if (file.convertToJpeg) {
    name.innerHTML = `${file.originalFile.name} <span class="badge-format" style="font-size:0.75em;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.08);color:var(--accent-secondary);margin-left:6px;">PNG → JPG</span>`;
  } else {
    name.textContent = file.originalFile.name;
  }

  const stats = document.createElement("div");
  stats.className = "image-stats";

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "item-actions";

  const compareBtn = document.createElement("button");
  compareBtn.className = "compare-btn";
  compareBtn.textContent = "Comparar";
  const canCompare = (file.isPng && !file.convertToJpeg)
    ? !!file.imagequantBuffer
    : !!(file.mozjpegBuffer || file.jpegliBuffer);
  compareBtn.disabled = isCompressing || !canCompare;
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

  const nameEl = item.querySelector(".image-name");
  if (nameEl) {
    if (file.convertToJpeg) {
      nameEl.innerHTML = `${file.originalFile.name} <span class="badge-format" style="font-size:0.75em;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.08);color:var(--accent-secondary);margin-left:6px;">PNG → JPG</span>`;
    } else {
      nameEl.textContent = file.originalFile.name;
    }
  }

  const statsEl = item.querySelector(".image-stats");
  if (!statsEl) return;

  const toKB = (b) => (b / BYTES_PER_KB).toFixed(2);
  const toPct = (b) => ((1 - b / file.originalSize) * 100).toFixed(1);

  let html = `<div class="stats-primary"><span>Original: ${toKB(file.originalSize)} KB</span>`;
  if (file.bestSize) {
    html += `<span><b>Mejor (${file.bestLib}): ${toKB(file.bestSize)} KB</b> (-${toPct(file.bestSize)}%)</span>`;
  }
  html += `</div>`;

  if (file.isPng && !file.convertToJpeg) {
    if (file.imagequantSize) {
      const details = [];
      if (typeof file.imagequantQuality === "number" && file.imagequantQuality >= 0) {
        details.push(`Calidad: ${file.imagequantQuality}/100`);
      }
      if (typeof file.imagequantColors === "number" && file.imagequantColors > 0) {
        details.push(`${file.imagequantColors} cols`);
      }
      if (typeof file.imagequantBitDepth === "number" && file.imagequantBitDepth > 0) {
        details.push(`${file.imagequantBitDepth}-bit`);
      }
      if (typeof file.imagequantMse === "number" && file.imagequantMse > 0) {
        details.push(`MSE: ${file.imagequantMse.toFixed(1)}`);
      }
      const detailsStr = details.length > 0 ? ` · ${details.join(" · ")}` : "";
      html += `<div style="font-size:0.85em;color:var(--text-secondary)">${ENGINE_IMAGEQUANT}: ${toKB(file.imagequantSize)} KB (-${toPct(file.imagequantSize)}%)${detailsStr}</div>`;
    }
  } else {
    if (file.mozjpegSize) {
      html += `<div style="font-size:0.85em;color:var(--text-secondary)">${ENGINE_MOZJPEG}: ${toKB(file.mozjpegSize)} KB (-${toPct(file.mozjpegSize)}%)</div>`;
    }
    if (file.jpegliSize) {
      html += `<div style="font-size:0.85em;color:var(--text-secondary)">${ENGINE_JPEGLI}: ${toKB(file.jpegliSize)} KB (-${toPct(file.jpegliSize)}%)</div>`;
    }
  }

  statsEl.innerHTML = html;

  const actionsDiv = item.querySelector(".item-actions");
  if (actionsDiv) {
    const compareBtn = actionsDiv.querySelector(".compare-btn");
    if (compareBtn) {
      const canCompare = (file.isPng && !file.convertToJpeg)
        ? !!file.imagequantBuffer
        : !!(file.mozjpegBuffer || file.jpegliBuffer);
      compareBtn.disabled = isCompressing || !canCompare;
    }
  }
}

// ── Helper para determinar mejor resultado ──
function updateBestResult(f) {
  f.bestSize = f.bestBuffer = f.bestLib = null;

  if (f.isPng && !f.convertToJpeg) {
    if (f.imagequantBuffer) {
      f.bestSize = f.imagequantSize;
      f.bestBuffer = f.imagequantBuffer;
      f.bestLib = "libimagequant";
    }
    return;
  }

  // Para JPEG
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

// Cache temporal durante la compresión para no decodificar el PNG dos veces si corren ambos motores
const rawRgbaCache = new Map();

async function getRawRgbaCached(fileId, file) {
  if (!rawRgbaCache.has(fileId)) {
    rawRgbaCache.set(
      fileId,
      (async () => {
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        let buffer;
        if (typeof OffscreenCanvas !== "undefined") {
          const offscreen = new OffscreenCanvas(width, height);
          const ctx = offscreen.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bitmap, 0, 0);
          buffer = ctx.getImageData(0, 0, width, height).data.buffer;
        } else {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bitmap, 0, 0);
          buffer = ctx.getImageData(0, 0, width, height).data.buffer;
        }
        bitmap.close();
        return { buffer, width, height };
      })(),
    );
  }
  const res = await rawRgbaCache.get(fileId);
  return { buffer: res.buffer.slice(0), width: res.width, height: res.height };
}

// ── Compresión ──
async function doCompression(mode) {
  const validFiles = filesData.filter((f) => !f.isUnsupported);
  if (validFiles.length === 0) return;

  const targetJpegs = validFiles.filter((f) => !f.isPng || f.convertToJpeg);
  const targetPngs = validFiles.filter((f) => f.isPng && !f.convertToJpeg);

  if (mode === "mozjpeg" && targetJpegs.length === 0) {
    updateStatus("No hay imágenes JPEG para procesar con MozJPEG", "warning");
    return;
  }
  if (mode === "jpegli" && targetJpegs.length === 0) {
    updateStatus("No hay imágenes JPEG para procesar con Jpegli", "warning");
    return;
  }
  if (mode === "imagequant" && targetPngs.length === 0) {
    updateStatus("No hay imágenes PNG para procesar con libimagequant", "warning");
    return;
  }

  isCompressing = true;
  if (mode === "general" || mode === "mozjpeg") lastMozTime = null;
  if (mode === "general" || mode === "jpegli") lastJpegliTime = null;
  if (mode === "general" || mode === "imagequant") lastImagequantTime = null;
  updateUI();

  const activeCount =
    mode === "mozjpeg" || mode === "jpegli"
      ? targetJpegs.length
      : mode === "imagequant"
      ? targetPngs.length
      : validFiles.length;

  updateStatus(`Comprimiendo ${activeCount} imágenes en paralelo...`, "warning");

  const startTime = performance.now();

  const mozPromise =
    (mode === "mozjpeg" || mode === "general") && isMozReady && targetJpegs.length > 0
      ? Promise.allSettled(
          targetJpegs.map(async (f) => {
            try {
              let res;
              if (f.convertToJpeg) {
                const raw = await getRawRgbaCached(f.id, f.originalFile);
                res = await compressImageMoz(raw.buffer, raw.width, raw.height, true);
              } else {
                res = await compressImageMoz(f.originalBuffer.slice(0), 0, 0, false);
              }
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
    (mode === "jpegli" || mode === "general") && isJpegliReady && targetJpegs.length > 0
      ? Promise.allSettled(
          targetJpegs.map(async (f) => {
            try {
              let res;
              if (f.convertToJpeg) {
                const raw = await getRawRgbaCached(f.id, f.originalFile);
                res = await compressImageJpegli(raw.buffer, raw.width, raw.height, true);
              } else {
                res = await compressImageJpegli(f.originalBuffer.slice(0), 0, 0, false);
              }
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

  const imagequantPromise =
    (mode === "imagequant" || mode === "general") && isImagequantReady && targetPngs.length > 0
      ? Promise.allSettled(
          targetPngs.map(async (f) => {
            try {
              const res = await compressImagequant(f.originalBuffer.slice(0));
              f.imagequantBuffer = res.buffer;
              f.imagequantSize = res.compressedSize;
              f.imagequantQuality = res.attainedQuality;
              f.imagequantColors = res.paletteColors;
              f.imagequantBitDepth = res.outputBitDepth;
              f.imagequantMse = res.mseError;
              updateBestResult(f);
              updateFileDOM(f);
              updateTotalStats(validFiles);
              return res;
            } catch (err) {
              console.warn(`libimagequant falló para "${f.originalFile.name}":`, err);
              throw err;
            }
          }),
        ).then(() => {
          lastImagequantTime = ((performance.now() - startTime) / 1000).toFixed(2);
          updateTotalStats(validFiles);
        })
      : Promise.resolve();

  await Promise.all([mozPromise, jpegliPromise, imagequantPromise]);
  rawRgbaCache.clear();

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
  general: (f) =>
    f.bestBuffer && {
      buffer: f.bestBuffer,
      lib: f.bestLib,
      isPng: f.bestLib === "libimagequant",
    },
  mozjpeg: (f) =>
    f.mozjpegBuffer && { buffer: f.mozjpegBuffer, lib: "MozJPEG", isPng: false },
  jpegli: (f) =>
    f.jpegliBuffer && { buffer: f.jpegliBuffer, lib: "Jpegli", isPng: false },
  imagequant: (f) =>
    f.imagequantBuffer && {
      buffer: f.imagequantBuffer,
      lib: "libimagequant",
      isPng: true,
    },
};

// Crea un <a> temporal, dispara la descarga y libera la URL.
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function executeDownload(filesToDownload, modeName) {
  if (filesToDownload.length === 0) return;

  if (filesToDownload.length === 1) {
    const f = filesToDownload[0];
    const base =
      f.name.lastIndexOf(".") > 0
        ? f.name.slice(0, f.name.lastIndexOf("."))
        : f.name;
    const suffix = f.lib ? `-${f.lib.toLowerCase()}` : "";
    const ext = f.isPng ? "png" : "jpg";
    const mime = f.isPng ? "image/png" : "image/jpeg";
    const url = URL.createObjectURL(new Blob([f.buffer], { type: mime }));
    triggerDownload(url, `${base}${suffix}-compressed.${ext}`);
    return;
  }

  updateStatus("Generando ZIP...", "warning");
  try {
    const zip = new JSZip();
    filesToDownload.forEach((f) => {
      const base =
        f.name.lastIndexOf(".") > 0
          ? f.name.slice(0, f.name.lastIndexOf("."))
          : f.name;
      const ext = f.isPng ? "png" : "jpg";
      zip.file(`${base}.${ext}`, f.buffer);
    });
    const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    triggerDownload(url, `compressed-${modeName}.zip`);
    updateStatus(`¡ZIP ${modeName} descargado!`, "success");
  } catch (err) {
    console.error(err);
    updateStatus("Error al generar el ZIP", "error");
  }
}

async function doDownload(mode) {
  if (mode === "general") {
    const getter = BUFFER_GETTER.general;
    const filesToDownload = filesData
      .map((f) => ({ name: f.originalFile.name, ...getter(f) }))
      .filter((f) => f.buffer);
    await executeDownload(filesToDownload, "all");
    return;
  }

  // Descarga de motor específico (mozjpeg, jpegli, imagequant)
  const engineGetter = BUFFER_GETTER[mode];
  const engineFiles = filesData
    .map((f) => ({ name: f.originalFile.name, ...engineGetter(f) }))
    .filter((f) => f.buffer);

  if (engineFiles.length === 0) return;

  // Comprobar si hay archivos comprimidos del otro formato en la lista
  const isTargetPng = mode === "imagequant";
  const otherFormatFiles = filesData
    .filter((f) => {
      const isPngFile = f.isPng && !f.convertToJpeg;
      return isTargetPng ? !isPngFile : isPngFile;
    })
    .map((f) => ({ name: f.originalFile.name, ...BUFFER_GETTER.general(f) }))
    .filter((f) => f.buffer);

  if (
    otherFormatFiles.length > 0 &&
    typeof window.showMixedDownloadModal === "function"
  ) {
    const engineName =
      mode === "mozjpeg"
        ? "MozJPEG"
        : mode === "jpegli"
        ? "Jpegli"
        : "libimagequant (PNG)";

    window.showMixedDownloadModal(
      engineName,
      {
        engineCount: engineFiles.length,
        totalCount: engineFiles.length + otherFormatFiles.length,
      },
      async (choice) => {
        if (choice === "engine-only") {
          await executeDownload(engineFiles, mode);
        } else {
          await executeDownload(
            [...engineFiles, ...otherFormatFiles],
            `${mode}-mixed`,
          );
        }
      },
    );
  } else {
    // Si no hay archivos del otro formato, descarga directa
    await executeDownload(engineFiles, mode);
  }
}

// ── Eventos ──
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  const hasInvalid = Array.from(e.dataTransfer.items || []).some(
    (item) =>
      item.kind === "file" &&
      item.type &&
      item.type !== "image/jpeg" &&
      item.type !== "image/png",
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
    const hasInvalid = files.some(
      (f) => f.type !== "image/jpeg" && f.type !== "image/png",
    );
    if (hasInvalid) {
      dropZone.classList.add("drop-error-flash");
      setTimeout(() => dropZone.classList.remove("drop-error-flash"), 1200);
      updateStatus(
        "Advertencia: Se omitieron archivos no válidos (solo se soportan imágenes JPEG y PNG)",
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
  lastImagequantTime = null;
  renderList();
  updateUI();
  updateStatus("Esperando imágenes...", "default");
});

compressBtn.addEventListener("click", () => doCompression("general"));
compressMozBtn.addEventListener("click", () => doCompression("mozjpeg"));
compressJpegliBtn.addEventListener("click", () => doCompression("jpegli"));
compressImagequantBtn.addEventListener("click", () =>
  doCompression("imagequant"),
);

downloadBtn.addEventListener("click", () => doDownload("general"));
downloadMozBtn.addEventListener("click", () => doDownload("mozjpeg"));
downloadJpegliBtn.addEventListener("click", () => doDownload("jpegli"));
downloadImagequantBtn.addEventListener("click", () =>
  doDownload("imagequant"),
);

// ── Arranque ──
initWorkers();
