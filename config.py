"""
config.py
----------
Central configuration file for the AI Threat Detection project.

All scripts import paths and hyperparameters from here.
To change any setting, edit this file only — no need to touch other scripts.

Dataset format: Parquet (UNSW-NB15)
  Train : dataset/train-00000-of-00001.parquet  (175,341 rows, 44 columns)
  Test  : dataset/test-00000-of-00001.parquet   (82,332  rows, 44 columns)
"""

import os

# ─────────────────────────────────────────────────────────────
# BASE DIRECTORY
# Resolved relative to this file so scripts work from any cwd.
# ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────
# DATASET PATHS
# ─────────────────────────────────────────────────────────────
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

# ── Parquet files (actual format on disk) ─────────────────────
TRAIN_PARQUET = os.path.join(DATASET_DIR, "train-00000-of-00001.parquet")
TEST_PARQUET  = os.path.join(DATASET_DIR, "test-00000-of-00001.parquet")

# ── CSV fallback paths (kept for backward compatibility) ──────
TRAIN_CSV = os.path.join(DATASET_DIR, "UNSW_NB15_training-set.csv")
TEST_CSV  = os.path.join(DATASET_DIR, "UNSW_NB15_testing-set.csv")

# ── Processed output directory ────────────────────────────────
PROCESSED_DIR = os.path.join(DATASET_DIR, "processed")

# ─────────────────────────────────────────────────────────────
# PREPROCESSING OBJECT PATHS  (saved with joblib)
# ─────────────────────────────────────────────────────────────
SCALER_PATH      = os.path.join(PROCESSED_DIR, "scaler.pkl")
ENCODER_PATH     = os.path.join(PROCESSED_DIR, "encoder.pkl")
CAT_ENCODER_PATH = os.path.join(PROCESSED_DIR, "cat_encoder.pkl")
FEATURE_NAMES_PATH = os.path.join(PROCESSED_DIR, "feature_names.pkl")
METADATA_PATH    = os.path.join(PROCESSED_DIR, "metadata.pkl")

# ─────────────────────────────────────────────────────────────
# PROCESSED NUMPY ARRAY PATHS
# ─────────────────────────────────────────────────────────────
X_TRAIN_PATH    = os.path.join(PROCESSED_DIR, "X_train.npy")
X_TEST_PATH     = os.path.join(PROCESSED_DIR, "X_test.npy")
Y_TRAIN_PATH    = os.path.join(PROCESSED_DIR, "y_train.npy")
Y_TEST_PATH     = os.path.join(PROCESSED_DIR, "y_test.npy")
Y_TRAIN_CAT_PATH = os.path.join(PROCESSED_DIR, "y_train_cat.npy")
Y_TEST_CAT_PATH  = os.path.join(PROCESSED_DIR, "y_test_cat.npy")

# ─────────────────────────────────────────────────────────────
# MODEL PATHS
# ─────────────────────────────────────────────────────────────
SAVED_MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
MODEL_PATH       = os.path.join(SAVED_MODELS_DIR, "lstm_threat_detection.h5")

# ─────────────────────────────────────────────────────────────
# RESULTS PATHS
# ─────────────────────────────────────────────────────────────
RESULTS_DIR  = os.path.join(BASE_DIR, "results")
GRAPHS_DIR   = os.path.join(RESULTS_DIR, "graphs")
REPORTS_DIR  = os.path.join(RESULTS_DIR, "reports")

TRAINING_HISTORY_PLOT = os.path.join(GRAPHS_DIR, "training_history.png")
ACCURACY_CURVE_PLOT   = os.path.join(GRAPHS_DIR, "accuracy_curve.png")
LOSS_CURVE_PLOT       = os.path.join(GRAPHS_DIR, "loss_curve.png")
CONFUSION_MATRIX_PLOT = os.path.join(GRAPHS_DIR, "confusion_matrix.png")
CLASSIFICATION_REPORT = os.path.join(REPORTS_DIR, "classification_report.txt")

# ─────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────
LOGS_DIR = os.path.join(BASE_DIR, "logs")
LOG_FILE = os.path.join(LOGS_DIR, "detection.log")

# ─────────────────────────────────────────────────────────────
# DATASET COLUMN CONFIGURATION
# Derived from inspecting the actual parquet files.
# ─────────────────────────────────────────────────────────────

# Target column for binary classification  (0 = Normal, 1 = Attack)
LABEL_COLUMN = "label"

# Multiclass attack category column
ATTACK_CAT_COLUMN = "attack_cat"

# Columns to DROP before feature extraction
# Note: parquet files do NOT contain an "id" column; attack_cat is
# kept for multiclass label extraction then dropped from features.
COLUMNS_TO_DROP = ["attack_cat"]

# Categorical (object dtype) feature columns confirmed in the parquet files
CATEGORICAL_COLUMNS = ["proto", "service", "state"]

# All 44 column names as they appear in the parquet files (alphabetically sorted)
UNSW_NB15_EXPECTED_COLUMNS = [
    "ackdat", "attack_cat", "ct_dst_ltm", "ct_dst_sport_ltm",
    "ct_dst_src_ltm", "ct_flw_http_mthd", "ct_ftp_cmd",
    "ct_src_dport_ltm", "ct_src_ltm", "ct_srv_dst", "ct_srv_src",
    "ct_state_ttl", "dbytes", "dinpkt", "djit", "dload", "dloss",
    "dmean", "dpkts", "dtcpb", "dttl", "dur", "dwin",
    "is_ftp_login", "is_sm_ips_ports", "label", "proto", "rate",
    "response_body_len", "sbytes", "service", "sinpkt", "sjit",
    "sload", "sloss", "smean", "spkts", "state", "stcpb", "sttl",
    "swin", "synack", "tcprtt", "trans_depth",
]

# Feature columns (everything except label and attack_cat)
# 44 total - 2 (label, attack_cat) = 42 numeric feature columns
FEATURE_COLUMNS = [
    c for c in UNSW_NB15_EXPECTED_COLUMNS
    if c not in (LABEL_COLUMN, ATTACK_CAT_COLUMN)
]

# Total expected number of features after encoding
# proto, service, state each become 1 integer column via LabelEncoder
# So the feature count stays at 42 (no one-hot expansion)
N_FEATURES = 42

# ─────────────────────────────────────────────────────────────
# MULTICLASS ATTACK CATEGORIES
# Confirmed from parquet value_counts()
# ─────────────────────────────────────────────────────────────
ATTACK_CATEGORIES = [
    "Analysis",
    "Backdoor",
    "DoS",
    "Exploits",
    "Fuzzers",
    "Generic",
    "Normal",
    "Reconnaissance",
    "Shellcode",
    "Worms",
]

# ─────────────────────────────────────────────────────────────
# DATASET STATISTICS (from actual parquet inspection)
# ─────────────────────────────────────────────────────────────
TRAIN_ROWS    = 175_341
TEST_ROWS     = 82_332
TOTAL_COLUMNS = 44          # including label and attack_cat
N_CLASSES_BINARY    = 2     # Normal / Attack
N_CLASSES_MULTICLASS = 10   # 9 attack types + Normal

# Class counts in training set (binary)
TRAIN_NORMAL_COUNT = 56_000
TRAIN_ATTACK_COUNT = 119_341

# ─────────────────────────────────────────────────────────────
# LSTM HYPERPARAMETERS
# ─────────────────────────────────────────────────────────────
# LSTM input: (samples, timesteps=1, features=42)
TIMESTEPS    = 1
LSTM_UNITS_1 = 128
LSTM_UNITS_2 = 64
DENSE_UNITS  = 32
DROPOUT_RATE_1 = 0.3
DROPOUT_RATE_2 = 0.3
DROPOUT_RATE_3 = 0.2
LEARNING_RATE  = 0.001

# ─────────────────────────────────────────────────────────────
# TRAINING HYPERPARAMETERS
# ─────────────────────────────────────────────────────────────
EPOCHS              = 30
BATCH_SIZE          = 256
VALIDATION_SPLIT    = 0.15
EARLY_STOP_PATIENCE = 5
REDUCE_LR_PATIENCE  = 3
REDUCE_LR_FACTOR    = 0.5
MIN_LR              = 1e-6

# ─────────────────────────────────────────────────────────────
# PREDICTION
# ─────────────────────────────────────────────────────────────
PREDICTION_THRESHOLD = 0.5  # sigmoid cutoff for binary classification
