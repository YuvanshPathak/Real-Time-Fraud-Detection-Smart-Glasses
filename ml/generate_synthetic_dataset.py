"""Generates a synthetic proof-of-concept genuine/spoof dataset.

There is no real labeled voice dataset anywhere in this repo (no ASVspoof, no
hardware-captured samples — see ml/README.md for why). This script fabricates
both classes from scratch purely to exercise the training -> quantization ->
on-device inference pipeline end to end. It is NOT a model of real human
speech vs. real spoofing attacks — "genuine" here means "harmonically rich
signal with natural-sounding jitter," and "spoof" means "flat, perfectly
periodic tone," which are trivially separable by design. Replace this with
real hardware-captured recordings before trusting the resulting model's score
for anything beyond pipeline validation. See ml/README.md.
"""

import os

import numpy as np
import soundfile as sf

from features import N_SAMPLES, SAMPLE_RATE

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")

SAMPLES_PER_CLASS = 200
SEED = 42


def _time_axis() -> np.ndarray:
    return np.arange(N_SAMPLES, dtype=np.float32) / SAMPLE_RATE


def _speech_envelope(rng: np.random.Generator, t: np.ndarray) -> np.ndarray:
    """Bursts of energy separated by near-silence, like speech vs. pauses."""
    n_bursts = rng.integers(4, 9)
    envelope = np.zeros_like(t)
    for _ in range(n_bursts):
        center = rng.uniform(0.3, t[-1] - 0.3)
        width = rng.uniform(0.15, 0.45)
        envelope += np.exp(-0.5 * ((t - center) / width) ** 2)
    return np.clip(envelope, 0.0, 1.0)


def make_genuine_sample(rng: np.random.Generator) -> np.ndarray:
    """Harmonic stack over a human-pitch-range fundamental, with jitter/shimmer
    (slow random-walk modulation of pitch and amplitude per harmonic) plus a
    speech-like amplitude envelope and a touch of broadband noise — meant to
    give the feature extractor genuine spectral/temporal variation to key on,
    mirroring what the cloud heuristic in anti_spoofing.py looks for
    (rich high-frequency content, non-uniform spectral centroid, energy
    variance) rather than truly synthesizing speech.
    """
    t = _time_axis()
    fundamental = rng.uniform(90.0, 260.0)

    # Slow pitch jitter via a smoothed random walk.
    jitter = np.cumsum(rng.normal(0, 0.4, size=len(t)))
    jitter = jitter / (np.abs(jitter).max() + 1e-9) * rng.uniform(2.0, 8.0)

    signal = np.zeros_like(t)
    n_harmonics = rng.integers(6, 12)
    for h in range(1, n_harmonics + 1):
        harmonic_freq = fundamental * h + jitter
        # Shimmer: independent slow amplitude modulation per harmonic.
        shimmer = 1.0 + 0.15 * np.sin(2 * np.pi * rng.uniform(2, 6) * t + rng.uniform(0, 2 * np.pi))
        amp = shimmer / h  # natural harmonic roll-off
        phase = 2 * np.pi * np.cumsum(harmonic_freq) / SAMPLE_RATE
        signal += amp * np.sin(phase)

    envelope = _speech_envelope(rng, t)
    signal *= envelope
    signal += rng.normal(0, 0.02, size=len(t))  # broadband noise floor

    signal = signal / (np.abs(signal).max() + 1e-9) * 0.8
    return signal.astype(np.float32)


def make_spoof_sample(rng: np.random.Generator) -> np.ndarray:
    """Flat, perfectly periodic, band-limited tone(s) — no jitter, no shimmer,
    suppressed high-frequency content — the opposite of make_genuine_sample by
    construction, standing in for a replayed/synthetic-TTS-style signal.
    """
    t = _time_axis()
    fundamental = rng.uniform(90.0, 260.0)

    signal = np.zeros_like(t)
    n_harmonics = rng.integers(2, 4)  # few harmonics -> suppressed HF energy
    for h in range(1, n_harmonics + 1):
        signal += np.sin(2 * np.pi * fundamental * h * t) / h

    # Perfectly steady envelope (no natural speech bursts) plus very low noise.
    envelope = 0.5 + 0.05 * np.sin(2 * np.pi * 0.5 * t)  # gentle, mechanical AM
    signal *= envelope
    signal += rng.normal(0, 0.002, size=len(t))

    signal = signal / (np.abs(signal).max() + 1e-9) * 0.8
    return signal.astype(np.float32)


def main() -> None:
    rng = np.random.default_rng(SEED)

    for label, make_fn in (("genuine", make_genuine_sample), ("spoof", make_spoof_sample)):
        out_dir = os.path.join(DATA_DIR, label)
        os.makedirs(out_dir, exist_ok=True)
        for i in range(SAMPLES_PER_CLASS):
            sample = make_fn(rng)
            sf.write(os.path.join(out_dir, f"{label}_{i:04d}.wav"), sample, SAMPLE_RATE, subtype="PCM_16")
        print(f"wrote {SAMPLES_PER_CLASS} {label} samples to {out_dir}")


if __name__ == "__main__":
    main()
