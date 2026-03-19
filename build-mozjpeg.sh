#!/bin/bash

# Script para compilar MozJPEG a WebAssembly
# Ejecutar desde la raíz del proyecto

set -e # Detener si hay error

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOZJPEG_DIR="$PROJECT_DIR/src/mozjpeg"
BUILD_DIR="$MOZJPEG_DIR/build_wasm"
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

# Verificar que el repo de mozjpeg existe
if [ ! -f "$MOZJPEG_DIR/CMakeLists.txt" ]; then
    echo "ERROR: No se encontró CMakeLists.txt en $MOZJPEG_DIR"
    echo "Clonando mozjpeg..."
    mkdir -p "$PROJECT_DIR/src"
    cd "$PROJECT_DIR/src"
    rm -rf mozjpeg
    git clone https://github.com/mozilla/mozjpeg.git mozjpeg
    cd mozjpeg
else
    echo "MozJPEG ya existe en $MOZJPEG_DIR"
fi

echo ""
echo "========================================"
echo " Limpieza previa..."
echo "========================================"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Sin CFLAGS extras: dejamos que cmake configure primero y genera jconfigint.h
unset CFLAGS
unset CXXFLAGS

echo ""
echo "========================================"
echo " Configurando con emcmake cmake..."
echo "========================================"
cd "$BUILD_DIR"
emcmake cmake "$MOZJPEG_DIR" \
    -DENABLE_STATIC=ON \
    -DENABLE_SHARED=OFF \
    -DWITH_SIMD=OFF \
    -DWITH_TURBOJPEG=OFF \
    -DPNG_SUPPORTED=OFF \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS_RELEASE="-Os -DNDEBUG"

JCONFIGINT="$BUILD_DIR/jconfigint.h"
if [ ! -f "$JCONFIGINT" ]; then
    echo "ERROR: No se generó $JCONFIGINT tras cmake"
    exit 1
fi
CURRENT=$(grep "SIZEOF_SIZE_T" "$JCONFIGINT" | head -1)
echo "  jconfigint.h original: $CURRENT"
sed -i 's/#define SIZEOF_SIZE_T.*/#define SIZEOF_SIZE_T 4/' "$JCONFIGINT"
echo "  jconfigint.h parcheado: #define SIZEOF_SIZE_T 4"

echo ""
echo "========================================"
echo " Compilando..."
echo "========================================"
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

cd "$PROJECT_DIR"
emcc src/mozjpeg-wrapper.c \
    -I src/mozjpeg \
    -I src/mozjpeg/build_wasm \
    "$BUILD_DIR/libjpeg.a" \
    -o build/mozjpeg/encoder.js \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=134217728 \
    -s MAXIMUM_MEMORY=536870912 \
    -s EXPORTED_RUNTIME_METHODS='["ccall","getValue","wasmMemory"]' \
    -s EXPORTED_FUNCTIONS='["_compress_image","_free","_get_result_data","_get_result_size","_malloc"]' \
    -s FILESYSTEM=0 \
    -s ENVIRONMENT='web' \
    --closure 1 \
    -Os \
    -DNDEBUG

echo ""
echo "========================================"
if [ -f "$BUILD_OUT/mozjpeg/encoder.js" ] && [ -f "$BUILD_OUT/mozjpeg/encoder.wasm" ]; then
    JS_SIZE=$(du -h "$BUILD_OUT/mozjpeg/encoder.js" | cut -f1)
    WASM_SIZE=$(du -h "$BUILD_OUT/mozjpeg/encoder.wasm" | cut -f1)
    echo " ¡ÉXITO!"
    echo " encoder.js:   $JS_SIZE"
    echo " encoder.wasm: $WASM_SIZE"
    
    echo ""
    echo "Copiando archivos a la carpeta web..."
    cp "$BUILD_OUT/mozjpeg/encoder.js" "$WEB_DIR/mozjpeg/"
    cp "$BUILD_OUT/mozjpeg/encoder.wasm" "$WEB_DIR/mozjpeg/"
    echo "¡Archivos copiados con éxito!"
else
    echo " ERROR: No se generaron los archivos de salida."
    exit 1
fi
echo "========================================"