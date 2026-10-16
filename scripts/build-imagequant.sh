#!/bin/bash

# Script para compilar libimagequant + lodepng a WebAssembly
# Ejecutar desde la raíz del proyecto

set -e # Detener si hay error

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGEQUANT_SRC="$PROJECT_DIR/src/imagequant"
BUILD_OUT="$PROJECT_DIR/build"
WEB_DIR="$PROJECT_DIR/web"

echo "========================================"
echo " Configuración de entorno"
echo "========================================"

# Cargar emsdk si no está en PATH
if ! command -v emcc &> /dev/null; then
    if [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
        source "$HOME/emsdk/emsdk_env.sh"
    fi
fi

if ! command -v emcc &> /dev/null; then
    echo "ERROR: emcc no encontrado. Asegúrate de que Emscripten está activado."
    echo "Prueba: source ~/emsdk/emsdk_env.sh"
    exit 1
fi

echo "Emscripten: $(emcc --version 2>&1 | head -1)"
mkdir -p "$BUILD_OUT/imagequant" "$WEB_DIR/engines/imagequant"

# Verificar que existen las fuentes
if [ ! -f "$IMAGEQUANT_SRC/libimagequant/libimagequant.c" ]; then
    echo "Clonando libimagequant..."
    mkdir -p "$IMAGEQUANT_SRC"
    cd "$IMAGEQUANT_SRC"
    git clone --depth 1 --branch 2.18.0 https://github.com/ImageOptim/libimagequant.git libimagequant
fi

if [ ! -f "$IMAGEQUANT_SRC/lodepng/lodepng.c" ]; then
    echo "Descargando lodepng..."
    mkdir -p "$IMAGEQUANT_SRC/lodepng"
    curl -sSL https://raw.githubusercontent.com/lvandeve/lodepng/master/lodepng.h -o "$IMAGEQUANT_SRC/lodepng/lodepng.h"
    curl -sSL https://raw.githubusercontent.com/lvandeve/lodepng/master/lodepng.cpp -o "$IMAGEQUANT_SRC/lodepng/lodepng.c"
fi

echo ""
echo "========================================"
echo " Compilando libimagequant + lodepng WASM..."
echo "========================================"

cd "$PROJECT_DIR"

INITIAL_MEM=134217728 # 128 MB
MAX_MEM=536870912     # 512 MB

LIBIQ_DIR="src/imagequant/libimagequant"
LODEPNG_DIR="src/imagequant/lodepng"

emcc \
    src/imagequant-wrapper.c \
    "$LIBIQ_DIR/pam.c" \
    "$LIBIQ_DIR/mediancut.c" \
    "$LIBIQ_DIR/blur.c" \
    "$LIBIQ_DIR/remap.c" \
    "$LIBIQ_DIR/mempool.c" \
    "$LIBIQ_DIR/kmeans.c" \
    "$LIBIQ_DIR/nearest.c" \
    "$LIBIQ_DIR/libimagequant.c" \
    "$LODEPNG_DIR/lodepng.c" \
    -I src \
    -I "$LIBIQ_DIR" \
    -I "$LODEPNG_DIR" \
    -o "$BUILD_OUT/imagequant/encoder.js" \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=${INITIAL_MEM} \
    -s MAXIMUM_MEMORY=${MAX_MEM} \
    -s EXPORTED_RUNTIME_METHODS='["ccall","getValue","wasmMemory"]' \
    -s EXPORTED_FUNCTIONS='["_compress_image_imagequant","_free","_free_result_data_imagequant","_malloc"]' \
    -s FILESYSTEM=0 \
    -s ENVIRONMENT='web' \
    --closure 0 \
    -O3 \
    -flto \
    -msimd128 \
    -DNDEBUG

echo ""
echo "========================================"
if [ -f "$BUILD_OUT/imagequant/encoder.js" ] && [ -f "$BUILD_OUT/imagequant/encoder.wasm" ]; then
    JS_SIZE=$(du -h "$BUILD_OUT/imagequant/encoder.js" | cut -f1)
    WASM_SIZE=$(du -h "$BUILD_OUT/imagequant/encoder.wasm" | cut -f1)
    echo " ¡ÉXITO!"
    echo " encoder.js:   $JS_SIZE"
    echo " encoder.wasm: $WASM_SIZE"
    
    echo ""
    echo "Copiando archivos a web/engines/imagequant/..."
    cp "$BUILD_OUT/imagequant/encoder.js" "$WEB_DIR/engines/imagequant/"
    cp "$BUILD_OUT/imagequant/encoder.wasm" "$WEB_DIR/engines/imagequant/"
    echo "¡Archivos copiados con éxito!"
else
    echo " ERROR: No se generaron los archivos de salida."
    exit 1
fi
echo "========================================"
