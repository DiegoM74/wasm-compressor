// IMPORTANTE: var es obligatorio para Module — Emscripten busca Module en self
var Module = {
  onRuntimeInitialized: function () {
    wasmReady = true;
    self.postMessage({ type: "ready" });
  },
};

// importScripts DESPUÉS de definir Module para que Emscripten lo detecte
importScripts("./encoder.js");

let wasmReady = false;

// Lee struct CompressedResult { unsigned char* data; int size; } del heap WASM (wasm32 Little-Endian)
function readCompressedResult(heap, ptr) {
  const dataPtr =
    heap[ptr] |
    (heap[ptr + 1] << 8) |
    (heap[ptr + 2] << 16) |
    (heap[ptr + 3] << 24);
  const size =
    heap[ptr + 4] |
    (heap[ptr + 5] << 8) |
    (heap[ptr + 6] << 16) |
    (heap[ptr + 7] << 24);
  return { dataPtr, size };
}

// ── Arquitectura del Worker MozJPEG ──
// Recibe parámetros de compresión planos en e.data junto al ArrayBuffer de la imagen.
// Reserva memoria en el heap WASM (_malloc), ejecuta _compress_image y lee el resultado
// del struct global en memoria WASM antes de retornar una copia del buffer mediante
// postMessage transferible ([outputBuffer.buffer]).
self.onmessage = function (e) {
  if (!wasmReady) {
    self.postMessage({ type: "error", message: "WASM no inicializado" });
    return;
  }

  const { imageBuffer } = e.data;

  // Validaciones tempranas antes de extraer el resto de parámetros
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    self.postMessage({ type: "error", message: "Buffer vacío" });
    return;
  }
  const magic = new Uint8Array(imageBuffer, 0, 2);
  if (magic[0] !== 0xff || magic[1] !== 0xd8) {
    self.postMessage({ type: "error", message: "No es un JPEG válido" });
    return;
  }

  // ── Parámetros con valores por defecto ──
  const {
    // Estándar libjpeg
    quality = 85,
    progressive = 1,
    optimize_coding = 1,
    smoothing = 0, // 0–100
    chroma_subsample = 2, // 0=4:4:4  1=4:2:2  2=4:2:0
    write_jfif = 1,
    // Nuevos parámetros estándar y avanzados
    dct_method = 0, // 0=ISLOW, 1=IFAST, 2=FLOAT
    do_fancy_downsampling = 1,
    grayscale = 0,
    quant_baseline = 1,
    restart_in_rows = 0,
    write_adobe_marker = 0,
    separate_chroma_quality = 0,
    chroma_quality = 75,
    // Booleanos MozJPEG
    trellis = 1,
    trellis_dc = 1,
    trellis_eob_opt = 1,
    use_scans_in_trellis = 0,
    trellis_q_opt = 0,
    overshoot_deringing = 1,
    optimize_scans = 1,
    // Enteros MozJPEG
    base_quant_tbl = 0, // 0–8
    trellis_freq_split = 8,
    trellis_num_loops = 1,
    dc_scan_opt_mode = 1, // 0/1/2
    // Flotantes opcionales (null = usar default interno de MozJPEG)
    lambda_log_scale1 = null,
    lambda_log_scale2 = null,
    trellis_delta_dc_weight = null,
  } = e.data;

  // Los flotantes se pasan ×100 como enteros para evitar problemas con el ABI
  // de float en WASM. -1 indica al C++ que use su propio default interno.
  const toX100 = (v) => (v != null ? Math.round(v * 100) : -1);
  const lambda_log_scale1_x100 = toX100(lambda_log_scale1);
  const lambda_log_scale2_x100 = toX100(lambda_log_scale2);
  const trellis_delta_dc_weight_x100 = toX100(trellis_delta_dc_weight);

  try {
    const inputPtr = Module._malloc(imageBuffer.byteLength);
    if (!inputPtr) throw new Error("malloc falló (sin memoria)");

    new Uint8Array(Module.wasmMemory.buffer).set(
      new Uint8Array(imageBuffer),
      inputPtr,
    );

    const resultStructPtr = Module._compress_image(
      inputPtr,
      imageBuffer.byteLength,
      quality,
      progressive,
      optimize_coding,
      smoothing,
      chroma_subsample,
      write_jfif,
      // Nuevos parámetros estándar / avanzados
      dct_method,
      do_fancy_downsampling,
      grayscale,
      quant_baseline,
      restart_in_rows,
      write_adobe_marker,
      separate_chroma_quality,
      chroma_quality,
      // Booleanos MozJPEG
      trellis,
      trellis_dc,
      trellis_eob_opt,
      use_scans_in_trellis,
      trellis_q_opt,
      overshoot_deringing,
      optimize_scans,
      // Enteros MozJPEG
      base_quant_tbl,
      trellis_freq_split,
      trellis_num_loops,
      dc_scan_opt_mode,
      // Flotantes MozJPEG (×100)
      lambda_log_scale1_x100,
      lambda_log_scale2_x100,
      trellis_delta_dc_weight_x100,
    );

    // Releer el heap DESPUÉS de compress_image: la memoria pudo haber crecido
    const heap = new Uint8Array(Module.wasmMemory.buffer);

    if (!resultStructPtr) {
      Module._free(inputPtr);
      throw new Error("compress_image devolvió null");
    }

    const { dataPtr, size } = readCompressedResult(heap, resultStructPtr);

    if (!dataPtr || size <= 0) {
      Module._free(inputPtr);
      if (dataPtr) Module._free_result_data(dataPtr);
      throw new Error(
        `compress_image devolvió datos inválidos (ptr=${dataPtr}, size=${size})`,
      );
    }

    // slice() crea una copia propia del buffer, necesaria para poder transferirla
    const outputBuffer = heap.slice(dataPtr, dataPtr + size);

    Module._free(inputPtr);
    Module._free_result_data(dataPtr);

    self.postMessage(
      {
        type: "done",
        buffer: outputBuffer.buffer,
        originalSize: imageBuffer.byteLength,
        compressedSize: size,
      },
      [outputBuffer.buffer],
    );
  } catch (err) {
    console.error("MozJPEG error:", err);
    self.postMessage({ type: "error", message: err.message });
  }
};
