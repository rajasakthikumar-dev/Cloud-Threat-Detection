"""
model/lstm_model.py
--------------------
LSTM neural network for binary or multiclass threat detection.

Architecture:
  Input(timesteps, features)
    → LSTM(128, return_sequences=True) → BatchNorm → Dropout(0.3)
    → LSTM(64)                         → BatchNorm → Dropout(0.3)
    → Dense(32, relu)                  → Dropout(0.2)
    → Dense(1, sigmoid)   [binary]
      OR
    → Dense(n_classes, softmax)        [multiclass]

All hyperparameters come from config.py.

Usage:
    from model.lstm_model import build_lstm_model
    model = build_lstm_model(input_shape=(1, 42))                  # binary
    model = build_lstm_model(input_shape=(1, 42), n_classes=10)    # multiclass
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam

from config import (
    LSTM_UNITS_1, LSTM_UNITS_2, DENSE_UNITS,
    DROPOUT_RATE_1, DROPOUT_RATE_2, DROPOUT_RATE_3,
    LEARNING_RATE,
)
from utils.logger import get_logger

logger = get_logger("lstm_model")


def build_lstm_model(
    input_shape: tuple,
    n_classes: int = 1,
    learning_rate: float = LEARNING_RATE,
) -> Sequential:
    """
    Build and compile the LSTM model.

    Parameters
    ----------
    input_shape   : (timesteps, features) — auto-detected from processed data
    n_classes     : 1 for binary (sigmoid); >1 for multiclass (softmax)
    learning_rate : Adam learning rate (default from config.py)

    Returns
    -------
    model : compiled Keras Sequential model
    """
    multiclass = n_classes > 1
    mode_label = f"multiclass ({n_classes} classes)" if multiclass else "binary"
    logger.info(
        f"Building LSTM model — input_shape={input_shape}, mode={mode_label}, "
        f"lr={learning_rate}"
    )

    model = Sequential(name="LSTM_ThreatDetector")

    # ── Block 1: First LSTM ────────────────────────────────────────────
    model.add(LSTM(
        units=LSTM_UNITS_1,
        return_sequences=True,   # pass full sequence to next LSTM
        input_shape=input_shape,
        name="lstm_1",
    ))
    model.add(BatchNormalization(name="batchnorm_1"))
    model.add(Dropout(rate=DROPOUT_RATE_1, name="dropout_1"))

    # ── Block 2: Second LSTM ───────────────────────────────────────────
    model.add(LSTM(
        units=LSTM_UNITS_2,
        return_sequences=False,  # collapse to single vector for Dense
        name="lstm_2",
    ))
    model.add(BatchNormalization(name="batchnorm_2"))
    model.add(Dropout(rate=DROPOUT_RATE_2, name="dropout_2"))

    # ── Dense hidden layer ─────────────────────────────────────────────
    model.add(Dense(units=DENSE_UNITS, activation="relu", name="dense_hidden"))
    model.add(Dropout(rate=DROPOUT_RATE_3, name="dropout_3"))

    # ── Output layer ───────────────────────────────────────────────────
    if multiclass:
        model.add(Dense(units=n_classes, activation="softmax", name="output"))
        loss = "sparse_categorical_crossentropy"
    else:
        model.add(Dense(units=1, activation="sigmoid", name="output"))
        loss = "binary_crossentropy"

    # ── Compile ────────────────────────────────────────────────────────
    model.compile(
        optimizer=Adam(learning_rate=learning_rate),
        loss=loss,
        metrics=["accuracy"],
    )

    logger.info(f"Model compiled — loss={loss}, optimizer=Adam(lr={learning_rate})")
    return model


def print_model_summary(model: Sequential):
    """Print a formatted model architecture summary."""
    print("\n" + "=" * 58)
    print("  LSTM Model Architecture")
    print("=" * 58)
    model.summary()
    print("=" * 58 + "\n")
