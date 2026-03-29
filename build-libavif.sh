#!/bin/bash

# Script para compilar libavif a WebAssembly con Emscripten
# Ejecutar desde la raíz del proyecto:
#   source ~/emsdk/emsdk_env.sh && bash build-libavif.sh

set -e  # Detener si hay error

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIBAVIF_DIR="$PROJECT_DIR/src/libavif"
AOM_SRC_DIR="$LIBAVIF_DIR/ext/aom"
AOM_BUILD_DIR="$AOM_SRC_DIR/build.libavif"
BUILD_DIR="$LIBAVIF_DIR/build_wasm"
BUILD_OUT="$PROJECT_DIR/build/avif"
WEB_DIR="$PROJECT_DIR/web/avif"

echo "========================================"
echo " Configuración de entorno"
echo "========================================"

# Verificar que emcc está disponible
if ! command -v emcc &> /dev/null; then
    echo "ERROR: emcc no encontrado. Activa Emscripten con:"
    echo "  source ~/emsdk/emsdk_env.sh"
    exit 1
fi

# Verificar que ninja está disponible
if ! command -v ninja &> /dev/null; then
    echo "ERROR: ninja no encontrado. Instálalo con:"
    echo "  sudo apt install ninja-build"
    exit 1
fi

echo "Emscripten: $(emcc --version 2>&1 | head -1)"
echo "Proyecto:   $PROJECT_DIR"
mkdir -p "$BUILD_OUT"

# ── Clonar libavif si no existe ──────────────────────────────────────────────
# Nota: esta versión de libavif NO usa submódulos git.
# Usa scripts .cmd propios en ext/ para gestionar dependencias.
if [ ! -f "$LIBAVIF_DIR/CMakeLists.txt" ]; then
    echo ""
    echo "Clonando libavif..."
    mkdir -p "$PROJECT_DIR/src"
    cd "$PROJECT_DIR/src"
    rm -rf libavif
    git clone --filter=blob:none \
        https://github.com/AOMediaCodec/libavif.git libavif
    echo "libavif clonado."
else
    echo "libavif ya existe en $LIBAVIF_DIR"
fi

# ── Clonar aom si no existe ──────────────────────────────────────────────────
# Versión exacta según ext/aom.cmd de libavif (v3.13.2)
# libavif lo busca automáticamente en ext/aom/ cuando AVIF_CODEC_AOM=LOCAL
if [ ! -f "$AOM_SRC_DIR/CMakeLists.txt" ]; then
    echo ""
    echo "Clonando aom v3.13.2..."
    cd "$LIBAVIF_DIR/ext"
    rm -rf aom
    git clone -b v3.13.2 --depth 1 https://aomedia.googlesource.com/aom
    echo "aom clonado."
else
    echo "aom ya existe en $AOM_SRC_DIR"
fi

echo ""
echo "========================================"
echo " Compilando aom (AV1 codec) con Emscripten"
echo "========================================"

# Reusar build si libaom.a ya existe
if [ -f "$AOM_BUILD_DIR/libaom.a" ]; then
    echo "libaom.a ya existe, saltando compilación."
else
    rm -rf "$AOM_BUILD_DIR"
    mkdir -p "$AOM_BUILD_DIR"
    cd "$AOM_BUILD_DIR"

    emcmake cmake .. \
        -G Ninja \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_C_FLAGS_RELEASE="-Os -DNDEBUG" \
        -DCMAKE_CXX_FLAGS_RELEASE="-Os -DNDEBUG" \
        -DBUILD_SHARED_LIBS=OFF \
        -DCONFIG_PIC=1 \
        -DAOM_TARGET_CPU=generic \
        -DENABLE_DOCS=0 \
        -DENABLE_EXAMPLES=0 \
        -DENABLE_TESTDATA=0 \
        -DENABLE_TESTS=0 \
        -DENABLE_TOOLS=0 \
        -DCONFIG_RUNTIME_CPU_DETECT=0 \
        -DCONFIG_MULTITHREAD=0 \
        -DCONFIG_OS_SUPPORT=0 \
        -DCONFIG_WEBM_IO=0

    echo "Compilando aom... (puede tardar varios minutos)"
    cmake --build . --config Release --parallel $(nproc)
fi

AOM_LIB="$AOM_BUILD_DIR/libaom.a"
if [ ! -f "$AOM_LIB" ]; then
    echo "ERROR: No se generó $AOM_LIB"
    find "$AOM_BUILD_DIR" -name "*.a" 2>/dev/null || echo "  (ninguno)"
    exit 1
fi
echo "  OK: libaom.a ($(du -h "$AOM_LIB" | cut -f1))"

echo ""
echo "========================================"
echo " Compilando libavif"
echo "========================================"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Notas:
# - AVIF_CODEC_AOM=LOCAL: libavif detecta aom automáticamente en ext/aom/
# - CMAKE_SKIP_INSTALL_RULES=ON: evita el bug del export de avif_obj con Emscripten
# - No pasar AOM_LIBRARY/AOM_INCLUDE_DIR/AVIF_LOCAL_AOM: esta versión no los usa
emcmake cmake .. \
    -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS_RELEASE="-Os -DNDEBUG" \
    -DAVIF_CODEC_AOM=LOCAL \
    -DCMAKE_SKIP_INSTALL_RULES=ON \
    -DAVIF_BUILD_APPS=OFF \
    -DAVIF_BUILD_TESTS=OFF \
    -DAVIF_LIBYUV=OFF \
    -DAVIF_LIBSHARPYUV=OFF

echo "Compilando libavif..."
cmake --build . --config Release --parallel $(nproc)

AVIF_LIB="$BUILD_DIR/libavif.a"
if [ ! -f "$AVIF_LIB" ]; then
    echo "ERROR: No se generó $AVIF_LIB"
    find "$BUILD_DIR" -name "*.a" 2>/dev/null || echo "  (ninguno)"
    exit 1
fi
echo "  OK: libavif.a ($(du -h "$AVIF_LIB" | cut -f1))"

echo ""
echo "========================================"
echo " Compilando el wrapper WASM final"
echo "========================================"

cd "$PROJECT_DIR"

emcc src/libavif-wrapper.c \
    -I src/libavif/include \
    -I src/libavif/ext/aom \
    src/libavif/build_wasm/libavif.a \
    src/libavif/ext/aom/build.libavif/libaom.a \
    -o build/avif/encoder.js \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=134217728 \
    -s MAXIMUM_MEMORY=1073741824 \
    -s STACK_SIZE=5242880 \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","wasmMemory"]' \
    -s EXPORTED_FUNCTIONS='["_avif_compress_rgba","_get_avif_result_data","_get_avif_result_size","_free_avif_result","_malloc","_free"]' \
    -s FILESYSTEM=0 \
    -s ENVIRONMENT='worker' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='LibAVIF' \
    -Os \
    -DNDEBUG

echo ""
echo "========================================"
if [ -f "$BUILD_OUT/encoder.js" ] && [ -f "$BUILD_OUT/encoder.wasm" ]; then
    JS_SIZE=$(du -h "$BUILD_OUT/encoder.js"   | cut -f1)
    WASM_SIZE=$(du -h "$BUILD_OUT/encoder.wasm" | cut -f1)
    echo " ¡ÉXITO!"
    echo " encoder.js:   $JS_SIZE"
    echo " encoder.wasm: $WASM_SIZE"

    echo ""
    echo "Copiando archivos a web/avif/..."
    mkdir -p "$WEB_DIR"
    cp "$BUILD_OUT/encoder.js"   "$WEB_DIR/"
    cp "$BUILD_OUT/encoder.wasm" "$WEB_DIR/"
    echo "¡Archivos copiados con éxito!"
else
    echo " ERROR: No se generaron los archivos de salida."
    echo " Archivos en $BUILD_OUT:"
    ls -lh "$BUILD_OUT/" 2>/dev/null || echo "  (directorio vacío)"
    exit 1
fi
echo "========================================"