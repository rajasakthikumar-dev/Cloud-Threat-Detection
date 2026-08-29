"""
ml-service/model/lstm_train.py
--------------------------------
Full LSTM training pipeline for the AI Threat Detection ML service.

Steps:
  1. Load preprocessed arrays from ml-service/preprocessing/
  2. Build LSTM model (binary or multiclass)
  3. Train with EarlyStopping + ModelCheckpoint + ReduceLROnPlateau
  4. Save trained model to ml-service/model/lstm_model.h5
  5. Evaluate and print accuracy, precision, recall, F1-score
  6. Save training curve plots to ml-service/model/plots/

Usage:
    python ml-service/model/lstm_train.py
    python ml-service/model/lstm_train.py --multiclass
"""

import os
import sys
import argparse
import logging
import numpy as np

# Make preprocessing importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report,
)

# ─────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROC_DIR    = os.path.join(os.path.dirname(SCRIPT_DIR), "preprocessing")
MODEL_PATH  = os.path.join(SCRIPT_DIR, "lstm_model.h5")
PLOTS_DIR   = os.path.join(SCRIPT_DIR, "plots")

X_TRAIN     = os.path.join(PROC_DIR, "X_train.npy")
X_TEST      = os.path.join(PROC_DIR, "X_test.npy")
Y_TRAIN     = os.path.join(PROC_DIR, "y_train.npy")
Y_TEST      = os.path.join(PROC_DIR, "y_test.npy")
Y_TRAIN_CAT = os.path.join(PROC_DIR, "y_train_cat.npy")
Y_TEST_CAT  = os.path.join(PROC_DIR, "y_test_cat.npy")

ATTACK_CATEGORIES = [
    "Normal", "Analysis", "Backdoor", "DoS", "Exploits",
    "Fuzzers", "Generic", "Reconnaissance", "Shellcode", "Worms",
]

# ─────────────────────────────────────────────────────────────
# HYPERPARAMETERS
# ─────────────────────────────────────────────────────────────
LSTM_UNITS_1       = 128
LSTM_UNITS_2       = 64
DENSE_UNITS        = 32
DROPOUT            = 0.3
LEARNING_RATE      = 0.001
EPOCHS             = 30
BATCH_SIZE         = 256
VALIDATION_SPLIT   = 0.15
EARLY_STOP_PATIENCE = 5
REDUCE_LR_PATIENCE  = 3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logger = logging.getLogger("lstm_train")


# ─────────────────────────────────────────────────────────────
# MODEL BUILDER
# ─────────────────────────────────────────────────────────────
def build_model(input_shape, n_classes=1):
    """
    Build and compile a 2-layer LSTM for binary or multiclass classification.

    Args:
        input_shape: tuple (timesteps, features)
        n_classes:   1 → binary sigmoid; >1 → multiclass softmax
    Returns:
        Compiled Keras Sequential model
    """
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import (
        LSTM, Dense, Dropout, BatchNormalization, Input,
    )
    from tensorflow.keras.optimizers import Adam

    multiclass = n_classes > 1
    model = Sequential(name="LSTM_ThreatDetector")

    model.add(Input(shape=input_shape))

    # Block 1
    model.add(LSTM(LSTM_UNITS_1, return_sequences=True, name="lstm_1"))
    model.add(BatchNormalization(name="bn_1"))
    model.add(Dropout(DROPOUT, name="drop_1"))

    # Block 2
    model.add(LSTM(LSTM_UNITS_2, return_sequences=False, name="lstm_2"))
    model.add(BatchNormalization(name="bn_2"))
    model.add(Dropout(DROPOUT, name="drop_2"))

    # Dense head
    model.add(Dense(DENSE_UNITS, activation="relu", name="dense_1"))
    model.add(Dropout(0.2, name="drop_3"))

    if multiclass:
        model.add(Dense(n_classes, activation="softmax", name="output"))
        loss = "sparse_categorical_crossentropy"
    else:
        model.add(Dense(1, activation="sigmoid", name="output"))
        loss = "binary_crossentropy"

    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss=loss,
        metrics=["accuracy"],
    )
    logger.info(f"Model built — mode={'multiclass' if multiclass else 'binary'}  loss={loss}")
    return model


# ─────────────────────────────────────────────────────────────
# TRAINING
# ─────────────────────────────────────────────────────────────
def get_callbacks():
    from tensorflow.keras.callbacks import (
        EarlyStopping, ModelCheckpoint, ReduceLROnPlateau,
    )
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    return [
        EarlyStopping(
            monitor="val_loss", patience=EARLY_STOP_PATIENCE,
            restore_best_weights=True, verbose=1,
        ),
        ModelCheckpoint(
            MODEL_PATH, monitor="val_accuracy",
            save_best_only=True, verbose=1,
        ),
        ReduceLROnPlateau(
            monitor="val_loss", factor=0.5,
            patience=REDUCE_LR_PATIENCE, min_lr=1e-6, verbose=1,
        ),
    ]


# ─────────────────────────────────────────────────────────────
# EVALUATION
# ─────────────────────────────────────────────────────────────
def evaluate(y_true, y_pred, multiclass=False):
    avg = "macro" if multiclass else "binary"
    names = [ATTACK_CATEGORIES[i] for i in sorted(set(y_true))] if multiclass else ["Normal", "Attack"]

    acc  = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, average=avg, zero_division=0)
    rec  = recall_score(y_true, y_pred, average=avg, zero_division=0)
    f1   = f1_score(y_true, y_pred, average=avg, zero_division=0)

    logger.info("=" * 52)
    logger.info("  EVALUATION RESULTS")
    logger.info("=" * 52)
    logger.info(f"  Accuracy  : {acc:.4f}  ({acc*100:.2f}%)")
    logger.info(f"  Precision : {prec:.4f}  (avg={avg})")
    logger.info(f"  Recall    : {rec:.4f}  (avg={avg})")
    logger.info(f"  F1-Score  : {f1:.4f}  (avg={avg})")
    logger.info("=" * 52)

    report = classification_report(
        y_true, y_pred,
        labels=sorted(set(y_true)),
        target_names=names,
        zero_division=0,
    )
    logger.info(f"\n{report}")
    return {"accuracy": acc, "precision": prec, "recall": rec, "f1": f1}


# ─────────────────────────────────────────────────────────────
# PLOTS
# ─────────────────────────────────────────────────────────────
def save_plots(history):
    os.makedirs(PLOTS_DIR, exist_ok=True)

    acc     = history.history.get("accuracy", [])
    val_acc = history.history.get("val_accuracy", [])
    loss    = history.history.get("loss", [])
    val_loss= history.history.get("val_loss", [])
    epochs  = range(1, len(acc) + 1)

    # Combined
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].plot(epochs, acc,     color="#38bdf8", label="Train", linewidth=2)
    axes[0].plot(epochs, val_acc, color="#f97316", label="Val",   linewidth=2, linestyle="--")
    axes[0].set_title("Accuracy"); axes[0].set_xlabel("Epoch"); axes[0].legend(); axes[0].grid(alpha=.3)
    axes[1].plot(epochs, loss,     color="#38bdf8", label="Train", linewidth=2)
    axes[1].plot(epochs, val_loss, color="#f97316", label="Val",   linewidth=2, linestyle="--")
    axes[1].set_title("Loss");     axes[1].set_xlabel("Epoch"); axes[1].legend(); axes[1].grid(alpha=.3)
    plt.suptitle("LSTM Training History")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "training_history.png"), dpi=150)
    plt.close()

    # Accuracy only
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(epochs, acc,     color="#22c55e", label="Train Accuracy", linewidth=2)
    ax.plot(epochs, val_acc, color="#f59e0b", label="Val Accuracy",   linewidth=2, linestyle="--")
    ax.set_title("Accuracy Curve"); ax.set_xlabel("Epoch"); ax.legend(); ax.grid(alpha=.3)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "accuracy_curve.png"), dpi=150)
    plt.close()

    # Loss only
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(epochs, loss,     color="#ef4444", label="Train Loss", linewidth=2)
    ax.plot(epochs, val_loss, color="#f97316", label="Val Loss",   linewidth=2, linestyle="--")
    ax.set_title("Loss Curve"); ax.set_xlabel("Epoch"); ax.legend(); ax.grid(alpha=.3)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "loss_curve.png"), dpi=150)
    plt.close()

    logger.info(f"Training plots saved to {PLOTS_DIR}/")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Train LSTM Threat Detection model")
    parser.add_argument("--multiclass", action="store_true",
                        help="Train multiclass attack-category model")
    args = parser.parse_args()

    # 1. Load data
    logger.info("Loading preprocessed data…")
    for p in [X_TRAIN, X_TEST, Y_TRAIN, Y_TEST]:
        if not os.path.exists(p):
            logger.error(f"Missing: {p}")
            logger.error("Run first:  python ml-service/preprocessing/preprocess.py")
            sys.exit(1)

    X_train = np.load(X_TRAIN)
    X_test  = np.load(X_TEST)

    if args.multiclass and os.path.exists(Y_TRAIN_CAT):
        y_train = np.load(Y_TRAIN_CAT)
        y_test  = np.load(Y_TEST_CAT)
        n_classes = len(ATTACK_CATEGORIES)
        logger.info(f"Multiclass mode — {n_classes} categories")
    else:
        y_train = np.load(Y_TRAIN)
        y_test  = np.load(Y_TEST)
        n_classes = 1
        logger.info("Binary mode — Normal / Attack")

    logger.info(f"X_train: {X_train.shape}  X_test: {X_test.shape}")

    # Class distribution
    unique, counts = np.unique(y_train, return_counts=True)
    for u, c in zip(unique, counts):
        label = ATTACK_CATEGORIES[u] if args.multiclass else ("Normal" if u == 0 else "Attack")
        logger.info(f"  {label}: {c:,}  ({100*c/len(y_train):.1f}%)")

    # 2. Build model
    input_shape = (X_train.shape[1], X_train.shape[2])  # (timesteps, features)
    model = build_model(input_shape, n_classes)
    model.summary()

    # 3. Train
    logger.info(f"Training — epochs={EPOCHS}, batch={BATCH_SIZE}, val_split={VALIDATION_SPLIT}")
    history = model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_split=VALIDATION_SPLIT,
        callbacks=get_callbacks(),
        verbose=1,
    )

    # 4. Save plots
    save_plots(history)

    # 5. Evaluate
    logger.info("Evaluating on test set…")
    if args.multiclass:
        y_prob = model.predict(X_test, verbose=0)
        y_pred = np.argmax(y_prob, axis=1)
    else:
        y_prob = model.predict(X_test, verbose=0).flatten()
        y_pred = (y_prob >= 0.5).astype(int)

    evaluate(y_test, y_pred, multiclass=args.multiclass)

    test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
    logger.info(f"Final test loss     : {test_loss:.4f}")
    logger.info(f"Final test accuracy : {test_acc:.4f}  ({test_acc*100:.2f}%)")
    logger.info(f"Model saved to      : {MODEL_PATH}")
    logger.info("Next step: start ml-service — uvicorn ml-service.app:app --port 8000")


if __name__ == "__main__":
    main()
