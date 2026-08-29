"""
preprocessing/verify_outputs.py
================================
Post-preprocessing verification script.

Checks that every file produced by preprocess.py:
  1. Exists on disk
  2. Has the correct shape / type
  3. Contains no NaN or Inf values (arrays)
  4. Metadata dict has all expected keys

Usage
-----
  cd <project-root>
  python preprocessing/verify_outputs.py

Exit code
---------
  0  — all checks passed
  1  — one or more checks failed
"""

import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

import numpy as np
import joblib

from config import (
    PROCESSED_DIR,
    X_TRAIN_PATH, X_TEST_PATH,
    Y_TRAIN_PATH, Y_TEST_PATH,
    Y_TRAIN_CAT_PATH, Y_TEST_CAT_PATH,
    SCALER_PATH, ENCODER_PATH,
    CAT_ENCODER_PATH, FEATURE_NAMES_PATH, METADATA_PATH,
    TRAIN_ROWS, TEST_ROWS, N_FEATURES, TIMESTEPS,
)

PASS = "  [PASS]"
FAIL = "  [FAIL]"
errors = []


def check(condition: bool, label: str, detail: str = "") -> None:
    """Record a pass or fail for one named check."""
    if condition:
        print(f"{PASS}  {label}")
    else:
        msg = f"{label}" + (f" — {detail}" if detail else "")
        print(f"{FAIL}  {msg}")
        errors.append(msg)


def section(title: str) -> None:
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


# ─────────────────────────────────────────────────────────────
# 1.  File existence
# ─────────────────────────────────────────────────────────────
section("1. File existence")

required_files = {
    "X_train.npy":        X_TRAIN_PATH,
    "X_test.npy":         X_TEST_PATH,
    "y_train.npy":        Y_TRAIN_PATH,
    "y_test.npy":         Y_TEST_PATH,
    "y_train_cat.npy":    Y_TRAIN_CAT_PATH,
    "y_test_cat.npy":     Y_TEST_CAT_PATH,
    "scaler.pkl":         SCALER_PATH,
    "encoder.pkl":        ENCODER_PATH,
    "cat_encoder.pkl":    CAT_ENCODER_PATH,
    "feature_names.pkl":  FEATURE_NAMES_PATH,
    "metadata.pkl":       METADATA_PATH,
}

for name, path in required_files.items():
    exists = os.path.exists(path)
    size_kb = os.path.getsize(path) / 1024 if exists else 0
    check(exists, f"{name}  ({size_kb:.0f} KB)")

# ─────────────────────────────────────────────────────────────
# 2.  Array shapes
# ─────────────────────────────────────────────────────────────
section("2. Array shapes")

expected_shapes = {
    X_TRAIN_PATH: ((TRAIN_ROWS, TIMESTEPS, N_FEATURES), "float32"),
    X_TEST_PATH:  ((TEST_ROWS,  TIMESTEPS, N_FEATURES), "float32"),
    Y_TRAIN_PATH: ((TRAIN_ROWS,), "int32"),
    Y_TEST_PATH:  ((TEST_ROWS,),  "int32"),
    Y_TRAIN_CAT_PATH: ((TRAIN_ROWS,), "int32"),
    Y_TEST_CAT_PATH:  ((TEST_ROWS,),  "int32"),
}

arrays = {}
for path, (exp_shape, exp_dtype) in expected_shapes.items():
    name = os.path.basename(path)
    if not os.path.exists(path):
        check(False, f"{name} shape", "file missing")
        continue
    arr = np.load(path, mmap_mode="r")
    arrays[path] = arr
    check(
        arr.shape == exp_shape,
        f"{name}  shape={arr.shape}  dtype={arr.dtype}",
        f"expected shape={exp_shape} dtype={exp_dtype}",
    )
    check(
        str(arr.dtype) == exp_dtype,
        f"{name}  dtype={arr.dtype}",
        f"expected {exp_dtype}",
    )

# ─────────────────────────────────────────────────────────────
# 3.  NaN / Inf check on feature arrays
# ─────────────────────────────────────────────────────────────
section("3. NaN / Inf in feature arrays")

for path in (X_TRAIN_PATH, X_TEST_PATH):
    name = os.path.basename(path)
    if path not in arrays:
        continue
    arr = arrays[path]
    n_nan = int(np.isnan(arr).sum())
    n_inf = int(np.isinf(arr).sum())
    check(n_nan == 0, f"{name}  NaN count={n_nan}", "NaNs detected" if n_nan else "")
    check(n_inf == 0, f"{name}  Inf count={n_inf}", "Infs detected" if n_inf else "")

# ─────────────────────────────────────────────────────────────
# 4.  Label value range
# ─────────────────────────────────────────────────────────────
section("4. Label value range")

for path, name in ((Y_TRAIN_PATH, "y_train"), (Y_TEST_PATH, "y_test")):
    if not os.path.exists(path):
        continue
    arr = np.load(path)
    check(
        set(arr.tolist()).issubset({0, 1}),
        f"{name}  unique={sorted(set(arr.tolist()))}",
        "expected only 0 and 1",
    )

for path, name in ((Y_TRAIN_CAT_PATH, "y_train_cat"), (Y_TEST_CAT_PATH, "y_test_cat")):
    if not os.path.exists(path):
        continue
    arr = np.load(path)
    check(
        arr.min() >= 0 and arr.max() <= 9,
        f"{name}  range=[{arr.min()}, {arr.max()}]  unique={len(set(arr.tolist()))} classes",
        "expected values in 0–9",
    )

# ─────────────────────────────────────────────────────────────
# 5.  Scaler
# ─────────────────────────────────────────────────────────────
section("5. StandardScaler")

if os.path.exists(SCALER_PATH):
    from sklearn.preprocessing import StandardScaler
    scaler = joblib.load(SCALER_PATH)
    check(
        isinstance(scaler, StandardScaler),
        f"scaler type = {type(scaler).__name__}",
    )
    check(
        hasattr(scaler, "mean_") and scaler.mean_ is not None,
        f"scaler is fitted  (n_features={len(scaler.mean_) if hasattr(scaler,'mean_') else '?'})",
    )
    # Verify it was fitted on N_FEATURES columns
    if hasattr(scaler, "mean_"):
        check(
            len(scaler.mean_) == N_FEATURES,
            f"scaler n_features={len(scaler.mean_)}  (expected {N_FEATURES})",
        )

# ─────────────────────────────────────────────────────────────
# 6.  Feature encoders
# ─────────────────────────────────────────────────────────────
section("6. Feature encoders  (proto / service / state)")

if os.path.exists(ENCODER_PATH):
    encoders = joblib.load(ENCODER_PATH)
    check(isinstance(encoders, dict), f"encoder.pkl type = dict  keys={list(encoders.keys())}")
    for col in ("proto", "service", "state"):
        check(col in encoders, f"  encoder key '{col}' present")
        if col in encoders:
            le = encoders[col]
            check(
                hasattr(le, "classes_"),
                f"  '{col}' LabelEncoder fitted  ({len(le.classes_)} classes)",
            )

# ─────────────────────────────────────────────────────────────
# 7.  Attack category encoder
# ─────────────────────────────────────────────────────────────
section("7. Attack category encoder  (cat_encoder.pkl)")

if os.path.exists(CAT_ENCODER_PATH):
    cat_enc = joblib.load(CAT_ENCODER_PATH)
    check(
        hasattr(cat_enc, "classes_") and len(cat_enc.classes_) == 10,
        f"cat_encoder classes ({len(cat_enc.classes_)}): {list(cat_enc.classes_)}",
    )

# ─────────────────────────────────────────────────────────────
# 8.  Feature names
# ─────────────────────────────────────────────────────────────
section("8. Feature names  (feature_names.pkl)")

if os.path.exists(FEATURE_NAMES_PATH):
    feature_names = joblib.load(FEATURE_NAMES_PATH)
    check(
        isinstance(feature_names, list) and len(feature_names) == N_FEATURES,
        f"feature_names is list  len={len(feature_names)}  (expected {N_FEATURES})",
    )
    print(f"  Features: {feature_names}")

# ─────────────────────────────────────────────────────────────
# 9.  Metadata dict
# ─────────────────────────────────────────────────────────────
section("9. Metadata  (metadata.pkl)")

REQUIRED_META_KEYS = [
    "source_format", "train_rows", "test_rows", "n_features",
    "timesteps", "lstm_input_shape", "feature_names",
    "categorical_cols", "has_attack_cat",
    "train_normal", "train_attack", "test_normal", "test_attack",
]

if os.path.exists(METADATA_PATH):
    meta = joblib.load(METADATA_PATH)
    for key in REQUIRED_META_KEYS:
        check(key in meta, f"  metadata key '{key}' = {meta.get(key)}")

    # Sanity-check row counts
    check(meta.get("train_rows") == TRAIN_ROWS,
          f"  train_rows={meta.get('train_rows')}  (expected {TRAIN_ROWS})")
    check(meta.get("test_rows") == TEST_ROWS,
          f"  test_rows={meta.get('test_rows')}  (expected {TEST_ROWS})")
    check(meta.get("n_features") == N_FEATURES,
          f"  n_features={meta.get('n_features')}  (expected {N_FEATURES})")

    print(f"\n  Metadata summary:")
    for k, v in meta.items():
        if k != "feature_names":
            print(f"    {k:<22} = {v}")

# ─────────────────────────────────────────────────────────────
# 10. FINAL RESULT
# ─────────────────────────────────────────────────────────────
print(f"\n{'═'*55}")
if errors:
    print(f"  RESULT: FAILED  ({len(errors)} error(s))")
    for e in errors:
        print(f"    ✗ {e}")
    print(f"{'═'*55}\n")
    sys.exit(1)
else:
    print("  RESULT: ALL CHECKS PASSED ✓")
    print(f"{'═'*55}")
    print("  dataset/processed/ is ready for model training.")
    print("  Next step:  python model/train.py\n")
    sys.exit(0)
