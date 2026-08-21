#include "tinyml.h"

#include <Arduino.h>
#include <esp_heap_caps.h>
#include <tensorflow/lite/micro/micro_interpreter.h>
#include <tensorflow/lite/micro/micro_mutable_op_resolver.h>
#include <tensorflow/lite/schema/schema_generated.h>

#include <cmath>

#include "tinyml_feature_config.h"
#include "tinyml_features.h"
#include "voice_tinyml_model.h"

// Written against esp-tflite-micro's mainline API as of when this was
// written (4-arg MicroInterpreter constructor, no separate MicroErrorReporter
// argument). TFLite Micro's API has churned across versions in the past —
// not verified against a real `pio run` in this environment (no PlatformIO
// toolchain available here, see firmware/platformio.ini comment), so this is
// the first thing to check against whatever esp-tflite-micro version
// PlatformIO actually resolves if the build fails on this file.
namespace {
// Sized generously above what ml/train.py's ~4K-parameter model needs
// (arena_used_bytes() is printed by initTinyML() on success — shrink this
// once you've seen the real number). Allocated from PSRAM, freed never (lives
// for the process lifetime, same pattern as the audio/HTTP buffers in
// microphone.cpp/api.cpp, which are freed per-cycle instead because they're
// much larger and only needed transiently).
constexpr int kTensorArenaSize = 60 * 1024;
uint8_t *tensor_arena = nullptr;

const tflite::Model *model = nullptr;
tflite::MicroInterpreter *interpreter = nullptr;
TfLiteTensor *input_tensor = nullptr;
TfLiteTensor *output_tensor = nullptr;

// Op list matches ml/train.py's architecture (Conv2D/MaxPool2D/
// GlobalAveragePooling2D-as-Mean/Dense/sigmoid, plus INT8 quantize/dequantize
// glue at the model boundary; BatchNormalization gets fused into the
// preceding Conv2D's weights during TFLite conversion, so it needs no op of
// its own). If AllocateTensors() or Invoke() reports an unresolved op, the
// error names it — add the matching AddXxx() call here and bump the
// MicroMutableOpResolver<N> count.
tflite::MicroMutableOpResolver<8> resolver;
}  // namespace

bool initTinyML() {
  tensor_arena = (uint8_t *)heap_caps_malloc(kTensorArenaSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!tensor_arena) {
    Serial.println("[tinyml] tensor arena PSRAM allocation failed, falling back to SRAM");
    tensor_arena = (uint8_t *)malloc(kTensorArenaSize);
  }
  if (!tensor_arena) {
    Serial.println("[tinyml] tensor arena allocation failed entirely");
    return false;
  }

  model = tflite::GetModel(g_voice_tinyml_model);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.printf("[tinyml] model schema version mismatch: %u != %d\n",
                  (unsigned)model->version(), TFLITE_SCHEMA_VERSION);
    return false;
  }

  resolver.AddConv2D();
  resolver.AddMaxPool2D();
  resolver.AddMean();
  resolver.AddFullyConnected();
  resolver.AddLogistic();
  resolver.AddReshape();
  resolver.AddQuantize();
  resolver.AddDequantize();

  static tflite::MicroInterpreter static_interpreter(model, resolver, tensor_arena, kTensorArenaSize);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("[tinyml] AllocateTensors failed — tensor arena likely too small, "
                    "see kTensorArenaSize in tinyml_model.cpp");
    interpreter = nullptr;
    return false;
  }

  input_tensor = interpreter->input(0);
  output_tensor = interpreter->output(0);

  Serial.printf("[tinyml] initialized, arena used=%u/%u bytes\n",
                (unsigned)interpreter->arena_used_bytes(), (unsigned)kTensorArenaSize);
  return true;
}

TinyMLResult runTinyMLInference(const int16_t *samples, size_t sampleCount, int sampleRate) {
  TinyMLResult result;

  if (!interpreter || !input_tensor || !output_tensor) return result;  // initTinyML() never succeeded
  if (sampleRate != TINYML_SAMPLE_RATE) return result;

  static float features[TINYML_NUM_FRAMES * TINYML_N_MELS];
  if (!computeLogMelFeatures(samples, sampleCount, features)) return result;

  const float inputScale = input_tensor->params.scale;
  const int32_t inputZeroPoint = input_tensor->params.zero_point;
  for (int i = 0; i < TINYML_NUM_FRAMES * TINYML_N_MELS; i++) {
    int32_t quantized = (int32_t)lroundf(features[i] / inputScale) + inputZeroPoint;
    if (quantized < -128) quantized = -128;
    if (quantized > 127) quantized = 127;
    input_tensor->data.int8[i] = (int8_t)quantized;
  }

  if (interpreter->Invoke() != kTfLiteOk) {
    Serial.println("[tinyml] Invoke failed");
    return result;
  }

  const float outputScale = output_tensor->params.scale;
  const int32_t outputZeroPoint = output_tensor->params.zero_point;
  float score = (output_tensor->data.int8[0] - outputZeroPoint) * outputScale;
  if (score < 0.0f) score = 0.0f;
  if (score > 1.0f) score = 1.0f;

  result.ok = true;
  result.livenessScore = score;
  return result;
}
