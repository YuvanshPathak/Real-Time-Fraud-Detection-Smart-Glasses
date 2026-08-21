"""Exports features.py's framing constants + precomputed mel filterbank +
Hann window into firmware/include/tinyml_feature_config.h, so the C++ port
(firmware/src/tinyml_features.cpp) uses numerically identical values rather
than a hand-reimplemented mel filterbank that might drift from training.
Re-run this whenever features.py's constants change, then retrain (train.py)
and re-export the model (export_tflite_to_c.py), in that order.

    backend\\.venv\\Scripts\\python.exe ml\\export_feature_config_to_c.py
"""

import os

from features import (
    FMAX, FMIN, FRAME_LEN, HOP_LEN, N_FFT_BINS, N_MELS, N_SAMPLES,
    NUM_FRAMES, SAMPLE_RATE, _HANN_WINDOW, _MEL_FILTERBANK,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HEADER_PATH = os.path.join(
    SCRIPT_DIR, "..", "firmware", "include", "tinyml_feature_config.h"
)


def _format_float_array_2d(name: str, arr) -> str:
    rows = []
    for row in arr:
        rows.append("  {" + ", ".join(f"{v:.8f}f" for v in row) + "},")
    return f"static const float {name}[{arr.shape[0]}][{arr.shape[1]}] = {{\n" + "\n".join(rows) + "\n};\n"


def _format_float_array_1d(name: str, arr) -> str:
    values = ", ".join(f"{v:.8f}f" for v in arr)
    return f"static const float {name}[{len(arr)}] = {{{values}}};\n"


def main() -> None:
    header = f"""// GENERATED FILE — do not edit by hand.
// Regenerate via: backend\\.venv\\Scripts\\python.exe ml\\export_feature_config_to_c.py
// Source of truth: ml/features.py

#ifndef TINYML_FEATURE_CONFIG_H
#define TINYML_FEATURE_CONFIG_H

#define TINYML_SAMPLE_RATE {SAMPLE_RATE}
#define TINYML_N_SAMPLES {N_SAMPLES}
#define TINYML_FRAME_LEN {FRAME_LEN}
#define TINYML_HOP_LEN {HOP_LEN}
#define TINYML_N_FFT_BINS {N_FFT_BINS}
#define TINYML_N_MELS {N_MELS}
#define TINYML_NUM_FRAMES {NUM_FRAMES}

{_format_float_array_1d("TINYML_HANN_WINDOW", _HANN_WINDOW)}
{_format_float_array_2d("TINYML_MEL_FILTERBANK", _MEL_FILTERBANK)}
#endif
"""

    os.makedirs(os.path.dirname(HEADER_PATH), exist_ok=True)
    with open(HEADER_PATH, "w", encoding="utf-8") as f:
        f.write(header)

    print(f"wrote {HEADER_PATH}")


if __name__ == "__main__":
    main()
