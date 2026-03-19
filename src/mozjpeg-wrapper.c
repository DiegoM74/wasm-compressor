#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <jpeglib.h>
#include <jerror.h>

typedef struct {
    unsigned char* data;
    int size;
} CompressedResult;

static CompressedResult g_result = {NULL, 0};

/*
 * compress_image — wraps MozJPEG with the full set of available parameters.
 *
 * Boolean MozJPEG extensions (jpeg_c_set_bool_param):
 *   trellis            → JBOOLEAN_TRELLIS_QUANT       — trellis quantization AC
 *   trellis_dc         → JBOOLEAN_TRELLIS_QUANT_DC    — trellis quantization DC
 *   trellis_eob_opt    → JBOOLEAN_TRELLIS_EOB_OPT     — optimize EOB position in trellis
 *   use_scans_in_trellis → JBOOLEAN_USE_SCANS_IN_TRELLIS — consider multiple scans in trellis
 *   trellis_q_opt      → JBOOLEAN_TRELLIS_Q_OPT       — refit quant table post-trellis
 *   overshoot_deringing → JBOOLEAN_OVERSHOOT_DERINGING — reduce ringing on B/W edges
 *   optimize_scans     → JBOOLEAN_OPTIMIZE_SCANS      — jpgcrush-style scan optimization
 *
 * Integer MozJPEG extensions (jpeg_c_set_int_param):
 *   base_quant_tbl     → JINT_BASE_QUANT_TBL_IDX      — preset quant table (0–8)
 *   trellis_freq_split → JINT_TRELLIS_FREQ_SPLIT       — AC freq split point in trellis
 *   trellis_num_loops  → JINT_TRELLIS_NUM_LOOPS        — trellis iteration count
 *   dc_scan_opt_mode   → JINT_DC_SCAN_OPT_MODE         — DC scan optimization mode (0/1/2)
 *
 * Float MozJPEG extensions (jpeg_c_set_float_param):
 *   lambda_log_scale1  → JFLOAT_LAMBDA_LOG_SCALE1      — RD lambda fidelity scale
 *   lambda_log_scale2  → JFLOAT_LAMBDA_LOG_SCALE2      — RD lambda size scale
 *   trellis_delta_dc_weight → JFLOAT_TRELLIS_DELTA_DC_WEIGHT — DC weight in trellis
 *
 * Standard libjpeg fields:
 *   quality            — 0–100
 *   progressive        — 0=baseline, 1=progressive
 *   optimize_coding    — 0/1 (Huffman optimization)
 *   smoothing          — 0–100 (input smoothing filter)
 *   chroma_subsample   — 0=4:4:4, 1=4:2:2, 2=4:2:0
 *   write_jfif         — 0=omit JFIF header (saves 18 bytes), 1=include
 */
CompressedResult* compress_image(
    unsigned char* input_buffer,
    int input_size,
    int quality,
    int progressive,
    int optimize_coding,
    int smoothing,
    int chroma_subsample,
    int write_jfif,
    /* Boolean MozJPEG extensions */
    int trellis,
    int trellis_dc,
    int trellis_eob_opt,
    int use_scans_in_trellis,
    int trellis_q_opt,
    int overshoot_deringing,
    int optimize_scans,
    /* Integer MozJPEG extensions */
    int base_quant_tbl,
    int trellis_freq_split,
    int trellis_num_loops,
    int dc_scan_opt_mode,
    /* Float MozJPEG extensions (passed as int*100 from JS, divided here) */
    int lambda_log_scale1_x100,
    int lambda_log_scale2_x100,
    int trellis_delta_dc_weight_x100
) {
    g_result.data = NULL;
    g_result.size = 0;

    /* ── Decompress input JPEG ── */
    struct jpeg_decompress_struct cinfo;
    struct jpeg_error_mgr jerr;
    unsigned char *buffer = NULL;
    int stride;

    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_decompress(&cinfo);

    jpeg_mem_src(&cinfo, input_buffer, input_size);
    if (jpeg_read_header(&cinfo, TRUE) != JPEG_HEADER_OK) {
        jpeg_destroy_decompress(&cinfo);
        return &g_result;
    }

    jpeg_start_decompress(&cinfo);

    stride = cinfo.output_width * cinfo.output_components;
    buffer = (unsigned char *)malloc(stride * cinfo.output_height);
    if (!buffer) {
        jpeg_destroy_decompress(&cinfo);
        return &g_result;
    }

    while (cinfo.output_scanline < cinfo.output_height) {
        unsigned char *row[1];
        row[0] = buffer + cinfo.output_scanline * stride;
        jpeg_read_scanlines(&cinfo, row, 1);
    }

    int width      = cinfo.output_width;
    int height     = cinfo.output_height;
    int components = cinfo.output_components;

    jpeg_finish_decompress(&cinfo);
    jpeg_destroy_decompress(&cinfo);

    /* ── Compress with MozJPEG ── */
    struct jpeg_compress_struct cinfo_out;
    struct jpeg_error_mgr jerr_out;
    unsigned char *out_buffer = NULL;
    unsigned long out_size = 0;

    cinfo_out.err = jpeg_std_error(&jerr_out);
    jpeg_create_compress(&cinfo_out);
    jpeg_mem_dest(&cinfo_out, &out_buffer, &out_size);

    cinfo_out.image_width      = width;
    cinfo_out.image_height     = height;
    cinfo_out.input_components = components;
    cinfo_out.in_color_space   = (components == 3) ? JCS_RGB : JCS_GRAYSCALE;

    jpeg_set_defaults(&cinfo_out);
    jpeg_set_quality(&cinfo_out, quality, TRUE);

    /* ── Standard libjpeg fields ── */
    cinfo_out.progressive_mode = progressive;
    cinfo_out.optimize_coding  = optimize_coding;
    cinfo_out.smoothing_factor = smoothing;
    cinfo_out.write_JFIF_header = write_jfif;

    /* ── Chroma subsampling ── */
    if (components == 3) {
        switch (chroma_subsample) {
            case 0: /* 4:4:4 — no subsampling */
                cinfo_out.comp_info[0].h_samp_factor = 1;
                cinfo_out.comp_info[0].v_samp_factor = 1;
                cinfo_out.comp_info[1].h_samp_factor = 1;
                cinfo_out.comp_info[1].v_samp_factor = 1;
                cinfo_out.comp_info[2].h_samp_factor = 1;
                cinfo_out.comp_info[2].v_samp_factor = 1;
                break;
            case 1: /* 4:2:2 — horizontal subsampling */
                cinfo_out.comp_info[0].h_samp_factor = 2;
                cinfo_out.comp_info[0].v_samp_factor = 1;
                cinfo_out.comp_info[1].h_samp_factor = 1;
                cinfo_out.comp_info[1].v_samp_factor = 1;
                cinfo_out.comp_info[2].h_samp_factor = 1;
                cinfo_out.comp_info[2].v_samp_factor = 1;
                break;
            case 2: /* 4:2:0 — full subsampling (default, best compression) */
            default:
                cinfo_out.comp_info[0].h_samp_factor = 2;
                cinfo_out.comp_info[0].v_samp_factor = 2;
                cinfo_out.comp_info[1].h_samp_factor = 1;
                cinfo_out.comp_info[1].v_samp_factor = 1;
                cinfo_out.comp_info[2].h_samp_factor = 1;
                cinfo_out.comp_info[2].v_samp_factor = 1;
                break;
        }
    }

    /* ── Boolean MozJPEG extensions ── */
    jpeg_c_set_bool_param(&cinfo_out, JBOOLEAN_TRELLIS_QUANT,         trellis);
    jpeg_c_set_bool_param(&cinfo_out, JBOOLEAN_TRELLIS_QUANT_DC,      trellis_dc);
    jpeg_c_set_bool_param(&cinfo_out, JBOOLEAN_TRELLIS_EOB_OPT,       trellis_eob_opt);
    jpeg_c_set_bool_param(&cinfo_out, JBOOLEAN_USE_SCANS_IN_TRELLIS,  use_scans_in_trellis);
    jpeg_c_set_bool_param(&cinfo_out, JBOOLEAN_TRELLIS_Q_OPT,         trellis_q_opt);
    jpeg_c_set_bool_param(&cinfo_out, JBOOLEAN_OVERSHOOT_DERINGING,   overshoot_deringing);
    jpeg_c_set_bool_param(&cinfo_out, JBOOLEAN_OPTIMIZE_SCANS,        optimize_scans);

    /* ── Integer MozJPEG extensions ── */
    jpeg_c_set_int_param(&cinfo_out, JINT_BASE_QUANT_TBL_IDX,    base_quant_tbl);
    jpeg_c_set_int_param(&cinfo_out, JINT_TRELLIS_FREQ_SPLIT,     trellis_freq_split);
    jpeg_c_set_int_param(&cinfo_out, JINT_TRELLIS_NUM_LOOPS,      trellis_num_loops);
    jpeg_c_set_int_param(&cinfo_out, JINT_DC_SCAN_OPT_MODE,       dc_scan_opt_mode);

    /* ── Float MozJPEG extensions ── */
    /* JS passes floats multiplied by 100 as integers to avoid float ABI issues in WASM */
    if (lambda_log_scale1_x100 >= 0)
        jpeg_c_set_float_param(&cinfo_out, JFLOAT_LAMBDA_LOG_SCALE1,
                               (float)lambda_log_scale1_x100 / 100.0f);
    if (lambda_log_scale2_x100 >= 0)
        jpeg_c_set_float_param(&cinfo_out, JFLOAT_LAMBDA_LOG_SCALE2,
                               (float)lambda_log_scale2_x100 / 100.0f);
    if (trellis_delta_dc_weight_x100 >= 0)
        jpeg_c_set_float_param(&cinfo_out, JFLOAT_TRELLIS_DELTA_DC_WEIGHT,
                               (float)trellis_delta_dc_weight_x100 / 100.0f);

    /* optimize_scans requires progressive + jpeg_simple_progression */
    if (progressive && optimize_scans)
        jpeg_simple_progression(&cinfo_out);

    jpeg_start_compress(&cinfo_out, TRUE);

    stride = width * components;
    while (cinfo_out.next_scanline < cinfo_out.image_height) {
        unsigned char *row[1];
        row[0] = buffer + cinfo_out.next_scanline * stride;
        jpeg_write_scanlines(&cinfo_out, row, 1);
    }

    jpeg_finish_compress(&cinfo_out);
    jpeg_destroy_compress(&cinfo_out);

    free(buffer);

    g_result.data = out_buffer;
    g_result.size = (int)out_size;

    return &g_result;
}

void free_result_data(unsigned char* ptr) {
    if (ptr) free(ptr);
}

unsigned char* get_result_data() { return g_result.data; }
int get_result_size()            { return g_result.size; }