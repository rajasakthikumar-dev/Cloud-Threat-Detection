"""
ml-service/app.py
==================
FastAPI prediction service for the AI Threat Detection platform.

Uses a pure NumPy LSTM inference engine (no TensorFlow dependency —
works on CPUs without AVX/AVX2 instructions).

Loads the EXISTING trained artifacts:
  model/saved_models/model_weights.npz   (weights extracted from .h5)
  preprocessing/processed/scaler.pkl     (fitted StandardScaler)
  preprocessing/processed/encoder.pkl    (LabelEncoders for proto/service/state)
  ../dataset/processed/feature_names.pkl (exact 42-feature ordered list)

Endpoints
---------
  GET  /health          — liveness + model-load status
  GET  /model/info      — model architecture details
  POST /predict         — single network flow prediction
  POST /predict/batch   — batch of flows (max 10,000)

Request body for /predict
--------------------------
  {
    "features": {
      "dur": 0.12, "proto": "tcp", "service": "http", "state": "FIN",
      "spkts": 6, "dpkts": 4, "sbytes": 258, ... (any of the 42 features)
    },
    "source_ip": "192.168.1.1"   // optional, for logging
  }

Response
--------
  {
    "prediction":        "Attack",   // Normal | Attack
    "attack_type":       "Attack",
    "risk_level":        "High",     // Low | Medium | High
    "confidence_score":  94.72,      // 0-100
    "binary_prediction": 1,          // 0=Normal 1=Attack
    "probability":       94.72,
    "probabilities":     {"Normal": 5.28, "Attack": 94.72}
  }

Run
---
  cd AI-Threat-Detection/AI-Threat-Detection/ml-service
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import sys
import time
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ── Path setup — make model/ importable ──────────────────────
ML_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJ_ROOT      = os.path.dirname(ML_SERVICE_DIR)
sys.path.insert(0, ML_SERVICE_DIR)

from model.numpy_predictor import NumpyLSTMPredictor

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ml-service")

# ── Resolved artifact paths ──────────────────────────────────
NPZ_PATH    = os.getenv(
    "MODEL_NPZ_PATH",
    os.path.join(ML_SERVICE_DIR, "model", "saved_models", "model_weights.npz")
)
SCALER_PATH = os.getenv(
    "SCALER_PATH",
    os.path.join(ML_SERVICE_DIR, "preprocessing", "processed", "scaler.pkl")
)
ENCODER_PATH = os.getenv(
    "ENCODER_PATH",
    os.path.join(ML_SERVICE_DIR, "preprocessing", "processed", "encoder.pkl")
)
FEAT_NAMES_PATH = os.getenv(
    "FEAT_NAMES_PATH",
    os.path.join(PROJ_ROOT, "dataset", "processed", "feature_names.pkl")
)
H5_PATH = os.path.join(ML_SERVICE_DIR, "model", "saved_models", "lstm_threat_detection.h5")

# ── Global predictor ─────────────────────────────────────────
predictor: Optional[NumpyLSTMPredictor] = None
_load_error: Optional[str] = None


# ── Lifespan ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global predictor, _load_error
    logger.info("=" * 55)
    logger.info("  AI Threat Detection — ML Service starting")
    logger.info("=" * 55)
    logger.info(f"  NPZ weights : {NPZ_PATH}")
    logger.info(f"  Scaler      : {SCALER_PATH}")
    logger.info(f"  Encoder     : {ENCODER_PATH}")
    logger.info(f"  Feat names  : {FEAT_NAMES_PATH}")
    logger.info(f"  Original H5 : {H5_PATH} (kept as-is, not loaded)")

    try:
        predictor = NumpyLSTMPredictor(
            npz_path        = NPZ_PATH,
            scaler_path     = SCALER_PATH,
            encoder_path    = ENCODER_PATH,
            feat_names_path = FEAT_NAMES_PATH,
        )
        logger.info("Model loaded successfully — ready to serve predictions.")
    except Exception as exc:
        _load_error = str(exc)
        logger.error(f"Failed to load model: {exc}")
        predictor = None

    yield
    logger.info("ML Service shutting down.")


# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI(
    title       = "AI Threat Detection — ML Service",
    description = "LSTM-based network intrusion detection (UNSW-NB15). "
                  "Uses pure NumPy inference engine — no TensorFlow required.",
    version     = "2.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["GET", "POST"],
    allow_headers  = ["*"],
)


# ── Request timing middleware ─────────────────────────────────
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Process-Time-Ms"] = f"{ms:.1f}"
    return response


# ── Schemas ──────────────────────────────────────────────────
class PredictRequest(BaseModel):
    features: Dict[str, Any] = Field(
        ...,
        description="Key-value map of UNSW-NB15 feature names. "
                    "Missing features are filled with 0. "
                    "Categorical fields (proto, service, state) are label-encoded.",
        example={
            "dur": 0.121478, "proto": "tcp", "service": "http", "state": "FIN",
            "spkts": 6, "dpkts": 4, "sbytes": 258, "dbytes": 172,
            "rate": 49.38, "sttl": 63, "dttl": 252,
        }
    )
    source_ip: Optional[str] = Field(None, description="Caller IP (for logging only).")


class BatchPredictRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(
        ...,
        description="List of feature dicts, one per network flow. Max 10,000.",
    )


class PredictResponse(BaseModel):
    prediction:        str
    attack_type:       str
    risk_level:        str
    confidence_score:  float
    binary_prediction: int
    probability:       float
    probabilities:     Dict[str, float]


class BatchPredictResponse(BaseModel):
    predictions:  List[PredictResponse]
    total:        int
    attack_count: int
    normal_count: int


# ── Routes ───────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    """Liveness probe — always 200 if the process is running."""
    return {
        "status":       "ok",
        "service":      "AI Threat Detection ML Service",
        "model_loaded": predictor is not None,
        "load_error":   _load_error,
        "h5_file":      H5_PATH,
        "h5_exists":    os.path.exists(H5_PATH),
        "inference":    "pure-numpy (no TensorFlow required)",
        "timestamp":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@app.get("/model/info", tags=["Model"])
def model_info():
    """Return architecture and artifact details."""
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model not loaded. Error: {_load_error}"
        )
    return {
        "architecture":    "Sequential LSTM (128) → BatchNorm → LSTM (64) → BatchNorm → Dense (32,relu) → Dense (1,sigmoid)",
        "input_shape":     list(predictor.input_shape),
        "n_features":      predictor.N_FEATURES,
        "feature_names":   predictor.feature_names,
        "output":          "binary (0=Normal, 1=Attack)",
        "inference_engine":"pure-numpy",
        "h5_file":         H5_PATH,
        "npz_weights":     NPZ_PATH,
        "scaler":          SCALER_PATH,
        "encoder":         ENCODER_PATH,
        "categorical_cols":["proto", "service", "state"],
        "dataset":         "UNSW-NB15",
        "timesteps":       1,
    }


@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
def predict(request: PredictRequest):
    """
    Predict whether a single network flow is Normal or an Attack.

    Send any subset of the 42 UNSW-NB15 features.
    Missing features are filled with 0.
    """
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model not loaded. Error: {_load_error}"
        )
    try:
        result = predictor.predict_single(request.features)
        logger.info(
            f"PREDICT | prediction={result['prediction']} "
            f"risk={result['risk_level']} "
            f"conf={result['confidence_score']:.2f}% "
            f"src={request.source_ip or 'n/a'}"
        )
        return result
    except Exception as exc:
        logger.error(f"Prediction error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")


@app.post("/predict/batch", response_model=BatchPredictResponse, tags=["Prediction"])
def predict_batch(request: BatchPredictRequest):
    """Batch prediction — up to 10,000 network flows per call."""
    if predictor is None:
        raise HTTPException(status_code=503, detail=f"Model not loaded. Error: {_load_error}")
    if not request.records:
        raise HTTPException(status_code=400, detail="records list is empty.")
    if len(request.records) > 10_000:
        raise HTTPException(status_code=400, detail="Maximum 10,000 records per batch.")
    try:
        predictions  = predictor.predict_batch(request.records)
        attack_count = sum(1 for p in predictions if p["binary_prediction"] == 1)
        logger.info(
            f"BATCH | total={len(predictions)} attacks={attack_count} "
            f"normal={len(predictions)-attack_count}"
        )
        return {
            "predictions":  predictions,
            "total":        len(predictions),
            "attack_count": attack_count,
            "normal_count": len(predictions) - attack_count,
        }
    except Exception as exc:
        logger.error(f"Batch prediction error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {exc}")


# ── Global error handler ──────────────────────────────────────
@app.exception_handler(Exception)
async def global_error(request: Request, exc: Exception):
    logger.error(f"Unhandled exception [{request.url}]: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error.", "error": str(exc)},
    )


# ── Entry point ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host      = "0.0.0.0",
        port      = int(os.getenv("PORT", 8000)),
        reload    = os.getenv("ENV", "development") == "development",
        log_level = "info",
    )
