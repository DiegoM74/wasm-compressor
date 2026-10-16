# AGENTS.md — Contexto operativo para agentes de código

## Resumen técnico

Aplicación web client-side de alto rendimiento que comprime imágenes JPEG y PNG usando tres motores WASM en paralelo: MozJPEG (Mozilla, C), Jpegli (Google, C++) y libimagequant + lodepng (C99). Cada motor opera a través de un **Worker Pool** concurrente que distribuye el procesamiento en múltiples Web Workers aprovechando todos los núcleos del procesador (`navigator.hardwareConcurrency`). Los binarios WASM están compilados con optimización `-O3`, vectorización **WASM SIMD 128-bit (`-msimd128`)** y soporte vectorial nativo mediante **Google Highway (`hwy`)** para Jpegli. Los wrappers C/C++ de JPEG utilizan una arquitectura de **streaming de scanlines por bloques** (16 líneas), mientras que el wrapper de PNG decodifica a RGBA32 crudo, cuantiza la paleta preservando transparencia de 8 bits con canal alfa completo y codifica el PNG indexado con LodePNG. La UI permite comparar resultados A/B, inspeccionar transparencias sobre fondos ajedrezados y descargar selectivamente o por lotes mixtos. No hay backend: todo el procesamiento ocurre en el navegador.

---

## Arquitectura y flujo de datos

```
Usuario sube imágenes (JPEG o PNG)
       │
       ▼
  main.js: handleFiles()
  Valida magic bytes (JPEG: 0xFF 0xD8 / PNG: 0x89 0x50 0x4E 0x47)
  Lee archivos como ArrayBuffer, detecta canal alfa en PNGs, almacena en filesData[]
       │
       ▼
  main.js: doCompression(mode)
  Despacha concurrentemente vía Promise.allSettled() según el tipo de archivo:
       │
       ├───────────────────────────────┬───────────────────────────────┐
       ▼                               ▼                               ▼
  mozPool.runTask(...)            jpegliPool.runTask(...)         imagequantPool.runTask(...)
  [Pool de N Workers MozJPEG]     [Pool de N Workers Jpegli]      [Pool de N Workers libimagequant]
  (Solo archivos JPEG)            (Solo archivos JPEG)            (Solo archivos PNG)
  postMessage({imageBuffer, ...}) postMessage({buffer, config})   postMessage({buffer, config})
  [buffer transferible .slice(0)] [buffer transferible .slice(0)] [buffer transferible .slice(0)]
       │                               │                               │
       ▼                               ▼                               ▼
  engines/mozjpeg/worker.js       engines/jpegli/worker.js        engines/imagequant/worker.js
  - Valida JPEG magic bytes       - Valida JPEG magic bytes       - Valida PNG magic bytes
  - _malloc + copia a heap WASM   - _malloc + copia a heap WASM   - _malloc + copia a heap WASM
  - Llama _compress_image()       - Llama ccall("compress_..._    - Llama ccall("compress_..._
    (parámetros planos)             jpegli", config)                imagequant", 20 parámetros)
  - Wrapper C: Streaming          - Wrapper C++: Streaming        - Wrapper C: Decodifica RGBA32,
    por bloques (16 scanlines)      por bloques (16 scanlines)      cuantiza paleta (K-means/median),
    de decodificador a codificador  de decodificador a codificador  tramado, remapeo, LodePNG Deflate
  - Lee struct resultado          - Lee struct resultado          - Lee struct resultado (24 bytes)
    (ptr@0, size@4)                 (ptr@0, size@4)                 (ptr@0, size@4, quality@8, ...)
  - .slice() del output           - .slice() del output           - .slice() del output
  - postMessage({type:"done"})    - postMessage({type:"done"})    - postMessage({type:"done", ...})
  - [buffer transferido]          - [buffer transferido]          - [buffer transferido + métricas]
       │                               │                               │
       └───────────────────────────────┴───────────────────────────────┘
                                       │
                                       ▼
  main.js: compara tamaños, asigna bestBuffer/bestLib, actualiza DOM y métricas
       │
       ▼
  doDownload(): 1 archivo → descarga directa, N archivos → JSZip (selectivo o mixto)
```

### Detalle WASM

- **Wrappers JPEG (MozJPEG y Jpegli)**: Siguen un patrón optimizado de streaming por bloques de **16 scanlines** (`MOZ_CHUNK_LINES 16` / `JPEGLI_CHUNK_LINES 16`) directamente entre descompresión y compresión, eliminando búferes RGB intermedios de imagen completa en el heap y optimizando el uso de caché L1/L2.
- **Wrapper PNG (libimagequant + LodePNG)**: Decodifica el PNG de entrada a RGBA32 crudo en memoria (`lodepng_decode32`), configura atributos de cuantización (`liq_attr`), crea la imagen con corrección gamma, posterización y transparencia, ejecuta la cuantización (`liq_image_quantize`), aplica tramado Floyd-Steinberg (`liq_set_dithering_level`), remapea los píxeles a índices de 8 bits y empaqueta el contenedor con LodePNG configurando estrategia de filtrado, ventana LZ77 de 32 KB, nicematch 258 y profundidad de bits adaptativa (1, 2, 4 u 8 bits).
- **Structs de retorno**: JS lee el struct del heap WASM tras `ALLOW_MEMORY_GROWTH=1`. JPEG usa struct de 8 bytes (`ptr@0`, `size@4`). libimagequant usa struct de 24 bytes alineados (`ptr@0`, `size@4`, `attainedQuality@8`, `paletteColors@12`, `outputBitDepth@16`, `mseError@20`).

---

## Mapa de archivos clave (por tarea)

| Tarea                                              | Archivos a tocar (en orden)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Agregar un parámetro de compresión MozJPEG**     | 1. `src/mozjpeg-wrapper.c` — agregar argumento a `compress_image()` y usarlo en la lógica de compresión. 2. `scripts/build-mozjpeg.sh` — agregar al array `EXPORTED_FUNCTIONS` si es nueva función (no aplica para parámetros existentes). 3. `web/engines/mozjpeg/worker.js` — agregar el parámetro a los defaults, extraerlo de `e.data` y pasarlo a `_compress_image()`. 4. `web/js/main.js` — agregar a `mozjpegConfig` y enviarlo en `compressImageMoz()` → `postMessage()`. 5. `web/js/modal.js` — agregar control UI en `buildMozjpegModal()` y leer/escribir en `applyMozjpegConfig()`. 6. `web/js/guide.js` — agregar entrada con descripción, pros/contras y ajuste recomendado en `mozjpegGuideData`. 7. Recompilar con `bash scripts/build-mozjpeg.sh`. |
| **Agregar un parámetro de compresión Jpegli**      | 1. `src/jpegli-wrapper.cpp` — agregar argumento a `compress_image_jpegli()`. 2. `web/engines/jpegli/worker.js` — agregar al array de tipos en `ccall()` y al array de valores (leer de `config`). 3. `web/js/main.js` — agregar a `jpegliConfig`. 4. `web/js/modal.js` — agregar control UI en `buildJpegliModal()` y leer/escribir en el listener de `jpegliApply`. 5. `web/js/guide.js` — agregar entrada con descripción, pros/contras y ajuste recomendado en `jpegliGuideData`. 6. Recompilar con `bash scripts/build-jpegli.sh`.                                                                                                                                                                                                                     |
| **Agregar un parámetro de compresión libimagequant** | 1. `src/imagequant-wrapper.c` — agregar argumento a `compress_image_imagequant()` y pasarlo a libimagequant o LodePNG. 2. `web/engines/imagequant/worker.js` — agregar a la lista de tipos y valores en `Module.ccall()`. 3. `web/js/main.js` — agregar valor por defecto a `imagequantConfig`. 4. `web/js/modal.js` — agregar control en `buildImagequantModal()` y leer/escribir en `initImagequantModalListeners()`. 5. `web/js/guide.js` — agregar entrada en `imagequantGuideData`. 6. Recompilar con `bash scripts/build-imagequant.sh`. |
| **Modificar UI/estilos**                           | `web/index.html`, `web/css/main.css`, `web/css/compare.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Cambiar la lógica de comparación visual**        | `web/js/compare.js` — slider, zoom, paneo. `web/css/compare.css` — estilos del modal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Cambiar cómo se determina el "mejor" resultado** | `web/js/main.js` — buscar bloque `if (f.mozjpegSize && f.jpegliSize)` en `doCompression()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Agregar un nuevo motor de compresión**           | Crear `src/nuevo-wrapper.c`, `scripts/build-nuevo.sh`, `web/engines/nuevo/worker.js`, y replicar el patrón de integración en `main.js` (nuevo worker, nuevo config, nuevos botones).                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## Proceso de build

### Requisitos

- **Linux o WSL** (los scripts son bash).
- **Emscripten SDK** instalado y activado: `source ~/emsdk/emsdk_env.sh`.
- **CMake** y **make** disponibles (vienen con emsdk).
- **Git** para clonar fuentes si no existen.

### Compilar MozJPEG

```bash
bash scripts/build-mozjpeg.sh
```

Flujo interno:

1. Verifica `emcc`. Si no existe, aborta con instrucciones.
2. Clona `mozilla/mozjpeg` en `src/mozjpeg/` si no existe.
3. Limpia `src/mozjpeg/build_wasm/`, corre `emcmake cmake` con flags: `BUILD_SHARED_LIBS=OFF`, `ENABLE_STATIC=ON`, `WITH_SIMD=OFF`, `WITH_TURBOJPEG=OFF`, `CMAKE_C_FLAGS_RELEASE="-O3 -flto -msimd128 -DNDEBUG"`.
4. **Parchea `jconfigint.h`**: fuerza `SIZEOF_SIZE_T` a 4 (wasm32). Sin este parche, la compilación puede fallar o producir binarios corruptos.
5. `emmake make -j$(nproc) jpeg-static` → produce `libjpeg.a`.
6. Compila el wrapper final: `emcc src/mozjpeg-wrapper.c + libjpeg.a → build/mozjpeg/encoder.{js,wasm}` con `-O3 -flto -msimd128`.
7. Copia a `web/engines/mozjpeg/`.

### Compilar Jpegli

```bash
bash scripts/build-jpegli.sh
```

Flujo interno:

1. Clona `google/jpegli` + submodules en `src/jpegli/` si no existe.
2. `emcmake cmake` con flags para deshabilitar tools, benchmarks, JNI, etc., y flags de optimización vectorial `CMAKE_C_FLAGS_RELEASE="-O3 -msimd128 -DNDEBUG"` y `CMAKE_CXX_FLAGS_RELEASE="-O3 -msimd128 -DNDEBUG"`.
3. `emmake make -j$(nproc) jpegli-static hwy` — **compila únicamente los targets requeridos** por el wrapper (`libjpegli-static.a` y `libhwy.a`). Google Highway compila con targets vectoriales `HWY_WASM_128`.
4. Busca dinámicamente las `.a` generadas (`libjpegli-static.a`, `libhwy.a`).
5. Compila wrapper: `em++ src/jpegli-wrapper.cpp + [libs] → build/jpegli/encoder.{js,wasm}` con `-O3 -msimd128`.
6. Copia a `web/engines/jpegli/`.

### Compilar libimagequant + LodePNG

```bash
bash scripts/build-imagequant.sh
```

Flujo interno:

1. Verifica `emcc`. Si no existe, aborta con instrucciones.
2. Clona `ImageOptim/libimagequant` en `src/libimagequant/` si no existe.
3. Descarga `lodepng.h` y `lodepng.c` desde el repositorio oficial `lvandeve/lodepng` si no existen.
4. Compila `libimagequant` en librería estática `libimagequant.a` usando `emmake make` con `-O3 -flto -msimd128 -DUSE_SSE=0`.
5. Compila el wrapper final: `emcc src/imagequant-wrapper.c + src/lodepng.c + libimagequant.a → build/imagequant/encoder.{js,wasm}` con `-O3 -flto -msimd128`.
6. Copia a `web/engines/imagequant/`.

### Flags Emscripten comunes (los tres builds)

| Flag                    | Valor        | Razón                                                    |
| ----------------------- | ------------ | -------------------------------------------------------- |
| `WASM=1`                | —            | Generar WASM                                             |
| `-O3`                   | —            | Máxima optimización de compilador y desenrollado bucles |
| `-msimd128`             | —            | Vectorización WebAssembly SIMD 128-bit (Highway / LLVM)  |
| `ALLOW_MEMORY_GROWTH=1` | —            | Imágenes grandes necesitan más memoria                   |
| `INITIAL_MEMORY`        | 128 MB       | Evitar resize temprano                                   |
| `MAXIMUM_MEMORY`        | 512 MB       | Límite de crecimiento                                    |
| `FILESYSTEM=0`          | —            | No hay FS, solo memoria                                  |
| `ENVIRONMENT='web'`     | —            | Solo para navegador/worker                               |

### Diferencias entre builds

|                      | MozJPEG                                                                       | Jpegli                                                                   | libimagequant                                                            |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `EXPORTED_FUNCTIONS` | `_compress_image`, `_free_result_data`, `_malloc`, `_free`                     | `_compress_image_jpegli`, `_free_result_data_jpegli`, `_malloc`, `_free` | `_compress_image_imagequant`, `_free_result_data_imagequant`, `_malloc`, `_free` |
| `--closure`          | 1 (minificación agresiva)                                                     | 0 (deshabilitado — causaba errores)                                      | 0 (deshabilitado para estabilidad en workers)                            |
| `-flto`              | Habilitado (Link-Time Optimization)                                           | Deshabilitado (evita colisiones en plantillas Highway)                   | Habilitado (Link-Time Optimization)                                      |
| Lenguaje wrapper     | C                                                                             | C++ (`extern "C"`)                                                       | C99                                                                      |

### Errores comunes

- **`emcc not found`**: No se activó el SDK. Ejecutar `source ~/emsdk/emsdk_env.sh`.
- **`SIZEOF_SIZE_T` incorrecto**: El script de MozJPEG lo parchea automáticamente a 4. Si se salta ese paso, los binarios serán inválidos.
- **`libjpegli-static.a` no encontrado**: El build de Jpegli busca los `.a` dinámicamente con `find`. Si cambia la estructura del repo upstream, hay que actualizar los targets de `emmake make`.
- **Heap out of memory en runtime**: Subir `INITIAL_MEMORY` o `MAXIMUM_MEMORY` en el build script.
- **`closure 1` rompe Jpegli**: Por eso Jpegli usa `--closure 0`. No activar sin probar extensivamente.

---

## Convenciones del proyecto

### Funciones expuestas a JS

- MozJPEG: expone `_compress_image` y `_free_result_data` (además de `_malloc` y `_free`). Sin sufijo de motor.
- Jpegli: sufijo `_jpegli` en todo: `_compress_image_jpegli`, `_free_result_data_jpegli`.
- libimagequant: sufijo `_imagequant` en todo: `_compress_image_imagequant`, `_free_result_data_imagequant`.
- Razón: evitar colisiones de símbolos si se linkean múltiples módulos en el mismo contexto futuro.

### Concurrencia y Worker Pools

- El frontend administra la concurrencia a través de la clase `WorkerPool` en `main.js`.
- Se inicializa un pool para MozJPEG (`mozPool`), uno para Jpegli (`jpegliPool`) y uno para libimagequant (`imagequantPool`) con tamaño `Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 4))`.
- La función `doCompression()` despacha todas las imágenes del lote en paralelo mediante `validFiles.map(...)` y `Promise.all()`.
  - Archivos **JPEG**: Se enrutan a `mozPool` y/o `jpegliPool` según el modo seleccionado (MozJPEG, Jpegli o Comparar ambos).
  - Archivos **PNG**: Se enrutan automáticamente a `imagequantPool`.
- Cada pool asigna automáticamente cada tarea al siguiente worker desocupado, procesando múltiples imágenes simultáneamente sin bloquear la UI.

### Paso de parámetros al worker

- **MozJPEG worker**: recibe parámetros como propiedades planas en `e.data` (destructuring directo). Los booleanos se convierten a `0/1` en `main.js` antes de enviar. Los floats se pasan como `int * 100` (convención `_x100`) para evitar problemas con el ABI de float en WASM; el wrapper C los divide por 100.
- **Jpegli worker**: recibe un objeto `config` dentro de `e.data`. Usa `Module.ccall()` (en vez de `Module._compress_image_jpegli()`) porque necesita pasar un `float` (distance) que ccall convierte correctamente.
- **libimagequant worker**: recibe un objeto plano con 20 parámetros en `e.data`. Usa `Module.ccall("compress_image_imagequant", ...)` con 22 parámetros de tipo `"number"` (puntero input, tamaño input, min_quality, max_quality, speed, dither_level, max_colors, posterization, gamma, full_transparency_first, strict_quality, auto_bitdepth, filter_strategy, zlib_windowsize, zlib_nicematch, zlib_lazymatching, adam7, strip_metadata, add_srgb, add_gama).
- **Streaming de scanlines**: Dentro de los wrappers C/C++ de JPEG, la descompresión y compresión se ejecutan en franjas de 16 líneas (`MOZ_CHUNK_LINES 16` / `JPEGLI_CHUNK_LINES 16`), eliminando asignaciones intermedias completas de la imagen en el heap. En PNG, LodePNG decodifica el stream a RGBA32, libimagequant genera el mapa indexado y LodePNG lo codifica al contenedor PNG final.

### Lectura de resultados del heap WASM

Los workers leen la estructura `CompressedResult` directamente desde el buffer WASM:

- **MozJPEG y Jpegli (8 bytes)**: `readCompressedResult(heap, ptr)` lee little-endian:
  - Bytes 0-3: puntero a datos.
  - Bytes 4-7: tamaño del buffer comprimido.
- **libimagequant (24 bytes)**: Se lee mediante `DataView(heap.buffer, ptr, 24)`:
  - Bytes 0-3: puntero a datos (`getUint32(0, true)`).
  - Bytes 4-7: tamaño del PNG comprimido (`getUint32(4, true)`).
  - Bytes 8-11: calidad real alcanzada (`getInt32(8, true)`).
  - Bytes 12-15: colores generados en paleta (`getInt32(12, true)`).
  - Bytes 16-19: profundidad de bits de salida 1/2/4/8 (`getInt32(16, true)`).
  - Bytes 20-23: error MSE (`getFloat32(20, true)`).
- Luego hacen `heap.slice(dataPtr, dataPtr + size)` para copiar el output antes de transferirlo al hilo principal y liberan la memoria WASM llamando al free correspondiente.

### Configuración desde la UI

- Los configs viven como objetos globales en `main.js`: `mozjpegConfig`, `jpegliConfig`, `imagequantConfig`.
- `modal.js` construye las modales programáticamente (no hay HTML estático) con helpers `sliderGroup()`, `checkboxGroup()`, `selectGroup()`, `accordion()`.
- Al presionar "Aplicar", el modal lee los inputs del DOM y actualiza el config global. No hay binding reactivo.
- La función `renderList()` de `main.js` utiliza reconciliación del DOM mediante `createFileElement()` por `id="item-${file.id}"` para evitar parpadeos visuales y no destruir nodos ya renderizados.
- La documentación interactiva de cada motor reside en `guide.js` (`mozjpegGuideData`, `jpegliGuideData`, `imagequantGuideData`). Contiene descripción, pros/contras y valor recomendado para cada opción. Las modales de Guía se organizan en los mismos submenús que las opciones de compresión.
- Los botones `(i)` junto a cada ajuste en las modales de configuración abren la guía correspondiente superpuesta (`z-index: 1100`/`1101`), realizan scroll automático hacia la tarjeta del ajuste y le aplican una animación visual de resaltado (`highlight-entry`).

### Estilo de código

- JavaScript vanilla, sin frameworks ni bundlers.
- Scripts cargados en orden en `index.html`: `main.js` → `modal.js` → `guide.js` → `compare.js`. Comparten globals (`filesData`, `mozjpegConfig`, `jpegliConfig`, `imagequantConfig`, `isCompressing`).
- El helper DOM `el(tag, attrs, ...children)` en `modal.js` detecta etiquetas del espacio de nombres SVG (`svg`, `use`, `path`, `circle`, `symbol`, etc.) y usa `document.createElementNS("http://www.w3.org/2000/svg", tag)`, gestionando correctamente clases y enlaces (`href` y `xlink:href`) para renderizar elementos del sprite SVG sin problemas.
- CSS variables definidas en `main.css` (ej: `--accent-secondary`, `--text-secondary`).
- Idioma: comentarios en español, nombres de variables/funciones en inglés.
- SVG icons inline via `<use href="img/main.svg#iconName">`.
- Accesibilidad: Las etiquetas de interfaz y contenedores implementan roles WAI-ARIA, navegación por teclado y respeto por `prefers-reduced-motion`.

---

## Limitaciones y gotchas

1. **JPEG y PNG soportados**: La validación es por magic bytes (`0xFF 0xD8` para JPEG y `0x89 0x50 0x4E 0x47` para PNG). No se aceptan WebP, AVIF, TIFF, etc. El frontend muestra los archivos no soportados en la lista pero no los procesa.

2. **Buffer transferido = destruido**: `postMessage()` usa transferable objects (`[buffer]`). El ArrayBuffer original queda inservible después del envío. Por eso `doCompression()` hace `.slice(0)` antes de enviar — **si se quita ese .slice(), la segunda compresión del mismo archivo fallará**.

3. **Heap invalidation post-compress**: Después de llamar a `_compress_image` / `ccall`, `Module.wasmMemory.buffer` puede haber cambiado (por `ALLOW_MEMORY_GROWTH`). Siempre releer el heap. Los workers ya lo hacen correctamente.

4. **Closure Compiler y Jpegli/imagequant**: `--closure 1` rompe el encoder de Jpegli (renombra símbolos internos de Emscripten). MozJPEG sí lo tolera con closure.

5. **Orden de llamadas en jpegli-wrapper.cpp**: Las funciones `jpegli_use_standard_quant_tables()`, `jpegli_set_xyb_mode()` y `jpegli_set_cicp_transfer_function()` **deben llamarse ANTES de `jpegli_set_defaults()`**. Si se reordenan, los parámetros se ignoran silenciosamente o crashea.

6. **Struct global estática**: Los tres wrappers usan una variable global `g_result` para retornar el resultado. Esto significa que **no son thread-safe**. Sin embargo, como cada motor corre en su propio Worker (un solo hilo por módulo WASM), no hay conflicto actual. No intentar llamar a `compress_image_*` en paralelo dentro del mismo Worker.

7. **Archivos WASM en web/ son copias de build/**: Los scripts de build copian automáticamente `build/*/encoder.{js,wasm}` a `web/engines/*/`. No editar los archivos en `web/engines/mozjpeg/encoder.*`, `web/engines/jpegli/encoder.*` o `web/engines/imagequant/encoder.*` directamente — se sobreescriben en cada build.

8. **JSZip cargado desde CDN**: `jszip.min.js` se carga desde cdnjs. Si necesitas offline, hay que descargarlo a `web/`.

9. **No hay build system para el frontend**: No hay webpack, vite ni npm scripts. Se sirve `web/` directamente con cualquier servidor estático. Los `.js` tienen query strings de versión (`?v=3.4`) para cache busting manual.

10. **MozJPEG: `optimize_scans` requiere `progressive`**: Si `optimize_scans` está habilitado pero `progressive` no, MozJPEG lo ignora silenciosamente. El wrapper llama `jpeg_simple_progression()` condicionalmente.

---

## Tareas comunes

### 1. Agregar soporte para un nuevo formato de entrada (ej: WebP o AVIF)

**Archivos a tocar:**

- `web/js/main.js` → Cambiar validación en `handleFiles()`: verificar magic bytes correspondientes (ej: `RIFF....WEBP`). Crear un nuevo pool o flujo de decodificación/compresión.
- `web/index.html` → Actualizar `accept="image/jpeg,image/png,image/webp"` en el file input.
- `src/` → Crear wrapper WASM con `libwebp` o biblioteca correspondiente.
- `web/engines/` → Crear subcarpeta del motor con su worker y binarios WASM.

### 2. Exponer un nuevo parámetro en libimagequant

**Archivos a tocar (en este orden exacto):**

1. `src/imagequant-wrapper.c` — Agregar parámetro a la firma de `compress_image_imagequant()` y aplicarlo a `liq_attr`, `liq_image` o configuración del codificador LodePNG.
2. `scripts/build-imagequant.sh` — Recompilar si es necesario.
3. `web/engines/imagequant/worker.js` — Agregar tipo `"number"` en el array de tipos de `ccall()` y pasar el parámetro desde `config`.
4. `web/js/main.js` — Agregar valor default a `imagequantConfig`.
5. `web/js/modal.js` — Agregar control UI en `buildImagequantModal()` y leer/escribir en `initImagequantModalListeners()`.
6. `web/js/guide.js` — Agregar tarjeta explicativa en `imagequantGuideData`.
7. Recompilar: `bash scripts/build-imagequant.sh`.

### 3. Exponer un nuevo flag de Jpegli (ej: `jpegli_set_psnr_target`)

**Archivos a tocar (en este orden exacto):**

1. `src/jpegli-wrapper.cpp` — Agregar parámetro a la firma de `compress_image_jpegli()`. Llamar a la función Jpegli correspondiente en el lugar correcto (antes o después de `set_defaults` según la API).
2. `scripts/build-jpegli.sh` — Solo si se exporta una nueva función (no aplica para agregar un parámetro a la función existente).
3. `web/engines/jpegli/worker.js` — Agregar el tipo (`"number"`) al array de tipos de `ccall()` y el valor (`config.nuevo_param`) al array de valores. Mantener el orden exacto de la firma C++.
4. `web/js/main.js` — Agregar valor default a `jpegliConfig`.
5. `web/js/modal.js` — Agregar control en `buildJpegliModal()` y leer/escribir en el listener de `jpegliApply`.
6. Recompilar: `bash scripts/build-jpegli.sh`.

### 4. Cambiar la memoria WASM (ej: soportar imágenes más grandes)

**Archivos a tocar:**

- `scripts/build-mozjpeg.sh`, `scripts/build-jpegli.sh`, `scripts/build-imagequant.sh` → Modificar `-s INITIAL_MEMORY=...` y `-s MAXIMUM_MEMORY=...`.
- Recompilar los tres motores.
- Nota: `MAXIMUM_MEMORY` no puede exceder 2 GB en wasm32. Para 4 GB necesitarías wasm64 (no soportado en navegadores actualmente).
