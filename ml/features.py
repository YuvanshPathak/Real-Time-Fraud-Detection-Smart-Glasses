"""Log-mel feature extraction — single source of truth for both training and
the on-device C++ port (firmware/src/tinyml_features.cpp).

The framing/filterbank constants here are exported verbatim into
firmware/include/tinyml_feature_config.h by export_feature_config_to_c.py, so
training and on-device inference see numerically consistent input shapes. If
you change any constant below, re-run that export script and retrain.
"""

import numpy as np

# Must match firmware/include/config.h.example's SAMPLE_RATE/RECORD_SECONDS —
# this pipeline analyzes the exact same 5s/16kHz buffer the board already
# captures in microphone.cpp, so no firmware capture changes are needed.
SAMPLE_RATE = 16000
DURATION_S = 5
N_SAMPLES = SAMPLE_RATE * DURATION_S  # 80000

FRAME_LEN = 1024   # 64ms @ 16kHz — a size arduinoFFT on the ESP32-S3 handles cheaply
HOP_LEN = 1600      # 100ms hop
N_FFT_BINS = FRAME_LEN // 2 + 1  # 513 real-FFT magnitude bins

N_MELS = 32
FMIN = 50.0
FMAX = SAMPLE_RATE / 2.0

# Number of frames a full N_SAMPLES buffer yields at this framing.
NUM_FRAMES = 1 + (N_SAMPLES - FRAME_LEN) // HOP_LEN  # 50

_LOG_EPS = 1e-6


def hz_to_mel(hz: np.ndarray) -> np.ndarray:
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def mel_to_hz(mel: np.ndarray) -> np.ndarray:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def build_mel_filterbank(
    n_mels: int = N_MELS,
    n_fft_bins: int = N_FFT_BINS,
    sample_rate: int = SAMPLE_RATE,
    fmin: float = FMIN,
    fmax: float = FMAX,
) -> np.ndarray:
    """Standard triangular mel filterbank, shape (n_mels, n_fft_bins)."""
    mel_min, mel_max = hz_to_mel(np.array([fmin, fmax]))
    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
    hz_points = mel_to_hz(mel_points)

    fft_freqs = np.linspace(0.0, sample_rate / 2.0, n_fft_bins)
    filterbank = np.zeros((n_mels, n_fft_bins), dtype=np.float32)

    for i in range(n_mels):
        left, center, right = hz_points[i], hz_points[i + 1], hz_points[i + 2]
        rising = (fft_freqs - left) / max(center - left, 1e-9)
        falling = (right - fft_freqs) / max(right - center, 1e-9)
        filterbank[i] = np.clip(np.minimum(rising, falling), 0.0, None)

    return filterbank


_MEL_FILTERBANK = build_mel_filterbank()
_HANN_WINDOW = np.hanning(FRAME_LEN).astype(np.float32)


def extract_log_mel(samples: np.ndarray) -> np.ndarray:
    """samples: 1D float32 array, exactly N_SAMPLES long (pad/truncate first).

    Returns log-mel energies, shape (NUM_FRAMES, N_MELS).
    """
    if len(samples) != N_SAMPLES:
        raise ValueError(f"expected {N_SAMPLES} samples, got {len(samples)}")

    features = np.zeros((NUM_FRAMES, N_MELS), dtype=np.float32)
    for i in range(NUM_FRAMES):
        start = i * HOP_LEN
        frame = samples[start:start + FRAME_LEN] * _HANN_WINDOW
        spectrum = np.abs(np.fft.rfft(frame))
        mel_energy = _MEL_FILTERBANK @ spectrum
        features[i] = np.log(mel_energy + _LOG_EPS)

    return features


def load_and_extract(wav_path: str) -> np.ndarray:
    """Read a WAV file and return its (NUM_FRAMES, N_MELS) log-mel features.

    Pads with silence or truncates to exactly N_SAMPLES first, so any 5s
    (or close to it) recording produces a fixed-shape feature matrix.
    """
    import soundfile as sf

    data, sr = sf.read(wav_path, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != SAMPLE_RATE:
        raise ValueError(f"{wav_path}: expected {SAMPLE_RATE}Hz, got {sr}Hz")

    if len(data) < N_SAMPLES:
        data = np.pad(data, (0, N_SAMPLES - len(data)))
    else:
        data = data[:N_SAMPLES]

    return extract_log_mel(data)
