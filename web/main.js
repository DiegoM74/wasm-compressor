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

let filesData = []; 
let workerMoz = null;
let isCompressing = false;
let isMozReady = false;
let isJpegliReady = false; // Simulated as false for now, since it's not ready

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
    workerMoz.onmessage = (e) => {
      if (e.data.type === "done") {
        resolve({
          buffer: e.data.buffer,
          originalSize: e.data.originalSize,
          compressedSize: e.data.compressedSize,
        });
      } else if (e.data.type === "error") {
        reject(new Error(e.data.message));
      } else if (e.data.type === "ready") {
        // Ignore
      }
    };
    workerMoz.onerror = (e) => reject(e);
    workerMoz.postMessage({
      imageBuffer: buffer,
      quality: 84,
      progressive: 1,
    });
  });
}

// Simulacion de Jpegli para un futuro
function compressImageJpegli(buffer) {
  return new Promise((resolve, reject) => {
    if (!isJpegliReady) reject(new Error("Jpegli no está disponible"));
    // Aquí iría el código cuando Jpegli esté listo
    reject(new Error("No implementado aún"));
  });
}

function initWorkers() {
  const workerUrl = "./worker.js?v=" + Date.now();
  workerMoz = new Worker(workerUrl);
  workerMoz.onmessage = (e) => {
    if (e.data.type === "ready") {
      isMozReady = true;
      checkWorkerStatus();
      updateButtonsState();
    }
  };
  
  // Future Jpegli worker init here
  isJpegliReady = false; 
  checkWorkerStatus();
  updateButtonsState();
}

initWorkers();

function updateButtonsState() {
  const validFiles = filesData.filter((f) => !f.isUnsupported);
  const hasFiles = validFiles.length > 0;
  
  if (!isCompressing) {
    if (isMozReady || isJpegliReady) compressBtn.disabled = !hasFiles;
    compressMozBtn.disabled = !(hasFiles && isMozReady);
    compressJpegliBtn.disabled = !(hasFiles && isJpegliReady);
  }
  
  const hasMoz = validFiles.some(f => f.mozjpegBuffer);
  const hasJpegli = validFiles.some(f => f.jpegliBuffer);
  const hasBest = validFiles.some(f => f.bestBuffer);
  
  if (filesData.length > 0) {
    listActions.style.display = 'flex';
  } else {
    listActions.style.display = 'none';
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
    filesData.forEach(f => {
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
    const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 5);

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
    
    if (f.bestSize) { totalBest += f.bestSize; hasBest = true; }
    if (f.mozjpegSize) { totalMoz += f.mozjpegSize; hasMoz = true; }
    if (f.jpegliSize) { totalJpegli += f.jpegliSize; hasJpegli = true; }
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
        const ratio = ((1 - file.bestSize / file.originalSize) * 100).toFixed(1);
        html += `<span><b>Mejor (${file.bestLib}): ${compKB} KB</b> (-${ratio}%)</span>`;
      }
      html += `</div>`;
      
      let detailsHtml = '';
      if (file.mozjpegSize) {
        const compKB = (file.mozjpegSize / 1024).toFixed(2);
        const ratio = ((1 - file.mozjpegSize / file.originalSize) * 100).toFixed(1);
        detailsHtml += `<div style="font-size:0.85em;color:var(--text-secondary)">MozJPEG: ${compKB} KB (-${ratio}%)</div>`;
      }
      
      if (file.jpegliSize) {
        const compKB = (file.jpegliSize / 1024).toFixed(2);
        const ratio = ((1 - file.jpegliSize / file.originalSize) * 100).toFixed(1);
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
    updateStatus(`Comprimiendo (${i + 1}/${validFiles.length}): ${f.originalFile.name}...`, "warning");

    try {
      if (mode === 'mozjpeg' || mode === 'general') {
        if (isMozReady) {
          const bufferCopy = f.originalBuffer.slice(0);
          const result = await compressImageMoz(bufferCopy);
          f.mozjpegBuffer = result.buffer;
          f.mozjpegSize = result.compressedSize;
        }
      }
      
      if (mode === 'jpegli' || mode === 'general') {
        if (isJpegliReady) {
          const bufferCopy = f.originalBuffer.slice(0);
          try {
             const result = await compressImageJpegli(bufferCopy);
             f.jpegliBuffer = result.buffer;
             f.jpegliSize = result.compressedSize;
          } catch(e) {
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
    updateStatus(`¡Completado! Se comprimieron ${successCount} de ${validFiles.length} imágenes.`, "success");
  } else {
    updateStatus("Ocurrió un error al comprimir las imágenes.", "error");
    renderList();
  }
}

compressBtn.addEventListener("click", () => doCompression('general'));
compressMozBtn.addEventListener("click", () => doCompression('mozjpeg'));
compressJpegliBtn.addEventListener("click", () => doCompression('jpegli'));

async function doDownload(mode) {
  let filesToDownload = [];
  
  if (mode === 'general') {
    filesToDownload = filesData.filter((f) => f.bestBuffer).map(f => ({ name: f.originalFile.name, buffer: f.bestBuffer, lib: f.bestLib }));
  } else if (mode === 'mozjpeg') {
    filesToDownload = filesData.filter((f) => f.mozjpegBuffer).map(f => ({ name: f.originalFile.name, buffer: f.mozjpegBuffer, lib: "MozJPEG" }));
  } else if (mode === 'jpegli') {
    filesToDownload = filesData.filter((f) => f.jpegliBuffer).map(f => ({ name: f.originalFile.name, buffer: f.jpegliBuffer, lib: "Jpegli" }));
  }
  
  if (filesToDownload.length === 0) return;

  if (filesToDownload.length === 1) {
    const f = filesToDownload[0];
    const originalName = f.name.substring(0, f.name.lastIndexOf(".")) || f.name;
    const suffix = f.lib ? `-${f.lib.toLowerCase()}` : '';
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
        // Podríamos añadir sufijo al archivo en el zip si queremos, o dejarlo original para reemplazar
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

downloadBtn.addEventListener("click", () => doDownload('general'));
downloadMozBtn.addEventListener("click", () => doDownload('mozjpeg'));
downloadJpegliBtn.addEventListener("click", () => doDownload('jpegli'));
