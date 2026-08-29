# ML Service — FastAPI LSTM Threat Detection

A standalone Python microservice that serves the trained LSTM model via a REST API.
The Node.js backend calls this service to classify network traffic as **Normal** or **Attack**.

---

## Architecture

```
Node.js Backend (port 5000)
        │
        │  POST /predict  { "features": { ... } }
        ▼
FastAPI ML Service (port 8000)
        │
        ├── ThreatPredictor.predict_single()
        │       ├── LabelEncoder (encoder.pkl)
        │       ├── StandardScaler (scaler.pkl)
        │       └── LSTM Model (lstm_model.h5)
        │
        └── Returns:
                {
                  "attack_type":       "DoS",
                  "risk_level":        "High",
                  "confidence_score":  94.7,
                  "binary_prediction": 1
                }
```

---

## Directory Structure

```
ml-service/
├── app.py                        ← FastAPI server entry point
├── requirements.txt              ← Python dependencies
├── Dockerfile                    ← Container definition
├── README.md
│
├── data/                         ← Place UNSW-NB15 CSV/Parquet files here
│   ├── UNSW_NB15_training-set.csv
│   └── UNSW_NB15_testing-set.csv
│
├── preprocessing/
│   ├── preprocess.py             ← Data cleaning, encoding, normalisation
│   ├── scaler.pkl                ← Saved StandardScaler (auto-generated)
│   ├── encoder.pkl               ← Saved LabelEncoders dict (auto-generated)
│   ├── cat_encoder.pkl           ← Attack category encoder (auto-generated)
│   ├── X_train.npy               ← Processed training features
│   ├── X_test.npy                ← Processed test features
│   ├── y_train.npy               ← Binary labels
│   └── y_test.npy
│
└── model/
    ├── lstm_train.py             ← Full LSTM training script
    ├── predict.py                ← ThreatPredictor inference class
    ├── lstm_model.h5             ← Trained model weights (auto-generated)
    └── plots/
        ├── training_history.png
        ├── accuracy_curve.png
        └── loss_curve.png
```

---

## Setup

### 1. Create a virtual environment

```bash
cd ml-service
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Place dataset files

Download UNSW-NB15 from:
- Official: https://research.unsw.edu.au/projects/unsw-nb15-dataset
- Kaggle:   https://www.kaggle.com/datasets/mrwellsdavid/unsw-nb15

Copy the CSV files to `ml-service/data/`:

```
ml-service/data/
├── UNSW_NB15_training-set.csv
└── UNSW_NB15_testing-set.csv
```

---

## Run the Pipeline

### Step 1 — Preprocess

```bash
python preprocessing/preprocess.py
```

Outputs: `X_train.npy`, `X_test.npy`, `y_train.npy`, `y_test.npy`, `scaler.pkl`, `encoder.pkl`

### Step 2 — Train

```bash
# Binary classification (Normal vs Attack)
python model/lstm_train.py

# Multiclass (10 attack categories)
python model/lstm_train.py --multiclass
```

Outputs: `model/lstm_model.h5`, `model/plots/*.png`

### Step 3 — Start the API server

```bash
# From the ml-service directory
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Or from the project root:

```bash
uvicorn ml-service.app:app --host 0.0.0.0 --port 8000
```

---

## API Reference

### `GET /health`
Liveness probe — returns model load status.

```json
{
  "status": "ok",
  "model_loaded": true,
  "timestamp": "2025-01-15T10:00:00Z"
}
```

### `GET /model/info`
Returns model architecture metadata.

### `POST /predict`
Single-sample threat prediction.

**Request:**
```json
{
  "features": {
    "dur": 0.121478,
    "proto": "tcp",
    "service": "http",
    "state": "FIN",
    "spkts": 6,
    "dpkts": 4,
    "sbytes": 258,
    "dbytes": 172,
    "rate": 49.38,
    "sttl": 63,
    "dttl": 252
  },
  "source_ip": "192.168.1.100"
}
```

**Response:**
```json
{
  "attack_type":       "DoS",
  "risk_level":        "High",
  "confidence_score":  94.7,
  "binary_prediction": 1,
  "probabilities": {
    "Normal": 5.3,
    "Attack": 94.7
  }
}
```

### `POST /predict/batch`
Batch prediction for up to 10,000 records.

**Request:**
```json
{
  "records": [
    { "dur": 0.12, "proto": "tcp", "sbytes": 258 },
    { "dur": 0.05, "proto": "udp", "sbytes": 64  }
  ]
}
```

**Response:**
```json
{
  "predictions": [ { ... }, { ... } ],
  "total": 2,
  "attack_count": 1,
  "normal_count": 1
}
```

---

## Risk Level Mapping

| Confidence | Risk Level |
|---|---|
| ≥ 85% | 🔴 High |
| 70% – 84% | 🟡 Medium |
| 50% – 69% | 🟢 Low |
| < 50% | ✅ Normal |

---

## Docker

```bash
# Build
docker build -t ai-threat-ml .

# Run
docker run -p 8000:8000 \
  -v $(pwd)/model:/app/model \
  -v $(pwd)/preprocessing:/app/preprocessing \
  ai-threat-ml
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server port |
| `ENV` | `development` | Set to `production` to disable reload |
| `MODEL_PATH` | `model/lstm_model.h5` | Path to trained model |
| `SCALER_PATH` | `preprocessing/scaler.pkl` | Path to saved scaler |
| `ENCODER_PATH` | `preprocessing/encoder.pkl` | Path to saved encoders |
