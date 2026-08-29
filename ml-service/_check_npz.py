import numpy as np, json, os

npz  = os.path.join(os.path.dirname(__file__), "model", "saved_models", "model_weights.npz")
info = os.path.join(os.path.dirname(__file__), "model", "saved_models", "model_info.json")

print("npz  exists:", os.path.exists(npz),  os.path.getsize(npz)  if os.path.exists(npz)  else 0, "bytes")
print("info exists:", os.path.exists(info), os.path.getsize(info) if os.path.exists(info) else 0, "bytes")

if os.path.exists(npz):
    d = np.load(npz)
    print("weight keys:", sorted(d.keys()))
    for k in sorted(d.keys()):
        print(f"  {k}: {d[k].shape}  {d[k].dtype}")

if os.path.exists(info):
    with open(info) as f:
        m = json.load(f)
    print("\nmodel_info:")
    for k, v in m.items():
        if k != "layers":
            print(f"  {k}: {v}")
