"""
utils/data_loader.py
=====================
Reusable loader functions for all artefacts produced by
preprocessing/preprocess.py.

What is available after preprocessing
--------------------------------------
  Numpy arrays (dataset/processed/)
    X_train.npy        (175341, 1, 42)  float32  — LSTM-ready train features
    X_test.npy         ( 82332, 1, 42)  float32  — LSTM-ready test  features
    y_train.npy        (175341,)        int32    — binary train labels
    y_test.npy         ( 82332,)        int32    — binary test  labels
    y_train_cat.npy    (175341,)        int32    — multiclass train labels
    y_test_cat.npy     ( 82332,)        int32    — multiclass test  labels

  Sklearn objects (dataset/processed/)
    scaler.pkl         StandardScaler   — fitted on X_train (2-D, pre-reshape)
    encoder.pkl        dict             — {col: LabelEncoder} for proto/service/state
    cat_encoder.pkl    LabelEncoder     — for attack_cat (10 classes)
    feature_names.pkl  list[str]        — ordered list of 42 feature names
    metadata.pkl       dict             — dataset statistics

Usage
-----
    from utils.data_loader import load_all_data, load_scaler, load_encoders

    X_train, X_test, y_train, y_test = load_all_data()
    scaler   = load_scaler()
    encoders = load_encoders()          # dict {col_name: LabelEncoder}
    names    = load_feature_names()     # list of 42 feature names
    meta     = load_metadata()          # dict with train/test statistics
"""

import os
import sys
import numpy as np
import joblib

# ── Make project root importable regardless of working directory ──────
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

from config import (
    PROCESSED_DIR,
    X_TRAIN_PATH, X_TEST_PATH,
    Y_TRAIN_PATH, Y_TEST_PATH,
    Y_TRAIN_CAT_PATH, Y_TEST_CAT_PATH,
    SCALER_PATH, ENCODER_PATH,
    CAT_ENCODER_PATH, FEATURE_NAMES_PATH, METADATA_PATH,
)
from utils.logger import get_logger

logger = get_logger("data_loader")


# ─────────────────────────────────────────────────────────────
# INTERNAL HELPER
# ─────────────────────────────────────────────────────────────

def _require(path: str) -> None:
    """Raise a clear FileNotFoundError if a required file is missing."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"\n[data_loader] Required file not found:\n"
            f"  {path}\n\n"
            f"Run preprocessing first:\n"
            f"  cd <project-root>\n"
            f"  python preprocessing/preprocess.py\n"
        )


# ─────────────────────────────────────────────────────────────
# NUMPY ARRAY LOADERS
# ─────────────────────────────────────────────────────────────

def load_training_data(processed_dir: str = PROCESSED_DIR):
    """
    Load X_train and y_train numpy arrays.

    Parameters
    ----------
    processed_dir : path to the processed/ directory (default from config)

    Returns
    -------
    X_train : np.ndarray  shape (175341, 1, 42)  float32
    y_train : np.ndarray  shape (175341,)         int32
    """
    x_path = os.path.join(processed_dir, "X_train.npy")
    y_path = os.path.join(processed_dir, "y_train.npy")
    _require(x_path)
    _require(y_path)

    X_train = np.load(x_path)
    y_train = np.load(y_path)
    logger.info(f"X_train loaded : {X_train.shape}  dtype={X_train.dtype}")
    logger.info(f"y_train loaded : {y_train.shape}  dtype={y_train.dtype}")
    return X_train, y_train


def load_testing_data(processed_dir: str = PROCESSED_DIR):
    """
    Load X_test and y_test numpy arrays.

    Returns
    -------
    X_test : np.ndarray  shape (82332, 1, 42)  float32
    y_test : np.ndarray  shape (82332,)         int32
    """
    x_path = os.path.join(processed_dir, "X_test.npy")
    y_path = os.path.join(processed_dir, "y_test.npy")
    _require(x_path)
    _require(y_path)

    X_test = np.load(x_path)
    y_test = np.load(y_path)
    logger.info(f"X_test  loaded : {X_test.shape}  dtype={X_test.dtype}")
    logger.info(f"y_test  loaded : {y_test.shape}  dtype={y_test.dtype}")
    return X_test, y_test


def load_all_data(processed_dir: str = PROCESSED_DIR):
    """
    Load all four core arrays in one call.

    Returns
    -------
    X_train, X_test, y_train, y_test : np.ndarray
    """
    X_train, y_train = load_training_data(processed_dir)
    X_test,  y_test  = load_testing_data(processed_dir)
    return X_train, X_test, y_train, y_test


def load_multiclass_labels(processed_dir: str = PROCESSED_DIR):
    """
    Load the 10-class attack category label arrays.
    Returns (None, None) gracefully if the files don't exist yet
    (e.g. preprocess was run without attack_cat).

    Returns
    -------
    y_train_cat : np.ndarray (175341,) int32  or  None
    y_test_cat  : np.ndarray (82332,)  int32  or  None
    """
    y_tr_path = os.path.join(processed_dir, "y_train_cat.npy")
    y_te_path = os.path.join(processed_dir, "y_test_cat.npy")

    if os.path.exists(y_tr_path) and os.path.exists(y_te_path):
        y_train_cat = np.load(y_tr_path)
        y_test_cat  = np.load(y_te_path)
        logger.info(
            f"Multiclass labels loaded — "
            f"train={y_train_cat.shape}  test={y_test_cat.shape}"
        )
        return y_train_cat, y_test_cat

    logger.info("Multiclass label files not found — binary mode only.")
    return None, None


# ─────────────────────────────────────────────────────────────
# SKLEARN / JOBLIB OBJECT LOADERS
# ─────────────────────────────────────────────────────────────

def load_scaler(scaler_path: str = SCALER_PATH):
    """
    Load the fitted StandardScaler.

    Returns
    -------
    sklearn.preprocessing.StandardScaler
    """
    _require(scaler_path)
    scaler = joblib.load(scaler_path)
    logger.info(f"StandardScaler loaded  ← {scaler_path}")
    return scaler


def load_encoders(encoder_path: str = ENCODER_PATH):
    """
    Load the dict of fitted LabelEncoders for categorical columns.

    Returns
    -------
    dict  {column_name: sklearn.preprocessing.LabelEncoder}
    Keys: proto, service, state
    """
    _require(encoder_path)
    encoders = joblib.load(encoder_path)
    logger.info(
        f"Feature encoders loaded  ← {encoder_path}  "
        f"({len(encoders)} col(s): {list(encoders.keys())})"
    )
    return encoders


def load_cat_encoder(cat_encoder_path: str = CAT_ENCODER_PATH):
    """
    Load the LabelEncoder fitted on attack_cat (10 attack categories).
    Returns None gracefully if the file doesn't exist.

    Returns
    -------
    sklearn.preprocessing.LabelEncoder  or  None
    """
    if not os.path.exists(cat_encoder_path):
        logger.info("cat_encoder.pkl not found — multiclass mode unavailable.")
        return None
    enc = joblib.load(cat_encoder_path)
    logger.info(
        f"Category encoder loaded  ← {cat_encoder_path}  "
        f"classes={list(enc.classes_)}"
    )
    return enc


def load_feature_names(feature_names_path: str = FEATURE_NAMES_PATH):
    """
    Load the ordered list of 42 feature column names.
    These names map index-by-index to X_train / X_test axis-2.

    Returns
    -------
    list[str]  — e.g. ['ackdat', 'ct_dst_ltm', ..., 'trans_depth']
                 (42 items, alphabetically sorted as saved by preprocess.py)
    """
    _require(feature_names_path)
    names = joblib.load(feature_names_path)
    logger.info(
        f"Feature names loaded  ← {feature_names_path}  "
        f"({len(names)} features)"
    )
    return names


def load_metadata(metadata_path: str = METADATA_PATH):
    """
    Load the metadata dict saved by preprocess.py.

    Dict keys
    ---------
    source_format    : 'parquet' or 'csv'
    train_rows       : int
    test_rows        : int
    n_features       : int  (42)
    timesteps        : int  (1)
    lstm_input_shape : tuple  (1, 42)
    feature_names    : list[str]
    categorical_cols : list[str]
    has_attack_cat   : bool
    train_normal     : int
    train_attack     : int
    test_normal      : int
    test_attack      : int

    Returns
    -------
    dict
    """
    _require(metadata_path)
    meta = joblib.load(metadata_path)
    logger.info(
        f"Metadata loaded  ← {metadata_path}  "
        f"train={meta.get('train_rows'):,}  "
        f"test={meta.get('test_rows'):,}  "
        f"features={meta.get('n_features')}"
    )
    return meta


# ─────────────────────────────────────────────────────────────
# SHAPE HELPER
# ─────────────────────────────────────────────────────────────

def get_input_shape(processed_dir: str = PROCESSED_DIR):
    """
    Return the LSTM input shape (timesteps, features) by reading
    the shape of X_train without loading the full array.

    Returns
    -------
    tuple  (timesteps, features)  e.g. (1, 42)
    """
    x_path = os.path.join(processed_dir, "X_train.npy")
    _require(x_path)

    # np.load with mmap_mode='r' reads only the header metadata
    X = np.load(x_path, mmap_mode="r")
    shape = (X.shape[1], X.shape[2])   # (timesteps, features)
    logger.info(f"LSTM input shape: {shape}  (from X_train header)")
    return shape


# ─────────────────────────────────────────────────────────────
# CONVENIENCE — load everything at once
# ─────────────────────────────────────────────────────────────

def load_all_artefacts(processed_dir: str = PROCESSED_DIR):
    """
    Load every preprocessing artefact in a single call.
    Useful for training and prediction scripts that need all objects.

    Returns
    -------
    dict with keys:
        X_train, X_test, y_train, y_test  — core arrays
        y_train_cat, y_test_cat           — multiclass labels (or None)
        scaler                            — StandardScaler
        encoders                          — {col: LabelEncoder}
        cat_encoder                       — LabelEncoder for attack_cat (or None)
        feature_names                     — list[str]
        metadata                          — statistics dict
        input_shape                       — (timesteps, features) tuple
    """
    X_train, X_test, y_train, y_test = load_all_data(processed_dir)
    y_train_cat, y_test_cat = load_multiclass_labels(processed_dir)

    scaler        = load_scaler()
    encoders      = load_encoders()
    cat_encoder   = load_cat_encoder()
    feature_names = load_feature_names()
    metadata      = load_metadata()
    input_shape   = get_input_shape(processed_dir)

    return {
        "X_train":      X_train,
        "X_test":       X_test,
        "y_train":      y_train,
        "y_test":       y_test,
        "y_train_cat":  y_train_cat,
        "y_test_cat":   y_test_cat,
        "scaler":       scaler,
        "encoders":     encoders,
        "cat_encoder":  cat_encoder,
        "feature_names": feature_names,
        "metadata":     metadata,
        "input_shape":  input_shape,
    }
