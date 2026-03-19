#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "lib/jpegli/encode.h"
#include "lib/jpegli/decode.h"
#include "lib/jpegli/common.h"

typedef struct {
    unsigned char* data;
    int size;
} CompressedResult;

static CompressedResult g_result = {NULL, 0};

extern "C" {

CompressedResult* compress_image_jpegli(
    unsigned char* input_buffer,
    int input_size,
    int quality,               // ignorado si use_distance=1
    float distance,            // butteraugli distance; rango útil: 0.5–3.0 (1.0 ≈ q90)
    int use_distance,          // 1 = usar distance, 0 = usar quality
    int use_standard_tables,   // 1 = tablas estándar Annex K; debe llamarse antes de set_defaults
    int xyb_mode,              // 1 = espacio XYB; debe llamarse antes de set_defaults
    int cicp_transfer_function,// debe llamarse antes de set_defaults (2=SDR, 1=BT.709, 16=PQ, 18=HLG)
    int progressive_level,     // 0=secuencial, 1=básico, 2=fino (default Jpegli)
    int subsampling,           // 0=4:4:4, 1=4:2:2, 2=4:2:0
    int optimize_coding,       // 1 = tablas Huffman óptimas (2 pasadas)
    int smoothing_factor,      // 0–100
    int dct_method,            // 0=ISLOW, 1=IFAST, 2=FLOAT
    int baseline,              // 1 = forzar coeficientes baseline (≤255)
    int adaptive_quantization  // 1 = cuantización adaptativa (exclusivo Jpegli)
) {
    g_result.data = NULL;
    g_result.size = 0;

    // ── Decodificar JPEG de entrada con Jpegli ──────────────────────────────
    struct jpeg_decompress_struct cinfo;
    struct jpeg_error_mgr jerr;
    unsigned char *buffer = NULL;
    int stride;

    cinfo.err = jpegli_std_error(&jerr);
    jpegli_create_decompress(&cinfo);

    jpegli_mem_src(&cinfo, input_buffer, input_size);
    if (jpegli_read_header(&cinfo, TRUE) != JPEG_HEADER_OK) {
        jpegli_destroy_decompress(&cinfo);
        return &g_result;
    }

    jpegli_start_decompress(&cinfo);

    stride = cinfo.output_width * cinfo.output_components;
    buffer = (unsigned char *)malloc(stride * cinfo.output_height);

    while (cinfo.output_scanline < cinfo.output_height) {
        unsigned char *row[1];
        row[0] = buffer + cinfo.output_scanline * stride;
        jpegli_read_scanlines(&cinfo, row, 1);
    }

    int width      = cinfo.output_width;
    int height     = cinfo.output_height;
    int components = cinfo.output_components;

    jpegli_finish_decompress(&cinfo);
    jpegli_destroy_decompress(&cinfo);

    // ── Codificar con Jpegli ────────────────────────────────────────────────
    struct jpeg_compress_struct cinfo_out;
    struct jpeg_error_mgr jerr_out;
    unsigned char *out_buffer = NULL;
    unsigned long out_size = 0;

    cinfo_out.err = jpegli_std_error(&jerr_out);
    jpegli_create_compress(&cinfo_out);

    jpegli_mem_dest(&cinfo_out, &out_buffer, &out_size);

    cinfo_out.image_width      = width;
    cinfo_out.image_height     = height;
    cinfo_out.input_components = components;
    cinfo_out.in_color_space   = (components == 3) ? JCS_RGB : JCS_GRAYSCALE;

    // ── Llamadas que DEBEN ir antes de jpegli_set_defaults() ───────────────

    // Tablas de cuantización estándar Annex K (en lugar de las optimizadas de Jpegli)
    if (use_standard_tables) {
        jpegli_use_standard_quant_tables(&cinfo_out);
    }

    // Espacio de color XYB — solo RGB, produce archivo JPEG estándar compatible
    if (xyb_mode && components == 3) {
        jpegli_set_xyb_mode(&cinfo_out);
    }

    // Función de transferencia CICP (para HDR; SDR normal = 2)
    jpegli_set_cicp_transfer_function(&cinfo_out, cicp_transfer_function);

    // ── jpegli_set_defaults() ──────────────────────────────────────────────
    jpegli_set_defaults(&cinfo_out);

    // ── Calidad / distance (después de set_defaults) ───────────────────────
    if (use_distance) {
        jpegli_set_distance(&cinfo_out, distance, baseline ? TRUE : FALSE);
    } else {
        jpegli_set_quality(&cinfo_out, quality, baseline ? TRUE : FALSE);
    }

    // ── Nivel progresivo (función dedicada, reemplaza asignar progressive_mode) ──
    jpegli_set_progressive_level(&cinfo_out, progressive_level);

    // ── Cuantización adaptativa (exclusivo Jpegli) ─────────────────────────
    jpegli_enable_adaptive_quantization(&cinfo_out, adaptive_quantization ? TRUE : FALSE);

    // ── Parámetros heredados de libjpeg ────────────────────────────────────
    cinfo_out.optimize_coding  = optimize_coding ? TRUE : FALSE;
    cinfo_out.smoothing_factor = smoothing_factor;

    J_DCT_METHOD method;
    if      (dct_method == 1) method = JDCT_IFAST;
    else if (dct_method == 2) method = JDCT_FLOAT;
    else                      method = JDCT_ISLOW;
    cinfo_out.dct_method = method;

    // ── Subsampling de croma (después de set_defaults) ─────────────────────
    if (components == 3) {
        if (subsampling == 2) {        // 4:2:0
            cinfo_out.comp_info[0].h_samp_factor = 2;
            cinfo_out.comp_info[0].v_samp_factor = 2;
            cinfo_out.comp_info[1].h_samp_factor = 1;
            cinfo_out.comp_info[1].v_samp_factor = 1;
            cinfo_out.comp_info[2].h_samp_factor = 1;
            cinfo_out.comp_info[2].v_samp_factor = 1;
        } else if (subsampling == 1) { // 4:2:2
            cinfo_out.comp_info[0].h_samp_factor = 2;
            cinfo_out.comp_info[0].v_samp_factor = 1;
            cinfo_out.comp_info[1].h_samp_factor = 1;
            cinfo_out.comp_info[1].v_samp_factor = 1;
            cinfo_out.comp_info[2].h_samp_factor = 1;
            cinfo_out.comp_info[2].v_samp_factor = 1;
        }
        // subsampling == 0 → 4:4:4 (ya es el default tras set_defaults)
    }

    // ── Comprimir ──────────────────────────────────────────────────────────
    jpegli_start_compress(&cinfo_out, TRUE);

    stride = width * components;
    while (cinfo_out.next_scanline < cinfo_out.image_height) {
        unsigned char *row[1];
        row[0] = buffer + cinfo_out.next_scanline * stride;
        jpegli_write_scanlines(&cinfo_out, row, 1);
    }

    jpegli_finish_compress(&cinfo_out);
    jpegli_destroy_compress(&cinfo_out);

    free(buffer);

    g_result.data = out_buffer;
    g_result.size = (int)out_size;

    return &g_result;
}

void free_result_data_jpegli(unsigned char* ptr) {
    if (ptr) free(ptr);
}

}