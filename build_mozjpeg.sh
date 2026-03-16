#!/bin/bash
# Script para compilar MozJPEG a WebAssembly
# Ejecutar desde: /home/diego/jpeg-compressor-wasm/

# Limpieza previa: rm -rf src/mozjpeg/build_wasm
# Uso: bash build_mozjpeg.sh

# Mover el archivo jpeg_encoder.js y jpeg_encoder.wasm a la carpeta web
# cp build/jpeg_encoder.js web/ && cp build/jpeg_encoder.wasm web/

set -e

PROJECT_DIR="/home/diego/jpeg-compressor-wasm"
MOZJPEG_DIR="$PROJECT_DIR/src/mozjpeg"
BUILD_DIR="$MOZJPEG_DIR/build_wasm"
BUILD_OUT="$PROJECT_DIR/build"

echo "========================================"
echo " Compilación de MozJPEG WASM"
echo "========================================"

if ! command -v emcc &> /dev/null; then
    echo "ERROR: emcc no encontrado. Asegúrate de que Emscripten está activado."
    echo "Prueba: source ~/emsdk/emsdk_env.sh"
    exit 1
fi

echo "[1/5] Emscripten: $(emcc --version 2>&1 | head -1)"

if [ ! -f "$MOZJPEG_DIR/CMakeLists.txt" ]; then
    echo "ERROR: No se encontró CMakeLists.txt en $MOZJPEG_DIR"
    echo "Clonando mozjpeg..."
    cd "$PROJECT_DIR/src"
    rm -rf mozjpeg
    git clone https://github.com/mozilla/mozjpeg.git mozjpeg
    cd mozjpeg
else
    echo "[2/5] MozJPEG ya existe en $MOZJPEG_DIR"
fi

echo "[3/5] Limpiando build_wasm..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Sin CFLAGS extras: dejamos que cmake configure primero y genera jconfigint.h
unset CFLAGS
unset CXXFLAGS

echo "[4/5] Configurando con emcmake cmake..."
cd "$BUILD_DIR"
emcmake cmake "$MOZJPEG_DIR" \
    -DENABLE_STATIC=ON \
    -DENABLE_SHARED=OFF \
    -DWITH_SIMD=OFF \
    -DWITH_TURBOJPEG=OFF \
    -DPNG_SUPPORTED=OFF \
    -DCMAKE_BUILD_TYPE=Release

# --- FIX: jconfigint.h bug ---
# emcmake cmake genera jconfigint.h con SIZEOF_SIZE_T=7 para wasm32 (bug de
# detección de arquitectura). jchuff.c solo acepta 4 u 8, de lo contrario
# lanza "#error Cannot determine word size". Lo parcheamos antes del make.
JCONFIGINT="$BUILD_DIR/jconfigint.h"
if [ ! -f "$JCONFIGINT" ]; then
    echo "ERROR: No se generó $JCONFIGINT tras cmake"
    exit 1
fi
CURRENT=$(grep "SIZEOF_SIZE_T" "$JCONFIGINT" | head -1)
echo "  jconfigint.h original: $CURRENT"
sed -i 's/#define SIZEOF_SIZE_T.*/#define SIZEOF_SIZE_T 4/' "$JCONFIGINT"
echo "  jconfigint.h parcheado: #define SIZEOF_SIZE_T 4"
# -----------------------------

echo "[5/5] Compilando..."
emmake make -j$(nproc)

echo ""
echo "========================================"
echo " Verificando archivos generados..."
echo "========================================"

if [ -f "$BUILD_DIR/libjpeg.a" ]; then
    SIZE=$(du -h "$BUILD_DIR/libjpeg.a" | cut -f1)
    echo "  OK: libjpeg.a ($SIZE)"
else
    echo "  ERROR: No se encontró libjpeg.a en $BUILD_DIR"
    echo "  Buscando archivos .a generados:"
    find "$BUILD_DIR" -name "*.a" -exec ls -lh {} \;
    exit 1
fi

if [ ! -f "$BUILD_DIR/jconfig.h" ]; then
    echo "  ADVERTENCIA: jconfig.h no encontrado, puede causar errores de compilación."
fi

echo ""
echo "========================================"
echo " Compilando el wrapper WASM final..."
echo "========================================"

mkdir -p "$BUILD_OUT"

cd "$PROJECT_DIR"
emcc src/jpeg_wrapper.c \
    -I src/mozjpeg \
    -I src/mozjpeg/build_wasm \
    "$BUILD_DIR/libjpeg.a" \
    -o build/jpeg_encoder.js \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=134217728 \
    -s MAXIMUM_MEMORY=536870912 \
    -s EXPORTED_RUNTIME_METHODS='["ccall","getValue","wasmMemory"]' \
    -s EXPORTED_FUNCTIONS='["_compress_image","_free","_get_result_data","_get_result_size","_malloc"]' \
    -O3 \
    -DNDEBUG

echo ""
echo "========================================"
if [ -f "$BUILD_OUT/jpeg_encoder.js" ] && [ -f "$BUILD_OUT/jpeg_encoder.wasm" ]; then
    JS_SIZE=$(du -h "$BUILD_OUT/jpeg_encoder.js" | cut -f1)
    WASM_SIZE=$(du -h "$BUILD_OUT/jpeg_encoder.wasm" | cut -f1)
    echo " EXITO!"
    echo " jpeg_encoder.js:   $JS_SIZE"
    echo " jpeg_encoder.wasm: $WASM_SIZE"
else
    echo " ERROR: No se generaron los archivos de salida."
    exit 1
fi
echo "========================================"