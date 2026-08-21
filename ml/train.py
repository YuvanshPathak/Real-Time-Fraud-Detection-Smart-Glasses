"""Trains the synthetic-POC TinyML voice liveness model and exports it as an
INT8-quantized TFLite file. Run with backend/.venv's Python (already has
tensorflow/numpy/scipy — see ml/README.md).

    backend\\.venv\\Scripts\\python.exe ml\\train.py

Prerequisite: ml/generate_synthetic_dataset.py must have been run first to
populate ml/data/{genuine,spoof}/*.wav.
"""

import glob
import os

import numpy as np
import tensorflow as tf

from features import N_MELS, NUM_FRAMES, load_and_extract

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")

SEED = 42
VAL_SPLIT = 0.2
EPOCHS = 20
BATCH_SIZE = 16


def load_dataset():
    """label 1.0 = genuine (liveness), 0.0 = spoof — matches voice_liveness_score
    semantics used everywhere else in this repo (higher = more genuine)."""
    X, y = [], []
    for label, value in (("genuine", 1.0), ("spoof", 0.0)):
        paths = sorted(glob.glob(os.path.join(DATA_DIR, label, "*.wav")))
        if not paths:
            raise FileNotFoundError(
                f"no WAVs found in {os.path.join(DATA_DIR, label)} — "
                "run generate_synthetic_dataset.py first"
            )
        for path in paths:
            X.append(load_and_extract(path))
            y.append(value)

    X = np.stack(X)[..., np.newaxis]  # (N, NUM_FRAMES, N_MELS, 1)
    y = np.array(y, dtype=np.float32)
    return X, y


def build_model() -> tf.keras.Model:
    inputs = tf.keras.Input(shape=(NUM_FRAMES, N_MELS, 1))
    x = tf.keras.layers.BatchNormalization()(inputs)
    x = tf.keras.layers.Conv2D(8, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.MaxPooling2D(2)(x)
    x = tf.keras.layers.Conv2D(16, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.MaxPooling2D(2)(x)
    x = tf.keras.layers.Conv2D(16, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dense(16, activation="relu")(x)
    outputs = tf.keras.layers.Dense(1, activation="sigmoid")(x)
    return tf.keras.Model(inputs, outputs)


def quantize_to_tflite(model: tf.keras.Model, x_train: np.ndarray) -> bytes:
    def representative_dataset():
        for i in range(min(100, len(x_train))):
            yield [x_train[i:i + 1].astype(np.float32)]

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


def main() -> None:
    tf.keras.utils.set_random_seed(SEED)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    X, y = load_dataset()
    n = len(X)
    idx = np.random.default_rng(SEED).permutation(n)
    X, y = X[idx], y[idx]
    n_val = int(n * VAL_SPLIT)
    X_val, y_val = X[:n_val], y[:n_val]
    X_train, y_train = X[n_val:], y[n_val:]

    print(f"train={len(X_train)} val={len(X_val)} shape={X.shape[1:]}")

    model = build_model()
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    model.summary()
    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS, batch_size=BATCH_SIZE, verbose=2,
    )

    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"final val_accuracy={val_acc:.4f} val_loss={val_loss:.4f}")
    if val_acc < 0.9:
        print(
            "WARNING: val_accuracy is low even for this trivially-separable "
            "synthetic dataset — something in the pipeline likely broke "
            "(check feature extraction / label alignment before exporting)."
        )

    tflite_model = quantize_to_tflite(model, X_train)
    out_path = os.path.join(OUTPUT_DIR, "voice_tinyml.tflite")
    with open(out_path, "wb") as f:
        f.write(tflite_model)
    print(f"wrote {out_path} ({len(tflite_model)} bytes)")

    interpreter = tf.lite.Interpreter(model_content=tflite_model)
    in_detail = interpreter.get_input_details()[0]
    out_detail = interpreter.get_output_details()[0]
    print(f"quantized input:  dtype={in_detail['dtype']} scale/zero_point={in_detail['quantization']}")
    print(f"quantized output: dtype={out_detail['dtype']} scale/zero_point={out_detail['quantization']}")
    print(
        "^ these scale/zero_point values must match what tinyml_model.cpp uses "
        "to quantize input / dequantize output — read them from the model at "
        "runtime via interpreter->input(0)->params, don't hardcode them."
    )


if __name__ == "__main__":
    main()
