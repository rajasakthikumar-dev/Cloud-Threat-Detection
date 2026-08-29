"""
ml-service/model/numpy_predictor.py
=====================================
Pure NumPy LSTM inference engine.

Loads weights from model_weights.npz (extracted from the trained
lstm_threat_detection.h5 by _extract_weights.py) and implements
the exact same forward pass as the Keras model:

  Input (1, 42)
    → LSTM(128, return_sequences=True)
    → BatchNormalization
    → LSTM(64, return_sequences=False)
    → BatchNormalization
    → Dense(32, relu)
    → Dense(1, sigmoid)
    → binary prediction

No TensorFlow, no Keras, no AVX requirement.
Requires only: numpy, joblib, pandas (already installed).
"""

import os
import logging
import numpy as np
import joblib
from typing import Dict, Any, List

logger = logging.getLogger("numpy_predictor")

# ── Activation functions ─────────────────────────────────────
def _sigmoid(x: np.ndarray) -> np.ndarray:
    # Numerically stable sigmoid
    return np.where(x >= 0,
                    1.0 / (1.0 + np.exp(-x)),
                    np.exp(x) / (1.0 + np.exp(x)))

def _tanh(x: np.ndarray) -> np.ndarray:
    return np.tanh(x)

def _relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(0.0, x)


# ── LSTM cell (single time step) ────────────────────────────
def _lstm_step(x_t, h_prev, c_prev, kernel, recurrent_kernel, bias, units):
    """
    Single LSTM cell computation for one time step.

    Keras LSTM bias is stored as shape (4*units,) in gate order:
      i (input), f (forget), c (cell), o (output)

    kernel           : (input_dim, 4*units)
    recurrent_kernel : (units, 4*units)
    bias             : (4*units,)
    """
    z = x_t @ kernel + h_prev @ recurrent_kernel + bias    # (batch, 4*units)

    i = _sigmoid(z[:, :units])
    f = _sigmoid(z[:, units:2*units])
    c_tilde = _tanh(z[:, 2*units:3*units])
    o = _sigmoid(z[:, 3*units:])

    c_next = f * c_prev + i * c_tilde
    h_next = o * _tanh(c_next)
    return h_next, c_next


def _lstm_forward(x, kernel, recurrent_kernel, bias, units, return_sequences=False):
    """
    Full LSTM forward pass over a sequence.

    x : (batch, timesteps, features)
    Returns:
      if return_sequences : (batch, timesteps, units)
      else                : (batch, units)
    """
    batch, timesteps, _ = x.shape
    h = np.zeros((batch, units), dtype=np.float32)
    c = np.zeros((batch, units), dtype=np.float32)

    all_h = []
    for t in range(timesteps):
        x_t = x[:, t, :]   # (batch, features)
        h, c = _lstm_step(x_t, h, c, kernel, recurrent_kernel, bias, units)
        if return_sequences:
            all_h.append(h[:, np.newaxis, :])

    if return_sequences:
        return np.concatenate(all_h, axis=1)   # (batch, timesteps, units)
    return h                                   # (batch, units)


def _batch_norm_inference(x, gamma, beta, moving_mean, moving_variance, eps=1e-3):
    """
    BatchNormalization in inference mode (uses moving statistics).
    eps=1e-3 matches Keras default.
    """
    return gamma * (x - moving_mean) / np.sqrt(moving_variance + eps) + beta


# ── Risk level mapping ────────────────────────────────────────
def _risk_level(confidence: float) -> str:
    if confidence >= 0.85:
        return "High"
    elif confidence >= 0.70:
        return "Medium"
    else:
        return "Low"


# ════════════════════════════════════════════════════════════
# NumpyLSTMPredictor
# ════════════════════════════════════════════════════════════
class NumpyLSTMPredictor:
    """
    Loads the extracted model weights and runs inference entirely
    with NumPy — no TensorFlow dependency.

    Parameters
    ----------
    npz_path      : path to model_weights.npz
    scaler_path   : path to scaler.pkl   (StandardScaler)
    encoder_path  : path to encoder.pkl  (dict of LabelEncoders)
    feat_names_path: path to feature_names.pkl  (list of 42 names)
    """

    N_FEATURES = 42
    TIMESTEPS  = 1

    def __init__(
        self,
        npz_path: str,
        scaler_path: str,
        encoder_path: str,
        feat_names_path: str,
    ):
        self._load_weights(npz_path)
        self._load_preprocessors(scaler_path, encoder_path, feat_names_path)
        logger.info(
            f"NumpyLSTMPredictor ready — "
            f"input_shape=({self.TIMESTEPS}, {self.N_FEATURES})  binary=True"
        )

    # ── Loading ──────────────────────────────────────────────
    def _load_weights(self, path: str):
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Weight file not found: {path}\n"
                f"Run: python3 ml-service/_extract_weights.py"
            )
        w = np.load(path)

        # Helper to resolve the double-underscored keys back to layer weights
        def get(key_suffix: str) -> np.ndarray:
            for k in w.files:
                if k.endswith(key_suffix):
                    return w[k].astype(np.float32)
            raise KeyError(f"Weight key ending with '{key_suffix}' not found in npz. "
                           f"Available keys: {w.files}")

        # LSTM 1  (units=128)
        self._lstm1_kernel    = get("lstm_1__lstm_cell__kernel")        # (42, 512)
        self._lstm1_recurrent = get("lstm_1__lstm_cell__recurrent_kernel")  # (128, 512)
        self._lstm1_bias      = get("lstm_1__lstm_cell__bias")          # (512,)

        # BatchNorm 1
        self._bn1_gamma       = get("batchnorm_1__gamma")               # (128,)
        self._bn1_beta        = get("batchnorm_1__beta")                # (128,)
        self._bn1_mean        = get("batchnorm_1__moving_mean")         # (128,)
        self._bn1_var         = get("batchnorm_1__moving_variance")     # (128,)

        # LSTM 2  (units=64)
        self._lstm2_kernel    = get("lstm_2__lstm_cell__kernel")        # (128, 256)
        self._lstm2_recurrent = get("lstm_2__lstm_cell__recurrent_kernel")  # (64, 256)
        self._lstm2_bias      = get("lstm_2__lstm_cell__bias")          # (256,)

        # BatchNorm 2
        self._bn2_gamma       = get("batchnorm_2__gamma")               # (64,)
        self._bn2_beta        = get("batchnorm_2__beta")                # (64,)
        self._bn2_mean        = get("batchnorm_2__moving_mean")         # (64,)
        self._bn2_var         = get("batchnorm_2__moving_variance")     # (64,)

        # Dense hidden  (units=32, relu)
        self._dense1_kernel   = get("dense_hidden__kernel")             # (64, 32)
        self._dense1_bias     = get("dense_hidden__bias")               # (32,)

        # Output  (units=1, sigmoid)
        self._out_kernel      = get("output__kernel")                   # (32, 1)
        self._out_bias        = get("output__bias")                     # (1,)

        logger.info(f"Weights loaded from {path}")

    def _load_preprocessors(self, scaler_path: str, encoder_path: str, feat_names_path: str):
        for p in (scaler_path, encoder_path, feat_names_path):
            if not os.path.exists(p):
                raise FileNotFoundError(f"Preprocessor file not found: {p}")

        self._scaler       = joblib.load(scaler_path)
        self._encoders     = joblib.load(encoder_path)   # dict {col: LabelEncoder}
        self._feature_names = joblib.load(feat_names_path)  # list of 42 names

        logger.info(
            f"Scaler loaded ({self._scaler.n_features_in_} features) | "
            f"Encoders: {list(self._encoders.keys())} | "
            f"Feature names: {len(self._feature_names)} names"
        )

    # ── Pre-processing ───────────────────────────────────────
    def _preprocess(self, features_dict: Dict[str, Any]) -> np.ndarray:
        """
        Apply IDENTICAL preprocessing to training:
          1. Build ordered DataFrame from feature_names list
          2. Encode proto / service / state with saved LabelEncoders
          3. Fill missing features with 0
          4. Apply saved StandardScaler
          5. Reshape to (1, 1, 42)
        """
        import pandas as pd

        # Build row in the exact column order the scaler was fitted on
        row = {}
        for col in self._feature_names:
            row[col] = features_dict.get(col, 0)

        df = pd.DataFrame([row], columns=self._feature_names)

        # Encode categorical columns (proto, service, state)
        for col, le in self._encoders.items():
            if col in df.columns:
                val = str(df[col].iloc[0])
                known = set(le.classes_)
                if val not in known:
                    val = le.classes_[0]   # unknown → first class (safe fallback)
                df[col] = le.transform([val])

        # Numeric conversion + fill
        df = df.apply(pd.to_numeric, errors="coerce").fillna(0).astype(np.float32)

        X = self._scaler.transform(df.values)           # (1, 42)
        X = X.reshape(1, self.TIMESTEPS, self.N_FEATURES)  # (1, 1, 42)
        return X.astype(np.float32)

    def _preprocess_batch(self, records: List[Dict[str, Any]]) -> np.ndarray:
        import pandas as pd

        rows = []
        for rec in records:
            row = {col: rec.get(col, 0) for col in self._feature_names}
            rows.append(row)

        df = pd.DataFrame(rows, columns=self._feature_names)

        for col, le in self._encoders.items():
            if col in df.columns:
                known = set(le.classes_)
                df[col] = df[col].astype(str).apply(
                    lambda v: v if v in known else le.classes_[0]
                )
                df[col] = le.transform(df[col])

        df = df.apply(pd.to_numeric, errors="coerce").fillna(0).astype(np.float32)

        X = self._scaler.transform(df.values)
        X = X.reshape(len(records), self.TIMESTEPS, self.N_FEATURES)
        return X.astype(np.float32)

    # ── Forward pass ─────────────────────────────────────────
    def _forward(self, X: np.ndarray) -> np.ndarray:
        """
        Full model forward pass.
        X : (batch, 1, 42)
        Returns : (batch,)  probabilities in [0, 1]
        """
        # ── LSTM 1 (return_sequences=True) ───────────────────
        h1 = _lstm_forward(
            X,
            self._lstm1_kernel, self._lstm1_recurrent, self._lstm1_bias,
            units=128, return_sequences=True,
        )   # (batch, 1, 128)

        # ── BatchNorm 1 (on last dim) ────────────────────────
        h1 = _batch_norm_inference(
            h1, self._bn1_gamma, self._bn1_beta, self._bn1_mean, self._bn1_var
        )   # (batch, 1, 128)

        # ── LSTM 2 (return_sequences=False) ──────────────────
        h2 = _lstm_forward(
            h1,
            self._lstm2_kernel, self._lstm2_recurrent, self._lstm2_bias,
            units=64, return_sequences=False,
        )   # (batch, 64)

        # ── BatchNorm 2 ──────────────────────────────────────
        h2 = _batch_norm_inference(
            h2, self._bn2_gamma, self._bn2_beta, self._bn2_mean, self._bn2_var
        )   # (batch, 64)

        # ── Dense hidden (relu) ──────────────────────────────
        h3 = _relu(h2 @ self._dense1_kernel + self._dense1_bias)   # (batch, 32)

        # ── Output (sigmoid) ─────────────────────────────────
        logit = h3 @ self._out_kernel + self._out_bias   # (batch, 1)
        prob  = _sigmoid(logit)                          # (batch, 1)
        return prob.flatten()                            # (batch,)

    # ── Public inference API ──────────────────────────────────
    def predict_single(self, features: Dict[str, Any]) -> Dict:
        """
        Predict for one feature dict.
        Returns dict matching FastAPI PredictResponse schema.
        """
        X    = self._preprocess(features)
        prob = float(self._forward(X)[0])

        binary     = int(prob >= 0.5)
        confidence = prob if binary == 1 else (1.0 - prob)
        attack_type = "Attack" if binary == 1 else "Normal"
        risk        = _risk_level(confidence) if binary == 1 else "Low"

        return {
            "prediction":        attack_type,
            "attack_type":       attack_type,
            "risk_level":        risk,
            "confidence_score":  round(confidence * 100, 4),
            "binary_prediction": binary,
            "probability":       round(prob * 100, 4),
            "probabilities": {
                "Normal": round((1.0 - prob) * 100, 4),
                "Attack": round(prob * 100, 4),
            },
        }

    def predict_batch(self, records: List[Dict[str, Any]]) -> List[Dict]:
        """Predict for a list of feature dicts (vectorised)."""
        X     = self._preprocess_batch(records)
        probs = self._forward(X)

        results = []
        for prob in probs:
            prob = float(prob)
            binary     = int(prob >= 0.5)
            confidence = prob if binary == 1 else (1.0 - prob)
            attack_type = "Attack" if binary == 1 else "Normal"
            risk        = _risk_level(confidence) if binary == 1 else "Low"
            results.append({
                "prediction":        attack_type,
                "attack_type":       attack_type,
                "risk_level":        risk,
                "confidence_score":  round(confidence * 100, 4),
                "binary_prediction": binary,
                "probability":       round(prob * 100, 4),
                "probabilities": {
                    "Normal": round((1.0 - prob) * 100, 4),
                    "Attack": round(prob * 100, 4),
                },
            })
        return results

    @property
    def input_shape(self):
        return (self.TIMESTEPS, self.N_FEATURES)

    @property
    def feature_names(self):
        return self._feature_names
