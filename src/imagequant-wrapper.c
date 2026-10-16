#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "imagequant/libimagequant/libimagequant.h"
#include "imagequant/lodepng/lodepng.h"

typedef struct {
    unsigned char* data;       // bytes 0..3
    int size;                  // bytes 4..7
    int attained_quality;      // bytes 8..11 (0-100)
    int palette_colors;        // bytes 12..15
    int output_bitdepth;       // bytes 16..19 (1, 2, 4 u 8)
    float mse_error;           // bytes 20..23 (error cuadrático medio)
} CompressedResult;

static CompressedResult g_result = {NULL, 0, 0, 0, 0, 0.0f};

#ifdef __cplusplus
extern "C" {
#endif

CompressedResult* compress_image_imagequant(
    unsigned char* input_buffer,
    int input_size,
    int max_colors,
    int min_quality,
    int max_quality,
    int strict_quality,
    int speed,
    float dithering,
    int posterization,
    float gamma,
    int last_index_transparent,
    int auto_bit_depth,
    int filter_strategy,
    int filter_palette_zero,
    int zlib_windowsize,
    int zlib_nicematch,
    int zlib_lazymatching,
    int interlace,
    int strip_metadata,
    int write_srgb_chunk
) {
    g_result.data = NULL;
    g_result.size = 0;
    g_result.attained_quality = 0;
    g_result.palette_colors = 0;
    g_result.output_bitdepth = 8;
    g_result.mse_error = 0.0f;

    if (!input_buffer || input_size <= 0) {
        return &g_result;
    }

    // 1. Decodificar el PNG de entrada a RGBA32 en memoria
    unsigned char* rgba_pixels = NULL;
    unsigned int width = 0;
    unsigned int height = 0;
    unsigned int error = lodepng_decode32(&rgba_pixels, &width, &height, input_buffer, (size_t)input_size);
    if (error || !rgba_pixels || width == 0 || height == 0) {
        if (rgba_pixels) free(rgba_pixels);
        return &g_result;
    }

    // 2. Configurar atributos de cuantización
    liq_attr *attr = liq_attr_create();
    if (!attr) {
        free(rgba_pixels);
        return &g_result;
    }

    if (max_colors < 2) max_colors = 2;
    if (max_colors > 256) max_colors = 256;
    liq_set_max_colors(attr, max_colors);

    if (speed < 1) speed = 1;
    if (speed > 10) speed = 10;
    liq_set_speed(attr, speed);

    if (min_quality < 0) min_quality = 0;
    if (max_quality > 100) max_quality = 100;
    if (min_quality > max_quality) min_quality = max_quality;
    liq_set_quality(attr, min_quality, max_quality);

    if (posterization < 0) posterization = 0;
    if (posterization > 4) posterization = 4;
    liq_set_min_posterization(attr, posterization);

    liq_set_last_index_transparent(attr, last_index_transparent ? 1 : 0);

    // 3. Crear imagen en libimagequant con soporte para gamma
    double d_gamma = (gamma > 0.001f && gamma < 1.0f) ? (double)gamma : 0.0;
    liq_image *image = liq_image_create_rgba(attr, rgba_pixels, width, height, d_gamma);
    if (!image) {
        liq_attr_destroy(attr);
        free(rgba_pixels);
        return &g_result;
    }

    // 4. Ejecutar cuantización
    liq_result *res = NULL;
    liq_error q_err = liq_image_quantize(image, attr, &res);
    if (q_err != LIQ_OK) {
        // Si no alcanza calidad mínima y no es estricto, fallback con mejor esfuerzo
        if (q_err == LIQ_QUALITY_TOO_LOW && !strict_quality) {
            liq_set_quality(attr, 0, max_quality);
            q_err = liq_image_quantize(image, attr, &res);
        }
    }

    if (q_err != LIQ_OK || !res) {
        if (res) liq_result_destroy(res);
        liq_image_destroy(image);
        liq_attr_destroy(attr);
        free(rgba_pixels);
        return &g_result;
    }

    // Aplicar nivel de tramado (dithering)
    if (dithering < 0.0f) dithering = 0.0f;
    if (dithering > 1.0f) dithering = 1.0f;
    liq_set_dithering_level(res, dithering);

    // 5. Remapear a búfer indexado de 8 bits
    size_t num_pixels = (size_t)width * height;
    unsigned char *indexed_pixels = (unsigned char*)malloc(num_pixels);
    if (!indexed_pixels) {
        liq_result_destroy(res);
        liq_image_destroy(image);
        liq_attr_destroy(attr);
        free(rgba_pixels);
        return &g_result;
    }

    liq_error remap_err = liq_write_remapped_image(res, image, indexed_pixels, num_pixels);
    if (remap_err != LIQ_OK) {
        free(indexed_pixels);
        liq_result_destroy(res);
        liq_image_destroy(image);
        liq_attr_destroy(attr);
        free(rgba_pixels);
        return &g_result;
    }

    // Extraer métricas tras el remapeo (calidad real alcanzada y error MSE)
    int attained_quality = liq_get_remapping_quality(res);
    if (attained_quality <= 0) {
        attained_quality = liq_get_quantization_quality(res);
    }
    if (attained_quality <= 0) {
        attained_quality = max_quality;
    }

    double mse_val = liq_get_remapping_error(res);
    if (mse_val < 0.0) {
        mse_val = liq_get_quantization_error(res);
    }
    float mse_error = (mse_val >= 0.0) ? (float)mse_val : 0.0f;

    const liq_palette *pal = liq_get_palette(res);
    if (!pal || pal->count == 0) {
        free(indexed_pixels);
        liq_result_destroy(res);
        liq_image_destroy(image);
        liq_attr_destroy(attr);
        free(rgba_pixels);
        return &g_result;
    }

    int pal_count = (int)pal->count;

    // 6. Determinar profundidad de bits (1, 2, 4 u 8 bits)
    unsigned int bitdepth = 8;
    if (auto_bit_depth) {
        if (pal_count <= 2) {
            bitdepth = 1;
        } else if (pal_count <= 4) {
            bitdepth = 2;
        } else if (pal_count <= 16) {
            bitdepth = 4;
        } else {
            bitdepth = 8;
        }
    }

    // 7. Codificar a PNG con paleta y canal alfa usando LodePNG
    LodePNGState state;
    lodepng_state_init(&state);
    state.info_raw.colortype = LCT_PALETTE;
    state.info_raw.bitdepth = 8;
    state.info_png.color.colortype = LCT_PALETTE;
    state.info_png.color.bitdepth = bitdepth;
    state.encoder.auto_convert = 0; // Respetar paleta exacta

    // Estrategia de filtrado de líneas PNG
    if (filter_strategy >= 0 && filter_strategy <= 7) {
        state.encoder.filter_strategy = (LodePNGFilterStrategy)filter_strategy;
    } else {
        state.encoder.filter_strategy = LFS_ZERO;
    }
    state.encoder.filter_palette_zero = filter_palette_zero ? 1 : 0;

    // Configuración del compresor Zlib / Deflate
    if (zlib_windowsize >= 256 && zlib_windowsize <= 32768) {
        state.encoder.zlibsettings.windowsize = (unsigned int)zlib_windowsize;
    } else {
        state.encoder.zlibsettings.windowsize = 32768; // 32 KB por defecto para máxima compresión
    }
    if (zlib_nicematch >= 8 && zlib_nicematch <= 258) {
        state.encoder.zlibsettings.nicematch = (unsigned int)zlib_nicematch;
    } else {
        state.encoder.zlibsettings.nicematch = 258; // Coincidencia óptima RFC 1951
    }
    state.encoder.zlibsettings.lazymatching = zlib_lazymatching ? 1 : 0;

    // Modo interlazado Adam7 (progresivo)
    state.info_png.interlace_method = interlace ? 1 : 0;

    // Cargar entradas de paleta en state.info_png y state.info_raw
    for (unsigned int i = 0; i < pal->count; i++) {
        lodepng_palette_add(&state.info_png.color, pal->entries[i].r, pal->entries[i].g, pal->entries[i].b, pal->entries[i].a);
        lodepng_palette_add(&state.info_raw, pal->entries[i].r, pal->entries[i].g, pal->entries[i].b, pal->entries[i].a);
    }

    // Metadatos auxiliares
    state.encoder.add_id = 0; // No añadir chunk identificador LodePNG
    if (strip_metadata) {
        state.info_png.time_defined = 0;
        state.info_png.phys_defined = 0;
        state.info_png.exif_defined = 0;
        state.info_png.background_defined = 0;
        lodepng_clear_text(&state.info_png);
        lodepng_clear_itext(&state.info_png);
    }

    // Chunks sRGB y gAMA
    if (write_srgb_chunk) {
        state.info_png.srgb_defined = 1;
        state.info_png.srgb_intent = 0; // Perceptual
        state.info_png.gama_defined = 1;
        state.info_png.gama_gamma = 45455; // 1/2.2 exponente sRGB
    } else {
        state.info_png.srgb_defined = 0;
        state.info_png.gama_defined = 0;
    }

    unsigned char *out_png = NULL;
    size_t out_size = 0;
    unsigned int enc_err = lodepng_encode(&out_png, &out_size, indexed_pixels, width, height, &state);

    // Liberar recursos intermedios inmediatamente
    lodepng_state_cleanup(&state);
    free(indexed_pixels);
    liq_result_destroy(res);
    liq_image_destroy(image);
    liq_attr_destroy(attr);
    free(rgba_pixels);

    if (enc_err != 0 || !out_png || out_size == 0) {
        if (out_png) free(out_png);
        return &g_result;
    }

    g_result.data = out_png;
    g_result.size = (int)out_size;
    g_result.attained_quality = (attained_quality >= 0) ? attained_quality : 0;
    g_result.palette_colors = pal_count;
    g_result.output_bitdepth = (int)bitdepth;
    g_result.mse_error = mse_error;
    return &g_result;
}

void free_result_data_imagequant(unsigned char* ptr) {
    if (ptr) free(ptr);
}

#ifdef __cplusplus
}
#endif
