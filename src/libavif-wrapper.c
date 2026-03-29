/**
 * libavif-wrapper.c
 *
 * Wrapper mínimo de libavif para uso desde WebAssembly/Emscripten.
 *
 * Flujo de datos:
 *   JS worker → decodeToRGBA() con OffscreenCanvas
 *     → avif_compress_rgba(pixels, width, height, has_alpha, config...)
 *       → avifImage + avifRGBImage
 *       → avifEncoder → AVIF bytes
 *     → get_result_data() / get_result_size()
 *
 * Por qué RGBA en el wrapper (en vez de JPEG/PNG):
 *   El worker JS ya decodifica la imagen al canvas antes de llamar al WASM.
 *   Esto evita dependencias de libjpeg/libpng dentro del WASM y aprovecha
 *   la decodificación nativa del navegador, que es más rápida e incluye
 *   soporte de color management, EXIF rotation, etc.
 *
 * Parámetros:
 *   pixels          — puntero a datos RGBA u8 (ancho × alto × 4 bytes)
 *   width/height    — dimensiones en píxeles
 *   has_alpha       — 1 si los datos tienen canal alpha real, 0 si es todo 255
 *   quality         — 0 = lossless, 1 = máxima calidad con pérdida, 100 = mínima calidad
 *                     (libavif: AVIF_QUALITY_LOSSLESS=100, AVIF_QUALITY_WORST=0 — ojo al revés del JS)
 *                     Aquí normalizamos: 0 JS → lossless, 1-100 JS → (100 - q) libavif
 *   quality_alpha   — -1 = igual que quality; 0-100 con la misma escala
 *   speed           — 0 (más lento, mejor) a 10 (más rápido, peor)
 *   chroma          — 0=4:4:4, 1=4:2:0, 2=4:2:2, 3=4:0:0
 *   bit_depth       — 8, 10 o 12
 *   lossless        — 1 = sin pérdida (ignora quality)
 *   tile_rows_log2  — 0-6 (solo si tiling=1)
 *   tile_cols_log2  — 0-6 (solo si tiling=1)
 */

#include <stdlib.h>
#include <string.h>
#include "avif/avif.h"

/* ── Buffer de resultado compartido ── */
typedef struct {
    uint8_t* data;
    int      size;
} AvifResult;

static AvifResult g_result = {NULL, 0};

/* ── Helpers internos ── */

/**
 * Mapea la escala de calidad JS (0=lossless…100=peor) a la escala de libavif.
 * libavif: AVIF_QUALITY_LOSSLESS = 100, AVIF_QUALITY_WORST = 0.
 * JS: 0 = lossless (tratado fuera), 1 = mejor, 100 = peor.
 *   → libavif_q = 100 - js_q (para el rango 1-100)
 */
static int js_quality_to_libavif(int js_q) {
    if (js_q <= 0) return AVIF_QUALITY_LOSSLESS;
    if (js_q >= 100) return AVIF_QUALITY_WORST;
    return 100 - js_q;  /* 1→99, 50→50, 99→1 */
}

static avifPixelFormat chroma_to_pixel_format(int chroma) {
    switch (chroma) {
        case 0: return AVIF_PIXEL_FORMAT_YUV444;
        case 1: return AVIF_PIXEL_FORMAT_YUV420;
        case 2: return AVIF_PIXEL_FORMAT_YUV422;
        case 3: return AVIF_PIXEL_FORMAT_YUV400;
        default: return AVIF_PIXEL_FORMAT_YUV420;
    }
}

/* ── Función principal exportada ── */

/**
 * avif_compress_rgba — comprime pixels RGBA en formato AVIF.
 *
 * Devuelve 1 en éxito, 0 en error.
 * Después de un éxito, llama a get_result_data() / get_result_size().
 */
int avif_compress_rgba(
    const uint8_t* pixels,
    int width,
    int height,
    int has_alpha,
    int quality,          /* JS: 0=lossless, 1=mejor, 100=peor */
    int quality_alpha,    /* JS: -1=igual que quality, 0-100 */
    int speed,            /* 0=más lento/mejor … 10=más rápido */
    int chroma,           /* 0=4:4:4, 1=4:2:0, 2=4:2:2, 3=4:0:0 */
    int bit_depth,        /* 8, 10 o 12 */
    int lossless,         /* 1 = sin pérdida */
    int tile_rows_log2,   /* 0-6 */
    int tile_cols_log2    /* 0-6 */
) {
    /* Liberar resultado anterior */
    if (g_result.data) {
        free(g_result.data);
        g_result.data = NULL;
        g_result.size = 0;
    }

    avifResult result = AVIF_RESULT_OK;
    avifImage*   image   = NULL;
    avifEncoder* encoder = NULL;
    avifRWData   output  = AVIF_DATA_EMPTY;
    int ret = 0;

    /* ── 1. Crear avifImage ── */
    image = avifImageCreate(width, height, bit_depth, chroma_to_pixel_format(chroma));
    if (!image) goto cleanup;

    /* ── 2. Configurar avifRGBImage y copiar pixels ── */
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, image);
    rgb.format   = AVIF_RGB_FORMAT_RGBA;
    rgb.depth      = 8; /* los pixels del canvas siempre son uint8 */
    rgb.rowBytes = (uint32_t)(width * 4);
    rgb.pixels   = (uint8_t*)pixels;

    result = avifImageRGBToYUV(image, &rgb);
    if (result != AVIF_RESULT_OK) goto cleanup;

    /* Si no hay alpha real, descartar el plano alpha para ahorrar espacio */
    if (!has_alpha) {
        image->alphaPlane    = NULL;
        image->alphaRowBytes = 0;
    }

    /* ── 3. Crear encoder y configurar ── */
    encoder = avifEncoderCreate();
    if (!encoder) goto cleanup;

    encoder->speed = speed;

    /* Opciones de tiling */
    if (tile_rows_log2 > 0) encoder->tileRowsLog2 = tile_rows_log2;
    if (tile_cols_log2 > 0) encoder->tileColsLog2 = tile_cols_log2;

    /* Calidad */
    if (lossless) {
        encoder->quality      = AVIF_QUALITY_LOSSLESS;
        encoder->qualityAlpha = AVIF_QUALITY_LOSSLESS;
        /* lossless requiere YUV444 y bit_depth igual al input */
        if (image->yuvFormat != AVIF_PIXEL_FORMAT_YUV444) {
            /* Forzar reconversión a 444 para lossless */
            avifImageDestroy(image);
            image = avifImageCreate(width, height, bit_depth, AVIF_PIXEL_FORMAT_YUV444);
            if (!image) goto cleanup;
            avifRGBImageSetDefaults(&rgb, image);
            rgb.format   = AVIF_RGB_FORMAT_RGBA; /* siempre RGBA */
            rgb.depth    = 8;
            rgb.rowBytes = (uint32_t)(width * 4);
            rgb.pixels   = (uint8_t*)pixels;
            result = avifImageRGBToYUV(image, &rgb);
            if (result != AVIF_RESULT_OK) goto cleanup;
        }
    } else {
        encoder->quality = js_quality_to_libavif(quality);
        if (quality_alpha < 0) {
            encoder->qualityAlpha = encoder->quality;
        } else {
            encoder->qualityAlpha = js_quality_to_libavif(quality_alpha);
        }
    }

    /* ── 4. Codificar ── */
    result = avifEncoderWrite(encoder, image, &output);
    if (result != AVIF_RESULT_OK) goto cleanup;

    /* ── 5. Copiar output a buffer persistente ── */
    g_result.data = (uint8_t*)malloc(output.size);
    if (!g_result.data) goto cleanup;
    memcpy(g_result.data, output.data, output.size);
    g_result.size = (int)output.size;
    ret = 1;

cleanup:
    if (output.data) avifRWDataFree(&output);
    if (encoder)     avifEncoderDestroy(encoder);
    if (image)       avifImageDestroy(image);
    return ret;
}

/* ── Funciones de acceso al resultado ── */

uint8_t* get_avif_result_data(void) { return g_result.data; }
int      get_avif_result_size(void)  { return g_result.size; }

void free_avif_result(void) {
    if (g_result.data) {
        free(g_result.data);
        g_result.data = NULL;
        g_result.size = 0;
    }
}

/* free() estándar — necesario para que JS libere mallocs del C heap */
/* (ya exportado vía EXPORTED_FUNCTIONS en el script de build) */