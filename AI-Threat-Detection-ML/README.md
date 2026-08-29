# Preprocessing Module

This module handles all data preparation steps before the LSTM model is trained.

## File

| File             | Description                                      |
|------------------|--------------------------------------------------|
| `preprocess.py`  | Full preprocessing pipeline for UNSW-NB15 data  |

## What It Does

1. **Load Data** — Reads `UNSW_NB15_training-set.csv` and `UNSW_NB15_testing-set.csv` from the `dataset/` folder.
2. **Drop Columns** — Removes non-informative columns like `id` and `attack_cat`.
3. **Handle Missing Values** — Fills numeric NaNs with median, categorical NaNs with mode.
4. **Encode Categorical Features** — Converts string columns (e.g., `proto`, `service`, `state`) to integers using `LabelEncoder`.
5. **Normalize Features** — Scales all numeric features to zero mean and unit variance using `StandardScaler`.
6. **Reshape for LSTM** — Converts 2D `(samples, features)` arrays to 3D `(samples, 1, features)` format.
7. **Save Processed Files** — Saves `.npy` arrays to `dataset/processed/`.

## How to Run

From the project root directory:

```bash
python preprocessing/preprocess.py
```

## Output

```
dataset/processed/
├── X_train.npy    ← Training features  (samples, 1, features)
├── X_test.npy     ← Testing features   (samples, 1, features)
├── y_train.npy    ← Training labels    (samples,)
└── y_test.npy     ← Testing labels     (samples,)
```

## Requirements

Make sure dependencies are installed:

```bash
pip install -r requirements.txt
```
