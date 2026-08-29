"""Read h5 model config without loading TensorFlow at all."""
import h5py
import json

H5 = "/home/rajasakthikumar/AI-Threat-Detection/AI-Threat-Detection/ml-service/model/saved_models/lstm_threat_detection.h5"

with h5py.File(H5, "r") as h5:
    print("Root keys     :", list(h5.keys()))
    print("Root attr keys:", list(h5.attrs.keys()))

    if "model_config" in h5.attrs:
        raw = h5.attrs["model_config"]
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        cfg = json.loads(raw)
        print("\nTop-level class_name:", cfg.get("class_name"))
        layers = cfg.get("config", {}).get("layers", [])
        print(f"\nLayers ({len(layers)} total):")
        for L in layers:
            cn = L.get("class_name", "?")
            lc = L.get("config", {})
            name = lc.get("name", "?")
            extra = ""
            if cn == "InputLayer":
                extra = f"  batch_input_shape={lc.get('batch_input_shape')}"
            elif cn == "LSTM":
                extra = f"  units={lc.get('units')}  return_seq={lc.get('return_sequences')}"
            elif cn == "Dense":
                extra = f"  units={lc.get('units')}  activation={lc.get('activation')}"
            elif cn == "Dropout":
                extra = f"  rate={lc.get('rate')}"
            elif cn == "BatchNormalization":
                extra = f"  axis={lc.get('axis')}"
            print(f"  {cn:<22} {name:<16}{extra}")
    else:
        print("No model_config attr found.")

    # Try to find keras version it was saved with
    if "keras_version" in h5.attrs:
        print("\nKeras version (saved with):", h5.attrs["keras_version"])
    if "backend" in h5.attrs:
        print("Backend:", h5.attrs["backend"])
    if "tf_keras_version" in h5.attrs:
        print("TF-Keras version:", h5.attrs["tf_keras_version"])
    # Print ALL attrs
    print("\nAll root attrs:")
    for k, v in h5.attrs.items():
        print(f"  {k}: {v!r}")
