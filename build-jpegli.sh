#!/bin/bash

# Script para compilar Jpegli a WebAssembly
# Ejecutar desde la raíz del proyecto

set -e  # Detener si hay error

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JPEGLI_DIR="$PROJECT_DIR/src/jpegli"
BUILD_DIR="$JPEGLI_DIR/build_wasm"
BUILD_OUT="$PROJECT_DIR/build"
WEB_DIR="$PROJECT_DIR/web"

echo "========================================"
echo " Configuración de entorno"
echo "========================================"

# Verificar que emcc está disponible
if ! command -v emcc &> /dev/null; then
    echo "ERROR: emcc no encontrado. Asegúrate de que Emscripten está activado."
    echo "Prueba: source ~/emsdk/emsdk_env.sh"
    exit 1
fi

echo "Emscripten: $(emcc --version 2>&1 | head -1)"
mkdir -p "$BUILD_OUT"

# Verificar que el repo de jpegli (libjxl) existe
if [ ! -f "$JPEGLI_DIR/CMakeLists.txt" ]; then
    echo "ERROR: No se encontró CMakeLists.txt en $JPEGLI_DIR"
    echo "Clonando libjxl..."
    mkdir -p "$PROJECT_DIR/src"
    cd "$PROJECT_DIR/src"
    rm -rf jpegli
    git clone https://github.com/libjxl/libjxl.git jpegli
    cd jpegli
    git submodule update --init --recursive
fi

echo ""
echo "========================================"
echo " Limpieza previa..."
echo "========================================"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo ""
echo "========================================"
echo " Configurando con emcmake cmake..."
echo "========================================"
cd "$BUILD_DIR"
emcmake cmake "$JPEGLI_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DJPEGXL_ENABLE_TOOLS=OFF \
    -DBUILD_TESTING=OFF \
    -DJPEGXL_ENABLE_BENCHMARK=OFF \
    -DJPEGXL_ENABLE_EXAMPLES=OFF \
    -DJPEGXL_ENABLE_JPEGLI=ON \
    -DJPEGXL_ENABLE_JNI=OFF \
    -DJPEGXL_ENABLE_VIEWERS=OFF \
    -DJPEGXL_ENABLE_SJPEG=OFF \
    -DJPEGXL_FORCE_SYSTEM_BROTLI=OFF \
    -DJPEGXL_FORCE_SYSTEM_HWY=OFF

echo ""
echo "========================================"
echo " Compilando librerias..."
echo "========================================"
emmake make -j$(nproc) jpegli-static jxl_cms jxl_threads hwy

echo ""
echo "========================================"
echo " Verificando archivos generados..."
echo "========================================"
EXPECTED_LIBS=(
    "$BUILD_DIR/lib/libjpegli-static.a"
    "$BUILD_DIR/third_party/highway/libhwy.a"
)

ALL_OK=true
for lib in "${EXPECTED_LIBS[@]}"; do
    if [ -f "$lib" ]; then
        SIZE=$(du -h "$lib" | cut -f1)
        echo "  OK: $(basename $lib) ($SIZE)"
    else
        echo "  FALTA: $lib"
        ALL_OK=false
    fi
done

# libjxl_threads y libjxl_cms pueden estar en lugares distintos según la versión
for lib in "$BUILD_DIR/lib/libjxl_threads.a" "$BUILD_DIR/lib/libjxl_cms.a"; do
    if [ -f "$lib" ]; then
        SIZE=$(du -h "$lib" | cut -f1)
        echo "  OK: $(basename $lib) ($SIZE)"
    fi
done

if [ "$ALL_OK" = false ]; then
    echo ""
    echo "ADVERTENCIA: Algunos .a no se encontraron en las rutas esperadas."
    echo "Buscando todos los .a generados:"
    find "$BUILD_DIR" -name "*.a" -exec ls -lh {} \;
fi

echo ""
echo "========================================"
echo " Compilando el wrapper WASM final..."
echo "========================================"

# Determinar qué librerías están disponibles para linkear
LINK_LIBS="$BUILD_DIR/lib/libjpegli-static.a"

if [ -f "$BUILD_DIR/lib/libjxl_threads.a" ]; then
    LINK_LIBS="$LINK_LIBS $BUILD_DIR/lib/libjxl_threads.a"
fi
if [ -f "$BUILD_DIR/lib/libjxl_cms.a" ]; then
    LINK_LIBS="$LINK_LIBS $BUILD_DIR/lib/libjxl_cms.a"
fi
if [ -f "$BUILD_DIR/third_party/highway/libhwy.a" ]; then
    LINK_LIBS="$LINK_LIBS $BUILD_DIR/third_party/highway/libhwy.a"
fi

echo "Enlazando con: $LINK_LIBS"

cd "$PROJECT_DIR"
emcc src/jpegli-wrapper.cpp \
    -I src/jpegli \
    -I src/jpegli/build_wasm/lib/include \
    -I src/jpegli/lib \
    -I src/jpegli/build_wasm \
    -I src/jpegli/build_wasm/lib/include/jpegli \
    -I src/jpegli/third_party/highway \
    $LINK_LIBS \
    -o build/jpegli/encoder.js \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=134217728 \
    -s MAXIMUM_MEMORY=536870912 \
    -s EXPORTED_RUNTIME_METHODS='["ccall","getValue","wasmMemory"]' \
    -s EXPORTED_FUNCTIONS='["_compress_image_jpegli","_free_result_data_jpegli","_malloc","_free"]' \
    -Os \
    -DNDEBUG

echo ""
echo "========================================"
if [ -f "$BUILD_OUT/jpegli/encoder.js" ] && [ -f "$BUILD_OUT/jpegli/encoder.wasm" ]; then
    JS_SIZE=$(du -h "$BUILD_OUT/jpegli/encoder.js" | cut -f1)
    WASM_SIZE=$(du -h "$BUILD_OUT/jpegli/encoder.wasm" | cut -f1)
    echo " ¡ÉXITO!"
    echo " encoder.js:   $JS_SIZE"
    echo " encoder.wasm: $WASM_SIZE"

    echo ""
    echo "Copiando archivos a la carpeta web..."
    cp "$BUILD_OUT/jpegli/encoder.js" "$WEB_DIR/jpegli/"
    cp "$BUILD_OUT/jpegli/encoder.wasm" "$WEB_DIR/jpegli/"
    echo "¡Archivos copiados con éxito!"
else
    echo " ERROR: No se generaron los archivos de salida."
    exit 1
fi
echo "========================================"