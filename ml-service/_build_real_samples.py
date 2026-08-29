"""
Build real predict-request payloads from the actual test parquet
(before any preprocessing) so we can hit /predict with genuine
UNSW-NB15 traffic rows.

Prints ready-to-curl JSON for Normal (y=0) and Attack (y=1) samples.
"""
import os, json, joblib
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML   = os.path.dirname(os.path.abspath(__file__))

TEST_PARQUET  = os.path.join(ROOT, "dataset", "test-00000-of-00001.parquet")
FEATURE_NAMES = os.path.join(ROOT, "dataset", "processed", "feature_names.pkl")
Y_TEST        = os.path.join(ROOT, "dataset", "processed", "y_test.npy")

feat_names = joblib.load(FEATURE_NAMES)
print(f"Feature names ({len(feat_names)}): {feat_names}")

# Load raw test parquet - column names as-is (lowercase from preprocessing)
df = pd.read_parquet(TEST_PARQUET)
df.columns = [c.strip().lower() for c in df.columns]

# Keep only rows where label is known
y = df["label"].values.astype(int)

# Find first Normal (label=0) and first Attack (label=1) row
idx_normal = int(np.where(y == 0)[0][0])
idx_attack = int(np.where(y == 1)[0][0])

def row_to_features(row_idx):
    row = df.iloc[row_idx]
    feats = {}
    for col in feat_names:
        val = row.get(col, 0)
        # Convert numpy types to Python native
        if hasattr(val, "item"):
            val = val.item()
        feats[col] = val
    return feats

normal_feats = row_to_features(idx_normal)
attack_feats = row_to_features(idx_attack)

print(f"\nRow index used for Normal sample: {idx_normal}  (label={y[idx_normal]})")
print(f"Row index used for Attack sample: {idx_attack}  (label={y[idx_attack]})")

normal_payload = {"features": normal_feats, "source_ip": "10.0.0.1"}
attack_payload = {"features": attack_feats, "source_ip": "10.0.0.2"}

# Save to JSON files
norm_path = os.path.join(ML, "_sample_normal.json")
atk_path  = os.path.join(ML, "_sample_attack.json")

with open(norm_path, "w") as f:
    json.dump(normal_payload, f, indent=2)
with open(atk_path, "w") as f:
    json.dump(attack_payload, f, indent=2)

print(f"\nSaved: {norm_path}")
print(f"Saved: {atk_path}")

# Print a compact preview of the normal payload
print("\nNormal sample (first 6 features):")
for k, v in list(normal_feats.items())[:6]:
    print(f"  {k}: {v}")
print("  ...")

print("\nAttack sample (first 6 features):")
for k, v in list(attack_feats.items())[:6]:
    print(f"  {k}: {v}")
print("  ...")
