import pandas as pd
import numpy as np
import sys
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

train = pd.read_parquet('dataset/train-00000-of-00001.parquet')
test  = pd.read_parquet('dataset/test-00000-of-00001.parquet')

print('=== TRAIN ===')
print('Shape:', train.shape)
print('Columns:', train.columns.tolist())
print()
print('dtypes:')
print(train.dtypes.to_string())
print()
print('Missing values:')
missing = train.isnull().sum()
print(missing[missing > 0].to_string() if missing.sum() > 0 else 'None')
print()
print('Label distribution:')
print(train['label'].value_counts())
print()
print('=== TEST ===')
print('Shape:', test.shape)
print()
print('Test label distribution:')
print(test['label'].value_counts())
print()
print('=== ATTACK_CAT ===')
if 'attack_cat' in train.columns:
    print('Unique values:', train['attack_cat'].unique())
    print()
    print('Value counts:')
    print(train['attack_cat'].value_counts())
else:
    print('attack_cat column NOT present')

print()
print('=== CATEGORICAL COLUMNS ===')
cat_cols = [c for c in train.columns if train[c].dtype == 'object']
print('Object dtype columns:', cat_cols)
for c in cat_cols:
    print(f'  {c}: {train[c].unique()[:10]}')
