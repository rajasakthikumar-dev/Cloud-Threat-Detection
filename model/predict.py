"""
model/predict.py
-----------------
Load the trained LSTM model and run inference on:
  (a) the saved test set  (default, no arguments)
  (b) a new CSV file      (--input path/to/file.csv)

Features:
  - Loads the saved StandardScaler and LabelEncoders from preprocessing
    so that new CSV data is transformed identically to training data
  - Supports binary (Normal / Attack) and multiclass (attack category) output
  - Displays prediction confidence for every sample
  - Logs all prediction events to logs/detection.log

Usage:
    python model/predict.py
    python model/predict.py --input path/to/traffic.csv
    python model/predict.py --multiclass
"""

import os
import sys
import argparse
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tensorflow.keras.models import load_model

from config import (
    MODEL_PATH,
    PREDICTION_THRESHOLD,
    TIMESTEPS,
    COLUMNS_TO_DROP,
    LABEL_COLUMN,
    ATTACK_CAT_COLUMN,
    ATTACK_CATEGORIES,
)
from utils.data_loader import (
    load_testing_data,
    load_scaler,
    load_encoders,
    load_cat_encoder,
)
from utils.logger import get_logger, log_section, log_prediction_event, log_error

logger = get_logger("predict")


# ─────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────

def load_trained_model(path: str = MODEL_PATH):
    """
    Load the saved LSTM .h5 model with a clear error if missing.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"\n[ERROR] Trained model not found at: {path}\n"
            f"Please train the model first:\n"
            f"  python model/train.py\n"
        )
    logger.info(f"Loading model from: {path}")
    model = load_model(path)
    logger.info("Model loaded successfully.")
    return model


# ─────────────────────────────────────────────────────────────
# CSV PREPROCESSING FOR PREDICTION
# ─────────────────────────────────────────────────────────────

def preprocess_csv(csv_path: str, scaler, encoders: dict) -> np.ndarray:
    """
    Apply the same transformations used during training to a raw CSV.
    Uses the saved scaler and encoders to ensure consistent transformation.

    Parameters
    ----------
    csv_path : path to a CSV file containing network traffic features
    scaler   : fitted StandardScaler (from scaler.pkl)
    encoders : dict of fitted LabelEncoders (from encoder.pkl)

    Returns
    -------
    X : np.ndarray  shape (samples, 1, features)
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"[ERROR] Input CSV not found: {csv_path}"
        )

    logger.info(f"Reading CSV: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)

    # Normalise column names
    df.columns = [c.strip().lower() for c in df.columns]

    # Drop label / ID / attack_cat columns if present — they are not features
    drop_cols = [c for c in [LABEL_COLUMN, ATTACK_CAT_COLUMN] + COLUMNS_TO_DROP
                 if c in df.columns]
    if drop_cols:
        df = df.drop(columns=drop_cols)
        logger.info(f"Dropped non-feature columns: {drop_cols}")

    # Handle missing values
    for col in df.columns:
        if df[col].isnull().any():
            if df[col].dtype == "object":
                df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "Unknown", inplace=True)
            else:
                df[col].fillna(df[col].median(), inplace=True)

    # Apply saved LabelEncoders to categorical columns
    for col, le in encoders.items():
        if col in df.columns:
            # Map unseen values to the first known class to avoid errors
            known_classes = set(le.classes_)
            df[col] = df[col].astype(str).apply(
                lambda x: x if x in known_classes else le.classes_[0]
            )
            df[col] = le.transform(df[col])
            logger.debug(f"Encoded column '{col}' with saved LabelEncoder.")

    # Apply saved StandardScaler
    X = scaler.transform(df.values.astype(np.float32))

    # Reshape for LSTM: (samples, 1, features)
    X = X.reshape((X.shape[0], TIMESTEPS, X.shape[1]))
    logger.info(f"Preprocessed CSV shape: {X.shape}")
    return X


# ─────────────────────────────────────────────────────────────
# INFERENCE
# ─────────────────────────────────────────────────────────────

def predict_binary(model, X: np.ndarray):
    """
    Run binary inference. Returns probabilities and 0/1 labels.

    Returns
    -------
    y_prob : np.ndarray, sigmoid probabilities
    y_pred : np.ndarray, 0=Normal, 1=Attack
    """
    if X.ndim == 2:
        X = X.reshape((X.shape[0], TIMESTEPS, X.shape[1]))
    y_prob = model.predict(X, verbose=0).flatten()
    y_pred = (y_prob >= PREDICTION_THRESHOLD).astype(int)
    return y_prob, y_pred


def predict_multiclass(model, X: np.ndarray):
    """
    Run multiclass inference. Returns softmax probabilities and class indices.

    Returns
    -------
    y_prob_raw : np.ndarray  (samples, n_classes)
    y_pred     : np.ndarray  class indices
    """
    if X.ndim == 2:
        X = X.reshape((X.shape[0], TIMESTEPS, X.shape[1]))
    y_prob_raw = model.predict(X, verbose=0)
    y_pred     = np.argmax(y_prob_raw, axis=1)
    return y_prob_raw, y_pred


# ─────────────────────────────────────────────────────────────
# DISPLAY
# ─────────────────────────────────────────────────────────────

def display_binary_results(y_prob: np.ndarray, y_pred: np.ndarray, max_display: int = 20):
    """Print a formatted binary prediction table with confidence %."""
    total   = len(y_pred)
    attacks = int(y_pred.sum())
    normals = total - attacks

    print("\n" + "=" * 60)
    print("  PREDICTION RESULTS  (Binary: Normal / Attack)")
    print("=" * 60)
    print(f"  Total Samples   : {total:,}")
    print(f"  Normal Traffic  : {normals:,}  ({100*normals/total:.1f}%)")
    print(f"  Attack Traffic  : {attacks:,}  ({100*attacks/total:.1f}%)")
    print("=" * 60)

    n = min(max_display, total)
    print(f"\nShowing first {n} predictions:\n")
    print(f"{'#':>6}  {'Prediction':>12}  {'Confidence':>12}  {'Status'}")
    print("-" * 54)

    for i in range(n):
        label      = "Attack" if y_pred[i] == 1 else "Normal"
        confidence = y_prob[i] if y_pred[i] == 1 else (1 - y_prob[i])
        status     = "⚠  THREAT DETECTED" if y_pred[i] == 1 else "✓  SAFE"
        print(f"{i+1:>6}  {label:>12}  {confidence*100:>10.2f}%  {status}")

    if total > max_display:
        print(f"\n  ... and {total - max_display:,} more samples.")

    log_prediction_event(logger, total, attacks, normals)


def display_multiclass_results(y_prob_raw: np.ndarray, y_pred: np.ndarray, max_display: int = 20):
    """Print multiclass prediction table with category name and confidence."""
    total = len(y_pred)
    from collections import Counter
    counts = Counter(y_pred)

    print("\n" + "=" * 65)
    print("  PREDICTION RESULTS  (Multiclass Attack Categories)")
    print("=" * 65)
    print(f"  Total Samples : {total:,}\n")
    for class_idx, count in sorted(counts.items()):
        cat = ATTACK_CATEGORIES[class_idx] if class_idx < len(ATTACK_CATEGORIES) else str(class_idx)
        print(f"  {cat:<20}: {count:>6,}  ({100*count/total:.1f}%)")
    print("=" * 65)

    n = min(max_display, total)
    print(f"\nShowing first {n} predictions:\n")
    print(f"{'#':>6}  {'Category':>18}  {'Confidence':>12}  {'Alert'}")
    print("-" * 60)

    for i in range(n):
        cat        = ATTACK_CATEGORIES[y_pred[i]] if y_pred[i] < len(ATTACK_CATEGORIES) else str(y_pred[i])
        confidence = float(y_prob_raw[i][y_pred[i]])
        alert      = "✓  NORMAL" if cat == "Normal" else f"⚠  {cat.upper()}"
        print(f"{i+1:>6}  {cat:>18}  {confidence*100:>10.2f}%  {alert}")

    if total > max_display:
        print(f"\n  ... and {total - max_display:,} more samples.")

    attacks = total - counts.get(0, 0)  # class 0 = Normal
    normals = counts.get(0, 0)
    log_prediction_event(logger, total, attacks, normals)


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="LSTM Threat Detection — Prediction Script"
    )
    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help="Path to a CSV file with network features. "
             "If omitted, uses saved X_test.npy.",
    )
    parser.add_argument(
        "--multiclass",
        action="store_true",
        default=False,
        help="Predict attack categories (multiclass) instead of binary Normal/Attack.",
    )
    args = parser.parse_args()

    try:
        log_section(logger, "LSTM Threat Detection — Prediction")

        # Load model
        model = load_trained_model()

        # Load preprocessing objects
        scaler   = load_scaler()
        encoders = load_encoders()

        # ── From CSV input ─────────────────────────────────────────────
        if args.input:
            logger.info(f"Predicting from CSV: {args.input}")
            X = preprocess_csv(args.input, scaler, encoders)

            if args.multiclass:
                y_prob_raw, y_pred = predict_multiclass(model, X)
                display_multiclass_results(y_prob_raw, y_pred)
            else:
                y_prob, y_pred = predict_binary(model, X)
                display_binary_results(y_prob, y_pred)

        # ── From saved test set ────────────────────────────────────────
        else:
            logger.info("No --input provided. Using saved test set (X_test.npy).")
            X_test, y_test = load_testing_data()

            if args.multiclass:
                y_prob_raw, y_pred = predict_multiclass(model, X_test)
                display_multiclass_results(y_prob_raw, y_pred)
            else:
                y_prob, y_pred = predict_binary(model, X_test)
                display_binary_results(y_prob, y_pred)

                # Accuracy vs ground truth
                acc = (y_pred == y_test).mean()
                logger.info(f"Ground-truth accuracy: {acc:.4f}  ({acc*100:.2f}%)")
                print(f"\n  Ground-truth Accuracy: {acc*100:.2f}%")

        logger.info("Prediction complete.")
        print("\n[DONE] Prediction complete.\n")

    except FileNotFoundError as e:
        log_error(logger, "predict.main", e)
        print(f"\n[ERROR] {e}")
        sys.exit(1)
    except Exception as e:
        log_error(logger, "predict.main", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
