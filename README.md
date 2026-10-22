# Compresor de Imágenes WASM (JPEG y PNG)

Compresor de imágenes de alto rendimiento que funciona completamente en el navegador utilizando WebAssembly. Integra tres motores de compresión de vanguardia — **MozJPEG** (Mozilla), **Jpegli** (Google) y **libimagequant + LodePNG** — para optimizar fotografías JPEG y gráficos/ilustraciones PNG con canal alfa, realizar pruebas A/B interactivas y obtener la mejor relación fidelidad visual / tamaño de archivo sin depender de servidores.

## ¿Por qué este proyecto?

La mayoría de herramientas de compresión de imágenes requieren instalar software pesado de escritorio, usar la consola de comandos, o subir archivos sensibles a servidores externos. Este proyecto nace de la necesidad de:

- **Comprimir imágenes directamente en el navegador**, con total privacidad: los datos nunca abandonan tu máquina.
- **Ajustar con máxima granularidad todos los parámetros de compresión** (calidad luma/croma, cuantización espectral, trellis, espacio de color XYB, posterización, tramado dithering, estrategias de filtrado PNG y ventana Deflate) desde una interfaz moderna sin tocar la terminal.
- **Comparar fácilmente los resultados** de distintos motores lado a lado, con un visor A/B interactivo con zoom sincrónico, paneo y slider, permitiendo elegir la mejor opción con criterio propio.
- **Soportar lotes mixtos (JPEG y PNG)** con detección inteligente de transparencias y opciones de descarga directa o paquetes ZIP organizados.

## Características

- **Privacidad absoluta**: Las imágenes se procesan 100% en el cliente mediante módulos WebAssembly compilados.
- **Aceleración WASM SIMD y Google Highway**: Binarios compilados con máxima optimización (`-O3`), Link-Time Optimization (`-flto`) y vectorización WebAssembly SIMD de 128-bit (`-msimd128`), aprovechando los kernels vectoriales nativos de Google Highway (`hwy`) y LLVM para transformadas DCT, cuantización y espacios de color.
- **Worker Pools y procesamiento concurrente en lote**: Arquitectura multi-hilo no bloqueante que distribuye la compresión de lotes de imágenes en paralelo a través de pools dedicados de Web Workers dimensionados automáticamente según los núcleos del procesador (`navigator.hardwareConcurrency`).
- **Streaming de scanlines de ultra bajo consumo de memoria**: Pipeline por bloques de 16 scanlines entre decodificación y compresión en C/C++ para JPEG, reduciendo la huella de RAM a menos de 1 MB por imagen y maximizando la localidad en memoria caché L1/L2.
- **Tres motores de compresión optimizados**:
  - **MozJPEG**: Optimización Huffman, cuantización Trellis, tablas de cuantización adaptativas y control independiente de croma.
  - **Jpegli**: Espacio de color XYB, distancia perceptual butteraugli y cuantización adaptativa de última generación.
  - **libimagequant + LodePNG**: Cuantización de color indexado PNG-8 con preservación de canal alfa de 8 bits completo, tramado Floyd-Steinberg, posterización (0-4 bits), balance gamma, reducción adaptativa de profundidad de bits (1, 2, 4 u 8 bits) y compresión Deflate de 32 KB.
- **Configuración avanzada y Guía interactiva**: Modales dedicadas organizadas en acordeones temáticos y guías interactivas con documentación técnica, pros, contras y valores recomendados. Los botones `(i)` junto a cada ajuste permiten saltar directamente al ítem correspondiente con animación de resaltado.
- **Métricas de calidad en tiempo real**: Muestra el porcentaje de compresión, tamaño exacto, calidad visual obtenida (0–100) y número final de colores en la paleta directamente en la tarjeta de cada archivo.
- **Comparación visual A/B con soporte de transparencia**: Visor interactivo con división por slider, zoom sincrónico hasta 8x y fondo ajedrezado para inspeccionar bordes translúcidos en PNGs.
- **Detección inteligente de PNGs opacos sin doble compresión**: Sugiere optimizar PNGs sin canal alfa mediante MozJPEG o Jpegli transmitiendo los píxeles crudos (RGBA) directamente al encoder WASM sin conversiones intermedias por canvas con pérdida. El archivo PNG original se conserva íntegro para la comparación visual A/B y cálculo de ahorro real, exportando el resultado en `.jpg`.
- **Accesibilidad integral (WAI-ARIA)**: Soporte completo para lectores de pantalla, navegación fluida por teclado, feedback visual instantáneo de errores y respeto por `prefers-reduced-motion`.

## Uso

1. Clona el repositorio.
2. Sirve la carpeta `web/` con cualquier servidor estático (ej: `python -m http.server 8000 --directory web` o la extensión Live Server de VS Code).
3. Abre la URL en un navegador moderno.
4. Arrastra imágenes JPEG o PNG al área de carga o haz clic para seleccionarlas.
5. Ajusta los parámetros de compresión con los botones ⚙️ de cada motor (opcional) o consulta las guías de opciones pulsando los iconos `(i)`.
6. Presiona **Comprimir** (o el botón específico de cada motor) y observa el progreso en tiempo real.
7. Usa el botón **Comparar** en cada imagen para inspeccionar visualmente la calidad contra el original.
8. Descarga las imágenes optimizadas individualmente o todas juntas en un archivo ZIP.

### Requisitos del sistema

- Navegador web moderno con soporte para WebAssembly, WASM SIMD y Web Workers (Chrome 91+, Firefox 89+, Edge 91+, Safari 16.4+).
- Archivos de entrada compatibles: **JPEG** (`.jpg`, `.jpeg`) y **PNG** (`.png`).

## Motores de compresión

### MozJPEG
Códec JPEG maduro desarrollado por Mozilla. Sobresale en imágenes de resolución media y alta gracias a la cuantización Trellis (optimización rate-distortion), optimización de scans progresivos y matrices de cuantización psicovisuales (PSNR-HVS-M, MS-SSIM).

### Jpegli
Códec JPEG de última generación desarrollado por Google a partir de la tecnología de JPEG XL. Proporciona una densidad de compresión excepcional en ratios de bits bajos mediante cuantización adaptativa por bloque, espacio perceptual XYB y métricas visuales butteraugli, manteniendo total compatibilidad con cualquier decodificador JPEG estándar.

### libimagequant + LodePNG
Motor especializado en optimización de imágenes PNG. Decodifica el PNG a RGBA32, realiza una reducción inteligente de paleta mediante K-means y cuantización median-cut preservando transparencia de 8 bits (PNG-8 translúcido), y reempaqueta el contenedor con LodePNG aplicando filtrado diferencial de líneas, ventana LZ77 de 32 KB y reducción de profundidad de bits (1, 2, 4 u 8 bits).

## Compilación de los motores WASM

Los binarios WASM precompilados ya están incluidos en `web/engines/`, por lo que **no necesitas compilar nada para usar la aplicación**. Solo compila si deseas modificar los wrappers C/C++ o actualizar librerías upstream.

### Requisitos de compilación

- Linux o WSL (los scripts son bash).
- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) instalado y activado.

### Compilar

```bash
# Activar Emscripten
source ~/emsdk/emsdk_env.sh

# Compilar MozJPEG
bash scripts/build-mozjpeg.sh

# Compilar Jpegli
bash scripts/build-jpegli.sh

# Compilar libimagequant + LodePNG
bash scripts/build-imagequant.sh
```

Cada script se encarga de verificar el entorno, compilar los componentes estáticos con `-O3 -flto -msimd128`, enlazar el wrapper WASM y sincronizar los archivos resultantes en `web/engines/`.

> Para detalles técnicos de arquitectura, paso de parámetros y flujos de datos internos, consulta [AGENTS.md](AGENTS.md).

## Estructura del proyecto

```
wasm-compressor/
├── AGENTS.md                   # Documentación técnica para agentes y desarrolladores
├── README.md                   # Este archivo
├── scripts/                    # Scripts de compilación a WebAssembly
│   ├── build-mozjpeg.sh        # Compilación MozJPEG → WASM
│   ├── build-jpegli.sh         # Compilación Jpegli → WASM
│   └── build-imagequant.sh     # Compilación libimagequant + LodePNG → WASM
├── src/                        # Código fuente C/C++
│   ├── mozjpeg-wrapper.c       # Wrapper MozJPEG para Emscripten
│   ├── jpegli-wrapper.cpp      # Wrapper Jpegli para Emscripten
│   ├── imagequant-wrapper.c    # Wrapper libimagequant + LodePNG
│   └── imagequant/             # Fuentes upstream libimagequant y LodePNG
└── web/                        # Aplicación frontend cliente (servir esta carpeta)
    ├── index.html
    ├── css/
    │   ├── main.css            # Estilos principales y diseño responsivo
    │   └── compare.css         # Estilos del visor de comparación A/B
    ├── js/
    │   ├── main.js             # Lógica principal (Worker Pools, gestión de lotes y descargas)
    │   ├── modal.js            # Modales programáticas de configuración
    │   ├── guide.js            # Documentación interactiva y navegación asistida
    │   └── compare.js          # Visor de comparación A/B con zoom y paneo
    └── engines/                # Módulos WebAssembly y Workers
        ├── mozjpeg/            # Worker y binarios MozJPEG
        ├── jpegli/             # Worker y binarios Jpegli
        └── imagequant/         # Worker y binarios libimagequant
```

## Roadmap

- [x] Integración de MozJPEG y Jpegli con configuración avanzada de parámetros.
- [x] Visor de comparación A/B con zoom y slider interactivo.
- [x] Soporte de múltiples imágenes y descarga en ZIP por lotes.
- [x] Soporte nativo para formato PNG mediante **libimagequant** y **LodePNG** con paleta de transparencia completa.
- [x] Suite avanzada de opciones de cuantización, posterización, tramado y tuning Deflate para PNG.
- [ ] Soporte para codificación WebP y compresión de próxima generación AVIF (`libavif`).
- [ ] Presets de configuración guardables por usuario (ej: "web optimizado", "alta calidad", "máxima compresión").

## Tecnologías

| Tecnología                                                   | Uso                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [MozJPEG](https://github.com/mozilla/mozjpeg)                | Códec JPEG optimizado psicovisualmente (Mozilla)             |
| [Jpegli](https://github.com/google/jpegli)                   | Códec JPEG avanzado con espacio XYB (Google)                  |
| [libimagequant](https://github.com/ImageOptim/libimagequant) | Cuantizador de color de paleta PNG-8 y canal alfa            |
| [LodePNG](https://github.com/lvandeve/lodepng)               | Codificador y decodificador PNG / Deflate en C               |
| [Emscripten](https://emscripten.org/)                        | Cadena de compilación C/C++ → WebAssembly SIMD              |
| Web Workers                                                  | Procesamiento concurrente multi-hilo en segundo plano        |
| [JSZip](https://stuk.github.io/jszip/)                       | Generación y empaquetado de archivos ZIP en el navegador     |

## Licencia

Este proyecto aún no tiene una licencia definida. Si deseas usar el código, por favor abre un issue para discutirlo.
