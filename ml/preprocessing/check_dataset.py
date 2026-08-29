import pandas as pd

train = pd.read_parquet("dataset/train-00000-of-00001.parquet")
test = pd.read_parquet("dataset/test-00000-of-00001.parquet")

print("=" * 60)
print("TRAIN DATASET")
print("=" * 60)

print("Shape:")
print(train.shape)

print("\nColumns:")
print(train.columns.tolist())

print("\nData Types:")
print(train.dtypes)

print("\nFirst 5 Rows:")
print(train.head())

print("\nMissing Values:")
print(train.isnull().sum())

print("\n" + "=" * 60)
print("TEST DATASET")
print("=" * 60)

print("Shape:")
print(test.shape)