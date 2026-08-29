"""Probe all pkl files and h5 metadata without importing TensorFlow."""
import os, sys, json, h5py, joblib, numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))

# ── paths to inspect ────────────────────────────────────────
ML_H5       = os.path.join(ROOT, "model", "saved_models", "lstm_threat_detection.h5")

# ml-service has its own processed folder
ML_SCALER   = os.path.join(ROOT, "preprocessing", "processed", "scaler.pkl")
ML_ENCODER  = os.path.join(ROOT, "preprocessing", "processed", "encoder.pkl")

# The main project's dataset/processed also has feature_names.pkl and metadata.pkl
PROJ_ROOT   = os.path.dirname(ROOT)
PROC        = os.path.join(PROJ_ROOT, "dataset", "processed")
FEAT_NAMES  = os.path.join(PROC, "feature_names.pkl")
METADATA    = os.path.join(PROC, "metadata.pkl")
PROJ_SCALER = os.path.join(PROC, "scaler.pkl")
PROJ_ENC    = os.path.join(PROC, "encoder.pkl")

def check_file(path, label):
    if os.path.exists(path):
        print(f"  EXISTS   {os.path.getsize(path):>10,} B  {label}")
        return True
    print(f"  MISSING              {label}")
    return False

print("=== FILE EXISTENCE ===")
files = {
    "ml-service H5":         ML_H5,
    "ml-service scaler.pkl": ML_SCALER,
    "ml-service encoder.pkl":ML_ENCODER,
    "project feature_names": FEAT_NAMES,
    "project metadata.pkl":  METADATA,
    "project scaler.pkl":    PROJ_SCALER,
    "project encoder.pkl":   PROJ_ENC,
}
present = {k: check_file(v, k) for k, v in files.items()}

# ── H5 architecture ─────────────────────────────────────────
print("\n=== MODEL ARCHITECTURE (from H5) ===")
with h5py.File(ML_H5, "r") as h5:
    cfg_raw = h5.attrs["model_config"]
    if isinstance(cfg_raw, bytes):
        cfg_raw = cfg_raw.decode()
    cfg = json.loads(cfg_raw)
    layers = cfg["config"]["layers"]
    for L in layers:
        cn = L["class_name"]
        lc = L.get("config", {})
        extra = ""
        if cn == "InputLayer":
            extra = f"  batch_shape={lc.get('batch_shape')}"
        elif cn == "LSTM":
            extra = f"  units={lc['units']}  return_seq={lc['return_sequences']}"
        elif cn == "Dense":
            extra = f"  units={lc['units']}  activation={lc['activation']}"
        elif cn == "Dropout":
            extra = f"  rate={lc['rate']}"
        elif cn == "BatchNormalization":
            extra = f"  axis={lc['axis']}"
        print(f"  {cn:<22} {lc.get('name',''):<18} {extra}")
    print(f"  keras_version = {h5.attrs.get('keras_version','?')}")

# ── ml-service scaler ────────────────────────────────────────
print("\n=== ML-SERVICE scaler.pkl ===")
s = joblib.load(ML_SCALER)
print(f"  type           : {type(s).__name__}")
print(f"  n_features_in_ : {s.n_features_in_}")
fni = getattr(s, "feature_names_in_", None)
print(f"  feature_names_in_ : {'NOT SET' if fni is None else list(fni)}")

# ── ml-service encoder ───────────────────────────────────────
print("\n=== ML-SERVICE encoder.pkl ===")
e = joblib.load(ML_ENCODER)
print(f"  type : {type(e).__name__}")
if isinstance(e, dict):
    for k, le in e.items():
        print(f"  '{k}': {len(le.classes_)} classes  first5={list(le.classes_[:5])}")

# ── project feature_names ────────────────────────────────────
if present["project feature_names"]:
    print("\n=== PROJECT feature_names.pkl ===")
    fn = joblib.load(FEAT_NAMES)
    print(f"  count : {len(fn)}")
    print(f"  names : {fn}")

# ── project metadata ─────────────────────────────────────────
if present["project metadata.pkl"]:
    print("\n=== PROJECT metadata.pkl ===")
    m = joblib.load(METADATA)
    for k, v in m.items():
        if k != "feature_names":
            print(f"  {k:<22} = {v}")

# ── project scaler ───────────────────────────────────────────
if present["project scaler.pkl"]:
    print("\n=== PROJECT scaler.pkl ===")
    ps = joblib.load(PROJ_SCALER)
    print(f"  n_features_in_ : {ps.n_features_in_}")
    pfni = getattr(ps, "feature_names_in_", None)
    print(f"  feature_names_in_ : {'NOT SET' if pfni is None else list(pfni)}")

# ── project encoder ──────────────────────────────────────────
if present["project encoder.pkl"]:
    print("\n=== PROJECT encoder.pkl ===")
    pe = joblib.load(PROJ_ENC)
    if isinstance(pe, dict):
        for k, le in pe.items():
            print(f"  '{k}': {len(le.classes_)} classes  first5={list(le.classes_[:5])}")
