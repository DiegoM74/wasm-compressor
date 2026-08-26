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
 * Tablas base de cuantización estándar de MozJPEG (Annex K, Flat, MS-SSIM, ImageMagick,
 * Kodak, Klein, Watson, Ahumada, Peterson).
 */
static const unsigned int std_luminance_quant_tbl[9][DCTSIZE2] = {
  {
    /* 0: JPEG Annex K */
    16,  11,  10,  16,  24,  40,  51,  61,
    12,  12,  14,  19,  26,  58,  60,  55,
    14,  13,  16,  24,  40,  57,  69,  56,
    14,  17,  22,  29,  51,  87,  80,  62,
    18,  22,  37,  56,  68, 109, 103,  77,
    24,  35,  55,  64,  81, 104, 113,  92,
    49,  64,  78,  87, 103, 121, 120, 101,
    72,  92,  95,  98, 112, 100, 103,  99
  },
  {
    /* 1: Flat */
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16
  },
  {
    /* 2: MS-SSIM */
    12,  17,  20,  21,  30,  34,  56,  63,
    18,  20,  20,  26,  28,  51,  61,  55,
    19,  20,  21,  26,  33,  58,  69,  55,
    26,  26,  26,  30,  46,  87,  86,  66,
    31,  33,  36,  40,  46,  96, 100,  73,
    40,  35,  46,  62,  81, 100, 111,  91,
    46,  66,  76,  86, 102, 121, 120, 101,
    68,  90,  90,  96, 113, 102, 105, 103
  },
  {
    /* 3: ImageMagick (N. Robidoux) */
    16,  16,  16,  18,  25,  37,  56,  85,
    16,  17,  20,  27,  34,  40,  53,  75,
    16,  20,  24,  31,  43,  62,  91, 135,
    18,  27,  31,  40,  53,  74, 106, 156,
    25,  34,  43,  53,  69,  94, 131, 189,
    37,  40,  62,  74,  94, 124, 169, 238,
    56,  53,  91, 106, 131, 169, 226, 311,
    85,  75, 135, 156, 189, 238, 311, 418
  },
  {
    /* 4: PSNR-HVS-M Kodak */
    9,   10,  12,  14,  27,  32,  51,  62,
    11,  12,  14,  19,  27,  44,  59,  73,
    12,  14,  18,  25,  42,  59,  79,  78,
    17,  18,  25,  42,  61,  92,  87,  92,
    23,  28,  42,  75,  79, 112, 112,  99,
    40,  42,  59,  84,  88, 124, 132, 111,
    42,  64,  78,  95, 105, 126, 125,  99,
    70,  75, 100, 102, 116, 100, 107,  98
  },
  {
    /* 5: Klein, Silverstein and Carney (1992) */
    10,  12,  14,  19,  26,  38,  57,  86,
    12,  18,  21,  28,  35,  41,  54,  76,
    14,  21,  25,  32,  44,  63,  92, 136,
    19,  28,  32,  41,  54,  75, 107, 157,
    26,  35,  44,  54,  70,  95, 132, 190,
    38,  41,  63,  75,  95, 125, 170, 239,
    57,  54,  92, 107, 132, 170, 227, 312,
    86,  76, 136, 157, 190, 239, 312, 419
  },
  {
    /* 6: Watson, Taylor, Borthwick (1997) */
    7,   8,   10,  14,  23,  44,  95,  241,
    8,   8,   11,  15,  25,  47,  102, 255,
    10,  11,  13,  19,  31,  58,  127, 255,
    14,  15,  19,  27,  44,  83,  181, 255,
    23,  25,  31,  44,  72,  136, 255, 255,
    44,  47,  58,  83,  136, 255, 255, 255,
    95,  102, 127, 181, 255, 255, 255, 255,
    241, 255, 255, 255, 255, 255, 255, 255
  },
  {
    /* 7: Ahumada, Watson, Peterson (1993) */
    15,  11,  11,  12,  15,  19,  25,  32,
    11,  13,  10,  10,  12,  15,  19,  24,
    11,  10,  14,  14,  16,  18,  22,  27,
    12,  10,  14,  18,  21,  24,  28,  33,
    15,  12,  16,  21,  26,  31,  36,  42,
    19,  15,  18,  24,  31,  38,  45,  53,
    25,  19,  22,  28,  36,  45,  55,  65,
    32,  24,  27,  33,  42,  53,  65,  77
  },
  {
    /* 8: Peterson, Ahumada and Watson (1993) */
    14,  10,  11,  14,  19,  25,  34,  45,
    10,  11,  11,  12,  15,  20,  26,  33,
    11,  11,  15,  18,  21,  25,  31,  38,
    14,  12,  18,  24,  28,  33,  39,  47,
    19,  15,  21,  28,  36,  43,  51,  59,
    25,  20,  25,  33,  43,  54,  64,  74,
    34,  26,  31,  39,  51,  64,  77,  91,
    45,  33,  38,  47,  59,  74,  91,  108
  }
};

static const unsigned int std_chrominance_quant_tbl[9][DCTSIZE2] = {
  {
    /* 0: JPEG Annex K */
    17,  18,  24,  47,  99,  99,  99,  99,
    18,  21,  26,  66,  99,  99,  99,  99,
    24,  26,  56,  99,  99,  99,  99,  99,
    47,  66,  99,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99
  },
  {
    /* 1: Flat */
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16,
    16,  16,  16,  16,  16,  16,  16,  16
  },
  {
    /* 2: MS-SSIM */
    8,   12,  15,  15,  86,  96,  96,  98,
    13,  13,  15,  26,  90,  96,  99,  98,
    12,  15,  18,  96,  99,  99,  99,  99,
    17,  16,  90,  96,  99,  99,  99,  99,
    96,  96,  99,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99
  },
  {
    /* 3: ImageMagick (N. Robidoux) */
    16,  16,  16,  18,  25,  37,  56,  85,
    16,  17,  20,  27,  34,  40,  53,  75,
    16,  20,  24,  31,  43,  62,  91, 135,
    18,  27,  31,  40,  53,  74, 106, 156,
    25,  34,  43,  53,  69,  94, 131, 189,
    37,  40,  62,  74,  94, 124, 169, 238,
    56,  53,  91, 106, 131, 169, 226, 311,
    85,  75, 135, 156, 189, 238, 311, 418
  },
  {
    /* 4: PSNR-HVS-M Kodak */
    9,   10,  17,  19,  62,  89,  91,  97,
    12,  13,  18,  29,  84,  91,  88,  98,
    14,  19,  29,  93,  95,  95,  98,  97,
    20,  26,  84,  88,  95,  95,  98,  94,
    26,  86,  91,  93,  97,  99,  98,  99,
    99, 100,  98,  99,  99,  99,  99,  99,
    99,  99,  99,  99,  99,  99,  99,  99,
    97,  97,  99,  99,  99,  99,  97,  99
  },
  {
    /* 5: Klein, Silverstein and Carney (1992) */
    10,  12,  14,  19,  26,  38,  57,  86,
    12,  18,  21,  28,  35,  41,  54,  76,
    14,  21,  25,  32,  44,  63,  92, 136,
    19,  28,  32,  41,  54,  75, 107, 157,
    26,  35,  44,  54,  70,  95, 132, 190,
    38,  41,  63,  75,  95, 125, 170, 239,
    57,  54,  92, 107, 132, 170, 227, 312,
    86,  76, 136, 157, 190, 239, 312, 419
  },
  {
    /* 6: Watson, Taylor, Borthwick (1997) */
    7,   8,   10,  14,  23,  44,  95,  241,
    8,   8,   11,  15,  25,  47,  102, 255,
    10,  11,  13,  19,  31,  58,  127, 255,
    14,  15,  19,  27,  44,  83,  181, 255,
    23,  25,  31,  44,  72,  136, 255, 255,
    44,  47,  58,  83,  136, 255, 255, 255,
    95,  102, 127, 181, 255, 255, 255, 255,
    241, 255, 255, 255, 255, 255, 255, 255
  },
  {
    /* 7: Ahumada, Watson, Peterson (1993) */
    15,  11,  11,  12,  15,  19,  25,  32,
    11,  13,  10,  10,  12,  15,  19,  24,
    11,  10,  14,  14,  16,  18,  22,  27,
    12,  10,  14,  18,  21,  24,  28,  33,
    15,  12,  16,  21,  26,  31,  36,  42,
    19,  15,  18,  24,  31,  38,  45,  53,
    25,  19,  22,  28,  36,  45,  55,  65,
    32,  24,  27,  33,  42,  53,  65,  77
  },
  {
    /* 8: Peterson, Ahumada and Watson (1993) */
    14,  10,  11,  14,  19,  25,  34,  45,
    10,  11,  11,  12,  15,  20,  26,  33,
    11,  11,  15,  18,  21,  25,  31,  38,
    14,  12,  18,  24,  28,  33,  39,  47,
    19,  15,  21,  28,  36,  43,  51,  59,
    25,  20,  25,  33,  43,  54,  64,  74,
    34,  26,  31,  39,  51,  64,  77,  91,
    45,  33,  38,  47,  59,  74,  91,  108
  }
};

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
 * Standard & Advanced libjpeg fields:
 *   quality                 — 0–100 (luma / default quality)
 *   progressive             — 0=baseline, 1=progressive
 *   optimize_coding         — 0/1 (Huffman optimization)
 *   smoothing               — 0–100 (input smoothing filter)
 *   chroma_subsample        — 0=4:4:4, 1=4:2:2, 2=4:2:0
 *   write_jfif              — 0=omit JFIF header (saves 18 bytes), 1=include
 *   dct_method              — 0=ISLOW (accurate integer), 1=IFAST (fast integer), 2=FLOAT
 *   do_fancy_downsampling   — 0=fast downsample, 1=fancy/smooth downsample (if libjpeg >= 70)
 *   grayscale               — 0=color (YCbCr/RGB), 1=monochrome (Grayscale)
 *   quant_baseline          — 0=allow 16-bit quantizers, 1=force 8-bit baseline
 *   restart_in_rows         — MCU rows per restart interval (0=disabled)
 *   write_adobe_marker      — 0=omit Adobe APP14 marker, 1=include
 *   separate_chroma_quality — 0=disabled, 1=use chroma_quality for color channels
 *   chroma_quality          — 0–100 (chrominance quality when separate)
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
    /* Nuevos parámetros estándar / avanzados */
    int dct_method,
    int do_fancy_downsampling,
    int grayscale,
    int quant_baseline,
    int restart_in_rows,
    int write_adobe_marker,
    int separate_chroma_quality,
    int chroma_quality,
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

    /* ── Initialize decompressor ── */
    struct jpeg_decompress_struct cinfo;
    struct jpeg_error_mgr jerr;

    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_decompress(&cinfo);

    jpeg_mem_src(&cinfo, input_buffer, input_size);
    if (jpeg_read_header(&cinfo, TRUE) != JPEG_HEADER_OK) {
        jpeg_destroy_decompress(&cinfo);
        return &g_result;
    }

    jpeg_start_decompress(&cinfo);

    int width      = cinfo.output_width;
    int height     = cinfo.output_height;
    int components = cinfo.output_components;

    /* ── Initialize MozJPEG compressor ── */
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

    /* ── Espacio de color de salida ── */
    if (grayscale) {
        jpeg_set_colorspace(&cinfo_out, JCS_GRAYSCALE);
    }

    /* ── Configuración de tablas de cuantización base y calidad ── */
    boolean force_baseline = quant_baseline ? TRUE : FALSE;
    int tbl_idx = (base_quant_tbl >= 0 && base_quant_tbl <= 8) ? base_quant_tbl : 0;
    jpeg_c_set_int_param(&cinfo_out, JINT_BASE_QUANT_TBL_IDX, tbl_idx);

    int luma_q = quality;
    int chroma_q = (separate_chroma_quality && components == 3 && !grayscale) ? chroma_quality : quality;

    /* Configurar tablas de cuantización directamente con la escala calculada */
    jpeg_add_quant_table(&cinfo_out, 0, std_luminance_quant_tbl[tbl_idx],
                         jpeg_quality_scaling(luma_q), force_baseline);
    jpeg_add_quant_table(&cinfo_out, 1, std_chrominance_quant_tbl[tbl_idx],
                         jpeg_quality_scaling(chroma_q), force_baseline);

    /* ── Standard libjpeg fields ── */
    cinfo_out.progressive_mode       = progressive;
    cinfo_out.optimize_coding        = optimize_coding;
    cinfo_out.smoothing_factor       = smoothing;
    cinfo_out.write_JFIF_header      = write_jfif;
    cinfo_out.dct_method             = (J_DCT_METHOD)dct_method;
#if JPEG_LIB_VERSION >= 70
    cinfo_out.do_fancy_downsampling  = do_fancy_downsampling ? TRUE : FALSE;
#endif
    cinfo_out.restart_in_rows        = restart_in_rows;
    cinfo_out.write_Adobe_marker     = write_adobe_marker ? TRUE : FALSE;

    /* ── Chroma subsampling (si no es escala de grises) ── */
    if (components == 3 && !grayscale) {
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

    /* ── Streaming de scanlines por bloques (elimina búfer RGB global) ── */
    #define MOZ_CHUNK_LINES 16
    int stride = width * components;
    JSAMPROW row_pointers[MOZ_CHUNK_LINES];
    unsigned char *chunk_buffer = (unsigned char *)malloc(stride * MOZ_CHUNK_LINES);
    if (!chunk_buffer) {
        jpeg_destroy_compress(&cinfo_out);
        jpeg_destroy_decompress(&cinfo);
        return &g_result;
    }

    for (int i = 0; i < MOZ_CHUNK_LINES; i++) {
        row_pointers[i] = chunk_buffer + i * stride;
    }

    while (cinfo_out.next_scanline < cinfo_out.image_height) {
        JDIMENSION lines_to_read = MOZ_CHUNK_LINES;
        if (cinfo.output_scanline + lines_to_read > cinfo.output_height) {
            lines_to_read = cinfo.output_height - cinfo.output_scanline;
        }

        JDIMENSION lines_read = jpeg_read_scanlines(&cinfo, row_pointers, lines_to_read);
        if (lines_read == 0) break;
        jpeg_write_scanlines(&cinfo_out, row_pointers, lines_read);
    }

    free(chunk_buffer);
    #undef MOZ_CHUNK_LINES

    jpeg_finish_decompress(&cinfo);
    jpeg_destroy_decompress(&cinfo);

    jpeg_finish_compress(&cinfo_out);
    jpeg_destroy_compress(&cinfo_out);

    g_result.data = out_buffer;
    g_result.size = (int)out_size;

    return &g_result;
}

// Libera el búfer de salida asignado internamente por jpeg_mem_dest (vía malloc).
// Debe ser invocada desde el Worker de JS tras copiar el resultado en el heap WASM
// para prevenir fugas de memoria (memory leaks).
void free_result_data(unsigned char* ptr) {
    if (ptr) free(ptr);
}