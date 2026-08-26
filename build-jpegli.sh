#!/bin/bash

# Script para compilar la última versión de Jpegli (google/jpegli) a WebAssembly
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
mkdir -p "$BUILD_OUT/jpegli" "$WEB_DIR/jpegli"

# Verificar si el repo de jpegli existe y si apunta al repo correcto
if [ ! -f "$JPEGLI_DIR/CMakeLists.txt" ]; then
    echo "ERROR: No se encontró CMakeLists.txt en $JPEGLI_DIR"
    echo "Clonando repositorio oficial de jpegli (google/jpegli)..."
    mkdir -p "$PROJECT_DIR/src"
    cd "$PROJECT_DIR/src"
    rm -rf jpegli
    git clone https://github.com/google/jpegli.git jpegli
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
    -DCMAKE_C_FLAGS_RELEASE="-O3 -msimd128 -DNDEBUG" \
    -DCMAKE_CXX_FLAGS_RELEASE="-O3 -msimd128 -DNDEBUG" \
    -DBUILD_TESTING=OFF \
    -DJPEGLI_ENABLE_TOOLS=OFF \
    -DJPEGXL_ENABLE_TOOLS=OFF \
    -DJPEGLI_ENABLE_BENCHMARK=OFF \
    -DJPEGXL_ENABLE_BENCHMARK=OFF \
    -DJPEGLI_ENABLE_EXAMPLES=OFF \
    -DJPEGXL_ENABLE_EXAMPLES=OFF \
    -DJPEGLI_ENABLE_JNI=OFF \
    -DJPEGXL_ENABLE_JNI=OFF

echo ""
echo "========================================"
echo " Compilando librerias..."
echo "========================================"
emmake make -j$(nproc) jpegli-static hwy jpegli_cms jpegli_threads

echo ""
echo "========================================"
echo " Verificando archivos generados..."
echo "========================================"

# Búsqueda dinámica de librerías estáticas generadas
JPEGLI_LIB=$(find "$BUILD_DIR" -name "libjpegli-static.a" -o -name "libjpegli.a" | head -n 1)
HWY_LIB=$(find "$BUILD_DIR" -name "libhwy.a" | head -n 1)

LINK_LIBS=""
if [ -n "$JPEGLI_LIB" ]; then
    echo "  OK Jpegli lib: $(basename $JPEGLI_LIB) ($(du -h "$JPEGLI_LIB" | cut -f1))"
    LINK_LIBS="$JPEGLI_LIB"
else
    echo "  ERROR: No se encontró libjpegli.a ni libjpegli-static.a en $BUILD_DIR"
    find "$BUILD_DIR" -name "*.a" -exec ls -lh {} \;
    exit 1
fi

if [ -n "$HWY_LIB" ]; then
    echo "  OK Highway lib: $(basename $HWY_LIB) ($(du -h "$HWY_LIB" | cut -f1))"
    LINK_LIBS="$LINK_LIBS $HWY_LIB"
fi

for extra_lib in "libjpegli_threads.a" "libjpegli_cms.a" "libjxl_threads.a" "libjxl_cms.a" "libcms.a"; do
    FOUND_EXTRA=$(find "$BUILD_DIR" -name "$extra_lib" | head -n 1)
    if [ -n "$FOUND_EXTRA" ]; then
        echo "  OK Extra lib: $(basename $FOUND_EXTRA)"
        LINK_LIBS="$LINK_LIBS $FOUND_EXTRA"
    fi
done

echo ""
echo "========================================"
echo " Compilando el wrapper WASM final..."
echo "========================================"
echo "Enlazando con: $LINK_LIBS"

cd "$PROJECT_DIR"

# Configuración de memoria WASM (en bytes):
# INITIAL_MEM = 128 MB (128 * 1024 * 1024 = 134217728 bytes)
# MAX_MEM     = 512 MB (512 * 1024 * 1024 = 536870912 bytes)
INITIAL_MEM=134217728
MAX_MEM=536870912

emcc src/jpegli-wrapper.cpp \
    -I src/jpegli \
    -I src/jpegli/lib \
    -I src/jpegli/include \
    -I src/jpegli/build_wasm \
    -I src/jpegli/build_wasm/lib/include \
    -I src/jpegli/build_wasm/lib/include/jpegli \
    -I src/jpegli/third_party/highway \
    $LINK_LIBS \
    -o build/jpegli/encoder.js \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=${INITIAL_MEM} \
    -s MAXIMUM_MEMORY=${MAX_MEM} \
    -s EXPORTED_RUNTIME_METHODS='["ccall","getValue","wasmMemory"]' \
    -s EXPORTED_FUNCTIONS='["_compress_image_jpegli","_free_result_data_jpegli","_malloc","_free"]' \
    -s FILESYSTEM=0 \
    -s ENVIRONMENT='web' \
    --closure 0 \
    -O3 \
    -msimd128 \
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