"""
Full integration test: simulates React → Node.js → FastAPI → LSTM → React.

Uses a valid JWT (generated from the server's own secret) to bypass
Firebase auth while testing the actual ML pipeline end-to-end.
"""
import json, os, sys, subprocess, urllib.request, urllib.error

NODE   = "http://localhost:5000"
FASTAPI = "http://localhost:8000"
SERVER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server")

PASS = "[PASS]"
FAIL = "[FAIL]"
failures = []

def http_post(url, payload, headers=None):
    data = json.dumps(payload).encode()
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = {}
        try: body = json.loads(e.read())
        except: pass
        return e.code, body

def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = {}
        try: body = json.loads(e.read())
        except: pass
        return e.code, body

def check(label, condition, detail=""):
    if condition:
        print(f"  {PASS}  {label}")
    else:
        msg = label + (f"  [{detail}]" if detail else "")
        print(f"  {FAIL}  {msg}")
        failures.append(msg)

# ── Generate JWT from server secret ─────────────────────────
def get_token():
    result = subprocess.run(
        ["node", "_gen_token.js"],
        cwd=SERVER_DIR,
        capture_output=True, text=True, timeout=10
    )
    token = result.stdout.strip()
    if not token or "error" in token.lower():
        raise RuntimeError(f"Could not generate token: {result.stderr}")
    return token

print("\n" + "="*65)
print("  FULL INTEGRATION TEST")
print("  React (simulated) → Node.js → FastAPI → NumPy LSTM → React")
print("="*65)

# ── BLOCK A: FastAPI direct ──────────────────────────────────
print("\n── BLOCK A: FastAPI direct (/health, /model/info) ──────────")

print("\n[A1] GET http://localhost:8000/health")
status, body = http_get(f"{FASTAPI}/health")
print(f"  HTTP {status}  model_loaded={body.get('model_loaded')}  inference={body.get('inference')}")
check("FastAPI health 200",       status == 200)
check("FastAPI model_loaded true", body.get("model_loaded") is True)

print("\n[A2] GET http://localhost:8000/model/info")
status, body = http_get(f"{FASTAPI}/model/info")
print(f"  HTTP {status}  n_features={body.get('n_features')}  input_shape={body.get('input_shape')}")
check("model/info 200",           status == 200)
check("n_features == 42",         body.get("n_features") == 42)

# ── BLOCK B: FastAPI /predict with real test data ────────────
print("\n── BLOCK B: FastAPI /predict with real UNSW-NB15 test rows ─")

# Real Normal sample (test row 0, label=0) — load from saved JSON
ML = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(ML, "_sample_normal.json")) as f:
    norm = json.load(f)
with open(os.path.join(ML, "_sample_attack.json")) as f:
    atk  = json.load(f)

print(f"\n[B1] POST /predict — Normal sample (test row 0, label=0)")
status, body = http_post(f"{FASTAPI}/predict", norm)
print(f"  HTTP {status}")
print(f"  prediction={body.get('prediction')}  risk={body.get('risk_level')}  "
      f"confidence={body.get('confidence_score')}%  binary={body.get('binary_prediction')}")
print(f"  probabilities: Normal={body.get('probabilities',{}).get('Normal')}%  "
      f"Attack={body.get('probabilities',{}).get('Attack')}%")
check("B1 HTTP 200",              status == 200)
check("B1 prediction field",      "prediction" in body)
check("B1 confidence 0-100",      0 <= body.get("confidence_score", -1) <= 100)

print(f"\n[B2] POST /predict — Attack sample (test row 243, label=1)")
status, body = http_post(f"{FASTAPI}/predict", atk)
print(f"  HTTP {status}")
print(f"  prediction={body.get('prediction')}  risk={body.get('risk_level')}  "
      f"confidence={body.get('confidence_score')}%  binary={body.get('binary_prediction')}")
print(f"  probabilities: Normal={body.get('probabilities',{}).get('Normal')}%  "
      f"Attack={body.get('probabilities',{}).get('Attack')}%")
check("B2 HTTP 200",              status == 200)
check("B2 prediction field",      "prediction" in body)
check("B2 confidence 0-100",      0 <= body.get("confidence_score", -1) <= 100)

# ── BLOCK C: Node.js health ──────────────────────────────────
print("\n── BLOCK C: Node.js ────────────────────────────────────────")

print("\n[C1] GET http://localhost:5000/health")
status, body = http_get(f"{NODE}/health")
print(f"  HTTP {status}  →  {body}")
check("Node.js health 200",       status == 200)
check("Node.js status ok",        body.get("status") == "ok")

# ── BLOCK D: Node.js → FastAPI (with JWT) ───────────────────
print("\n── BLOCK D: Node.js → FastAPI → LSTM  (with JWT) ──────────")

print("\n  Generating test JWT from server secret...")
token = get_token()
print(f"  Token: {token[:45]}...")
auth = {"Authorization": f"Bearer {token}"}

# Use Attack sample features
attack_features = atk["features"]

print(f"\n[D1] POST /api/threats/analyze  →  Node.js :5000 → FastAPI :8000 → LSTM")
print(f"     Sample: Attack features (42 cols), source_ip=192.168.1.100")
payload = {"features": attack_features, "source_ip": "192.168.1.100"}
status, body = http_post(f"{NODE}/api/threats/analyze", payload, headers=auth)
print(f"  HTTP {status}")
print(f"  Response:\n{json.dumps(body, indent=4)}")

check("D1 analyze HTTP 200",      status == 200,
      f"got {status}: {body.get('message', str(body))[:80]}")
check("D1 attack_type present",   "attack_type" in body)
check("D1 risk_level present",    "risk_level" in body)
check("D1 confidence_score",      "confidence_score" in body)

if "attack_type" in body:
    print(f"\n  ✓ Full chain result:")
    print(f"    attack_type      = {body['attack_type']}")
    print(f"    risk_level       = {body['risk_level']}")
    print(f"    confidence_score = {body['confidence_score']}%")
    print(f"    ground-truth     = Attack (label=1)")

# Normal sample too
print(f"\n[D2] POST /api/threats/analyze  →  Normal features")
norm_features = norm["features"]
payload2 = {"features": norm_features, "source_ip": "10.0.0.1"}
status2, body2 = http_post(f"{NODE}/api/threats/analyze", payload2, headers=auth)
print(f"  HTTP {status2}")
print(f"  Response:\n{json.dumps(body2, indent=4)}")
check("D2 analyze HTTP 200",      status2 == 200,
      f"got {status2}: {body2.get('message', str(body2))[:80]}")
check("D2 attack_type present",   "attack_type" in body2)

if "attack_type" in body2:
    print(f"\n  ✓ Full chain result:")
    print(f"    attack_type      = {body2['attack_type']}")
    print(f"    risk_level       = {body2['risk_level']}")
    print(f"    confidence_score = {body2['confidence_score']}%")
    print(f"    ground-truth     = Normal (label=0)")

# ── FINAL REPORT ─────────────────────────────────────────────
print("\n" + "="*65)
if failures:
    print(f"  RESULT: {len(failures)} FAILURE(S)")
    for f in failures:
        print(f"    ✗ {f}")
    sys.exit(1)
else:
    print("  ALL CHECKS PASSED ✓")
    print()
    print("  Verified flow:")
    print("  [Client]  POST /predict          → FastAPI :8000  ✓")
    print("  [Client]  GET  /health           → FastAPI :8000  ✓")
    print("  [Client]  GET  /model/info       → FastAPI :8000  ✓")
    print("  [Client]  POST /api/threats/analyze → Node.js :5000")
    print("                → FastAPI :8000 /predict")
    print("                → NumPy LSTM")
    print("                → JSON {attack_type, risk_level, confidence_score}")
    print("                → back to client  ✓")
print("="*65 + "\n")
