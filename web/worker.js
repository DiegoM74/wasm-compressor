var wasmReady = false;

var Module = {
  onRuntimeInitialized: function () {
    wasmReady = true;
    console.log("MozJPEG WASM ready");
    self.postMessage({ type: "ready" });
  },
};

// importScripts DESPUÉS de definir Module
importScripts("./jpeg_encoder.js");

self.onmessage = function (e) {
  if (!wasmReady) {
    self.postMessage({ type: "error", message: "WASM not initialized" });
    return;
  }

  const { imageBuffer, quality = 84 } = e.data;

  if (!imageBuffer || imageBuffer.byteLength === 0) {
    self.postMessage({ type: "error", message: "Empty buffer" });
    return;
  }

  const firstBytes = new Uint8Array(imageBuffer, 0, 2);
  if (firstBytes[0] !== 0xff || firstBytes[1] !== 0xd8) {
    self.postMessage({ type: "error", message: "Not a JPEG" });
    return;
  }

  try {
    // Siempre leer HEAPU8 fresco desde Module — puede cambiar si la
    // memoria WASM crece (ALLOW_MEMORY_GROWTH=1 invalida vistas anteriores)
    const heap = Module.HEAPU8;

    const inputPtr = Module._malloc(imageBuffer.byteLength);
    if (!inputPtr) throw new Error("malloc failed (out of memory)");

    heap.set(new Uint8Array(imageBuffer), inputPtr);

    const progressive = 1;
    const trellis = 1;
    const trellis_dc = 1;
    const tune_ssim = 1;
    const optimize_scans = 1;

    const resultStructPtr = Module._compress_image(
      inputPtr,
      imageBuffer.byteLength,
      quality,
      progressive,
      trellis,
      trellis_dc,
      tune_ssim,
      optimize_scans,
    );

    // Releer heap DESPUÉS de compress_image: la memoria pudo haber crecido
    const heapAfter = Module.HEAPU8;

    if (!resultStructPtr) {
      Module._free(inputPtr);
      throw new Error("compress_image returned null");
    }

    // Leer el struct CompressedResult { unsigned char* data; int size; }
    // En wasm32: puntero = 4 bytes, int = 4 bytes → offsets 0 y 4
    const dataPtr =
      heapAfter[resultStructPtr] |
      (heapAfter[resultStructPtr + 1] << 8) |
      (heapAfter[resultStructPtr + 2] << 16) |
      (heapAfter[resultStructPtr + 3] << 24);

    const size =
      heapAfter[resultStructPtr + 4] |
      (heapAfter[resultStructPtr + 5] << 8) |
      (heapAfter[resultStructPtr + 6] << 16) |
      (heapAfter[resultStructPtr + 7] << 24);

    if (!dataPtr || size <= 0) {
      Module._free(inputPtr);
      throw new Error(
        `compress_image devolvió datos inválidos (ptr=${dataPtr}, size=${size})`,
      );
    }

    // Copiar resultado antes de liberar
    const outputBuffer = new Uint8Array(
      heapAfter.slice(dataPtr, dataPtr + size),
    );

    Module._free(inputPtr);
    // Nota: out_buffer de libjpeg se libera internamente por mozjpeg,
    // NO llamar free sobre dataPtr (lo maneja jpeg_mem_dest internamente)

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
    console.error("Error:", err);
    self.postMessage({ type: "error", message: err.message });
  }
};
