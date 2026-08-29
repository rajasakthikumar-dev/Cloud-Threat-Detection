import platform
import struct
import subprocess
import os

print("Python version  :", platform.python_version())
print("Architecture    :", platform.machine())
print("Pointer bits    :", struct.calcsize("P") * 8)

# CPU flags
flags = []
try:
    with open("/proc/cpuinfo") as f:
        for line in f:
            if line.startswith("flags"):
                flags = line.split(":")[1].strip().split()
                break
except Exception:
    pass

want = ["avx", "avx2", "avx512f", "sse4_1", "sse4_2", "fma"]
print("\nRelevant CPU flags:")
for w in want:
    present = w in flags
    print(f"  {w:<12} : {'YES' if present else 'NO'}")

# Check TF wheel tag
try:
    import importlib.metadata as im
    meta = im.metadata("tensorflow")
    print("\nTF package name :", meta.get("Name"))
    print("TF version      :", meta.get("Version"))
except Exception as e:
    print("Could not read TF metadata:", e)

# Check what instruction the crash uses
ldd_out = subprocess.run(
    ["ldd", "/usr/local/lib/python3.10/dist-packages/tensorflow/python/_pywrap_tensorflow_internal.so"],
    capture_output=True, text=True
)
print("\nldd output (first 10 lines):")
for line in ldd_out.stdout.splitlines()[:10]:
    print(" ", line)
