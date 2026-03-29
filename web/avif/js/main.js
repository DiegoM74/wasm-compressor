// ── Elementos del DOM ──
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const compressBtn = document.getElementById("compress-btn");
const downloadBtn = document.getElementById("download-btn");
const statusText = document.getElementById("status");
const statsDiv = document.getElementById("stats");
const imageList = document.getElementById("image-list");
const statusPillAvif = document.getElementById("status-libavif");
const listActions = document.getElementById("list-actions");
const clearAllBtn = document.getElementById("clear-all-btn");

// ── Configuración por defecto de libavif ──
let avifConfig = {
  quality: 25, // 0 = lossless, 100 = worst (libavif usa 0-100 donde 0 es mejor)
  qualityAlpha: -1, // -1 = mismo que quality
  speed: 6, // 0 = más lento/mejor, 10 = más rápido
  chromaSubsampling: 1, // 0=4:4:4  1=4:2:0  2=4:2:2  3=4:0:0
  bitDepth: 8, // 8 o 10
  lossless: false, // si true ignora quality
  tiling: false, // segmentar imagen en tiles (útil para imágenes grandes)
  tileRowsLog2: 0, // 0-6 cuando tiling=true
  tileColsLog2: 0, // 0-6 cuando tiling=true
};

// ── Estado global ──
let filesData = [];
let workerAvif = null;
let isCompressing = false;
let isAvifReady = false;
let avifHasError = false;

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
    icon.setAttribute("href", "../img/main.svg#checkIcon");
    span.textContent = `${name} disponible`;
  } else if (hasError) {
    pill.classList.add("error");
    icon.setAttribute("href", "../img/main.svg#errorIcon");
    span.textContent = `${name} no disponible`;
  } else {
    pill.classList.add("loading");
    icon.setAttribute("href", "../img/main.svg#refreshIcon");
    span.textContent = `${name} cargando...`;
  }
}

function updateUI() {
  updateLibPill(statusPillAvif, isAvifReady, avifHasError, "libavif");

  const validFiles = filesData.filter((f) => !f.isUnsupported);
  const hasFiles = validFiles.length > 0;

  if (!isCompressing) {
    compressBtn.disabled = !(hasFiles && isAvifReady);
  }

  downloadBtn.disabled = !validFiles.some((f) => f.avifBuffer) || isCompressing;

  listActions.style.display = filesData.length > 0 ? "flex" : "none";
  clearAllBtn.disabled = isCompressing;

  document.querySelectorAll(".image-item").forEach((item) => {
    const id = item.id.replace("item-", "");
    const f = filesData.find((file) => file.id === id);
    if (!f) return;

    const actionsDiv = item.querySelector(".item-actions");
    if (actionsDiv) {
      const compareBtn = actionsDiv.querySelector(".compare-btn");
      const deleteBtn = actionsDiv.querySelector(".delete-btn");
      if (compareBtn) compareBtn.disabled = isCompressing || !f.avifBuffer;
      if (deleteBtn) deleteBtn.disabled = isCompressing;
    }
  });

  document.querySelectorAll(".unsupported-item .delete-btn").forEach((btn) => {
    btn.disabled = isCompressing;
  });

  updateTotalStats(validFiles);
}

// ── Stats globales ──
function updateTotalStats(validFiles) {
  let totalOriginal = 0;
  let totalAvif = 0;
  let hasAvif = false;

  for (const f of validFiles) {
    totalOriginal += f.originalSize;
    if (f.avifSize) {
      totalAvif += f.avifSize;
      hasAvif = true;
    }
  }

  if (totalOriginal === 0) {
    statsDiv.innerHTML = "";
    return;
  }

  const toMB = (b) => (b / (1024 * 1024)).toFixed(2);
  const toPct = (b) => ((1 - b / totalOriginal) * 100).toFixed(1);

  let html = `<b>Total Original</b>: ${toMB(totalOriginal)} MB<br/>`;
  if (hasAvif)
    html += `<span style="color:var(--accent-secondary)">AVIF</span>: ${toMB(totalAvif)} MB | <b>Ahorro</b>: ${toPct(totalAvif)}%<br/>`;

  statsDiv.innerHTML = html;
}

// ── Worker ──
function initWorker() {
  const v = Date.now();
  workerAvif = new Worker(`./worker.js?v=${v}`);

  workerAvif.onmessage = (e) => {
    if (e.data.type === "ready") {
      isAvifReady = true;
      updateUI();
    } else if (e.data.type === "error" && !e.data.fileId) {
      // Error de inicialización
      console.error("libavif worker error:", e.data.message);
      avifHasError = true;
      updateUI();
    }
  };

  workerAvif.onerror = (e) => {
    console.error("libavif worker error:", e);
    avifHasError = true;
    updateUI();
  };

  updateUI();
}

// ── Conversión + Compresión con libavif ──
function compressImageAvif(file) {
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      if (e.data.type !== "done" && e.data.type !== "error") return;
      if (e.data.fileId !== file.id) return;
      workerAvif.removeEventListener("message", handler);

      if (e.data.type === "done") {
        resolve({
          buffer: e.data.buffer,
          originalSize: e.data.originalSize,
          compressedSize: e.data.compressedSize,
        });
      } else {
        reject(new Error(e.data.message));
      }
    };

    workerAvif.addEventListener("message", handler);

    // Enviamos el ArrayBuffer original; el worker decodificará PNG/JPEG
    // usando OffscreenCanvas y luego comprimirá con libavif WASM
    workerAvif.postMessage(
      {
        type: "compress",
        fileId: file.id,
        fileName: file.originalFile.name,
        mimeType: file.originalFile.type,
        imageBuffer: file.originalBuffer.slice(0),
        config: { ...avifConfig },
      },
      [file.originalBuffer.slice(0)],
    );
  });
}

// ── Manejo de archivos ──
function handleFiles(newFiles) {
  if (isCompressing) return;

  for (const file of newFiles) {
    const fileId = crypto.randomUUID();

    const isJpeg = file.type === "image/jpeg";
    const isPng = file.type === "image/png";

    if (!isJpeg && !isPng) {
      filesData.push({
        id: fileId,
        originalFile: file,
        isUnsupported: true,
        errorMessage: `Omitido "${file.name}": solo se aceptan PNG y JPEG`,
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
        avifBuffer: null,
        avifSize: null,
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
  if (f.avifPreviewUrl) URL.revokeObjectURL(f.avifPreviewUrl);
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
    img.alt = file.originalFile.name;

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
    compareBtn.disabled = isCompressing || !file.avifBuffer;
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
  if (file.avifSize) {
    html += `<span><b>AVIF: ${toKB(file.avifSize)} KB</b> (-${toPct(file.avifSize)}%)</span>`;
  }
  html += `</div>`;

  statsEl.innerHTML = html;

  const actionsDiv = item.querySelector(".item-actions");
  if (actionsDiv) {
    const compareBtn = actionsDiv.querySelector(".compare-btn");
    if (compareBtn) compareBtn.disabled = isCompressing || !file.avifBuffer;
  }
}

// ── Compresión ──
async function doCompression() {
  const validFiles = filesData.filter((f) => !f.isUnsupported);
  if (validFiles.length === 0) return;

  isCompressing = true;
  updateUI();

  let successCount = 0;

  for (let i = 0; i < validFiles.length; i++) {
    const f = validFiles[i];
    updateStatus(
      `Convirtiendo y comprimiendo (${i + 1}/${validFiles.length}): ${f.originalFile.name}...`,
      "warning",
    );

    try {
      const result = await compressImageAvif(f);
      f.avifBuffer = result.buffer;
      f.avifSize = result.compressedSize;

      // Crear URL de previsualización del AVIF resultante
      if (f.avifPreviewUrl) URL.revokeObjectURL(f.avifPreviewUrl);
      f.avifPreviewUrl = URL.createObjectURL(
        new Blob([f.avifBuffer], { type: "image/avif" }),
      );

      successCount++;
      updateFileDOM(f);
    } catch (err) {
      console.error(`Error al procesar "${f.originalFile.name}":`, err);
    }
  }

  isCompressing = false;
  updateUI();

  if (successCount > 0) {
    updateStatus(
      `¡Completado! ${successCount} de ${validFiles.length} imágenes convertidas a AVIF.`,
      "success",
    );
  } else {
    updateStatus("Ocurrió un error al comprimir las imágenes.", "error");
    renderList();
  }
}

// ── Descarga ──
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toAvifName(originalName) {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base}.avif`;
}

async function doDownload() {
  const filesToDownload = filesData
    .filter((f) => f.avifBuffer)
    .map((f) => ({
      name: toAvifName(f.originalFile.name),
      buffer: f.avifBuffer,
    }));

  if (filesToDownload.length === 0) return;

  if (filesToDownload.length === 1) {
    const f = filesToDownload[0];
    const url = URL.createObjectURL(
      new Blob([f.buffer], { type: "image/avif" }),
    );
    triggerDownload(url, f.name);
    return;
  }

  updateStatus("Generando ZIP...", "warning");
  try {
    const zip = new JSZip();
    filesToDownload.forEach((f) => zip.file(f.name, f.buffer));
    const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    triggerDownload(url, "compressed-avif.zip");
    updateStatus("¡ZIP descargado!", "success");
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
    if (f.avifPreviewUrl) URL.revokeObjectURL(f.avifPreviewUrl);
  });
  filesData = [];
  renderList();
  updateUI();
  updateStatus("Esperando imágenes...", "default");
});

compressBtn.addEventListener("click", () => doCompression());
downloadBtn.addEventListener("click", () => doDownload());

// ── Arranque ──
initWorker();
