"""
model/train.py
---------------
Training pipeline for the LSTM Threat Detection model.

Steps:
  1. Load processed data from dataset/processed/
  2. Auto-detect input shape and number of classes
  3. Build LSTM model (binary or multiclass)
  4. Train with EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
  5. Save three graph files: training_history, accuracy_curve, loss_curve
  6. Evaluate on test set — print accuracy, precision, recall, F1
  7. Save confusion matrix and classification report

Usage:
    python model/train.py
    python model/train.py --multiclass     # use attack_cat labels
"""

import os
import sys
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
from tensorflow.keras.callbacks import (
    EarlyStopping,
    ModelCheckpoint,
    ReduceLROnPlateau,
)

from config import (
    MODEL_PATH, SAVED_MODELS_DIR,
    EPOCHS, BATCH_SIZE, VALIDATION_SPLIT,
    EARLY_STOP_PATIENCE,
    REDUCE_LR_PATIENCE, REDUCE_LR_FACTOR, MIN_LR,
    LEARNING_RATE,
    ATTACK_CATEGORIES,
)
from utils.data_loader import (
    load_all_data,
    load_multiclass_labels,
    get_input_shape,
)
from utils.metrics import (
    evaluate_model,
    plot_confusion_matrix,
    plot_training_history,
)
from model.lstm_model import build_lstm_model, print_model_summary
from utils.logger import get_logger, log_section, log_error

logger = get_logger("train")


# ─────────────────────────────────────────────────────────────
# CALLBACKS
# ─────────────────────────────────────────────────────────────

def build_callbacks() -> list:
    """
    Return Keras training callbacks:
      EarlyStopping      — halt training when val_loss stops improving
      ModelCheckpoint    — save the best model automatically
      ReduceLROnPlateau  — halve LR when val_loss stalls
    """
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)

    early_stop = EarlyStopping(
        monitor="val_loss",
        patience=EARLY_STOP_PATIENCE,
        restore_best_weights=True,
        verbose=1,
    )

    checkpoint = ModelCheckpoint(
        filepath=MODEL_PATH,
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1,
    )

    reduce_lr = ReduceLROnPlateau(
        monitor="val_loss",
        factor=REDUCE_LR_FACTOR,
        patience=REDUCE_LR_PATIENCE,
        min_lr=MIN_LR,
        verbose=1,
    )

    return [early_stop, checkpoint, reduce_lr]


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Train the LSTM Threat Detection model."
    )
    parser.add_argument(
        "--multiclass",
        action="store_true",
        default=False,
        help="Train on multiclass attack categories instead of binary labels.",
    )
    args = parser.parse_args()

    try:
        log_section(logger, "LSTM Training Pipeline")

        # ── Step 1: Load data ──────────────────────────────────────────
        logger.info("[Step 1/5] Loading processed dataset...")
        X_train, X_test, y_train_binary, y_test_binary = load_all_data()

        # Decide label arrays
        if args.multiclass:
            y_train_cat, y_test_cat = load_multiclass_labels()
            if y_train_cat is None:
                logger.warning(
                    "--multiclass requested but no category labels found. "
                    "Falling back to binary mode."
                )
                args.multiclass = False
                y_train, y_test = y_train_binary, y_test_binary
            else:
                y_train, y_test = y_train_cat, y_test_cat
                n_classes = len(ATTACK_CATEGORIES)
                logger.info(f"Multiclass mode — {n_classes} attack categories.")
        else:
            y_train, y_test = y_train_binary, y_test_binary

        # Log class distribution
        unique, counts = np.unique(y_train, return_counts=True)
        logger.info("Training class distribution:")
        for u, c in zip(unique, counts):
            if args.multiclass:
                name = ATTACK_CATEGORIES[u] if u < len(ATTACK_CATEGORIES) else str(u)
            else:
                name = "Normal" if u == 0 else "Attack"
            logger.info(f"  {name} ({u}): {c:,}  ({100*c/len(y_train):.1f}%)")

        # ── Step 2: Build model ────────────────────────────────────────
        logger.info("[Step 2/5] Building LSTM model...")
        input_shape = get_input_shape()
        n_classes   = len(ATTACK_CATEGORIES) if args.multiclass else 1
        model       = build_lstm_model(input_shape, n_classes=n_classes, learning_rate=LEARNING_RATE)
        print_model_summary(model)

        # ── Step 3: Train ──────────────────────────────────────────────
        logger.info(
            f"[Step 3/5] Training — epochs={EPOCHS}, batch={BATCH_SIZE}, "
            f"val_split={VALIDATION_SPLIT}"
        )
        callbacks = build_callbacks()

        history = model.fit(
            X_train, y_train,
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            validation_split=VALIDATION_SPLIT,
            callbacks=callbacks,
            verbose=1,
        )

        # Log each epoch summary to detection.log
        for epoch_idx in range(len(history.history["accuracy"])):
            logger.debug(
                f"Epoch {epoch_idx+1:03d} | "
                f"acc={history.history['accuracy'][epoch_idx]:.4f} "
                f"val_acc={history.history['val_accuracy'][epoch_idx]:.4f} | "
                f"loss={history.history['loss'][epoch_idx]:.4f} "
                f"val_loss={history.history['val_loss'][epoch_idx]:.4f}"
            )

        # ── Step 4: Save graphs ────────────────────────────────────────
        logger.info("[Step 4/5] Saving training graphs...")
        plot_training_history(history, save_fig=True)

        # ── Step 5: Evaluate ───────────────────────────────────────────
        logger.info("[Step 5/5] Evaluating on test set...")
        multiclass_mode = args.multiclass

        if multiclass_mode:
            # softmax → argmax
            y_prob_raw = model.predict(X_test, verbose=0)
            y_pred     = np.argmax(y_prob_raw, axis=1)
        else:
            # sigmoid → threshold
            y_prob = model.predict(X_test, verbose=0).flatten()
            y_pred = (y_prob >= 0.5).astype(int)

        metrics = evaluate_model(
            y_test, y_pred,
            multiclass=multiclass_mode,
            save_report=True,
        )

        plot_confusion_matrix(
            y_test, y_pred,
            multiclass=multiclass_mode,
            save_fig=True,
        )

        # Final Keras evaluate for loss figure
        test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
        logger.info(f"Final test loss     : {test_loss:.4f}")
        logger.info(f"Final test accuracy : {test_acc:.4f}  ({test_acc*100:.2f}%)")
        logger.info(f"Model saved to      : {MODEL_PATH}")
        logger.info("Training complete. Run:  python model/predict.py")

    except Exception as e:
        log_error(logger, "train.main", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
