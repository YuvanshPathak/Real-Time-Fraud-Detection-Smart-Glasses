"""Converts ml/output/voice_tinyml.tflite into a committed C header
(firmware/include/voice_tinyml_model.h) — a portable stand-in for the usual
`xxd -i model.tflite > model.h` step, since xxd isn't reliably on PATH on
Windows. Run after train.py:

    backend\\.venv\\Scripts\\python.exe ml\\export_tflite_to_c.py
"""

import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TFLITE_PATH = os.path.join(SCRIPT_DIR, "output", "voice_tinyml.tflite")
HEADER_PATH = os.path.join(
    SCRIPT_DIR, "..", "firmware", "include", "voice_tinyml_model.h"
)

BYTES_PER_LINE = 12


def main() -> None:
    with open(TFLITE_PATH, "rb") as f:
        model_bytes = f.read()

    lines = []
    for i in range(0, len(model_bytes), BYTES_PER_LINE):
        chunk = model_bytes[i:i + BYTES_PER_LINE]
        lines.append("  " + ", ".join(f"0x{b:02x}" for b in chunk) + ",")

    header = f"""// GENERATED FILE — do not edit by hand.
// Regenerate via: backend\\.venv\\Scripts\\python.exe ml\\export_tflite_to_c.py
// (after ml\\train.py has produced ml/output/voice_tinyml.tflite)
//
// This is a synthetic-proof-of-concept model — see ml/README.md. It proves
// the on-device inference pipeline works, not that it detects real spoofing.

#ifndef VOICE_TINYML_MODEL_H
#define VOICE_TINYML_MODEL_H

alignas(8) const unsigned char g_voice_tinyml_model[] = {{
{chr(10).join(lines)}
}};

const unsigned int g_voice_tinyml_model_len = {len(model_bytes)};

#endif
"""

    os.makedirs(os.path.dirname(HEADER_PATH), exist_ok=True)
    with open(HEADER_PATH, "w", encoding="utf-8") as f:
        f.write(header)

    print(f"wrote {HEADER_PATH} ({len(model_bytes)} bytes -> {len(header)} chars of source)")


if __name__ == "__main__":
    main()
