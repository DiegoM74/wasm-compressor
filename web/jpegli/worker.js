// self.Module es obligatorio, Emscripten busca Module en el objeto global del worker
self.Module = {
  onRuntimeInitialized: function () {
    self.wasmReady = true;
    self.postMessage({ type: "ready" });
  },
};

// importScripts DESPUÉS de definir Module para que Emscripten lo detecte
importScripts("./encoder.js");

self.onmessage = function (e) {
  if (!self.wasmReady) {
    self.postMessage({ type: "error", message: "WASM no inicializado" });
    return;
  }

  const { imageBuffer, config } = e.data;

  // Validaciones tempranas
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    self.postMessage({ type: "error", message: "Buffer vacío" });
    return;
  }
  const magic = new Uint8Array(imageBuffer, 0, 2);
  if (magic[0] !== 0xff || magic[1] !== 0xd8) {
    self.postMessage({ type: "error", message: "No es un JPEG válido" });
    return;
  }

  try {
    const inputPtr = self.Module._malloc(imageBuffer.byteLength);
    if (!inputPtr) throw new Error("malloc falló (sin memoria)");

    new Uint8Array(self.Module.HEAPU8.buffer).set(
      new Uint8Array(imageBuffer),
      inputPtr,
    );

    // ccall convierte correctamente el argumento float (distance).
    // El orden de parámetros debe coincidir exactamente con la firma C++.
    const resultStructPtr = self.Module.ccall(
      "compress_image_jpegli",
      "number",
      [
        "number", // input_buffer (ptr)
        "number", // input_size
        "number", // quality
        "number", // distance (float — ccall lo convierte correctamente)
        "number", // use_distance
        "number", // use_standard_tables
        "number", // xyb_mode
        "number", // cicp_transfer_function
        "number", // progressive_level
        "number", // subsampling
        "number", // optimize_coding
        "number", // smoothing_factor
        "number", // dct_method
        "number", // baseline
        "number", // adaptive_quantization
        "number", // write_jfif
      ],
      [
        inputPtr,
        imageBuffer.byteLength,
        config.quality,
        config.use_distance ? config.distance : 1.0,
        config.use_distance ? 1 : 0,
        config.use_standard_tables ? 1 : 0,
        config.xyb_mode ? 1 : 0,
        config.cicp_transfer_function,
        config.progressive_level,
        config.subsampling,
        config.optimize_coding ? 1 : 0,
        config.smoothing_factor,
        config.dct_method,
        config.baseline ? 1 : 0,
        config.adaptive_quantization ? 1 : 0,
        config.write_jfif ? 1 : 0,
      ],
    );

    // Releer el heap DESPUÉS de ccall: la memoria pudo haber crecido durante la compresión
    const heap = new Uint8Array(self.Module.HEAPU8.buffer);

    if (!resultStructPtr) {
      self.Module._free(inputPtr);
      throw new Error("compress_image_jpegli devolvió null");
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
      self.Module._free(inputPtr);
      throw new Error(
        `compress_image_jpegli devolvió datos inválidos (ptr=${dataPtr}, size=${size})`,
      );
    }

    // slice() crea una copia propia del buffer, necesaria para poder transferirla
    const outputBuffer = heap.slice(dataPtr, dataPtr + size);

    self.Module._free(inputPtr);

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
    console.error("Jpegli error:", err);
    self.postMessage({ type: "error", message: err.message });
  }
};
