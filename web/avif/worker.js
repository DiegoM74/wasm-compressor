/**
 * worker.js — Web Worker para conversión PNG/JPEG → AVIF con libavif WASM
 *
 * Flujo:
 *   1. Recibe { type:"compress", fileId, fileName, mimeType, imageBuffer, config }
 *   2. Decodifica el PNG/JPEG a píxeles RGBA usando OffscreenCanvas
 *   3. Pasa los píxeles a libavif WASM → genera ArrayBuffer AVIF
 *   4. Responde { type:"done", fileId, buffer, originalSize, compressedSize }
 *
 * API del wrapper C (libavif-wrapper.c):
 *   int      avif_compress_rgba(pixels, width, height, has_alpha,
 *                               quality, quality_alpha, speed,
 *                               chroma, bit_depth, lossless,
 *                               tile_rows_log2, tile_cols_log2)  → 1=ok, 0=error
 *   uint8_t* get_avif_result_data()  → puntero al buffer de resultado
 *   int      get_avif_result_size()  → tamaño en bytes
 *   void     free_avif_result()      → liberar buffer
 *
 * config esperado desde el main thread:
 *   {
 *     quality         : 0-100   (0 = lossless)
 *     qualityAlpha    : -1|0-100 (-1 = igual que quality)
 *     speed           : 0-10
 *     chromaSubsampling: 0=4:4:4 | 1=4:2:0 | 2=4:2:2 | 3=4:0:0
 *     bitDepth        : 8 | 10 | 12
 *     lossless        : bool
 *     tiling          : bool
 *     tileRowsLog2    : 0-6
 *     tileColsLog2    : 0-6
 *   }
 */

// ── Variables del módulo WASM ──
let libavifModule = null;
let avifCompress = null; // función cwrap
let isWasmReady = false;

// ── Inicialización ──
async function init() {
  try {
    importScripts("./encoder.js");

    libavifModule = await LibAVIF();

    // Crear wrappers tipados para las funciones exportadas del C
    avifCompress = libavifModule.cwrap(
      "avif_compress_rgba",
      "number", // retorno: int (1=ok, 0=error)
      [
        "number", // pixels      — puntero en heap WASM
        "number", // width
        "number", // height
        "number", // has_alpha
        "number", // quality
        "number", // quality_alpha
        "number", // speed
        "number", // chroma
        "number", // bit_depth
        "number", // lossless
        "number", // tile_rows_log2
        "number", // tile_cols_log2
      ],
    );

    isWasmReady = true;
    postMessage({ type: "ready" });
  } catch (err) {
    postMessage({
      type: "error",
      message: `Error al inicializar libavif: ${err.message}`,
    });
  }
}

// ── Decodificar PNG/JPEG a píxeles RGBA usando OffscreenCanvas ──
async function decodeToRGBA(imageBuffer, mimeType) {
  const blob = new Blob([imageBuffer], { type: mimeType });
  const imageBitmap = await createImageBitmap(blob);
  const { width, height } = imageBitmap;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageBitmap, 0, 0);
  imageBitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);

  // Detectar si hay alpha real (algún pixel con alpha < 255)
  // Esto evita pagar el costo de canal alpha en imágenes opacas (JPEG, PNG sin alpha)
  let hasAlpha = false;
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      hasAlpha = true;
      break;
    }
  }

  return { pixels: data, width, height, hasAlpha };
}

// ── Compresión con libavif WASM ──
async function compressWithLibavif(pixels, width, height, hasAlpha, config) {
  if (!isWasmReady || !libavifModule) {
    throw new Error(
      "libavif WASM no está cargado. Asegúrate de que encoder.js y encoder.wasm " +
        "están en el mismo directorio que este worker.",
    );
  }

  const pixelCount = width * height * 4; // siempre RGBA del canvas
  let wasmPtr = 0;

  try {
    // 1. Reservar memoria en el heap WASM y copiar los píxeles
    wasmPtr = libavifModule._malloc(pixelCount);
    if (!wasmPtr) throw new Error("malloc falló en el heap WASM");

    const heapView = new Uint8Array(
      libavifModule.wasmMemory.buffer,
      wasmPtr,
      pixelCount,
    );
    heapView.set(pixels);

    // 2. Llamar al encoder
    const lossless = config.lossless ? 1 : 0;
    const quality = lossless ? 0 : (config.quality ?? 50);
    const qualityAlpha = lossless
      ? 0
      : hasAlpha
        ? 0
        : (config.qualityAlpha ?? -1);
    const speed = config.speed ?? 6;
    const chroma = config.chromaSubsampling ?? 1; // 4:2:0 por defecto
    const bitDepth = config.bitDepth ?? 8;
    const tileRowsLog2 = config.tiling ? (config.tileRowsLog2 ?? 0) : 0;
    const tileColsLog2 = config.tiling ? (config.tileColsLog2 ?? 0) : 0;

    const ok = avifCompress(
      wasmPtr,
      width,
      height,
      hasAlpha ? 1 : 0,
      quality,
      qualityAlpha,
      speed,
      chroma,
      bitDepth,
      lossless,
      tileRowsLog2,
      tileColsLog2,
    );

    if (!ok) throw new Error("avif_compress_rgba devolvió error (resultado 0)");

    // 3. Leer el resultado desde el heap WASM
    const resultPtr = libavifModule._get_avif_result_data();
    const resultSize = libavifModule._get_avif_result_size();

    if (!resultPtr || resultSize <= 0) {
      throw new Error("El encoder no generó datos AVIF");
    }

    // Copiar a un Uint8Array JS propio (fuera del heap WASM)
    const avifData = new Uint8Array(libavifModule.wasmMemory.buffer).slice(
      resultPtr,
      resultPtr + resultSize,
    );

    // 4. Liberar el buffer interno del encoder
    libavifModule._free_avif_result();

    return avifData;
  } finally {
    // Siempre liberar la memoria de los píxeles, incluso si hubo error
    if (wasmPtr) libavifModule._free(wasmPtr);
  }
}

// ── Manejador de mensajes ──
self.onmessage = async (e) => {
  const { type, fileId, fileName, mimeType, imageBuffer, config } = e.data;

  if (type !== "compress") return;

  const originalSize = imageBuffer.byteLength;

  try {
    // 1. Decodificar la imagen a píxeles RGBA
    let pixels, width, height, hasAlpha;
    try {
      ({ pixels, width, height, hasAlpha } = await decodeToRGBA(
        imageBuffer,
        mimeType,
      ));
    } catch (decodeErr) {
      postMessage({
        type: "error",
        fileId,
        message: `No se pudo decodificar "${fileName}": ${decodeErr.message}`,
      });
      return;
    }

    // 2. Comprimir con libavif WASM
    let avifData;
    try {
      avifData = await compressWithLibavif(
        pixels,
        width,
        height,
        hasAlpha,
        config,
      );
    } catch (wasmErr) {
      postMessage({
        type: "error",
        fileId,
        message: `Error al comprimir "${fileName}": ${wasmErr.message}`,
      });
      return;
    }

    // 3. Responder con el resultado (transferable para evitar copias)
    postMessage(
      {
        type: "done",
        fileId,
        buffer: avifData.buffer,
        originalSize,
        compressedSize: avifData.byteLength,
      },
      [avifData.buffer],
    );
  } catch (err) {
    postMessage({
      type: "error",
      fileId,
      message: `Error inesperado al procesar "${fileName}": ${err.message}`,
    });
  }
};

// ── Arranque ──
init();
