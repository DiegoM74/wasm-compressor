// IMPORTANTE: var es obligatorio para Module — Emscripten busca Module en self
var Module = {
  onRuntimeInitialized: function () {
    wasmReady = true;
    console.log("MozJPEG WASM listo");
    self.postMessage({ type: "ready" });
  },
};

// importScripts DESPUÉS de definir Module para que Emscripten lo detecte
importScripts("./encoder.js");

let wasmReady = false;

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

    // Leer struct CompressedResult { unsigned char* data; int size; }
    // En wasm32: puntero = 4 bytes, int = 4 bytes → offsets 0 y 4
    const dataPtr =
      heap[resultStructPtr] |
      (heap[resultStructPtr + 1] << 8) |
      (heap[resultStructPtr + 2] << 16) |
      (heap[resultStructPtr + 3] << 24);

    const size =
      heap[resultStructPtr + 4] |
      (heap[resultStructPtr + 5] << 8) |
      (heap[resultStructPtr + 6] << 16) |
      (heap[resultStructPtr + 7] << 24);

    if (!dataPtr || size <= 0) {
      Module._free(inputPtr);
      throw new Error(
        `compress_image devolvió datos inválidos (ptr=${dataPtr}, size=${size})`,
      );
    }

    // slice() crea una copia propia del buffer, necesaria para poder transferirla
    const outputBuffer = heap.slice(dataPtr, dataPtr + size);

    Module._free(inputPtr);

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
