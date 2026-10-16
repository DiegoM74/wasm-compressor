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

// Lee struct CompressedResult del heap WASM (wasm32 Little-Endian)
function readCompressedResult(buffer, ptr) {
  const view = new DataView(buffer, ptr, 24);
  const dataPtr = view.getUint32(0, true);
  const size = view.getInt32(4, true);
  const attainedQuality = view.getInt32(8, true);
  const paletteColors = view.getInt32(12, true);
  const outputBitDepth = view.getInt32(16, true);
  const mseError = view.getFloat32(20, true);
  return {
    dataPtr,
    size,
    attainedQuality,
    paletteColors,
    outputBitDepth,
    mseError,
  };
}

// ── Arquitectura del Worker libimagequant ──
// Recibe el ArrayBuffer de la imagen PNG y el objeto de configuración.
// Reserva memoria en el heap WASM (_malloc), ejecuta compress_image_imagequant mediante ccall,
// y lee el resultado del struct global en memoria WASM antes de retornar una copia
// del buffer mediante postMessage transferible ([outputBuffer.buffer]).
self.onmessage = function (e) {
  if (!wasmReady) {
    self.postMessage({ type: "error", message: "WASM libimagequant no inicializado" });
    return;
  }

  const { imageBuffer, config = {} } = e.data;

  if (!imageBuffer || imageBuffer.byteLength === 0) {
    self.postMessage({ type: "error", message: "Buffer vacío" });
    return;
  }

  // Validación de magic bytes de PNG: 0x89 0x50 0x4E 0x47 (89 'P' 'N' 'G')
  const magic = new Uint8Array(imageBuffer, 0, 4);
  if (
    magic[0] !== 0x89 ||
    magic[1] !== 0x50 ||
    magic[2] !== 0x4e ||
    magic[3] !== 0x47
  ) {
    self.postMessage({ type: "error", message: "No es un PNG válido" });
    return;
  }

  const {
    max_colors = 256,
    min_quality = 55,
    max_quality = 85,
    strict_quality = false,
    speed = 4,
    dithering = 1.0,
    posterization = 0,
    gamma = 0.0,
    last_index_transparent = false,
    auto_bit_depth = true,
    filter_strategy = 0,
    filter_palette_zero = true,
    zlib_windowsize = 32768,
    zlib_nicematch = 258,
    zlib_lazymatching = true,
    interlace = false,
    strip_metadata = true,
    write_srgb_chunk = true,
  } = config;

  try {
    const inputPtr = Module._malloc(imageBuffer.byteLength);
    if (!inputPtr) throw new Error("malloc falló (sin memoria)");

    new Uint8Array(Module.wasmMemory.buffer).set(
      new Uint8Array(imageBuffer),
      inputPtr,
    );

    const resultStructPtr = Module.ccall(
      "compress_image_imagequant",
      "number",
      [
        "number", // input_buffer
        "number", // input_size
        "number", // max_colors
        "number", // min_quality
        "number", // max_quality
        "number", // strict_quality
        "number", // speed
        "number", // dithering (float)
        "number", // posterization
        "number", // gamma (float)
        "number", // last_index_transparent
        "number", // auto_bit_depth
        "number", // filter_strategy
        "number", // filter_palette_zero
        "number", // zlib_windowsize
        "number", // zlib_nicematch
        "number", // zlib_lazymatching
        "number", // interlace
        "number", // strip_metadata
        "number", // write_srgb_chunk
      ],
      [
        inputPtr,
        imageBuffer.byteLength,
        max_colors,
        min_quality,
        max_quality,
        strict_quality ? 1 : 0,
        speed,
        Number(dithering),
        posterization,
        Number(gamma),
        last_index_transparent ? 1 : 0,
        auto_bit_depth ? 1 : 0,
        filter_strategy,
        filter_palette_zero ? 1 : 0,
        zlib_windowsize,
        zlib_nicematch,
        zlib_lazymatching ? 1 : 0,
        interlace ? 1 : 0,
        strip_metadata ? 1 : 0,
        write_srgb_chunk ? 1 : 0,
      ],
    );

    // Releer el heap DESPUÉS de ccall: la memoria pudo haber crecido (ALLOW_MEMORY_GROWTH=1)
    const heap = new Uint8Array(Module.wasmMemory.buffer);

    if (!resultStructPtr) {
      Module._free(inputPtr);
      throw new Error("compress_image_imagequant devolvió puntero nulo");
    }

    const {
      dataPtr,
      size,
      attainedQuality,
      paletteColors,
      outputBitDepth,
      mseError,
    } = readCompressedResult(Module.wasmMemory.buffer, resultStructPtr);

    if (!dataPtr || size <= 0) {
      Module._free(inputPtr);
      if (dataPtr) Module._free_result_data_imagequant(dataPtr);
      throw new Error(
        `compress_image_imagequant devolvió datos inválidos (ptr=${dataPtr}, size=${size})`,
      );
    }

    // Copiar el resultado antes de liberar la memoria WASM
    const outputBuffer = heap.slice(dataPtr, dataPtr + size);

    // Liberar memoria WASM
    Module._free_result_data_imagequant(dataPtr);
    Module._free(inputPtr);

    self.postMessage(
      {
        type: "done",
        buffer: outputBuffer.buffer,
        originalSize: imageBuffer.byteLength,
        compressedSize: size,
        attainedQuality,
        paletteColors,
        outputBitDepth,
        mseError,
      },
      [outputBuffer.buffer],
    );
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err.message || "Error desconocido en libimagequant",
    });
  }
};
