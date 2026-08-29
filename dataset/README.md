# Dataset Directory

## UNSW-NB15 Dataset

This project uses the **UNSW-NB15** dataset, a comprehensive network intrusion detection dataset created by the Cyber Range Lab of UNSW Canberra.

## Download Instructions

1. Visit the official dataset page:
   - https://research.unsw.edu.au/projects/unsw-nb15-dataset
   - Or: https://www.kaggle.com/datasets/mrwellsdavid/unsw-nb15

2. Download the following CSV files:
   - `UNSW_NB15_training-set.csv`
   - `UNSW_NB15_testing-set.csv`

3. Place both files in this `dataset/` folder:
   ```
   AI-Threat-Detection/
   └── dataset/
       ├── UNSW_NB15_training-set.csv
       ├── UNSW_NB15_testing-set.csv
       └── processed/          ← auto-generated after preprocessing
   ```

## Dataset Overview

| Property        | Details                              |
|-----------------|--------------------------------------|
| Records         | ~2.5 million network connections     |
| Features        | 49 features + 1 label                |
| Attack Types    | 9 attack categories + Normal traffic |
| Task Type       | Binary Classification (Normal/Attack)|

## Attack Categories

- **Fuzzers** – Sending random/invalid data to crash systems
- **Analysis** – Port scans, spam, HTML file penetration
- **Backdoors** – Techniques to bypass security mechanisms
- **DoS** – Denial of Service attacks
- **Exploits** – Known vulnerability exploitation
- **Generic** – Attacks on block cipher algorithms
- **Reconnaissance** – Probing and scanning attacks
- **Shellcode** – Small code snippets for shell execution
- **Worms** – Self-replicating malware

## Label Column

- `label = 0` → Normal traffic
- `label = 1` → Attack traffic

## Processed Files

After running `preprocessing/preprocess.py`, the following files will appear in `dataset/processed/`:

```
processed/
├── X_train.npy    ← Training features (LSTM format)
├── X_test.npy     ← Testing features (LSTM format)
├── y_train.npy    ← Training labels
└── y_test.npy     ← Testing labels
```
