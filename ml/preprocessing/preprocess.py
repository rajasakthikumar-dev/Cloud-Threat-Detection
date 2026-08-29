"""
preprocessing/preprocess.py
============================
UNSW-NB15 Preprocessing Pipeline  —  Parquet Edition

Dataset facts (confirmed by inspection):
  Train : 175,341 rows × 44 columns  (no missing values)
  Test  :  82,332 rows × 44 columns  (no missing values)
  Categorical columns: proto, service, state
  Analysis column   : attack_cat  (10 categories)
  Target column     : label       (0=Normal, 1=Attack)

Pipeline steps
--------------
  1.  Load parquet files  (pyarrow engine)
  2.  Validate columns  — normalise names, warn on unexpected cols
  3.  Audit missing values  — fill if any found
  4.  Extract multiclass labels from attack_cat  →  y_train_cat / y_test_cat
  5.  Drop non-feature columns  (attack_cat)
  6.  Encode categorical features  (proto, service, state)  →  LabelEncoder
  7.  Separate X / y
  8.  Normalise numerical features  →  StandardScaler  (fit on train only)
  9.  Reshape for LSTM  →  (samples, timesteps=1, features=42)
  10. Save all outputs  →  dataset/processed/

Outputs saved
-------------
  X_train.npy          (175341, 1, 42)  float32
  X_test.npy           ( 82332, 1, 42)  float32
  y_train.npy          (175341,)        int32
  y_test.npy           ( 82332,)        int32
  y_train_cat.npy      (175341,)        int32
  y_test_cat.npy       ( 82332,)        int32
  scaler.pkl           fitted StandardScaler
  encoder.pkl          dict {col: LabelEncoder}
  cat_encoder.pkl      LabelEncoder for attack_cat
  feature_names.pkl    list of 42 feature column names
  metadata.pkl         dict with dataset statistics

Usage
-----
  cd /path/to/AI-Threat-Detection/AI-Threat-Detection
  python preprocessing/preprocess.py
"""

import os
import sys
import time

# ── Make project root importable regardless of working directory ──────
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import LabelEncoder, StandardScaler

from config import (
    # Raw data
    TRAIN_PARQUET, TEST_PARQUET,
    TRAIN_CSV, TEST_CSV,
    # Processed output paths
    PROCESSED_DIR,
    X_TRAIN_PATH, X_TEST_PATH,
    Y_TRAIN_PATH, Y_TEST_PATH,
    Y_TRAIN_CAT_PATH, Y_TEST_CAT_PATH,
    SCALER_PATH, ENCODER_PATH,
    CAT_ENCODER_PATH, FEATURE_NAMES_PATH, METADATA_PATH,
    # Column configuration
    LABEL_COLUMN, ATTACK_CAT_COLUMN,
    COLUMNS_TO_DROP, CATEGORICAL_COLUMNS,
    UNSW_NB15_EXPECTED_COLUMNS, ATTACK_CATEGORIES,
    # LSTM shape
    TIMESTEPS,
)
from utils.logger import get_logger, log_section, log_error

logger = get_logger("preprocess")


# ═════════════════════════════════════════════════════════════
# STEP 1 — LOAD PARQUET / CSV
# ═════════════════════════════════════════════════════════════

def load_data() -> tuple:
    """
    Load train and test DataFrames.

    Priority order:
      1. Parquet files  (TRAIN_PARQUET / TEST_PARQUET)  — fast, lossless
      2. CSV files      (TRAIN_CSV / TEST_CSV)           — fallback

    Returns
    -------
    train_df       : pd.DataFrame
    test_df        : pd.DataFrame
    has_attack_cat : bool
    source_format  : str  ("parquet" or "csv")
    """
    log_section(logger, "UNSW-NB15 Preprocessing Pipeline  [Parquet]")

    # ── Parquet (preferred) ───────────────────────────────────────────
    if os.path.exists(TRAIN_PARQUET) and os.path.exists(TEST_PARQUET):
        logger.info(f"Loading train parquet : {TRAIN_PARQUET}")
        t0 = time.time()
        train_df = pd.read_parquet(TRAIN_PARQUET, engine="pyarrow")
        logger.info(f"  Loaded in {time.time()-t0:.2f}s  →  shape {train_df.shape}")

        logger.info(f"Loading test  parquet : {TEST_PARQUET}")
        t0 = time.time()
        test_df  = pd.read_parquet(TEST_PARQUET,  engine="pyarrow")
        logger.info(f"  Loaded in {time.time()-t0:.2f}s  →  shape {test_df.shape}")
        source_format = "parquet"

    # ── CSV fallback ──────────────────────────────────────────────────
    elif os.path.exists(TRAIN_CSV) and os.path.exists(TEST_CSV):
        logger.warning("Parquet files not found — falling back to CSV.")
        logger.info(f"Loading train CSV : {TRAIN_CSV}")
        train_df = pd.read_csv(TRAIN_CSV, low_memory=False)
        logger.info(f"Loading test  CSV : {TEST_CSV}")
        test_df  = pd.read_csv(TEST_CSV,  low_memory=False)
        source_format = "csv"

    # ── Nothing found ─────────────────────────────────────────────────
    else:
        msg = (
            "\n" + "=" * 58 + "\n"
            "  DATASET NOT FOUND\n"
            "=" * 58 + "\n"
            "  Expected parquet files:\n"
            f"    {TRAIN_PARQUET}\n"
            f"    {TEST_PARQUET}\n\n"
            "  OR CSV files:\n"
            f"    {TRAIN_CSV}\n"
            f"    {TEST_CSV}\n\n"
            "  Download UNSW-NB15 from:\n"
            "    https://research.unsw.edu.au/projects/unsw-nb15-dataset\n"
            "  Place files inside the  dataset/  folder.\n"
            + "=" * 58
        )
        logger.error(msg)
        raise FileNotFoundError(msg)

    has_attack_cat = ATTACK_CAT_COLUMN in train_df.columns
    logger.info(
        f"Source: {source_format} | "
        f"train={len(train_df):,} rows | test={len(test_df):,} rows | "
        f"attack_cat present={has_attack_cat}"
    )
    return train_df, test_df, has_attack_cat, source_format


# ═════════════════════════════════════════════════════════════
# STEP 2 — VALIDATE & NORMALISE COLUMN NAMES
# ═════════════════════════════════════════════════════════════

def validate_columns(df: pd.DataFrame, source_name: str) -> pd.DataFrame:
    """
    Normalise column names (lowercase + strip whitespace) and verify
    that all expected UNSW-NB15 columns are present.

    Parameters
    ----------
    df          : raw DataFrame
    source_name : label used in log messages

    Returns
    -------
    df with normalised column names
    """
    df.columns = [c.strip().lower() for c in df.columns]

    expected = set(UNSW_NB15_EXPECTED_COLUMNS)
    actual   = set(df.columns)
    extra    = actual - expected
    missing  = expected - actual

    if extra:
        logger.warning(
            f"[{source_name}] {len(extra)} unexpected column(s) "
            f"(kept as-is): {sorted(extra)}"
        )
    if missing:
        logger.warning(
            f"[{source_name}] {len(missing)} expected column(s) absent: "
            f"{sorted(missing)}"
        )

    if LABEL_COLUMN not in df.columns:
        raise ValueError(
            f"Label column '{LABEL_COLUMN}' not found in {source_name}.\n"
            f"Available columns: {sorted(df.columns.tolist())}"
        )

    logger.info(
        f"[{source_name}] Column validation OK — "
        f"{len(df.columns)} cols × {len(df):,} rows"
    )
    return df


# ═════════════════════════════════════════════════════════════
# STEP 3 — AUDIT & HANDLE MISSING VALUES
# ═════════════════════════════════════════════════════════════

def handle_missing_values(df: pd.DataFrame, tag: str) -> pd.DataFrame:
    """
    Report and fill any missing values.
    Numeric  NaNs → column median
    String   NaNs → column mode  (or 'Unknown' if mode is empty)

    The UNSW-NB15 parquet files have zero missing values, so this
    step is a safety net for future data drift.
    """
    total = int(df.isnull().sum().sum())

    if total == 0:
        logger.info(f"[{tag}] No missing values — skipping imputation.")
        return df

    logger.warning(f"[{tag}] {total:,} missing value(s) detected — imputing…")
    for col in df.columns:
        n_miss = int(df[col].isnull().sum())
        if n_miss == 0:
            continue
        if df[col].dtype == object:
            fill = df[col].mode()[0] if not df[col].mode().empty else "Unknown"
            df[col] = df[col].fillna(fill)
        else:
            df[col] = df[col].fillna(df[col].median())
        logger.debug(f"  [{tag}] '{col}': filled {n_miss} NaN(s)")

    remaining = int(df.isnull().sum().sum())
    if remaining == 0:
        logger.info(f"[{tag}] All missing values resolved.")
    else:
        logger.error(f"[{tag}] {remaining} NaN(s) still remain after imputation!")
    return df


# ═════════════════════════════════════════════════════════════
# STEP 4 — EXTRACT MULTICLASS ATTACK CATEGORY LABELS
# ═════════════════════════════════════════════════════════════

def extract_attack_categories(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> tuple:
    """
    Encode attack_cat into integer class indices and persist.

    The 10 known categories (from ATTACK_CATEGORIES in config.py):
      Analysis, Backdoor, DoS, Exploits, Fuzzers,
      Generic, Normal, Reconnaissance, Shellcode, Worms

    Any unseen category value is mapped to 'Normal' before encoding.

    Saves
    -----
    dataset/processed/y_train_cat.npy
    dataset/processed/y_test_cat.npy
    dataset/processed/cat_encoder.pkl

    Returns
    -------
    y_train_cat : np.ndarray  (175341,)  int32
    y_test_cat  : np.ndarray  ( 82332,)  int32
    cat_encoder : fitted LabelEncoder
    """
    logger.info("Extracting multiclass attack_cat labels…")

    cat_encoder = LabelEncoder()
    cat_encoder.fit(ATTACK_CATEGORIES)
    known = set(ATTACK_CATEGORIES)

    def _encode_series(series: pd.Series) -> np.ndarray:
        clean = (
            series
            .fillna("Normal")
            .astype(str)
            .str.strip()
            .apply(lambda v: v if v in known else "Normal")
        )
        return cat_encoder.transform(clean).astype(np.int32)

    y_train_cat = _encode_series(train_df[ATTACK_CAT_COLUMN])
    y_test_cat  = _encode_series(test_df[ATTACK_CAT_COLUMN])

    # Log class mapping and distribution
    mapping = dict(zip(cat_encoder.classes_,
                       cat_encoder.transform(cat_encoder.classes_)))
    logger.info(f"  Category → index mapping: {mapping}")

    unique_tr, counts_tr = np.unique(y_train_cat, return_counts=True)
    logger.info("  Train multiclass distribution:")
    for idx, cnt in zip(unique_tr, counts_tr):
        logger.info(
            f"    [{idx:2d}] {cat_encoder.classes_[idx]:<18} "
            f"{cnt:>7,}  ({100*cnt/len(y_train_cat):.1f}%)"
        )

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    np.save(Y_TRAIN_CAT_PATH, y_train_cat)
    np.save(Y_TEST_CAT_PATH,  y_test_cat)
    joblib.dump(cat_encoder, CAT_ENCODER_PATH)

    logger.info(
        f"  Saved y_train_cat {y_train_cat.shape} → {Y_TRAIN_CAT_PATH}"
    )
    logger.info(
        f"  Saved y_test_cat  {y_test_cat.shape}  → {Y_TEST_CAT_PATH}"
    )
    logger.info(f"  Saved cat_encoder              → {CAT_ENCODER_PATH}")
    return y_train_cat, y_test_cat, cat_encoder


# ═════════════════════════════════════════════════════════════
# STEP 5 — DROP NON-FEATURE COLUMNS
# ═════════════════════════════════════════════════════════════

def drop_non_feature_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove columns that are not model features.
    For the parquet version: only 'attack_cat' is dropped (no 'id' column).
    'label' is kept here and separated in step 7.
    """
    to_drop = [c for c in COLUMNS_TO_DROP if c in df.columns]
    if to_drop:
        df = df.drop(columns=to_drop)
        logger.info(f"Dropped non-feature columns: {to_drop}")
    else:
        logger.info("No columns to drop (already clean).")
    return df


# ═════════════════════════════════════════════════════════════
# STEP 6 — ENCODE CATEGORICAL FEATURES
# ═════════════════════════════════════════════════════════════

def encode_categorical_features(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> tuple:
    """
    Encode object-dtype columns with LabelEncoder.

    Confirmed categorical columns: proto, service, state

    Fitting strategy: encoder is fitted on the UNION of train+test
    unique values so the test set never sees an unseen label.

    Returns
    -------
    train_df  : DataFrame with categorical columns replaced by integers
    test_df   : same
    encoders  : dict {column_name: fitted LabelEncoder}
    """
    logger.info("Encoding categorical features…")

    cat_cols = [
        c for c in train_df.columns
        if train_df[c].dtype == object and c != LABEL_COLUMN
    ]

    if not cat_cols:
        logger.info("  No object-dtype columns detected — skipping.")
        return train_df, test_df, {}

    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        combined = pd.concat(
            [train_df[col].astype(str), test_df[col].astype(str)],
            axis=0, ignore_index=True,
        )
        le.fit(combined)
        train_df = train_df.copy()
        test_df  = test_df.copy()
        train_df[col] = le.transform(train_df[col].astype(str))
        test_df[col]  = le.transform(test_df[col].astype(str))
        encoders[col] = le
        logger.info(
            f"  '{col}': {len(le.classes_)} unique values → "
            f"{le.classes_[:8].tolist()}{'…' if len(le.classes_) > 8 else ''}"
        )

    logger.info(f"  Encoded {len(cat_cols)} column(s): {cat_cols}")
    return train_df, test_df, encoders


# ═════════════════════════════════════════════════════════════
# STEP 7 — SEPARATE FEATURES AND BINARY LABELS
# ═════════════════════════════════════════════════════════════

def separate_features_labels(df: pd.DataFrame) -> tuple:
    """
    Split DataFrame into feature matrix X and binary label vector y.

    Returns
    -------
    X : np.ndarray  (samples, features)  float32
    y : np.ndarray  (samples,)           int32
    feature_names : list[str]
    """
    feature_cols  = [c for c in df.columns if c != LABEL_COLUMN]
    X = df[feature_cols].values.astype(np.float32)
    y = df[LABEL_COLUMN].values.astype(np.int32)
    return X, y, feature_cols


# ═════════════════════════════════════════════════════════════
# STEP 8 — NORMALISE NUMERICAL FEATURES
# ═════════════════════════════════════════════════════════════

def normalize_features(
    X_train: np.ndarray,
    X_test: np.ndarray,
) -> tuple:
    """
    Fit StandardScaler on training data only, then transform both sets.
    This prevents data leakage from the test distribution.

    Returns
    -------
    X_train_scaled : np.ndarray  float32
    X_test_scaled  : np.ndarray  float32
    scaler         : fitted StandardScaler
    """
    logger.info("Normalising features with StandardScaler (fit on train only)…")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train).astype(np.float32)
    X_test_scaled  = scaler.transform(X_test).astype(np.float32)

    logger.info(
        f"  Train after scaling — "
        f"mean={X_train_scaled.mean():.6f}  std={X_train_scaled.std():.6f}"
    )
    logger.info(
        f"  Test  after scaling — "
        f"mean={X_test_scaled.mean():.6f}  std={X_test_scaled.std():.6f}"
    )
    return X_train_scaled, X_test_scaled, scaler


# ═════════════════════════════════════════════════════════════
# STEP 9 — RESHAPE FOR LSTM
# ═════════════════════════════════════════════════════════════

def reshape_for_lstm(X: np.ndarray) -> np.ndarray:
    """
    Reshape 2-D array to 3-D LSTM input format.

    (samples, features)  →  (samples, TIMESTEPS, features)

    With TIMESTEPS=1 each network flow is treated as a single
    time step.  For sequence modelling, increase TIMESTEPS in
    config.py and group consecutive flows before calling this.

    Returns
    -------
    np.ndarray  (samples, 1, features)  float32
    """
    reshaped = X.reshape((X.shape[0], TIMESTEPS, X.shape[1]))
    logger.info(
        f"  Reshaped {X.shape}  →  {reshaped.shape}  "
        f"(samples, timesteps={TIMESTEPS}, features={X.shape[1]})"
    )
    return reshaped


# ═════════════════════════════════════════════════════════════
# STEP 10 — SAVE ALL OUTPUTS
# ═════════════════════════════════════════════════════════════

def save_all(
    X_train, X_test,
    y_train, y_test,
    scaler, encoders,
    feature_names: list,
    metadata: dict,
) -> None:
    """
    Persist every output artefact to dataset/processed/.

    Files written
    -------------
    X_train.npy         training features   (175341, 1, 42)
    X_test.npy          test features       ( 82332, 1, 42)
    y_train.npy         binary train labels (175341,)
    y_test.npy          binary test  labels ( 82332,)
    scaler.pkl          fitted StandardScaler
    encoder.pkl         {col: LabelEncoder}
    feature_names.pkl   ordered list of 42 feature names
    metadata.pkl        dataset statistics dict
    """
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    np.save(X_TRAIN_PATH,      X_train)
    np.save(X_TEST_PATH,       X_test)
    np.save(Y_TRAIN_PATH,      y_train)
    np.save(Y_TEST_PATH,       y_test)
    joblib.dump(scaler,        SCALER_PATH)
    joblib.dump(encoders,      ENCODER_PATH)
    joblib.dump(feature_names, FEATURE_NAMES_PATH)
    joblib.dump(metadata,      METADATA_PATH)

    logger.info("=" * 58)
    logger.info("  Saved files:")
    logger.info(f"    X_train.npy       {X_train.shape}  → {X_TRAIN_PATH}")
    logger.info(f"    X_test.npy        {X_test.shape}   → {X_TEST_PATH}")
    logger.info(f"    y_train.npy       {y_train.shape}  → {Y_TRAIN_PATH}")
    logger.info(f"    y_test.npy        {y_test.shape}   → {Y_TEST_PATH}")
    logger.info(f"    scaler.pkl                         → {SCALER_PATH}")
    logger.info(f"    encoder.pkl                        → {ENCODER_PATH}")
    logger.info(f"    feature_names.pkl                  → {FEATURE_NAMES_PATH}")
    logger.info(f"    metadata.pkl                       → {METADATA_PATH}")
    logger.info("=" * 58)


# ═════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR
# ═════════════════════════════════════════════════════════════

def main() -> None:
    pipeline_start = time.time()

    try:
        # ── Step 1: Load ──────────────────────────────────────────────
        logger.info("STEP 1/10  Load raw data")
        train_df, test_df, has_attack_cat, fmt = load_data()

        # ── Step 2: Validate columns ──────────────────────────────────
        logger.info("STEP 2/10  Validate & normalise column names")
        train_df = validate_columns(train_df, f"train ({fmt})")
        test_df  = validate_columns(test_df,  f"test  ({fmt})")

        # ── Step 3: Audit missing values ──────────────────────────────
        logger.info("STEP 3/10  Audit missing values")
        train_df = handle_missing_values(train_df, "train")
        test_df  = handle_missing_values(test_df,  "test")

        # ── Step 4: Multiclass labels (before dropping attack_cat) ────
        logger.info("STEP 4/10  Extract multiclass attack_cat labels")
        if has_attack_cat:
            y_train_cat, y_test_cat, _ = extract_attack_categories(
                train_df, test_df
            )
        else:
            logger.warning("attack_cat column absent — skipping multiclass labels.")

        # ── Step 5: Drop non-feature columns ──────────────────────────
        logger.info("STEP 5/10  Drop non-feature columns")
        train_df = drop_non_feature_columns(train_df)
        test_df  = drop_non_feature_columns(test_df)

        # ── Step 6: Encode categorical features ───────────────────────
        logger.info("STEP 6/10  Encode categorical features")
        train_df, test_df, encoders = encode_categorical_features(
            train_df, test_df
        )

        # ── Step 7: Separate features / labels ────────────────────────
        logger.info("STEP 7/10  Separate X and y")
        X_train, y_train, feature_names = separate_features_labels(train_df)
        X_test,  y_test,  _             = separate_features_labels(test_df)

        # Binary class distribution
        unique, counts = np.unique(y_train, return_counts=True)
        logger.info("  Binary label distribution (train):")
        for u, c in zip(unique, counts):
            lbl = "Normal" if u == 0 else "Attack"
            logger.info(
                f"    {lbl} ({u}): {c:>7,}  ({100*c/len(y_train):.1f}%)"
            )
        logger.info(f"  Feature count: {len(feature_names)}")

        # ── Step 8: Normalise ──────────────────────────────────────────
        logger.info("STEP 8/10  Normalise numerical features")
        X_train, X_test, scaler = normalize_features(X_train, X_test)

        # ── Step 9: Reshape for LSTM ───────────────────────────────────
        logger.info("STEP 9/10  Reshape to LSTM format (samples, 1, features)")
        X_train = reshape_for_lstm(X_train)
        X_test  = reshape_for_lstm(X_test)

        # ── Step 10: Save ──────────────────────────────────────────────
        logger.info("STEP 10/10  Save all outputs")
        metadata = {
            "source_format":   fmt,
            "train_rows":      int(X_train.shape[0]),
            "test_rows":       int(X_test.shape[0]),
            "n_features":      int(X_train.shape[2]),
            "timesteps":       int(TIMESTEPS),
            "lstm_input_shape": X_train.shape[1:],
            "feature_names":   feature_names,
            "categorical_cols": list(encoders.keys()),
            "has_attack_cat":  has_attack_cat,
            "train_normal":    int((y_train == 0).sum()),
            "train_attack":    int((y_train == 1).sum()),
            "test_normal":     int((y_test  == 0).sum()),
            "test_attack":     int((y_test  == 1).sum()),
        }

        save_all(
            X_train, X_test,
            y_train, y_test,
            scaler, encoders,
            feature_names, metadata,
        )

        elapsed = time.time() - pipeline_start
        logger.info("")
        logger.info("  ✓ Preprocessing complete!")
        logger.info(f"  Total time : {elapsed:.1f}s")
        logger.info("  Next step  : python model/train.py")
        logger.info("")

    except FileNotFoundError as exc:
        log_error(logger, "load_data", exc)
        sys.exit(1)
    except ValueError as exc:
        log_error(logger, "validate_columns", exc)
        sys.exit(1)
    except Exception as exc:
        log_error(logger, "preprocess.main", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
