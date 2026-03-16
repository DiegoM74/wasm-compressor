# Compresor JPEG WASM

Compresor de imágenes JPEG que funciona completamente en el navegador utilizando WebAssembly e integrando MozJPEG y Jpegli para compresión optimizada.

## Características

- **Sin servidor**: Todo el procesamiento ocurre localmente en tu navegador, sin necesidad de backend ni envío de datos a servidores externos.
- **Privacidad total**: Las imágenes nunca salen del dispositivo del usuario. El procesamiento se realiza 100% en cliente.
- **WebAssembly**: Rendimiento cercano al nativo mediante compilación de código C a WebAssembly con Emscripten.
- **Soporte múltiple imágenes**: Capacidad de cargar y procesar múltiples archivos JPEG simultáneamente. Las imágenes comprimidas pueden descargar individualmente o en un archivo ZIP para descarga conjunta.
- **Web Worker**: El motor de compresión corre en segundo plano, sin bloquear la interfaz de usuario durante el procesamiento.
- **Configuración Avanzada**: Modales dedicados para ajustar todos los parámetros y flags posibles de MozJPEG y Jpegli directamente desde la interfaz web.

## Arquitectura Tecnológica

El proyecto integra dos librerías de compresión JPEG trabajando en paralelo:

### MozJPEG

- Codec JPEG optimizado por Mozilla con años de desarrollo maduro.
- Implementación compilada a WebAssembly mediante Emscripten.
- Proporciona compresión confiable y de alta calidad.

### Jpegli

- Codec JPEG de Google con algoritmos avanzados derivados de JPEG XL.
- Proporciona una calidad superior a ratios de bits bajos y es totalmente compatible con visores JPEG estándar.
- Implementación completa en WebAssembly con soporte para cuantización adaptativa y espacio de color XYB.

### Enfoque de Compresión Comparativa

El objetivo del proyecto no es únicamente utilizar MozJPEG o Jpegli, sino integrar ambas librerías para realizar pruebas A/B y determinar qué técnica ofrece mejor relación entre compresión y preservación de detalles visuales según cada caso de uso específico.

## Tecnologías Utilizadas

- **MozJPEG**: Codec JPEG optimizado por Mozilla
- **Jpegli**: Codec JPEG optimizado por Google
- **Emscripten**: Compilador C/C++ a WebAssembly
- **Web Workers**: Procesamiento en segundo plano para no bloquear la interfaz
- **JSZip**: Paquetización de múltiples archivos comprimidos en ZIP

## Instalación y Uso

1. Clona el repositorio
2. Abre la carpeta `web` directamente en un navegador web moderno
3. Arrastra una o más imágenes JPEG al área designada, o haz clic para seleccionar archivos desde el sistema de archivos
4. Presiona el botón "Comprimir" cuando se hayan cargado las imágenes
5. Descarga las imágenes optimizadas individualmente o todas juntas en un ZIP presionando el botón "Descargar"

## Requisitos del Sistema

- Navegador web moderno con soporte para Web Workers y WebAssembly
- Archivos de entrada exclusivamente en formato JPEG (próximamente se soportarán otros formatos)

El proyecto incluye scripts de automatización para facilitar la compilación de ambos motores en un entorno Linux (o WSL en Windows):

```bash
# Requisitos: Emscripten SDK instalado y activado
# Asegúrate de haber ejecutado: source /ruta/a/emsdk/emsdk_env.sh

# Para compilar MozJPEG
bash build_mozjpeg.sh

# Para compilar Jpegli
bash build_jpegli.sh
```

Los scripts son generales y pueden ejecutarse en cualquier PC con Emscripten. Se encargan de:

1.  **Configurar el entorno**: Verificar herramientas y descargar el código fuente necesario si no existe.
2.  **Limpieza previa**: Eliminar compilaciones anteriores para asegurar un estado limpio.
3.  **Compilación**: Configurar CMake con flags óptimos para WebAssembly y compilar las librerías.
4.  **WRAPPER WASM**: Generar los archivos `.js` y `.wasm` finales en la carpeta `build/`.
5.  **Despliegue automático**: Copiar automáticamente los archivos generados a la carpeta `web/` para que la aplicación frontend pueda usarlos inmediatamente.

## Estructura del Proyecto

```
jpeg-compressor-wasm/
├── README.md               # Este archivo de documentación
├── .gitignore              # Archivo de ignorado para git
├── build_mozjpeg.sh        # Script de compilación automatizada para MozJPEG
├── build_jpegli.sh         # Script de compilación automatizada para Jpegli
├── build/                  # Directorio de archivos compilados finales
│   ├── jpeg_encoder.js     # Módulo JS de MozJPEG
│   ├── jpeg_encoder.wasm   # Binario WASM de MozJPEG
│   ├── jpegli_encoder.js   # Módulo JS de Jpegli
│   └── jpegli_encoder.wasm # Binario WASM de Jpegli
├── src/                    # Código fuente C/C++
│   ├── jpeg_wrapper.c      # Wrapper para MozJPEG
│   ├── jpegli_wrapper.cpp  # Wrapper para Jpegli
│   ├── mozjpeg/            # Submódulo/Código de MozJPEG
│   └── jpegli/             # Submódulo/Código de Jpegli (libjxl)
└── web/                    # Aplicación frontend
    ├── index.html          # Interfaz de usuario (página principal)
    ├── main.js             # Lógica de la aplicación y modales
    ├── styles.css          # Estilos visuales
    ├── worker.js           # Web Worker para MozJPEG
    ├── worker-jpegli.js    # Web Worker para Jpegli
    ├── jpeg_encoder.js     # (Auto-generado) Binario MozJPEG
    ├── jpeg_encoder.wasm   # (Auto-generado) Binario MozJPEG
    ├── jpegli_encoder.js   # (Auto-generado) Binario Jpegli
    └── jpegli_encoder.wasm # (Auto-generado) Binario Jpegli
```

## Roadmap

- **Fase Actual**: Integración completa de MozJPEG y Jpegli con soporte para configuración avanzada de parámetros.
- **Próxima Fase**: Soporte para otros formatos de entrada (PNG, WebP) para optimizar su compresión.
- **Futuro**: Soporte de otros codecs de salida modernos como WebP y AVIF.

## Licencia

Este proyecto se encuentra bajo la licencia MIT con dependencias en sus términos propios de licencia original.

---
