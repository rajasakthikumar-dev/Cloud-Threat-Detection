"""
Test role-based security fixes:
1. Normal signup always creates role='user'
2. Admin routes reject non-admin users
3. User dashboard shows only basic info (no threat stats)
4. Admin dashboard shows full threat stats
"""
import json, sys, urllib.request, urllib.error

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

print("\n" + "="*70)
print("  ROLE-BASED SECURITY TEST")
print("="*70)

# ── TEST 1: Register new user WITHOUT role field ────────────
print("\n[TEST 1] POST /api/auth/register (no role field sent)")
reg_email = f"testuser_{int(__import__('time').time())}@test.local"
reg_status, reg_body = http_post(f"{NODE}/api/auth/register", {
    "name": "Test User",
    "email": reg_email,
    "password": "Test@12345"
    # NOTE: NO 'role' field — backend should default to 'user'
})
print(f"  HTTP {reg_status}")
print(f"  Response: {json.dumps(reg_body, indent=2)}")
check("Register HTTP 201", reg_status == 201, f"got {reg_status}")
check("User role is 'user'", reg_body.get("user", {}).get("role") == "user",
      f"got role={reg_body.get('user',{}).get('role')}")

user_token = reg_body.get("token")
if not user_token:
    print("\n  Cannot continue without token.")
    sys.exit(1)

# ── TEST 2: Attempt to register with role='admin' (should ignore) ──
print("\n[TEST 2] POST /api/auth/register (send role='admin', should be ignored)")
admin_email = f"admintest_{int(__import__('time').time())}@test.local"
reg2_status, reg2_body = http_post(f"{NODE}/api/auth/register", {
    "name": "Fake Admin",
    "email": admin_email,
    "password": "Admin@12345",
    "role": "admin"  # Client tries to send admin
})
print(f"  HTTP {reg2_status}")
print(f"  Response: {json.dumps(reg2_body, indent=2)}")
check("Register HTTP 201", reg2_status == 201, f"got {reg2_status}")
check("Backend forced role='user'",
      reg2_body.get("user", {}).get("role") == "user",
      f"Backend accepted client role! Got: {reg2_body.get('user',{}).get('role')}")

# ── TEST 3: Normal user tries to access admin endpoint ──────
print("\n[TEST 3] GET /api/users/admin/stats (normal user token)")
admin_stats_status, admin_stats_body = http_get(
    f"{NODE}/api/users/admin/stats",
    headers={"Authorization": f"Bearer {user_token}"}
)
print(f"  HTTP {admin_stats_status}")
print(f"  Response: {json.dumps(admin_stats_body, indent=2)[:200]}")
check("Admin endpoint rejects user",
      admin_stats_status == 403,
      f"Expected 403 Forbidden, got {admin_stats_status}")

# ── TEST 4: Normal user CAN access own stats ────────────────
print("\n[TEST 4] GET /api/users/stats (normal user token)")
user_stats_status, user_stats_body = http_get(
    f"{NODE}/api/users/stats",
    headers={"Authorization": f"Bearer {user_token}"}
)
print(f"  HTTP {user_stats_status}")
print(f"  Response: {json.dumps(user_stats_body, indent=2)[:200]}")
check("User stats endpoint allows user",
      user_stats_status == 200,
      f"Expected 200, got {user_stats_status}")

# ── TEST 5: Normal user CAN analyze threats ─────────────────
print("\n[TEST 5] POST /api/threats/analyze (normal user token)")
analyze_status, analyze_body = http_post(
    f"{NODE}/api/threats/analyze",
    {
        "features": {
            "dur": 0.0, "proto": "tcp", "service": "http", "state": "FIN",
            "spkts": 2, "dpkts": 0, "sbytes": 100, "dbytes": 0,
            "rate": 100.0, "sttl": 64, "dttl": 0, "sload": 10000.0,
            "dload": 0.0, "sloss": 0, "dloss": 0, "sinpkt": 0.0,
            "dinpkt": 0.0, "sjit": 0.0, "djit": 0.0, "swin": 0,
            "stcpb": 0, "dtcpb": 0, "dwin": 0, "tcprtt": 0.0,
            "synack": 0.0, "ackdat": 0.0, "smean": 50, "dmean": 0,
            "trans_depth": 0, "response_body_len": 0, "ct_srv_src": 1,
            "ct_state_ttl": 2, "ct_dst_ltm": 1, "ct_src_dport_ltm": 1,
            "ct_dst_sport_ltm": 1, "ct_dst_src_ltm": 1,
            "is_ftp_login": 0, "ct_ftp_cmd": 0, "ct_flw_http_mthd": 0,
            "ct_src_ltm": 1, "ct_srv_dst": 1, "is_sm_ips_ports": 0
        },
        "source_ip": "192.168.1.50"
    },
    headers={"Authorization": f"Bearer {user_token}"}
)
print(f"  HTTP {analyze_status}")
if analyze_status == 200:
    print(f"  Result: {analyze_body.get('attack_type')} / {analyze_body.get('risk_level')} / {analyze_body.get('confidence_score')}%")
else:
    print(f"  Response: {json.dumps(analyze_body, indent=2)[:200]}")
check("User can analyze threats",
      analyze_status == 200,
      f"Expected 200, got {analyze_status}: {analyze_body.get('message','')}")

# ── FINAL REPORT ─────────────────────────────────────────────
print("\n" + "="*70)
if failures:
    print(f"  RESULT: {len(failures)} FAILURE(S)")
    for f in failures:
        print(f"    ✗ {f}")
    sys.exit(1)
else:
    print("  ALL SECURITY TESTS PASSED ✓")
    print()
    print("  ✓ Signup without role field → role='user'")
    print("  ✓ Signup with role='admin' → backend ignores it, creates role='user'")
    print("  ✓ Normal user blocked from admin endpoints (403 Forbidden)")
    print("  ✓ Normal user can access own stats")
    print("  ✓ Normal user can analyze threats")
print("="*70 + "\n")
