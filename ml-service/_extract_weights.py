"""
Extract weights from the Keras 3.x h5 model file into a plain numpy archive.
This lets us run inference with pure numpy + no TensorFlow dependency.

Run once:
    python3 ml-service/_extract_weights.py

Output:
    ml-service/model/saved_models/model_weights.npz
    ml-service/model/saved_models/model_info.json
"""

import os
import json
import h5py
import numpy as np

H5_PATH  = os.path.join(os.path.dirname(__file__),
                        "model", "saved_models", "lstm_threat_detection.h5")
NPZ_PATH = os.path.join(os.path.dirname(__file__),
                        "model", "saved_models", "model_weights.npz")
JSON_PATH = os.path.join(os.path.dirname(__file__),
                         "model", "saved_models", "model_info.json")

def read_all_weights(h5, prefix=""):
    """Recursively collect all weight arrays from h5 group."""
    weights = {}
    for key in h5.keys():
        full_key = f"{prefix}/{key}" if prefix else key
        item = h5[key]
        if isinstance(item, h5py.Dataset):
            weights[full_key] = item[()]
        elif isinstance(item, h5py.Group):
            weights.update(read_all_weights(item, full_key))
    return weights

with h5py.File(H5_PATH, "r") as h5:
    # Parse model config
    raw_cfg = h5.attrs["model_config"]
    if isinstance(raw_cfg, bytes):
        raw_cfg = raw_cfg.decode("utf-8")
    cfg = json.loads(raw_cfg)

    # Read model config
    model_cfg = cfg.get("config", {})
    layers = model_cfg.get("layers", [])

    print("=== MODEL CONFIG ===")
    print("Name:", model_cfg.get("name"))
    print("Input shape:", None)

    layer_info = []
    for L in layers:
        cn = L.get("class_name")
        lc = L.get("config", {})
        info = {"class_name": cn, "name": lc.get("name"), "config": lc}
        if cn == "InputLayer":
            info["batch_shape"] = lc.get("batch_shape")
            print(f"  InputLayer   batch_shape={lc.get('batch_shape')}")
        elif cn == "LSTM":
            print(f"  LSTM         units={lc.get('units')}  return_sequences={lc.get('return_sequences')}")
        elif cn == "Dense":
            print(f"  Dense        units={lc.get('units')}  activation={lc.get('activation')}")
        elif cn == "Dropout":
            print(f"  Dropout      rate={lc.get('rate')}")
        elif cn == "BatchNormalization":
            print(f"  BatchNorm    axis={lc.get('axis')}")
        layer_info.append(info)

    # Read all weights
    print("\n=== READING WEIGHTS ===")
    all_weights = read_all_weights(h5["model_weights"])

    # Print weight names and shapes
    for name, arr in all_weights.items():
        print(f"  {name}  {arr.shape}  {arr.dtype}")

    # Save weights as npz
    np.savez(NPZ_PATH, **{k.replace("/", "__"): v for k, v in all_weights.items()})
    print(f"\nWeights saved to {NPZ_PATH}")

    # Save model info as JSON
    model_info = {
        "class_name": cfg.get("class_name"),
        "layers": layer_info,
        "input_shape": [None, 1, 42],
        "output_shape": [None, 1],
        "output_activation": "sigmoid",
        "n_features": 42,
        "timesteps": 1,
        "binary": True,
        "keras_version": h5.attrs.get("keras_version", "unknown"),
        "backend": h5.attrs.get("backend", "tensorflow"),
    }
    with open(JSON_PATH, "w") as f:
        json.dump(model_info, f, indent=2)
    print(f"Model info saved to {JSON_PATH}")

print("\nDone.")
