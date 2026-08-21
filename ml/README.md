# TinyML Voice Liveness — Training Pipeline

Trains the on-device model used by `firmware/src/tinyml_model.cpp` for the
edge-side "TinyML Extraction" stage in `README.md`'s Fig. 2 architecture.

## What this is (and isn't)

**There is no real labeled genuine/spoof voice dataset in this repo.**
Building one needs either a large external corpus (`CLAUDE.md` names ASVspoof
as the mentor-endorsed target — too large/license-gated to pull into this
pipeline as a first step) or audio recorded from the actual XIAO ESP32-S3
Sense PDM mic, which needs physical hardware access.

So `generate_synthetic_dataset.py` fabricates both classes programmatically:
"genuine" = harmonic-rich signals with randomized jitter/shimmer/speech-like
amplitude bursts; "spoof" = flat, perfectly periodic, harmonically sparse
tones. These are trivially separable by design — **this proves the pipeline
mechanics work (feature extraction → training → INT8 quantization → on-device
TFLite Micro inference), not that the resulting model detects real voice
spoofing.** The firmware's `tinyml_liveness_score` is wired through the
backend as informational-only for exactly this reason — see `CLAUDE.md`.

## Retraining on real data (the actual next step)

Once you can record labeled 16kHz/5s WAVs from the real board:

1. Drop genuine recordings into `ml/data/genuine/*.wav` and spoofed/replayed
   recordings into `ml/data/spoof/*.wav` (same layout `generate_synthetic_dataset.py`
   produces — you can skip that script once you have real data).
2. Run `train.py` — no code changes needed, it just glob-loads whatever's in
   `ml/data/{genuine,spoof}/`.
3. Run `export_tflite_to_c.py`.
4. Rebuild and reflash the firmware.

If you ever change `features.py`'s constants (frame size, hop, mel bins),
re-run `export_feature_config_to_c.py` **before** `train.py`, so the firmware
C++ feature extractor and the training-time features stay numerically
consistent — that header is the single source of truth the C++ side mirrors.

## Usage

All scripts run with `backend/.venv`'s Python — it already has
`tensorflow`/`numpy`/`scipy`/`soundfile` pulled in transitively via
`deepface`/`tf-keras`, so no new dependencies are needed.

```bash
cd ml
..\backend\.venv\Scripts\python.exe generate_synthetic_dataset.py
..\backend\.venv\Scripts\python.exe train.py
..\backend\.venv\Scripts\python.exe export_tflite_to_c.py
..\backend\.venv\Scripts\python.exe export_feature_config_to_c.py
```

`data/` and `output/` are gitignored (regeneratable); the exported
`firmware/include/voice_tinyml_model.h` and `tinyml_feature_config.h` headers
**are committed**, since the firmware build can't generate them itself.

## Files

| File | Purpose |
|---|---|
| `features.py` | Log-mel feature extraction — source of truth for both training and the C++ port |
| `generate_synthetic_dataset.py` | Fabricates the synthetic genuine/spoof WAVs described above |
| `train.py` | Trains a small Conv2D model, exports INT8-quantized `output/voice_tinyml.tflite` |
| `export_tflite_to_c.py` | `.tflite` → `firmware/include/voice_tinyml_model.h` |
| `export_feature_config_to_c.py` | `features.py` constants + mel filterbank → `firmware/include/tinyml_feature_config.h` |
