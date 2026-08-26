# Compresor JPEG WASM

Compresor de imágenes JPEG que funciona completamente en el navegador utilizando WebAssembly. Integra dos motores de compresión — **MozJPEG** (Mozilla) y **Jpegli** (Google) — para realizar pruebas A/B y encontrar la mejor relación calidad/tamaño para cada imagen.

## ¿Por qué este proyecto?

La mayoría de herramientas de compresión de imágenes requieren instalar software de escritorio, usar la línea de comandos, o subir archivos a un servidor externo. Este proyecto nace de la necesidad de:

- **Comprimir imágenes directamente en el navegador**, sin depender de servidores externos ni exponer archivos privados.
- **Ajustar todos los parámetros de compresión** (calidad, trellis, chroma subsampling, cuantización adaptativa, etc.) desde una interfaz visual, sin tocar la consola.
- **Comparar fácilmente los resultados** de distintos motores lado a lado, con un visor A/B interactivo con zoom y slider, para elegir la mejor opción con criterio propio.

## Características

- **Privacidad total**: Las imágenes nunca salen del dispositivo. Todo el procesamiento ocurre en el navegador con WebAssembly.
- **Aceleración WASM SIMD y Google Highway**: Binarios compilados a máxima optimización (`-O3`) con vectorización WebAssembly SIMD de 128-bit (`-msimd128`), aprovechando los kernels vectoriales nativos de Google Highway (`hwy`) y LLVM para transformadas DCT, cuantización y espacios de color.
- **Worker Pools y procesamiento concurrente en lote**: Arquitectura multi-hilo que distribuye la compresión de lotes de imágenes en paralelo a través de pools dedicados de Web Workers dimensionados según los núcleos del CPU (`navigator.hardwareConcurrency`).
- **Streaming de scanlines de bajo consumo de memoria**: Pipeline por bloques de 16 scanlines entre decodificación y compresión en C/C++, reduciendo el consumo de RAM intermedia a menos de 1 MB por imagen y maximizando la localidad en caché L1/L2.
- **Dos motores en paralelo concurrente**: Comprime con MozJPEG y Jpegli de forma verdaderamente paralela en sus propios Web Workers independientes, reduciendo significativamente los tiempos de procesamiento y seleccionando automáticamente el mejor resultado.
- **Configuración avanzada y Guía interactiva**: Modales dedicadas para ajustar todos los parámetros de compresión y guías interactivas para MozJPEG y Jpegli. Consulta explicaciones detalladas, pros/contras y valores recomendados con los botones (i) junto a cada control para saltar directo a su documentación.
- **Comparación visual A/B**: Visor interactivo con slider, zoom y paneo para comparar Original vs MozJPEG vs Jpegli.
- **Múltiples imágenes y prevención de duplicados**: Carga y procesa varios archivos JPEG a la vez con reconciliación del DOM sin parpadeo y detección automática de imágenes duplicadas. Descarga individual o en ZIP.
- **Accesibilidad integral (WAI-ARIA)**: Soporte completo para lectores de pantalla, navegación por teclado, feedback visual instantáneo de errores y respeto por preferencias de movimiento reducido (`prefers-reduced-motion`).
- **No bloquea la interfaz**: Los motores corren en Web Workers en segundo plano sin congelar la UI.

## Uso

1. Clona el repositorio.
2. Sirve la carpeta `web/` con cualquier servidor estático (ej: `python -m http.server 8000 --directory web` o la extensión Live Server de VS Code).
3. Abre la URL en un navegador moderno.
4. Arrastra imágenes JPEG al área de carga o haz clic para seleccionarlas.
5. Ajusta los parámetros de compresión con los botones ⚙️ de cada motor (opcional) o consulta las guías de opciones pulsando los iconos `(i)`.
6. Presiona **Comprimir** y espera los resultados.
7. Usa el botón **Comparar** en cada imagen para ver las diferencias lado a lado.
8. Descarga las imágenes optimizadas individualmente o todas juntas en un ZIP.

### Requisitos del sistema

- Navegador web moderno con soporte para WebAssembly, WASM SIMD y Web Workers (Chrome 91+, Firefox 89+, Edge 91+, Safari 16.4+).
- Archivos de entrada en formato JPEG.

## Motores de compresión

### MozJPEG

Codec JPEG optimizado por Mozilla con años de desarrollo maduro. Incluye trellis quantization, optimización de scans progresivos, y tablas de cuantización perceptual. Proporciona compresión confiable y de alta calidad.

### Jpegli

Codec JPEG de última generación desarrollado por Google, con algoritmos derivados de JPEG XL. Ofrece cuantización adaptativa, espacio de color XYB, y métrica de distancia butteraugli. Produce calidad superior a ratios de bits bajos y es totalmente compatible con visores JPEG estándar.

### ¿Por qué dos motores?

No existe un motor que sea "el mejor" para todas las imágenes. MozJPEG y Jpegli usan enfoques diferentes (tablas de cuantización estáticas vs. cuantización adaptativa, YCbCr vs. XYB, etc.). Al correr ambos en paralelo, el proyecto permite comparar resultados y elegir la mejor opción caso por caso.

## Compilación de los motores WASM

Los binarios WASM precompilados ya están incluidos en `web/mozjpeg/` y `web/jpegli/`, por lo que **no necesitas compilar nada para usar la aplicación**. Solo compila si quieres modificar los wrappers C/C++ o actualizar las librerías upstream.

### Requisitos de compilación

- Linux o WSL (los scripts son bash).
- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) instalado y activado.

### Compilar

```bash
# Activar Emscripten (ajustar ruta si es necesario)
source ~/emsdk/emsdk_env.sh

# Compilar MozJPEG
bash build-mozjpeg.sh

# Compilar Jpegli
bash build-jpegli.sh
```

Cada script se encarga de clonar el código fuente (si no existe), configurar CMake, compilar las librerías estáticas, generar el wrapper WASM, y copiar los archivos finales a `web/`.

> Para detalles técnicos de arquitectura, convenciones de código, flujo de datos interno, y guía de contribución, ver [AGENTS.md](AGENTS.md).

## Estructura del proyecto

```
wasm-compressor/
├── AGENTS.md               # Documentación técnica para desarrolladores
├── README.md               # Este archivo
├── build-mozjpeg.sh        # Script de compilación MozJPEG → WASM
├── build-jpegli.sh         # Script de compilación Jpegli → WASM
├── src/                    # Código fuente C/C++
│   ├── mozjpeg-wrapper.c   # Wrapper MozJPEG para Emscripten
│   └── jpegli-wrapper.cpp  # Wrapper Jpegli para Emscripten
└── web/                    # Aplicación frontend (servir esta carpeta)
    ├── index.html
    ├── css/
    │   ├── main.css        # Estilos principales
    │   └── compare.css     # Estilos del visor de comparación
    ├── js/
    │   ├── main.js         # Lógica principal (workers, compresión, descarga)
    │   ├── modal.js        # Modales de configuración de parámetros
    │   └── compare.js      # Visor de comparación A/B
    ├── mozjpeg/             # Motor MozJPEG
    │   ├── worker.js
    │   ├── encoder.js
    │   └── encoder.wasm
    └── jpegli/              # Motor Jpegli
        ├── worker.js
        ├── encoder.js
        └── encoder.wasm
```

## Roadmap

- [x] Integración de MozJPEG y Jpegli con configuración avanzada de parámetros.
- [x] Visor de comparación A/B con zoom y slider.
- [x] Soporte de múltiples imágenes y descarga en ZIP.
- [ ] Soporte para formatos de entrada adicionales (PNG, WebP) con conversión automática a JPEG.
- [ ] Integración de un tercer motor: AVIF (libavif) para compresión de próxima generación.
- [ ] Modo offline completo (bundlear JSZip localmente).
- [ ] Presets de configuración guardables (ej: "web optimizado", "alta calidad", "máxima compresión").

## Tecnologías

| Tecnología                                    | Uso                                        |
| --------------------------------------------- | ------------------------------------------ |
| [MozJPEG](https://github.com/mozilla/mozjpeg) | Codec JPEG optimizado (Mozilla)            |
| [Jpegli](https://github.com/google/jpegli)    | Codec JPEG avanzado (Google)               |
| [Emscripten](https://emscripten.org/)         | Compilador C/C++ → WebAssembly             |
| Web Workers                                   | Procesamiento en segundo plano             |
| [JSZip](https://stuk.github.io/jszip/)        | Generación de archivos ZIP en el navegador |

## Licencia

Este proyecto aún no tiene una licencia definida. Si deseas usar el código, por favor abre un issue para discutirlo.

---
