#include "tinyml_features.h"

#include <arduinoFFT.h>

#include <cmath>

#include "tinyml_feature_config.h"

// Written against arduinoFFT v1.x's classic API (constructor takes the
// working arrays + length + sample rate; Compute()/ComplexToMagnitude() are
// void, operate in place on those arrays). platformio.ini pins
// `kosme/arduinoFFT @ ^1.6.2` specifically to get this API — if that ever
// changes to a v2.x release, the call sites below need updating to the
// FFTDirection-based v2 API. Not verified against a real `pio run` in this
// environment — see firmware/platformio.ini's comment on this dependency.
namespace {
double vReal[TINYML_FRAME_LEN];
double vImag[TINYML_FRAME_LEN];
ArduinoFFT<double> FFT(vReal, vImag, TINYML_FRAME_LEN, (double)TINYML_SAMPLE_RATE);
}  // namespace

bool computeLogMelFeatures(const int16_t *samples, size_t sampleCount, float *outFeatures) {
  if (sampleCount != TINYML_N_SAMPLES) return false;

  for (int frame = 0; frame < TINYML_NUM_FRAMES; frame++) {
    const size_t start = (size_t)frame * TINYML_HOP_LEN;

    // Window with the same Hann table features.py used, then zero the
    // imaginary half for a real-valued FFT input.
    for (int i = 0; i < TINYML_FRAME_LEN; i++) {
      const float sampleF = samples[start + i] / 32768.0f;  // matches soundfile's int16->float32 normalization
      vReal[i] = (double)(sampleF * TINYML_HANN_WINDOW[i]);
      vImag[i] = 0.0;
    }

    FFT.Compute(FFT_FORWARD);
    FFT.ComplexToMagnitude();

    // Only the first TINYML_N_FFT_BINS (N/2+1) bins are meaningful for
    // real-valued input — the rest mirror them and are unused, matching
    // np.fft.rfft's output in features.py.
    for (int mel = 0; mel < TINYML_N_MELS; mel++) {
      double energy = 0.0;
      for (int bin = 0; bin < TINYML_N_FFT_BINS; bin++) {
        energy += (double)TINYML_MEL_FILTERBANK[mel][bin] * vReal[bin];
      }
      outFeatures[frame * TINYML_N_MELS + mel] = logf((float)energy + 1e-6f);
    }
  }

  return true;
}
