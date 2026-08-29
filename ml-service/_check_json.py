import json, os
ML = os.path.dirname(os.path.abspath(__file__))
for fname in ("_sample_normal.json", "_sample_attack.json"):
    path = os.path.join(ML, fname)
    with open(path) as f:
        d = json.load(f)
    print(f"\n{fname}")
    print(f"  top-level keys: {list(d.keys())}")
    feats = d.get("features", {})
    print(f"  features count: {len(feats)}")
    print(f"  first 3: {list(feats.items())[:3]}")
    # Check for any non-serialisable values
    for k, v in feats.items():
        if not isinstance(v, (int, float, str, bool, type(None))):
            print(f"  BAD TYPE: {k}={v!r} ({type(v).__name__})")
