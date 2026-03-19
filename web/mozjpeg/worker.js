var wasmReady = false;

var Module = {
  onRuntimeInitialized: function () {
    wasmReady = true;
    console.log("MozJPEG WASM ready");
    self.postMessage({ type: "ready" });
  },
};

// importScripts DESPUÉS de definir Module
importScripts("./encoder.js");

self.onmessage = function (e) {
  if (!wasmReady) {
    self.postMessage({ type: "error", message: "WASM not initialized" });
    return;
  }

  const { imageBuffer } = e.data;

  // ── Parámetros con defaults ──────────────────────────────────────────────
  // Estándar libjpeg
  const quality = e.data.quality ?? 85;
  const progressive = e.data.progressive ?? 1;
  const optimize_coding = e.data.optimize_coding ?? 1;
  const smoothing = e.data.smoothing ?? 0; // 0–100
  const chroma_subsample = e.data.chroma_subsample ?? 2; // 0=4:4:4 1=4:2:2 2=4:2:0
  const write_jfif = e.data.write_jfif ?? 1;

  // Booleanos MozJPEG exclusivos
  const trellis = e.data.trellis ?? 1;
  const trellis_dc = e.data.trellis_dc ?? 1;
  const trellis_eob_opt = e.data.trellis_eob_opt ?? 1;
  const use_scans_in_trellis = e.data.use_scans_in_trellis ?? 0;
  const trellis_q_opt = e.data.trellis_q_opt ?? 0;
  const overshoot_deringing = e.data.overshoot_deringing ?? 1;
  const optimize_scans = e.data.optimize_scans ?? 1;

  // Enteros MozJPEG exclusivos
  const base_quant_tbl = e.data.base_quant_tbl ?? 0; // 0–8
  const trellis_freq_split = e.data.trellis_freq_split ?? 8; // default mozjpeg
  const trellis_num_loops = e.data.trellis_num_loops ?? 1;
  const dc_scan_opt_mode = e.data.dc_scan_opt_mode ?? 1; // 0/1/2

  // Flotantes MozJPEG exclusivos (se pasan × 100 como enteros para evitar
  // problemas con el ABI de float en WASM; -1 = usar default interno)
  const lambda_log_scale1_x100 =
    e.data.lambda_log_scale1 != null
      ? Math.round(e.data.lambda_log_scale1 * 100)
      : -1;
  const lambda_log_scale2_x100 =
    e.data.lambda_log_scale2 != null
      ? Math.round(e.data.lambda_log_scale2 * 100)
      : -1;
  const trellis_delta_dc_weight_x100 =
    e.data.trellis_delta_dc_weight != null
      ? Math.round(e.data.trellis_delta_dc_weight * 100)
      : -1;
  // ────────────────────────────────────────────────────────────────────────

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
    const inputPtr = Module._malloc(imageBuffer.byteLength);
    if (!inputPtr) throw new Error("malloc failed (out of memory)");

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
      // Flotantes MozJPEG (× 100)
      lambda_log_scale1_x100,
      lambda_log_scale2_x100,
      trellis_delta_dc_weight_x100,
    );

    // Releer heap DESPUÉS de compress_image: la memoria pudo haber crecido
    const heapAfter = new Uint8Array(Module.wasmMemory.buffer);

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
