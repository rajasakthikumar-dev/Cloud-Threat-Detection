"""
End-to-end test script for the FastAPI ML service.
Runs every endpoint with real UNSW-NB15 test samples and
prints a clean PASS/FAIL report.

Usage:
    python3 ml-service/_run_tests.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

ML = os.path.dirname(os.path.abspath(__file__))

BASE = "http://localhost:8000"
PASS = "[PASS]"
FAIL = "[FAIL]"
failures = []


def http_get(path):
    url = BASE + path
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status, json.loads(r.read())


def http_post(path, payload):
    url = BASE + path
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check(label, condition, detail=""):
    if condition:
        print(f"  {PASS}  {label}")
    else:
        msg = f"{label}" + (f"  [{detail}]" if detail else "")
        print(f"  {FAIL}  {msg}")
        failures.append(msg)


# ─────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  AI Threat Detection — ML Service End-to-End Tests")
print("="*60)

# ── TEST 1: /health ──────────────────────────────────────────
print("\n[TEST 1] GET /health")
status, body = http_get("/health")
print(f"  HTTP {status}")
print(f"  Response: {json.dumps(body, indent=4)}")
check("HTTP 200",          status == 200)
check("status == ok",      body.get("status") == "ok")
check("model_loaded true", body.get("model_loaded") is True)
check("load_error null",   body.get("load_error") is None)
check("h5_exists true",    body.get("h5_exists") is True)

# ── TEST 2: /model/info ──────────────────────────────────────
print("\n[TEST 2] GET /model/info")
status, body = http_get("/model/info")
print(f"  HTTP {status}")
print(f"  n_features   : {body.get('n_features')}")
print(f"  input_shape  : {body.get('input_shape')}")
print(f"  inference    : {body.get('inference_engine')}")
check("HTTP 200",              status == 200)
check("n_features == 42",      body.get("n_features") == 42)
check("input_shape == [1,42]", body.get("input_shape") == [1, 42])
check("inference == pure-numpy", "numpy" in str(body.get("inference_engine", "")))
check("42 feature names",      len(body.get("feature_names", [])) == 42)

# ── TEST 3: /predict with real Normal sample ─────────────────
print("\n[TEST 3] POST /predict — Real Normal sample (test row 0, label=0)")
norm_path = os.path.join(ML, "_sample_normal.json")
with open(norm_path) as f:
    norm_payload = json.load(f)

print(f"  Sending {len(norm_payload['features'])} features, source_ip={norm_payload.get('source_ip')}")
status, body = http_post("/predict", norm_payload)
print(f"  HTTP {status}")
print(f"  Response: {json.dumps(body, indent=4)}")
check("HTTP 200",                     status == 200)
check("prediction field present",     "prediction" in body)
check("attack_type field present",    "attack_type" in body)
check("risk_level field present",     "risk_level" in body)
check("confidence_score 0-100",       0 <= body.get("confidence_score", -1) <= 100)
check("binary_prediction 0 or 1",     body.get("binary_prediction") in (0, 1))
check("probabilities Normal + Attack",
      abs(body.get("probabilities", {}).get("Normal", 0) +
          body.get("probabilities", {}).get("Attack", 0) - 100) < 0.1)
norm_pred = body.get("prediction")
print(f"  MODEL SAYS: {norm_pred}  (ground-truth: Normal)")

# ── TEST 4: /predict with real Attack sample ─────────────────
print("\n[TEST 4] POST /predict — Real Attack sample (test row 243, label=1)")
atk_path = os.path.join(ML, "_sample_attack.json")
with open(atk_path) as f:
    atk_payload = json.load(f)

print(f"  Sending {len(atk_payload['features'])} features, source_ip={atk_payload.get('source_ip')}")
status, body = http_post("/predict", atk_payload)
print(f"  HTTP {status}")
print(f"  Response: {json.dumps(body, indent=4)}")
check("HTTP 200",                     status == 200)
check("prediction field present",     "prediction" in body)
check("confidence_score 0-100",       0 <= body.get("confidence_score", -1) <= 100)
check("binary_prediction 0 or 1",     body.get("binary_prediction") in (0, 1))
atk_pred = body.get("prediction")
print(f"  MODEL SAYS: {atk_pred}  (ground-truth: Attack)")

# ── TEST 5: /predict/batch with both samples ─────────────────
print("\n[TEST 5] POST /predict/batch — 2 samples (Normal + Attack)")
batch_payload = {
    "records": [norm_payload["features"], atk_payload["features"]]
}
status, body = http_post("/predict/batch", batch_payload)
print(f"  HTTP {status}")
check("HTTP 200",                     status == 200)
check("total == 2",                   body.get("total") == 2)
check("predictions list len 2",       len(body.get("predictions", [])) == 2)
if body.get("predictions"):
    p0 = body["predictions"][0]
    p1 = body["predictions"][1]
    print(f"  Batch[0]: {p0.get('prediction')}  conf={p0.get('confidence_score'):.2f}%  (ground-truth: Normal)")
    print(f"  Batch[1]: {p1.get('prediction')}  conf={p1.get('confidence_score'):.2f}%  (ground-truth: Attack)")
    check("batch[0] has all fields",
          all(k in p0 for k in ("prediction","risk_level","confidence_score","binary_prediction")))
    check("batch[1] has all fields",
          all(k in p1 for k in ("prediction","risk_level","confidence_score","binary_prediction")))
print(f"  attack_count={body.get('attack_count')}  normal_count={body.get('normal_count')}")

# ── FINAL REPORT ─────────────────────────────────────────────
print("\n" + "="*60)
if failures:
    print(f"  RESULT: {len(failures)} FAILURE(S)")
    for f in failures:
        print(f"    ✗ {f}")
else:
    print("  RESULT: ALL TESTS PASSED ✓")
print("="*60 + "\n")
sys.exit(1 if failures else 0)
