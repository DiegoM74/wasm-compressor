# AGENTS.md — Contexto operativo para agentes de código

## Resumen técnico

Aplicación web client-side que comprime imágenes JPEG usando dos motores WASM en paralelo: MozJPEG (Mozilla, C) y Jpegli (Google, C++). Cada motor corre en su propio Web Worker. La UI permite comparar resultados A/B entre ambos motores y descargar el mejor. No hay backend: todo el procesamiento ocurre en el navegador. Los motores se compilan a WASM con Emscripten desde wrappers C/C++ que exponen una única función `compress_image` cada uno.

---

## Arquitectura y flujo de datos

```
Usuario sube JPEG
       │
       ▼
  main.js: handleFiles()
  Lee archivo como ArrayBuffer, lo almacena en filesData[]
       │
       ▼
  main.js: doCompression(mode)
  Itera filesData[], hace .slice(0) del buffer (copia)
       │
       ├──────────────────────────────┐
       ▼                              ▼
  compressImageMoz()             compressImageJpegli()
  postMessage({imageBuffer, ...})  postMessage({imageBuffer, config})
  [buffer transferido]             [buffer transferido]
       │                              │
       ▼                              ▼
  mozjpeg/worker.js              jpegli/worker.js
  - Valida JPEG magic bytes      - Valida JPEG magic bytes
  - _malloc + copia a heap WASM  - _malloc + copia a heap WASM
  - Llama _compress_image()      - Llama ccall("compress_image_jpegli")
    (parámetros planos)            (parámetros via config object)
  - Lee struct resultado         - Lee struct resultado
    del heap (ptr@0, size@4)       del heap (ptr@0, size@4)
  - .slice() del output          - .slice() del output
  - postMessage({type:"done"})   - postMessage({type:"done"})
  - [buffer transferido]         - [buffer transferido]
       │                              │
       └──────────────┬───────────────┘
                      ▼
  main.js: compara tamaños, asigna bestBuffer/bestLib
  Actualiza DOM con stats por imagen y totales
       │
       ▼
  doDownload(): 1 archivo → descarga directa, N archivos → JSZip
```

### Detalle WASM

Ambos wrappers siguen el mismo patrón:

1. Reciben un buffer JPEG + parámetros de compresión.
2. Decodifican el JPEG a pixeles RGB crudos en memoria (descompresión).
3. Recomprimen los pixeles con los parámetros solicitados.
4. Retornan un `CompressedResult*` (struct global estática con `{unsigned char* data, int size}`).

JS lee el struct directamente del heap WASM: offset 0 = puntero (4 bytes LE), offset 4 = tamaño (4 bytes LE). **Importante**: el heap debe releerse _después_ de la llamada a compress porque `ALLOW_MEMORY_GROWTH=1` puede invalidar las vistas anteriores.

---

## Mapa de archivos clave (por tarea)

| Tarea                                              | Archivos a tocar (en orden)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agregar un parámetro de compresión MozJPEG**     | 1. `src/mozjpeg-wrapper.c` — agregar argumento a `compress_image()` y usarlo en la lógica de compresión. 2. `build-mozjpeg.sh` — agregar al array `EXPORTED_FUNCTIONS` si es nueva función (no aplica para parámetros existentes). 3. `web/mozjpeg/worker.js` — agregar el parámetro a los defaults, extraerlo de `e.data` y pasarlo a `_compress_image()`. 4. `web/js/main.js` — agregar a `mozjpegConfig` y enviarlo en `compressImageMoz()` → `postMessage()`. 5. `web/js/modal.js` — agregar control UI en `buildMozjpegModal()` y leer/escribir en `applyMozjpegConfig()`. 6. Recompilar con `bash build-mozjpeg.sh`. |
| **Agregar un parámetro de compresión Jpegli**      | 1. `src/jpegli-wrapper.cpp` — agregar argumento a `compress_image_jpegli()`. 2. `web/jpegli/worker.js` — agregar al array de tipos en `ccall()` y al array de valores (leer de `config`). 3. `web/js/main.js` — agregar a `jpegliConfig`. 4. `web/js/modal.js` — agregar control UI en `buildJpegliModal()` y leer/escribir en el listener de `jpegliApply`. 5. Recompilar con `bash build-jpegli.sh`.                                                                                                                                                                                                                     |
| **Modificar UI/estilos**                           | `web/index.html`, `web/css/main.css`, `web/css/compare.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Cambiar la lógica de comparación visual**        | `web/js/compare.js` — slider, zoom, paneo. `web/css/compare.css` — estilos del modal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Cambiar cómo se determina el "mejor" resultado** | `web/js/main.js` — buscar bloque `if (f.mozjpegSize && f.jpegliSize)` en `doCompression()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Agregar un nuevo motor de compresión**           | Crear `src/nuevo-wrapper.c`, `build-nuevo.sh`, `web/nuevo/worker.js`, y replicar el patrón de integración en `main.js` (nuevo worker, nuevo config, nuevos botones).                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## Proceso de build

### Requisitos

- **Linux o WSL** (los scripts son bash).
- **Emscripten SDK** instalado y activado: `source ~/emsdk/emsdk_env.sh`.
- **CMake** y **make** disponibles (vienen con emsdk).
- **Git** para clonar fuentes si no existen.

### Compilar MozJPEG

```bash
bash build-mozjpeg.sh
```

Flujo interno:

1. Verifica `emcc`. Si no existe, aborta con instrucciones.
2. Clona `mozilla/mozjpeg` en `src/mozjpeg/` si no existe.
3. Limpia `src/mozjpeg/build_wasm/`, corre `emcmake cmake` con flags: `ENABLE_STATIC=ON`, `WITH_SIMD=OFF`, `WITH_TURBOJPEG=OFF`, `CMAKE_C_FLAGS_RELEASE="-Os -DNDEBUG"`.
4. **Parchea `jconfigint.h`**: fuerza `SIZEOF_SIZE_T` a 4 (wasm32). Sin este parche, la compilación puede fallar o producir binarios corruptos.
5. `emmake make -j$(nproc)` → produce `libjpeg.a`.
6. Compila el wrapper final: `emcc src/mozjpeg-wrapper.c + libjpeg.a → build/mozjpeg/encoder.{js,wasm}`.
7. Copia a `web/mozjpeg/`.

### Compilar Jpegli

```bash
bash build-jpegli.sh
```

Flujo interno:

1. Clona `google/jpegli` + submodules en `src/jpegli/` si no existe.
2. `emcmake cmake` con flags para deshabilitar tools, benchmarks, JNI, etc.
3. `emmake make -j$(nproc) jpegli-static hwy jpegli_cms jpegli_threads` — **builds only specific targets**, no `all`.
4. Busca dinámicamente las `.a` generadas (`libjpegli-static.a`, `libhwy.a`, extras).
5. Compila wrapper: `emcc src/jpegli-wrapper.cpp + [libs] → build/jpegli/encoder.{js,wasm}`.
6. Copia a `web/jpegli/`.

### Flags Emscripten comunes (ambos builds)

| Flag                    | Valor  | Razón                                  |
| ----------------------- | ------ | -------------------------------------- |
| `WASM=1`                | —      | Generar WASM                           |
| `ALLOW_MEMORY_GROWTH=1` | —      | Imágenes grandes necesitan más memoria |
| `INITIAL_MEMORY`        | 128 MB | Evitar resize temprano                 |
| `MAXIMUM_MEMORY`        | 512 MB | Límite de crecimiento                  |
| `FILESYSTEM=0`          | —      | No hay FS, solo memoria                |
| `ENVIRONMENT='web'`     | —      | Solo para navegador/worker             |

### Diferencias entre builds

|                      | MozJPEG                                                                       | Jpegli                                                                   |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `EXPORTED_FUNCTIONS` | `_compress_image`, `_get_result_data`, `_get_result_size`, `_malloc`, `_free` | `_compress_image_jpegli`, `_free_result_data_jpegli`, `_malloc`, `_free` |
| `--closure`          | 1 (minificación agresiva)                                                     | 0 (deshabilitado — causaba errores)                                      |
| Lenguaje wrapper     | C                                                                             | C++ (`extern "C"`)                                                       |

### Errores comunes

- **`emcc not found`**: No se activó el SDK. Ejecutar `source ~/emsdk/emsdk_env.sh`.
- **`SIZEOF_SIZE_T` incorrecto**: El script de MozJPEG lo parchea automáticamente a 4. Si se salta ese paso, los binarios serán inválidos.
- **`libjpegli-static.a` no encontrado**: El build de Jpegli busca los `.a` dinámicamente con `find`. Si cambia la estructura del repo upstream, hay que actualizar los targets de `emmake make`.
- **Heap out of memory en runtime**: Subir `INITIAL_MEMORY` o `MAXIMUM_MEMORY` en el build script.
- **`closure 1` rompe Jpegli**: Por eso Jpegli usa `--closure 0`. No activar sin probar extensivamente.

---

## Convenciones del proyecto

### Funciones expuestas a JS

- MozJPEG: prefijo `_compress_image`, `_get_result_data`, `_get_result_size`, `_free_result_data`. Sin sufijo de motor.
- Jpegli: sufijo `_jpegli` en todo: `_compress_image_jpegli`, `_free_result_data_jpegli`.
- Razón: evitar colisiones de símbolos si se linkean ambos en el mismo módulo futuro.

### Paso de parámetros al worker

- **MozJPEG worker**: recibe parámetros como propiedades planas en `e.data` (destructuring directo). Los booleanos se convierten a `0/1` en `main.js` antes de enviar. Los floats se pasan como `int * 100` (convención `_x100`) para evitar problemas con el ABI de float en WASM; el wrapper C los divide por 100.
- **Jpegli worker**: recibe un objeto `config` dentro de `e.data`. Usa `Module.ccall()` (en vez de `Module._compress_image_jpegli()`) porque necesita pasar un `float` (distance) que ccall convierte correctamente.

### Lectura de resultados del heap WASM

Ambos workers leen el `CompressedResult` struct manualmente byte a byte (little-endian, wasm32):

- Bytes 0-3: puntero a data.
- Bytes 4-7: tamaño.
- Luego hacen `heap.slice(dataPtr, dataPtr + size)` para copiar el output.

### Configuración desde la UI

- Los configs viven como objetos globales en `main.js`: `mozjpegConfig`, `jpegliConfig`.
- `modal.js` construye las modales programáticamente (no hay HTML estático) con helpers `sliderGroup()`, `checkboxGroup()`, `selectGroup()`, `accordion()`.
- Al presionar "Aplicar", el modal lee los inputs del DOM y actualiza el config global. No hay binding reactivo.

### Estilo de código

- JavaScript vanilla, sin frameworks ni bundlers.
- Scripts cargados en orden en `index.html`: `main.js` → `modal.js` → `compare.js`. Comparten globals (`filesData`, `mozjpegConfig`, `jpegliConfig`, `isCompressing`).
- CSS variables definidas en `main.css` (ej: `--accent-secondary`, `--text-secondary`).
- Idioma: comentarios en español, nombres de variables/funciones en inglés.
- SVG icons inline via `<use href="img/main.svg#iconName">`.

---

## Limitaciones y gotchas

1. **Solo JPEG de entrada**: La validación es por magic bytes (`0xFF 0xD8`). No se acepta PNG, WebP, etc. El frontend muestra los archivos no-JPEG como "no soportado" pero no los procesa.

2. **Buffer transferido = destruido**: `postMessage()` usa transferable objects (`[buffer]`). El ArrayBuffer original queda inservible después del envío. Por eso `doCompression()` hace `.slice(0)` antes de enviar — **si se quita ese .slice(), la segunda compresión del mismo archivo fallará**.

3. **Heap invalidation post-compress**: Después de llamar a `_compress_image` / `ccall`, `Module.wasmMemory.buffer` puede haber cambiado (por `ALLOW_MEMORY_GROWTH`). Siempre releer el heap. Los workers ya lo hacen correctamente.

4. **Closure Compiler y Jpegli**: `--closure 1` rompe el encoder de Jpegli (renombra símbolos internos de Emscripten). MozJPEG sí lo tolera.

5. **Orden de llamadas en jpegli-wrapper.cpp**: Las funciones `jpegli_use_standard_quant_tables()`, `jpegli_set_xyb_mode()` y `jpegli_set_cicp_transfer_function()` **deben llamarse ANTES de `jpegli_set_defaults()`**. Si se reordenan, los parámetros se ignoran silenciosamente o crashea.

6. **Struct global estática**: Ambos wrappers usan una variable global `g_result` para retornar el resultado. Esto significa que **no son thread-safe**. Sin embargo, como cada motor corre en su propio Worker (un solo hilo por módulo WASM), no hay conflicto actual. No intentar llamar a `compress_image` en paralelo dentro del mismo Worker.

7. **Archivos WASM en web/ son copias de build/**: Los scripts de build copian automáticamente `build/*/encoder.{js,wasm}` a `web/*/`. No editar los archivos en `web/mozjpeg/encoder.*` o `web/jpegli/encoder.*` directamente — se sobreescriben en cada build.

8. **JSZip cargado desde CDN**: `jszip.min.js` se carga desde cdnjs. Si necesitas offline, hay que descargarlo a `web/`.

9. **No hay build system para el frontend**: No hay webpack, vite ni npm scripts. Se sirve `web/` directamente con cualquier servidor estático. Los `.js` tienen query strings de versión (`?v=2.3`) para cache busting manual.

10. **MozJPEG: `optimize_scans` requiere `progressive`**: Si `optimize_scans` está habilitado pero `progressive` no, MozJPEG lo ignora silenciosamente. El wrapper llama `jpeg_simple_progression()` condicionalmente.

---

## Tareas comunes

### 1. Agregar soporte para un nuevo formato de entrada (ej: PNG)

**Archivos a tocar:**

- `web/js/main.js` → Cambiar validación en `handleFiles()`: aceptar `image/png` además de `image/jpeg`. Convertir PNG a pixeles RGB (usando Canvas 2D API: crear `<img>`, dibujar en canvas, obtener `ImageData`) antes de enviarlo al worker, ya que los wrappers WASM esperan un buffer JPEG como entrada. **Alternativa**: modificar los wrappers C/C++ para aceptar raw RGB + dimensiones directamente (evitar re-decode).
- `web/index.html` → Actualizar `accept="image/jpeg"` en el file input.
- `src/mozjpeg-wrapper.c` y/o `src/jpegli-wrapper.cpp` → Si se opta por pasar raw RGB, crear una nueva función o agregar parámetros `width`, `height`, `components` y saltar el paso de decodificación.
- `web/mozjpeg/worker.js` y `web/jpegli/worker.js` → Cambiar validación de magic bytes. Si se pasan pixeles crudos, cambiar el mensaje para incluir dimensiones.

### 2. Exponer un nuevo flag de Jpegli (ej: `jpegli_set_psnr_target`)

**Archivos a tocar (en este orden exacto):**

1. `src/jpegli-wrapper.cpp` — Agregar parámetro a la firma de `compress_image_jpegli()`. Llamar a la función Jpegli correspondiente en el lugar correcto (antes o después de `set_defaults` según la API).
2. `build-jpegli.sh` — Solo si se exporta una nueva función (no aplica para agregar un parámetro a la función existente).
3. `web/jpegli/worker.js` — Agregar el tipo (`"number"`) al array de tipos de `ccall()` y el valor (`config.nuevo_param`) al array de valores. Mantener el orden exacto de la firma C++.
4. `web/js/main.js` — Agregar valor default a `jpegliConfig`.
5. `web/js/modal.js` — Agregar control en `buildJpegliModal()` y leer/escribir en el listener de `jpegliApply`.
6. Recompilar: `bash build-jpegli.sh`.

### 3. Cambiar la memoria WASM (ej: soportar imágenes más grandes)

**Archivos a tocar:**

- `build-mozjpeg.sh` → Modificar `-s INITIAL_MEMORY=...` y `-s MAXIMUM_MEMORY=...`.
- `build-jpegli.sh` → Ídem.
- Recompilar ambos motores.
- Nota: `MAXIMUM_MEMORY` no puede exceder 2 GB en wasm32. Para 4 GB necesitarías wasm64 (no soportado en navegadores actualmente).
