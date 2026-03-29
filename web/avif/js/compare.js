// ── Estado de la modal de comparación ──
let compareModal = null;
let currentCompareUrls = [];
let compareScale = 1;
let compareTx = 0;
let compareTy = 0;

// ── Construcción de la modal ──
function initCompareModal() {
  if (compareModal) return;

  compareModal = document.createElement("div");
  compareModal.id = "compare-modal";
  compareModal.className = "compare-modal-overlay hidden";

  compareModal.innerHTML = `
    <div style="display:flex; flex-direction:column; height: 100%;">
      <div class="compare-header">
        <div id="compare-selectors" class="compare-selectors"></div>
        <button id="compare-close" class="compare-close-btn" title="Cerrar comparación">
          <svg><use href="../img/main.svg#errorIcon"></use></svg>
        </button>
      </div>

      <div class="compare-body" id="compare-body">
        <div class="compare-slider-container" id="compare-container">
          <div class="compare-layer compare-layer-left">
            <div class="zoom-layer" id="zoom-layer-left">
              <img id="compare-img-left" class="compare-img" alt="Imagen izquierda" />
            </div>
          </div>

          <div class="compare-layer compare-layer-right" id="compare-layer-right">
            <div class="zoom-layer" id="zoom-layer-right">
              <img id="compare-img-right" class="compare-img" alt="Imagen derecha" />
            </div>
          </div>

          <div class="compare-slider-handle" id="compare-handle">
            <div class="compare-slider-hitarea" id="compare-slider-hitarea"></div>
            <div class="compare-slider-line"></div>
            <div class="compare-slider-button">
              <svg><use href="../img/main.svg#compareIcon"></use></svg>
            </div>
          </div>

          <div class="compare-labels-container">
            <div class="compare-label" id="compare-label-left">Original</div>
            <div class="compare-label" id="compare-label-right">AVIF</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(compareModal);
  attachCompareModalEvents();
}

// ── Eventos del modal ──
function attachCompareModalEvents() {
  document
    .getElementById("compare-close")
    .addEventListener("click", closeCompareModal);

  document.addEventListener("keydown", handleEscapeKey);
  attachInteractionEvents();
}

function handleEscapeKey(e) {
  if (
    e.key === "Escape" &&
    compareModal &&
    !compareModal.classList.contains("hidden")
  ) {
    closeCompareModal();
  }
}

// ── Lógica de interacción (slider + paneo + zoom) ──
function attachInteractionEvents() {
  const container = document.getElementById("compare-container");
  const layerRight = document.getElementById("compare-layer-right");
  const zoomLayerLeft = document.getElementById("zoom-layer-left");
  const zoomLayerRight = document.getElementById("zoom-layer-right");
  const handle = document.getElementById("compare-handle");

  let isDraggingSlider = false;
  let isPanning = false;
  let lastPanX = 0;
  let lastPanY = 0;

  const applyTransform = () => {
    const transformStr = `translate(${compareTx}px, ${compareTy}px) scale(${compareScale})`;
    zoomLayerLeft.style.transform = transformStr;
    zoomLayerRight.style.transform = transformStr;
  };

  const updateSlider = (clientX) => {
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;

    layerRight.style.clipPath = `polygon(${percent}% 0, 100% 0, 100% 100%, ${percent}% 100%)`;
    handle.style.left = `${percent}%`;
  };

  const getClientCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const startInteraction = (e) => {
    if (
      e.target.tagName.toLowerCase() === "select" ||
      e.target.closest("button")
    )
      return;

    const { x, y } = getClientCoords(e);

    if (
      e.target.id === "compare-slider-hitarea" ||
      e.target.closest(".compare-slider-button")
    ) {
      isDraggingSlider = true;
      updateSlider(x);
    } else {
      isPanning = true;
      lastPanX = x;
      lastPanY = y;
    }
  };

  const moveInteraction = (e) => {
    if (!isDraggingSlider && !isPanning) return;

    const { x, y } = getClientCoords(e);

    if (isDraggingSlider) {
      updateSlider(x);
    } else if (isPanning) {
      compareTx += x - lastPanX;
      compareTy += y - lastPanY;
      lastPanX = x;
      lastPanY = y;
      applyTransform();
    }
  };

  const stopInteraction = () => {
    isDraggingSlider = false;
    isPanning = false;
  };

  const handleZoom = (e) => {
    e.preventDefault();

    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = 1 - e.deltaY * 0.0015;
    const newScale = Math.max(1, Math.min(compareScale * zoomFactor, 15));

    if (newScale === compareScale) return;

    if (newScale === 1) {
      compareTx = 0;
      compareTy = 0;
    } else {
      compareTx = cursorX - (cursorX - compareTx) * (newScale / compareScale);
      compareTy = cursorY - (cursorY - compareTy) * (newScale / compareScale);
    }

    compareScale = newScale;
    applyTransform();
  };

  container.addEventListener("mousedown", startInteraction);
  window.addEventListener("mousemove", moveInteraction);
  window.addEventListener("mouseup", stopInteraction);

  container.addEventListener("touchstart", startInteraction, { passive: true });
  window.addEventListener("touchmove", moveInteraction, { passive: true });
  window.addEventListener("touchend", stopInteraction);

  container.addEventListener("wheel", handleZoom, { passive: false });
}

// ── Apertura y cierre ──
function closeCompareModal() {
  if (!compareModal) return;

  compareModal.classList.add("hidden");
  document.body.style.overflow = "";

  currentCompareUrls.forEach((url) => URL.revokeObjectURL(url));
  currentCompareUrls = [];
}

// Crea una URL de objeto temporal para AVIF y la registra para liberar al cerrar
function getTempAvifUrl(buffer) {
  const url = URL.createObjectURL(new Blob([buffer], { type: "image/avif" }));
  currentCompareUrls.push(url);
  return url;
}

function openCompareModal(fileId) {
  // filesData es global en main.js
  const file = filesData?.find((f) => f.id === fileId);
  if (!file) {
    console.warn(
      `openCompareModal: no se encontró el archivo con id "${fileId}"`,
    );
    return;
  }

  const versions = buildVersions(file);
  if (versions.length < 2) {
    console.warn(
      "openCompareModal: se necesitan al menos 2 versiones para comparar",
    );
    return;
  }

  initCompareModal();
  renderSelectors(versions);
  compareModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  resetSliderState();
}

// ── Construcción de versiones comparables ──
function buildVersions(file) {
  const versions = [
    {
      id: "orig",
      name: "Original",
      // El previewUrl apunta al JPEG/PNG original
      url: file.previewUrl,
      size: file.originalSize,
      originalSize: file.originalSize,
      mimeType: file.originalFile.type,
    },
  ];

  if (file.avifBuffer) {
    versions.push({
      id: "avif",
      name: "AVIF",
      url: getTempAvifUrl(file.avifBuffer),
      size: file.avifSize,
      originalSize: file.originalSize,
      mimeType: "image/avif",
    });
  }

  return versions;
}

// ── Selectores de modo de comparación ──
function renderSelectors(versions) {
  const selectorsContainer = document.getElementById("compare-selectors");
  selectorsContainer.innerHTML = "";

  const label = document.createElement("span");
  label.className = "compare-mode-label";
  label.textContent = `${versions[0].name} vs ${versions[1].name}`;
  selectorsContainer.appendChild(label);
  setImages(versions[0], versions[1]);
}

// ── Reseteo del estado visual del modal ──
function resetSliderState() {
  const layerRight = document.getElementById("compare-layer-right");
  const handle = document.getElementById("compare-handle");
  const zoomLayerLeft = document.getElementById("zoom-layer-left");
  const zoomLayerRight = document.getElementById("zoom-layer-right");

  if (layerRight)
    layerRight.style.clipPath = "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)";
  if (handle) handle.style.left = "50%";

  compareScale = 1;
  compareTx = 0;
  compareTy = 0;

  const identityTransform = "translate(0px, 0px) scale(1)";
  if (zoomLayerLeft) zoomLayerLeft.style.transform = identityTransform;
  if (zoomLayerRight) zoomLayerRight.style.transform = identityTransform;
}

// ── Actualización de imágenes y etiquetas ──
function setImages(leftVer, rightVer) {
  const imgLeft = document.getElementById("compare-img-left");
  const imgRight = document.getElementById("compare-img-right");
  const labelLeft = document.getElementById("compare-label-left");
  const labelRight = document.getElementById("compare-label-right");

  if (!imgLeft || !imgRight || !labelLeft || !labelRight) return;

  imgLeft.src = leftVer.url;
  imgRight.src = rightVer.url;

  labelLeft.innerHTML = buildLabel(leftVer);
  labelRight.innerHTML = buildLabel(rightVer);
}

// Genera el HTML de una etiqueta con nombre y tamaño
function buildLabel(ver) {
  const toKB = (b) => (b / 1024).toFixed(2) + " KB";

  if (ver.id === "orig") {
    return `<div class="compare-label-title">${ver.name}</div>
            <div class="compare-label-size">${toKB(ver.size)}</div>`;
  }

  const pct = ((1 - ver.size / ver.originalSize) * 100).toFixed(1);
  return `<div class="compare-label-title">${ver.name}</div>
          <div class="compare-label-size">${toKB(ver.size)} (-${pct}%)</div>`;
}

// ── Exposición pública ──
window.openCompareModal = openCompareModal;
