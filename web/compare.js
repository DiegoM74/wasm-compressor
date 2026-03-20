let compareModal = null;
let currentCompareUrls = [];
let compareScale = 1;
let compareTx = 0;
let compareTy = 0;

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
          <svg><use href="img/main.svg#errorIcon"></use></svg>
        </button>
      </div>
      <div class="compare-body" id="compare-body">
        <div class="compare-slider-container" id="compare-container">
          <div class="compare-layer compare-layer-left">
            <div class="zoom-layer" id="zoom-layer-left">
              <img id="compare-img-left" class="compare-img" />
            </div>
          </div>
          <div class="compare-layer compare-layer-right" id="compare-layer-right">
            <div class="zoom-layer" id="zoom-layer-right">
              <img id="compare-img-right" class="compare-img" />
            </div>
          </div>
          
          <div class="compare-slider-handle" id="compare-handle">
            <div class="compare-slider-hitarea" id="compare-slider-hitarea"></div>
            <div class="compare-slider-line"></div>
            <div class="compare-slider-button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 8l-4 4 4 4m8-8 4 4-4 4" />
              </svg>
            </div>
          </div>
          
          <div class="compare-labels-container">
             <div class="compare-label" id="compare-label-left">Original</div>
             <div class="compare-label" id="compare-label-right">Comprimido</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(compareModal);

  // Cerrar modal al clickear fuera, botones o en el close
  compareModal.addEventListener("click", (e) => {
    // Si se clickea el background puro (".compare-modal-overlay" o ".compare-body") cerramos.
    // Ignoramos 'compare-container' porque es donde arrastramos el slider.
    if (e.target === compareModal || e.target.id === "compare-body") {
      closeCompareModal();
    }
  });

  document
    .getElementById("compare-close")
    .addEventListener("click", closeCompareModal);

  // Lógica del slider y zoom
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
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const percent = (x / rect.width) * 100;

    layerRight.style.clipPath = `polygon(${percent}% 0, 100% 0, 100% 100%, ${percent}% 100%)`;
    handle.style.left = `${percent}%`;
  };

  const startInteraction = (e) => {
    if (
      e.target.tagName.toLowerCase() === "select" ||
      e.target.closest("button")
    )
      return;

    const clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

    if (
      e.target.id === "compare-slider-hitarea" ||
      e.target.closest(".compare-slider-button")
    ) {
      isDraggingSlider = true;
      updateSlider(clientX);
    } else {
      isPanning = true;
      lastPanX = clientX;
      lastPanY = clientY;
    }
  };

  const moveInteraction = (e) => {
    if (!isDraggingSlider && !isPanning) return;

    const clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

    if (isDraggingSlider) {
      updateSlider(clientX);
    } else if (isPanning) {
      const dx = clientX - lastPanX;
      const dy = clientY - lastPanY;
      compareTx += dx;
      compareTy += dy;
      lastPanX = clientX;
      lastPanY = clientY;
      applyTransform();
    }
  };

  const stopInteraction = () => {
    isDraggingSlider = false;
    isPanning = false;
  };

  const handleZoom = (e) => {
    e.preventDefault(); // prevenir scroll real de la página por si a caso

    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomSpeed = 0.0015;
    const zoomFactor = 1 - e.deltaY * zoomSpeed;

    let newScale = compareScale * zoomFactor;
    newScale = Math.max(1, Math.min(newScale, 15)); // Limitar zoom entre 1x y 15x

    if (newScale === 1) {
      // Si volvemos a x1, resetear paneo al centro
      compareTx = 0;
      compareTy = 0;
    } else if (newScale !== compareScale) {
      // Math: x' = x - (x - tx) * (newScale / scale)
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

  // Evento de zoom
  container.addEventListener("wheel", handleZoom, { passive: false });
}

function closeCompareModal() {
  if (compareModal) {
    compareModal.classList.add("hidden");
  }
  document.body.style.overflow = ""; // Restaurar scroll de la página original

  // Limpiar URLs temporales para evitar pérdida de memoria
  currentCompareUrls.forEach((url) => URL.revokeObjectURL(url));
  currentCompareUrls = [];
}

function getTempUrl(buffer) {
  const url = URL.createObjectURL(new Blob([buffer], { type: "image/jpeg" }));
  currentCompareUrls.push(url);
  return url;
}

function openCompareModal(fileId) {
  initCompareModal();

  // filesData es global en main.js
  const file = filesData.find((f) => f.id === fileId);
  if (!file) return;

  const versions = [];
  versions.push({ id: "orig", name: "Original", url: file.previewUrl });

  if (file.mozjpegBuffer) {
    versions.push({
      id: "mozjpeg",
      name: "MozJPEG",
      url: getTempUrl(file.mozjpegBuffer),
    });
  }
  if (file.jpegliBuffer) {
    versions.push({
      id: "jpegli",
      name: "Jpegli",
      url: getTempUrl(file.jpegliBuffer),
    });
  }

  // Si no hay versiones comprimidas, no abrir (aunque el botón debería estar deshabilitado)
  if (versions.length < 2) return;

  const selectorsContainer = document.getElementById("compare-selectors");
  selectorsContainer.innerHTML = "";

  let leftVer = versions[0];
  let rightVer = versions[1];

  if (versions.length > 2) {
    // Si tenemos 3 versiones, creamos un selector
    const select = document.createElement("select");
    select.className = "compare-mode-select";

    const options = [
      {
        value: "orig-moz",
        text: "Original vs MozJPEG",
        left: versions[0],
        right: versions.find((v) => v.id === "mozjpeg"),
      },
      {
        value: "orig-jpegli",
        text: "Original vs Jpegli",
        left: versions[0],
        right: versions.find((v) => v.id === "jpegli"),
      },
      {
        value: "moz-jpegli",
        text: "MozJPEG vs Jpegli",
        left: versions.find((v) => v.id === "mozjpeg"),
        right: versions.find((v) => v.id === "jpegli"),
      },
    ];

    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.text;
      select.appendChild(option);
    });

    select.addEventListener("change", (e) => {
      const selected = options.find((o) => o.value === e.target.value);
      setImages(selected.left, selected.right);
    });

    selectorsContainer.appendChild(select);
    leftVer = options[0].left;
    rightVer = options[0].right;
  } else {
    // Si solo hay original y otra (ej. solo MozJPEG o solo Jpegli), mostrar label normal
    const label = document.createElement("span");
    label.className = "compare-mode-label";
    label.textContent = `${versions[0].name} vs ${versions[1].name}`;
    selectorsContainer.appendChild(label);

    leftVer = versions[0];
    rightVer = versions[1];
  }

  setImages(leftVer, rightVer);
  compareModal.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // Deshabilitar scroll en el fondo

  // Reiniciar estado del slider y transform
  document.getElementById("compare-layer-right").style.clipPath =
    "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)";
  document.getElementById("compare-handle").style.left = "50%";

  // Reiniciar variables estado y transform
  compareScale = 1;
  compareTx = 0;
  compareTy = 0;

  const zoomLayerLeft = document.getElementById("zoom-layer-left");
  const zoomLayerRight = document.getElementById("zoom-layer-right");
  if (zoomLayerLeft && zoomLayerRight) {
    zoomLayerLeft.style.transform = "translate(0px, 0px) scale(1)";
    zoomLayerRight.style.transform = "translate(0px, 0px) scale(1)";
  }
}

function setImages(leftVer, rightVer) {
  const imgLeft = document.getElementById("compare-img-left");
  const imgRight = document.getElementById("compare-img-right");
  const labelLeft = document.getElementById("compare-label-left");
  const labelRight = document.getElementById("compare-label-right");

  imgLeft.src = leftVer.url;
  imgRight.src = rightVer.url;
  labelLeft.textContent = leftVer.name;
  labelRight.textContent = rightVer.name;
}

// Hacerlo disponible para eventos inline o llamadas desde main.js
window.openCompareModal = openCompareModal;
