"""
ml-service/preprocessing/preprocess.py
----------------------------------------
Full UNSW-NB15 preprocessing pipeline for the FastAPI ML service.

Responsibilities:
  1. Load raw CSV / Parquet files from ml-service/data/
  2. Validate and normalise column names
  3. Handle missing values
  4. Drop non-feature columns (id, attack_cat for features)
  5. Encode categorical features with LabelEncoder  → saved as encoder.pkl
  6. Normalise numerical features with StandardScaler → saved as scaler.pkl
  7. Extract binary labels (0=Normal, 1=Attack)
  8. Extract multiclass attack category labels       → saved as cat_encoder.pkl
  9. Reshape to LSTM format (samples, 1, features)
  10. Save processed arrays to ml-service/preprocessing/

Usage:
    python ml-service/preprocessing/preprocess.py
"""

import os
import sys
import logging
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split

# ─────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
SERVICE_DIR     = os.path.dirname(BASE_DIR)
DATA_DIR        = os.path.join(SERVICE_DIR, "data")
PROC_DIR        = BASE_DIR   # save processed files next to this script

TRAIN_CSV       = os.path.join(DATA_DIR, "UNSW_NB15_training-set.csv")
TEST_CSV        = os.path.join(DATA_DIR, "UNSW_NB15_testing-set.csv")
# Parquet alternative (faster for large datasets)
TRAIN_PARQUET   = os.path.join(DATA_DIR, "UNSW_NB15_training-set.parquet")
TEST_PARQUET    = os.path.join(DATA_DIR, "UNSW_NB15_testing-set.parquet")

SCALER_PATH     = os.path.join(PROC_DIR, "scaler.pkl")
ENCODER_PATH    = os.path.join(PROC_DIR, "encoder.pkl")
CAT_ENC_PATH    = os.path.join(PROC_DIR, "cat_encoder.pkl")

X_TRAIN_PATH    = os.path.join(PROC_DIR, "X_train.npy")
X_TEST_PATH     = os.path.join(PROC_DIR, "X_test.npy")
Y_TRAIN_PATH    = os.path.join(PROC_DIR, "y_train.npy")
Y_TEST_PATH     = os.path.join(PROC_DIR, "y_test.npy")
Y_TRAIN_CAT     = os.path.join(PROC_DIR, "y_train_cat.npy")
Y_TEST_CAT      = os.path.join(PROC_DIR, "y_test_cat.npy")

# ─────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────
LABEL_COL       = "label"
ATTACK_CAT_COL  = "attack_cat"
DROP_COLS       = ["id", "attack_cat"]
TIMESTEPS       = 1   # each sample = 1 time step for LSTM

ATTACK_CATEGORIES = [
    "Normal", "Analysis", "Backdoor", "DoS", "Exploits",
    "Fuzzers", "Generic", "Reconnaissance", "Shellcode", "Worms",
]

# ─────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logger = logging.getLogger("preprocess")


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _load_file(csv_path: str, parquet_path: str) -> pd.DataFrame:
    """Load parquet if available (faster), otherwise CSV."""
    if os.path.exists(parquet_path):
        logger.info(f"Loading parquet: {parquet_path}")
        return pd.read_parquet(parquet_path)
    elif os.path.exists(csv_path):
        logger.info(f"Loading CSV: {csv_path}")
        return pd.read_csv(csv_path, low_memory=False)
    return None


def load_data():
    """
    Load training and testing DataFrames.
    Falls back to 80/20 stratified split if only training data exists.

    Returns: (train_df, test_df, has_attack_cat)
    """
    train_df = _load_file(TRAIN_CSV, TRAIN_PARQUET)
    test_df  = _load_file(TEST_CSV,  TEST_PARQUET)

    if train_df is None:
        raise FileNotFoundError(
            f"\n{'='*55}\n"
            f"  DATASET NOT FOUND\n"
            f"  Expected CSV or Parquet in: {DATA_DIR}\n"
            f"  Download: https://research.unsw.edu.au/projects/unsw-nb15-dataset\n"
            f"{'='*55}"
        )

    # Normalise column names
    train_df.columns = [c.strip().lower() for c in train_df.columns]

    if test_df is None:
        logger.warning("Test file not found — splitting training data 80/20 (stratified).")
        train_df, test_df = train_test_split(
            train_df, test_size=0.2, random_state=42, stratify=train_df[LABEL_COL]
        )
        train_df = train_df.reset_index(drop=True)
        test_df  = test_df.reset_index(drop=True)
    else:
        test_df.columns = [c.strip().lower() for c in test_df.columns]

    has_attack_cat = ATTACK_CAT_COL in train_df.columns
    logger.info(f"Train: {len(train_df):,} rows | Test: {len(test_df):,} rows | attack_cat: {has_attack_cat}")
    return train_df, test_df, has_attack_cat


def handle_missing(df: pd.DataFrame, tag: str) -> pd.DataFrame:
    n = df.isnull().sum().sum()
    if n > 0:
        logger.info(f"[{tag}] Filling {n:,} missing values…")
        for col in df.columns:
            if df[col].isnull().any():
                if df[col].dtype == object:
                    df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "Unknown", inplace=True)
                else:
                    df[col].fillna(df[col].median(), inplace=True)
    return df


def encode_categoricals(train_df: pd.DataFrame, test_df: pd.DataFrame):
    """
    Fit LabelEncoders on the union of train+test values for each string column.
    Returns encoded DataFrames and a dict of fitted encoders.
    """
    cat_cols = [
        c for c in train_df.columns
        if train_df[c].dtype == object and c != LABEL_COL
    ]
    if not cat_cols:
        logger.info("No categorical columns to encode.")
        return train_df, test_df, {}

    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        combined = pd.concat([train_df[col].astype(str), test_df[col].astype(str)])
        le.fit(combined)
        train_df[col] = le.transform(train_df[col].astype(str))
        test_df[col]  = le.transform(test_df[col].astype(str))
        encoders[col] = le

    logger.info(f"Encoded {len(cat_cols)} categorical columns: {cat_cols}")
    return train_df, test_df, encoders


def extract_attack_categories(train_df: pd.DataFrame, test_df: pd.DataFrame):
    """
    Encode the attack_cat column into integer class indices.
    Unknown categories are mapped to 'Normal'.
    """
    cat_le = LabelEncoder()
    cat_le.fit(ATTACK_CATEGORIES)
    known = set(ATTACK_CATEGORIES)

    def safe_encode(series):
        vals = series.fillna("Normal").str.strip()
        vals = vals.apply(lambda x: x if x in known else "Normal")
        return cat_le.transform(vals).astype(np.int32)

    y_tr_cat = safe_encode(train_df[ATTACK_CAT_COL])
    y_te_cat = safe_encode(test_df[ATTACK_CAT_COL])
    joblib.dump(cat_le, CAT_ENC_PATH)
    logger.info(f"Attack category encoder saved → {CAT_ENC_PATH}")
    return y_tr_cat, y_te_cat


def run():
    """Full preprocessing pipeline."""
    logger.info("=" * 55)
    logger.info("  UNSW-NB15 Preprocessing Pipeline")
    logger.info("=" * 55)

    # 1. Load
    train_df, test_df, has_attack_cat = load_data()

    # 2. Extract attack category labels BEFORE dropping attack_cat
    y_train_cat, y_test_cat = None, None
    if has_attack_cat:
        y_train_cat, y_test_cat = extract_attack_categories(train_df, test_df)

    # 3. Drop non-feature columns
    drop = [c for c in DROP_COLS if c in train_df.columns]
    train_df = train_df.drop(columns=drop)
    test_df  = test_df.drop(columns=drop)
    logger.info(f"Dropped columns: {drop}")

    # 4. Handle missing values
    train_df = handle_missing(train_df, "train")
    test_df  = handle_missing(test_df,  "test")

    # 5. Encode categorical features
    train_df, test_df, encoders = encode_categoricals(train_df, test_df)

    # 6. Separate features / labels
    X_train = train_df.drop(columns=[LABEL_COL]).values.astype(np.float32)
    y_train = train_df[LABEL_COL].values.astype(np.int32)
    X_test  = test_df.drop(columns=[LABEL_COL]).values.astype(np.float32)
    y_test  = test_df[LABEL_COL].values.astype(np.int32)

    logger.info(f"Features: {X_train.shape[1]} columns")
    unique, counts = np.unique(y_train, return_counts=True)
    for u, c in zip(unique, counts):
        logger.info(f"  {'Normal' if u==0 else 'Attack'} ({u}): {c:,} ({100*c/len(y_train):.1f}%)")

    # 7. Normalise
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)
    logger.info(f"Scaled — mean≈{X_train.mean():.4f}  std≈{X_train.std():.4f}")

    # 8. Reshape for LSTM: (samples, 1, features)
    X_train = X_train.reshape(X_train.shape[0], TIMESTEPS, X_train.shape[1])
    X_test  = X_test.reshape(X_test.shape[0],   TIMESTEPS, X_test.shape[1])
    logger.info(f"LSTM shape: {X_train.shape}")

    # 9. Save everything
    os.makedirs(PROC_DIR, exist_ok=True)
    np.save(X_TRAIN_PATH, X_train)
    np.save(X_TEST_PATH,  X_test)
    np.save(Y_TRAIN_PATH, y_train)
    np.save(Y_TEST_PATH,  y_test)
    joblib.dump(scaler,   SCALER_PATH)
    joblib.dump(encoders, ENCODER_PATH)

    if y_train_cat is not None:
        np.save(Y_TRAIN_CAT, y_train_cat)
        np.save(Y_TEST_CAT,  y_test_cat)

    logger.info(f"Saved X_train {X_train.shape} → {X_TRAIN_PATH}")
    logger.info(f"Saved X_test  {X_test.shape}  → {X_TEST_PATH}")
    logger.info(f"Saved scaler               → {SCALER_PATH}")
    logger.info(f"Saved encoders             → {ENCODER_PATH}")
    logger.info("Preprocessing complete.  Next: python ml-service/model/lstm_train.py")


if __name__ == "__main__":
    run()
