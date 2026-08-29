"""
Quick smoke test for NumpyLSTMPredictor.
Run from ml-service/ directory:
    python3 _test_predictor.py
"""
import os, sys, logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")

ML = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ML)

from model.numpy_predictor import NumpyLSTMPredictor

PROJ = os.path.dirname(ML)   # AI-Threat-Detection/AI-Threat-Detection/

predictor = NumpyLSTMPredictor(
    npz_path       = os.path.join(ML,   "model", "saved_models", "model_weights.npz"),
    scaler_path    = os.path.join(ML,   "preprocessing", "processed", "scaler.pkl"),
    encoder_path   = os.path.join(ML,   "preprocessing", "processed", "encoder.pkl"),
    feat_names_path= os.path.join(PROJ, "dataset", "processed", "feature_names.pkl"),
)

# Sample normal-ish traffic
normal_features = {
    "dur": 0.000011, "proto": "tcp", "service": "http", "state": "FIN",
    "spkts": 2, "dpkts": 0, "sbytes": 200, "dbytes": 0,
    "rate": 90909.09, "sttl": 254, "dttl": 0, "sload": 72727272.0,
    "dload": 0.0, "sloss": 0, "dloss": 0, "sinpkt": 0.0, "dinpkt": 0.0,
    "sjit": 0.0, "djit": 0.0, "swin": 0, "stcpb": 0, "dtcpb": 0,
    "dwin": 0, "tcprtt": 0.0, "synack": 0.0, "ackdat": 0.0,
    "smean": 100, "dmean": 0, "trans_depth": 0, "response_body_len": 0,
    "ct_srv_src": 1, "ct_state_ttl": 2, "ct_dst_ltm": 1,
    "ct_src_dport_ltm": 1, "ct_dst_sport_ltm": 1, "ct_dst_src_ltm": 1,
    "is_ftp_login": 0, "ct_ftp_cmd": 0, "ct_flw_http_mthd": 0,
    "ct_src_ltm": 1, "ct_srv_dst": 1, "is_sm_ips_ports": 0,
}

print("\n=== Single prediction (normal-ish traffic) ===")
result = predictor.predict_single(normal_features)
for k, v in result.items():
    print(f"  {k}: {v}")

# Sample attack-like traffic
attack_features = {**normal_features, "rate": 0.0, "sbytes": 0,
                   "dbytes": 0, "spkts": 0, "dpkts": 0, "proto": "udp"}

print("\n=== Single prediction (attack-like traffic) ===")
result2 = predictor.predict_single(attack_features)
for k, v in result2.items():
    print(f"  {k}: {v}")

# Batch prediction
print("\n=== Batch prediction (2 samples) ===")
batch = predictor.predict_batch([normal_features, attack_features])
for i, r in enumerate(batch):
    print(f"  Sample {i+1}: prediction={r['prediction']}  confidence={r['confidence_score']:.2f}%")

print("\nAll tests passed.")
