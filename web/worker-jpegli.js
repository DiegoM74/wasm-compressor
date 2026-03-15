// Configurar el objeto Module antes de importar el script
self.Module = {
  onRuntimeInitialized: function () {
    self.wasmReady = true;
    self.heapU8 = self.Module.HEAPU8;
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
    const inputPtr = self.Module._malloc(imageBuffer.byteLength);
    const imageArray = new Uint8Array(imageBuffer);
    for (let i = 0; i < imageBuffer.byteLength; i++) {
      self.heapU8[inputPtr + i] = imageArray[i];
    }

    // Llamar a la función de compresión con todos los parámetros
    const resultStructPtr = self.Module._compress_image_jpegli(
      inputPtr,
      imageBuffer.byteLength,
      config.quality,
      config.progressive_level,
      config.subsampling,
      config.optimize_coding ? 1 : 0,
      config.allow_chroma_gray ? 1 : 0,
      config.smoothing_factor,
      config.dct_method,
      config.use_standard_tables ? 1 : 0,
      config.baseline ? 1 : 0,
      config.adaptive_quantization ? 1 : 0,
    );

    // Leer el resultado: estructura con dos enteros (puntero y tamaño)
    const dataPtr =
      self.heapU8[resultStructPtr] |
      (self.heapU8[resultStructPtr + 1] << 8) |
      (self.heapU8[resultStructPtr + 2] << 16) |
      (self.heapU8[resultStructPtr + 3] << 24);
    const size =
      self.heapU8[resultStructPtr + 4] |
      (self.heapU8[resultStructPtr + 5] << 8) |
      (self.heapU8[resultStructPtr + 6] << 16) |
      (self.heapU8[resultStructPtr + 7] << 24);

    const outputBuffer = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      outputBuffer[i] = self.heapU8[dataPtr + i];
    }

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
