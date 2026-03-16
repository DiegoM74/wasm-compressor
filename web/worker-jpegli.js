// Configurar el objeto Module antes de importar el script
self.Module = {
  onRuntimeInitialized: function () {
    self.wasmReady = true;
    console.log("Jpegli WASM ready");
    self.postMessage({ type: "ready" });
  },
};

importScripts("./jpegli_encoder.js");

self.onmessage = function (e) {
  if (!self.wasmReady) {
    self.postMessage({ type: "error", message: "WASM not initialized" });
    return;
  }

  const { imageBuffer, config } = e.data;

  if (!imageBuffer || imageBuffer.byteLength === 0) {
    self.postMessage({ type: "error", message: "Empty buffer" });
    return;
  }

  // Validación rápida de JPEG
  const firstBytes = new Uint8Array(imageBuffer, 0, 2);
  if (firstBytes[0] !== 0xff || firstBytes[1] !== 0xd8) {
    self.postMessage({ type: "error", message: "Not a JPEG" });
    return;
  }

  try {
    const heap = () => new Uint8Array(self.Module.wasmMemory.buffer);
    const inputPtr = self.Module._malloc(imageBuffer.byteLength);
    heap().set(new Uint8Array(imageBuffer), inputPtr);

    // Llamar con ccall para pasar correctamente el argumento float (distance).
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
      ],
      [
        inputPtr,
        imageBuffer.byteLength,
        config.quality,
        config.use_distance ? config.distance : 1.0,  // valor ignorado si use_distance=0
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
      ]
    );

    // Re-leer heap después de ccall por si la memoria creció durante la compresión
    const heapAfter = new Uint8Array(self.Module.wasmMemory.buffer);
    const dataPtr =
      heapAfter[resultStructPtr    ]         |
      (heapAfter[resultStructPtr + 1] << 8)  |
      (heapAfter[resultStructPtr + 2] << 16) |
      (heapAfter[resultStructPtr + 3] << 24);
    const size =
      heapAfter[resultStructPtr + 4]         |
      (heapAfter[resultStructPtr + 5] << 8)  |
      (heapAfter[resultStructPtr + 6] << 16) |
      (heapAfter[resultStructPtr + 7] << 24);

    const outputBuffer = new Uint8Array(size);
    outputBuffer.set(heapAfter.subarray(dataPtr, dataPtr + size));

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
    console.error("Jpegli Error:", err);
    self.postMessage({ type: "error", message: err.message });
  }
};