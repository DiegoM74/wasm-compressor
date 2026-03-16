#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <jpegli/encode.h>
#include <jpegli/decode.h>
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
    int quality,
    int progressive_level,
    int subsampling,
    int optimize_coding,
    int allow_chroma_gray,
    int smoothing_factor,
    int dct_method,
    int use_standard_tables,   // se ignora
    int baseline,
    int adaptive_quantization
) {
    g_result.data = NULL;
    g_result.size = 0;

    // Decodificar con Jpegli
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
        unsigned char *buffer_array[1];
        buffer_array[0] = buffer + (cinfo.output_scanline) * stride;
        jpegli_read_scanlines(&cinfo, buffer_array, 1);
    }

    int width = cinfo.output_width;
    int height = cinfo.output_height;
    int components = cinfo.output_components;

    jpegli_finish_decompress(&cinfo);
    jpegli_destroy_decompress(&cinfo);

    // Codificar con Jpegli
    struct jpeg_compress_struct cinfo_out;
    struct jpeg_error_mgr jerr_out;
    unsigned char *out_buffer = NULL;
    unsigned long out_size = 0;

    cinfo_out.err = jpegli_std_error(&jerr_out);
    jpegli_create_compress(&cinfo_out);

    jpegli_mem_dest(&cinfo_out, &out_buffer, &out_size);

    cinfo_out.image_width = width;
    cinfo_out.image_height = height;
    cinfo_out.input_components = components;

    if (components == 3)
        cinfo_out.in_color_space = JCS_RGB;
    else
        cinfo_out.in_color_space = JCS_GRAYSCALE;

    jpegli_set_defaults(&cinfo_out);
    jpegli_set_quality(&cinfo_out, quality, TRUE);

    // Asignar parámetros directamente en la estructura
    cinfo_out.optimize_coding = optimize_coding ? TRUE : FALSE;
    cinfo_out.progressive_mode = (progressive_level > 0) ? TRUE : FALSE;
    cinfo_out.smoothing_factor = smoothing_factor;

    // Método DCT
    J_DCT_METHOD method;
    if (dct_method == 0) method = JDCT_ISLOW;
    else if (dct_method == 1) method = JDCT_IFAST;
    else method = JDCT_FLOAT;
    cinfo_out.dct_method = method;

    cinfo_out.write_JFIF_header = baseline ? TRUE : FALSE;

    // Cuantización adaptativa
    jpegli_enable_adaptive_quantization(&cinfo_out, adaptive_quantization ? TRUE : FALSE);

    // Subsampling de croma
    if (components == 3) {
        if (subsampling == 2) {  // 4:2:0
            cinfo_out.comp_info[0].h_samp_factor = 2;
            cinfo_out.comp_info[0].v_samp_factor = 2;
            cinfo_out.comp_info[1].h_samp_factor = 1;
            cinfo_out.comp_info[1].v_samp_factor = 1;
            cinfo_out.comp_info[2].h_samp_factor = 1;
            cinfo_out.comp_info[2].v_samp_factor = 1;
        } else if (subsampling == 1) {  // 4:2:2
            cinfo_out.comp_info[0].h_samp_factor = 2;
            cinfo_out.comp_info[0].v_samp_factor = 1;
            cinfo_out.comp_info[1].h_samp_factor = 1;
            cinfo_out.comp_info[1].v_samp_factor = 1;
            cinfo_out.comp_info[2].h_samp_factor = 1;
            cinfo_out.comp_info[2].v_samp_factor = 1;
        }
        // subsampling == 0 es 4:4:4 (factores 1,1,1,1,1,1) que ya es el default
    }

    jpegli_start_compress(&cinfo_out, TRUE);

    stride = width * components;
    while (cinfo_out.next_scanline < cinfo_out.image_height) {
        unsigned char *buffer_array[1];
        buffer_array[0] = buffer + (cinfo_out.next_scanline) * stride;
        jpegli_write_scanlines(&cinfo_out, buffer_array, 1);
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