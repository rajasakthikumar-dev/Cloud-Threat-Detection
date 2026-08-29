"""
ml-service/model/predict.py
-----------------------------
ThreatPredictor class — loads the trained LSTM model, scaler, and encoders,
then transforms raw feature dicts into threat predictions.

Used by ml-service/app.py FastAPI endpoints.
"""

import os
import sys
import logging
import numpy as np
import pandas as pd
import joblib
from typing import Dict, List, Any

logger = logging.getLogger("predict")

ATTACK_CATEGORIES = [
    "Normal", "Analysis", "Backdoor", "DoS", "Exploits",
    "Fuzzers", "Generic", "Reconnaissance", "Shellcode", "Worms",
]

# Risk level thresholds (confidence of attack prediction)
RISK_THRESHOLDS = {
    "Low":    (0.50, 0.70),
    "Medium": (0.70, 0.85),
    "High":   (0.85, 1.01),
}


def _confidence_to_risk(confidence: float) -> str:
    """Map attack confidence (0-1) to Low / Medium / High."""
    if confidence >= 0.85:
        return "High"
    elif confidence >= 0.70:
        return "Medium"
    else:
        return "Low"


class ThreatPredictor:
    """
    Wraps the trained LSTM model and preprocessing objects.

    Args:
        model_path:   path to lstm_model.h5
        scaler_path:  path to scaler.pkl
        encoder_path: path to encoder.pkl (dict of LabelEncoders)
    """

    ATTACK_CATEGORIES = ATTACK_CATEGORIES

    def __init__(self, model_path: str, scaler_path: str, encoder_path: str):
        self._load_model(model_path)
        self._load_preprocessors(scaler_path, encoder_path)

    # ─────────────────────────────────────────────────────────
    # LOADING
    # ─────────────────────────────────────────────────────────
    def _load_model(self, path: str):
        from tensorflow.keras.models import load_model  # lazy import

        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Model not found: {path}\n"
                f"Run:  python ml-service/model/lstm_train.py"
            )
        logger.info(f"Loading model from {path} …")
        self._model = load_model(path)

        # Infer input shape and whether this is multiclass
        input_shape      = self._model.input_shape    # (None, timesteps, features)
        self.n_features  = input_shape[-1]
        self.input_shape = (input_shape[1], input_shape[2])

        out_units = self._model.output_shape[-1]
        self._multiclass = out_units > 1
        self._n_classes  = out_units if self._multiclass else 2

        logger.info(
            f"Model loaded — input {self.input_shape}  "
            f"mode={'multiclass' if self._multiclass else 'binary'}  "
            f"classes={self._n_classes}"
        )

    def _load_preprocessors(self, scaler_path: str, encoder_path: str):
        if not os.path.exists(scaler_path):
            raise FileNotFoundError(
                f"Scaler not found: {scaler_path}\n"
                f"Run:  python ml-service/preprocessing/preprocess.py"
            )
        self._scaler   = joblib.load(scaler_path)
        self._encoders = joblib.load(encoder_path) if os.path.exists(encoder_path) else {}
        logger.info(
            f"Scaler loaded from {scaler_path}  "
            f"| Encoders: {list(self._encoders.keys())}"
        )

    # ─────────────────────────────────────────────────────────
    # PREPROCESSING
    # ─────────────────────────────────────────────────────────
    def _prepare(self, features_dict: Dict[str, Any]) -> np.ndarray:
        """
        Convert a feature dict to a (1, timesteps, n_features) numpy array.

        1. Build a single-row DataFrame
        2. Apply saved LabelEncoders to categorical columns
        3. Ensure exactly n_features columns (fill missing with 0)
        4. Apply saved StandardScaler
        5. Reshape to LSTM format
        """
        df = pd.DataFrame([features_dict])

        # Encode known categorical columns
        for col, le in self._encoders.items():
            if col in df.columns:
                val = str(df[col].iloc[0])
                if val in set(le.classes_):
                    df[col] = le.transform([val])
                else:
                    df[col] = le.transform([le.classes_[0]])  # unknown → first class
            else:
                df[col] = 0  # column missing entirely

        # Convert to numeric, fill NaN
        df = df.apply(pd.to_numeric, errors="coerce").fillna(0)

        # Align to exactly n_features columns
        # (extra columns dropped, missing filled with 0)
        expected_cols = getattr(self._scaler, "feature_names_in_", None)
        if expected_cols is not None:
            for c in expected_cols:
                if c not in df.columns:
                    df[c] = 0
            df = df[expected_cols]
        else:
            # Pad or trim to n_features
            current = df.values.astype(np.float32)
            if current.shape[1] < self.n_features:
                pad = np.zeros((1, self.n_features - current.shape[1]), dtype=np.float32)
                current = np.hstack([current, pad])
            elif current.shape[1] > self.n_features:
                current = current[:, :self.n_features]
            df = pd.DataFrame(current)

        X = self._scaler.transform(df.values.astype(np.float32))
        X = X.reshape(1, self.input_shape[0], self.n_features)
        return X

    def _prepare_batch(self, records: List[Dict[str, Any]]) -> np.ndarray:
        """Prepare multiple feature dicts at once."""
        df = pd.DataFrame(records)

        for col, le in self._encoders.items():
            if col in df.columns:
                known = set(le.classes_)
                df[col] = df[col].astype(str).apply(
                    lambda v: v if v in known else le.classes_[0]
                )
                df[col] = le.transform(df[col])
            else:
                df[col] = 0

        df = df.apply(pd.to_numeric, errors="coerce").fillna(0)

        expected_cols = getattr(self._scaler, "feature_names_in_", None)
        if expected_cols is not None:
            for c in expected_cols:
                if c not in df.columns:
                    df[c] = 0
            df = df[expected_cols]
        else:
            current = df.values.astype(np.float32)
            if current.shape[1] < self.n_features:
                pad = np.zeros((len(records), self.n_features - current.shape[1]), dtype=np.float32)
                current = np.hstack([current, pad])
            elif current.shape[1] > self.n_features:
                current = current[:, :self.n_features]
            df = pd.DataFrame(current)

        X = self._scaler.transform(df.values.astype(np.float32))
        X = X.reshape(len(records), self.input_shape[0], self.n_features)
        return X

    # ─────────────────────────────────────────────────────────
    # INFERENCE
    # ─────────────────────────────────────────────────────────
    def _build_response(
        self,
        binary_pred: int,
        attack_confidence: float,
        attack_type: str,
    ) -> Dict:
        risk_level = _confidence_to_risk(attack_confidence) if binary_pred == 1 else "Low"
        return {
            "attack_type":       attack_type,
            "risk_level":        risk_level,
            "confidence_score":  round(attack_confidence * 100, 2),
            "binary_prediction": binary_pred,
            "probabilities": {
                "Normal": round((1 - attack_confidence) * 100, 2),
                "Attack": round(attack_confidence * 100, 2),
            },
        }

    def predict_single(self, features: Dict[str, Any]) -> Dict:
        """Predict threat for a single feature dict."""
        X = self._prepare(features)

        if self._multiclass:
            probs      = self._model.predict(X, verbose=0)[0]
            class_idx  = int(np.argmax(probs))
            confidence = float(probs[class_idx])
            attack_type = ATTACK_CATEGORIES[class_idx] if class_idx < len(ATTACK_CATEGORIES) else "Unknown"
            binary = 0 if attack_type == "Normal" else 1
        else:
            prob       = float(self._model.predict(X, verbose=0)[0][0])
            binary     = int(prob >= 0.5)
            confidence = prob if binary == 1 else (1 - prob)
            attack_type = "Attack" if binary == 1 else "Normal"

        return self._build_response(binary, confidence, attack_type)

    def predict_batch(self, records: List[Dict[str, Any]]) -> List[Dict]:
        """Predict threats for a list of feature dicts (vectorised)."""
        X = self._prepare_batch(records)

        if self._multiclass:
            probs_all  = self._model.predict(X, verbose=0)
            class_idxs = np.argmax(probs_all, axis=1)
            results = []
            for i, class_idx in enumerate(class_idxs):
                confidence  = float(probs_all[i][class_idx])
                attack_type = ATTACK_CATEGORIES[class_idx] if class_idx < len(ATTACK_CATEGORIES) else "Unknown"
                binary = 0 if attack_type == "Normal" else 1
                results.append(self._build_response(binary, confidence, attack_type))
        else:
            probs  = self._model.predict(X, verbose=0).flatten()
            binary = (probs >= 0.5).astype(int)
            results = []
            for i, (b, p) in enumerate(zip(binary, probs)):
                confidence  = float(p) if b == 1 else float(1 - p)
                attack_type = "Attack" if b == 1 else "Normal"
                results.append(self._build_response(int(b), confidence, attack_type))

        return results
