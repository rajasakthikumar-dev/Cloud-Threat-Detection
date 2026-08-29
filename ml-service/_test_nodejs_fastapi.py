"""
Test: React → Node.js → FastAPI → NumPy LSTM → Node.js → React

Since we can't run a browser here, we simulate the React client
with Python HTTP calls through the exact same path.

Flow:
  1. POST /api/auth/register  → create test user
  2. POST /api/auth/login     → get JWT token
  3. POST /api/threats/analyze (with JWT)  → Node.js proxies to FastAPI /predict
  4. Verify the LSTM prediction comes back through Node.js
"""
import json, sys, urllib.request, urllib.error, urllib.parse

NODE = "http://localhost:5000"
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
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read())
        except Exception:
            pass
        return e.code, body

def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read())
        except Exception:
            pass
        return e.code, body

def check(label, condition, detail=""):
    if condition:
        print(f"  {PASS}  {label}")
    else:
        msg = label + (f"  [{detail}]" if detail else "")
        print(f"  {FAIL}  {msg}")
        failures.append(msg)

print("\n" + "="*65)
print("  Node.js → FastAPI → NumPy LSTM Integration Test")
print("="*65)

# ── Step 1: Check Node.js health ─────────────────────────────
print("\n[STEP 1] GET http://localhost:5000/health  (Node.js)")
status, body = http_get(f"{NODE}/health")
print(f"  HTTP {status}  →  {body}")
check("Node.js HTTP 200", status == 200)
check("Node.js status ok", body.get("status") == "ok")

# ── Step 2: Register test user ───────────────────────────────
print("\n[STEP 2] POST /api/auth/register  (create test user)")
reg_status, reg_body = http_post(f"{NODE}/api/auth/register", {
    "name": "TestUser",
    "email": "testuser@aithreat.local",
    "password": "Test@12345",
    "role": "user"
})
print(f"  HTTP {reg_status}  →  {json.dumps(reg_body)[:120]}")
# 201 = created, 409 = already exists — both are fine
check("Register 201 or 409", reg_status in (201, 409),
      f"got {reg_status}: {reg_body.get('message','')}")

# ── Step 3: Login ────────────────────────────────────────────
print("\n[STEP 3] POST /api/auth/login  (get JWT token)")
login_status, login_body = http_post(f"{NODE}/api/auth/login", {
    "email": "testuser@aithreat.local",
    "password": "Test@12345"
})
print(f"  HTTP {login_status}  →  {json.dumps(login_body)[:120]}")
check("Login HTTP 200", login_status == 200, f"got {login_status}")
token = login_body.get("token", "")
check("JWT token received", bool(token), f"body={login_body.get('message','')}")

if not token:
    print("\n  Cannot continue without JWT token.")
    sys.exit(1)

auth_header = {"Authorization": f"Bearer {token}"}
print(f"  Token: {token[:30]}...")

# ── Step 4: Node.js → FastAPI predict ────────────────────────
print("\n[STEP 4] POST /api/threats/analyze  (Node.js → FastAPI → LSTM)")
print("         Using real Attack sample (test row 243, label=1)")

attack_features = {
    "ackdat": 0.0, "ct_dst_ltm": 1, "ct_dst_sport_ltm": 1,
    "ct_dst_src_ltm": 2, "ct_flw_http_mthd": 0, "ct_ftp_cmd": 0,
    "ct_src_dport_ltm": 1, "ct_src_ltm": 1, "ct_srv_dst": 1,
    "ct_srv_src": 1, "ct_state_ttl": 4, "dbytes": 0, "dinpkt": 0.0,
    "djit": 0.0, "dload": 0.0, "dloss": 0, "dmean": 0, "dpkts": 0,
    "dtcpb": 0, "dttl": 0, "dur": 0.0, "dwin": 0, "is_ftp_login": 0,
    "is_sm_ips_ports": 0, "proto": "udp", "rate": 0.0,
    "response_body_len": 0, "sbytes": 232, "service": "-",
    "sinpkt": 0.0, "sjit": 0.0, "sload": 0.0, "sloss": 0,
    "smean": 232, "spkts": 1, "state": "INT", "stcpb": 0,
    "sttl": 64, "swin": 0, "synack": 0.0, "tcprtt": 0.0, "trans_depth": 0,
}

analyze_payload = {
    "features": attack_features,
    "source_ip": "192.168.1.100"
}

analyze_status, analyze_body = http_post(
    f"{NODE}/api/threats/analyze",
    analyze_payload,
    headers=auth_header
)
print(f"  HTTP {analyze_status}")
print(f"  Response: {json.dumps(analyze_body, indent=4)}")

check("Analyze HTTP 200",              analyze_status == 200,
      f"got {analyze_status}: {analyze_body.get('message','')}")
check("attack_type present",           "attack_type" in analyze_body)
check("risk_level present",            "risk_level" in analyze_body)
check("confidence_score present",      "confidence_score" in analyze_body)
check("message present",               "message" in analyze_body)

if "attack_type" in analyze_body:
    print(f"\n  LSTM says: {analyze_body['attack_type']}  "
          f"Risk={analyze_body.get('risk_level')}  "
          f"Confidence={analyze_body.get('confidence_score')}%")
    print(f"  Ground-truth: Attack (label=1)")

# ── Step 5: Normal sample through full stack ─────────────────
print("\n[STEP 5] POST /api/threats/analyze  (Node.js → FastAPI → LSTM)")
print("         Using real Normal sample (test row 0, label=0)")

normal_features = {
    "ackdat": 0.0, "ct_dst_ltm": 1, "ct_dst_sport_ltm": 1,
    "ct_dst_src_ltm": 2, "ct_flw_http_mthd": 0, "ct_ftp_cmd": 0,
    "ct_src_dport_ltm": 1, "ct_src_ltm": 1, "ct_srv_dst": 1,
    "ct_srv_src": 1, "ct_state_ttl": 2, "dbytes": 5200, "dinpkt": 0.250,
    "djit": 0.0, "dload": 265842.15, "dloss": 0, "dmean": 520, "dpkts": 10,
    "dtcpb": 2571868052, "dttl": 252, "dur": 0.156494, "dwin": 255,
    "is_ftp_login": 0, "is_sm_ips_ports": 0, "proto": "tcp", "rate": 95854.0,
    "response_body_len": 0, "sbytes": 2360, "service": "http",
    "sinpkt": 0.071, "sjit": 0.0, "sload": 120713.9, "sloss": 0,
    "smean": 168, "spkts": 14, "state": "FIN", "stcpb": 2478785512,
    "sttl": 63, "swin": 255, "synack": 0.021, "tcprtt": 0.021, "trans_depth": 1,
}

norm_payload = {"features": normal_features, "source_ip": "10.0.0.1"}

norm_status, norm_body = http_post(
    f"{NODE}/api/threats/analyze",
    norm_payload,
    headers=auth_header
)
print(f"  HTTP {norm_status}")
print(f"  Response: {json.dumps(norm_body, indent=4)}")
check("Normal analyze HTTP 200", norm_status == 200,
      f"got {norm_status}: {norm_body.get('message','')}")

if "attack_type" in norm_body:
    print(f"\n  LSTM says: {norm_body['attack_type']}  "
          f"Risk={norm_body.get('risk_level')}  "
          f"Confidence={norm_body.get('confidence_score')}%")
    print(f"  Ground-truth: Normal (label=0)")

# ── FINAL REPORT ─────────────────────────────────────────────
print("\n" + "="*65)
if failures:
    print(f"  RESULT: {len(failures)} FAILURE(S)")
    for f in failures:
        print(f"    ✗ {f}")
else:
    print("  RESULT: ALL STEPS PASSED ✓")
    print()
    print("  Complete flow verified:")
    print("  [Python/React client] → POST /api/threats/analyze")
    print("  → [Node.js :5000]     → POST /predict to FastAPI")
    print("  → [FastAPI :8000]     → NumpyLSTMPredictor.predict_single()")
    print("  → [NumPy LSTM]        → prediction result")
    print("  → [FastAPI :8000]     → JSON response")
    print("  → [Node.js :5000]     → JSON response  ")
    print("  → [Python/React]      → attack_type + risk_level + confidence")
print("="*65 + "\n")
sys.exit(1 if failures else 0)
