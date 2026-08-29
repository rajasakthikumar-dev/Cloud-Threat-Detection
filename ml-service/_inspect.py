"""Temporary inspection script — safe to delete after running."""
import os
import sys

ML = os.path.dirname(os.path.abspath(__file__))

# ── File sizes ─────────────────────────────────────────────
print("=== FILE SIZES ===")
files = {
    "model":   os.path.join(ML, "model", "saved_models", "lstm_threat_detection.h5"),
    "scaler":  os.path.join(ML, "preprocessing", "processed", "scaler.pkl"),
    "encoder": os.path.join(ML, "preprocessing", "processed", "encoder.pkl"),
}
for name, path in files.items():
    if os.path.exists(path):
        print(f"  EXISTS  {os.path.getsize(path):>12,} bytes  {path}")
    else:
        print(f"  MISSING {path}")

# ── Scaler ─────────────────────────────────────────────────
print("\n=== SCALER ===")
import joblib, numpy as np
scaler = joblib.load(files["scaler"])
print("Type:", type(scaler).__name__)
print("n_features_in_:", getattr(scaler, "n_features_in_", "N/A"))
fnames = getattr(scaler, "feature_names_in_", None)
if fnames is not None:
    print("feature_names_in_ count:", len(fnames))
    print("Names:", list(fnames))
else:
    print("feature_names_in_: NOT SET (no column names saved)")
print("mean_ shape:", scaler.mean_.shape)
print("var_ shape :", scaler.var_.shape)

# ── Encoder ────────────────────────────────────────────────
print("\n=== ENCODER ===")
encoders = joblib.load(files["encoder"])
print("Type:", type(encoders).__name__)
if isinstance(encoders, dict):
    print("Keys:", list(encoders.keys()))
    for k, v in encoders.items():
        print(f"  '{k}': {len(v.classes_)} classes  first10={list(v.classes_[:10])}")
else:
    print("Value:", encoders)

# ── Model ──────────────────────────────────────────────────
print("\n=== MODEL ===")
import tensorflow as tf
print("TF version:", tf.__version__)
model = tf.keras.models.load_model(files["model"])
print("Input  shape:", model.input_shape)
print("Output shape:", model.output_shape)
print()
model.summary()
