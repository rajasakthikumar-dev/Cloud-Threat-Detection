"""
utils/metrics.py
-----------------
Evaluation functions for binary and multiclass threat detection.

Outputs:
  - Console metrics: accuracy, precision, recall, F1
  - results/reports/classification_report.txt
  - results/graphs/training_history.png  (combined accuracy + loss)
  - results/graphs/accuracy_curve.png    (accuracy only)
  - results/graphs/loss_curve.png        (loss only)
  - results/graphs/confusion_matrix.png

Usage:
    from utils.metrics import evaluate_model, plot_confusion_matrix, plot_training_history
"""

import os
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")   # non-interactive backend — safe for server/script use
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import (
    REPORTS_DIR, GRAPHS_DIR,
    CLASSIFICATION_REPORT,
    TRAINING_HISTORY_PLOT,
    ACCURACY_CURVE_PLOT,
    LOSS_CURVE_PLOT,
    CONFUSION_MATRIX_PLOT,
    ATTACK_CATEGORIES,
)
from utils.logger import get_logger

logger = get_logger("metrics")

# ─────────────────────────────────────────────────────────────
# EVALUATION
# ─────────────────────────────────────────────────────────────

def evaluate_model(
    y_true,
    y_pred,
    multiclass: bool = False,
    save_report: bool = True,
    report_path: str = CLASSIFICATION_REPORT,
):
    """
    Compute and display accuracy, precision, recall, F1-score.
    Saves a text classification report.

    Parameters
    ----------
    y_true      : array-like of true labels
    y_pred      : array-like of predicted labels
    multiclass  : if True, uses macro averaging and ATTACK_CATEGORIES names
    save_report : save report to disk
    report_path : output file path

    Returns
    -------
    dict with keys: accuracy, precision, recall, f1
    """
    avg = "macro" if multiclass else "binary"
    target_names = ATTACK_CATEGORIES if multiclass else ["Normal", "Attack"]

    accuracy  = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average=avg, zero_division=0)
    recall    = recall_score(y_true, y_pred, average=avg, zero_division=0)
    f1        = f1_score(y_true, y_pred, average=avg, zero_division=0)

    # Adjust target_names to only include labels present in y_true/y_pred
    present_labels = sorted(set(list(y_true) + list(y_pred)))
    if multiclass:
        display_names = [
            ATTACK_CATEGORIES[i] for i in present_labels
            if i < len(ATTACK_CATEGORIES)
        ]
    else:
        display_names = target_names

    report_str = classification_report(
        y_true, y_pred,
        labels=present_labels,
        target_names=display_names,
        zero_division=0,
    )

    # ── Console output ─────────────────────────────────────────────────
    logger.info("=" * 52)
    logger.info("  MODEL EVALUATION METRICS")
    logger.info("=" * 52)
    logger.info(f"  Accuracy  : {accuracy:.4f}  ({accuracy*100:.2f}%)")
    logger.info(f"  Precision : {precision:.4f}  (avg={avg})")
    logger.info(f"  Recall    : {recall:.4f}  (avg={avg})")
    logger.info(f"  F1-Score  : {f1:.4f}  (avg={avg})")
    logger.info("=" * 52)
    logger.info("Detailed Classification Report:\n" + report_str)

    # ── Save report ────────────────────────────────────────────────────
    if save_report:
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, "w") as fh:
            fh.write("MODEL EVALUATION METRICS\n")
            fh.write("=" * 52 + "\n")
            fh.write(f"Accuracy  : {accuracy:.4f}  ({accuracy*100:.2f}%)\n")
            fh.write(f"Precision : {precision:.4f}  (avg={avg})\n")
            fh.write(f"Recall    : {recall:.4f}  (avg={avg})\n")
            fh.write(f"F1-Score  : {f1:.4f}  (avg={avg})\n")
            fh.write("=" * 52 + "\n\n")
            fh.write("Detailed Classification Report:\n")
            fh.write(report_str)
        logger.info(f"Report saved → {report_path}")

    return {"accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1}


# ─────────────────────────────────────────────────────────────
# CONFUSION MATRIX
# ─────────────────────────────────────────────────────────────

def plot_confusion_matrix(
    y_true,
    y_pred,
    multiclass: bool = False,
    save_fig: bool = True,
    fig_path: str = CONFUSION_MATRIX_PLOT,
):
    """
    Plot a confusion matrix heatmap and optionally save it.

    Parameters
    ----------
    y_true     : array-like of true labels
    y_pred     : array-like of predicted labels
    multiclass : use ATTACK_CATEGORIES names if True
    save_fig   : save to disk
    fig_path   : output path
    """
    cm = confusion_matrix(y_true, y_pred)

    if multiclass:
        present = sorted(set(list(y_true) + list(y_pred)))
        labels  = [ATTACK_CATEGORIES[i] for i in present if i < len(ATTACK_CATEGORIES)]
    else:
        labels = ["Normal", "Attack"]

    fig_w = max(7, len(labels) * 1.2)
    fig_h = max(5, len(labels) * 0.9)

    plt.figure(figsize=(fig_w, fig_h))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=labels,
        yticklabels=labels,
        linewidths=0.4,
        linecolor="lightgray",
    )
    mode_label = "Multiclass" if multiclass else "Binary"
    plt.title(f"Confusion Matrix — LSTM Threat Detection ({mode_label})", fontsize=13, pad=12)
    plt.ylabel("Actual Label",    fontsize=11)
    plt.xlabel("Predicted Label", fontsize=11)
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()

    if save_fig:
        os.makedirs(os.path.dirname(fig_path), exist_ok=True)
        plt.savefig(fig_path, dpi=150, bbox_inches="tight")
        logger.info(f"Confusion matrix saved → {fig_path}")

    plt.close()


# ─────────────────────────────────────────────────────────────
# TRAINING HISTORY PLOTS
# ─────────────────────────────────────────────────────────────

def plot_training_history(history, save_fig: bool = True):
    """
    Save three graph files from a Keras History object:
      1. training_history.png  — accuracy + loss side-by-side
      2. accuracy_curve.png    — accuracy only
      3. loss_curve.png        — loss only

    Parameters
    ----------
    history  : Keras History object (returned by model.fit())
    save_fig : save to disk
    """
    os.makedirs(GRAPHS_DIR, exist_ok=True)

    acc     = history.history.get("accuracy",     [])
    val_acc = history.history.get("val_accuracy", [])
    loss    = history.history.get("loss",         [])
    val_loss= history.history.get("val_loss",     [])
    epochs  = range(1, len(acc) + 1)

    # ── 1. Combined history plot ───────────────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    axes[0].plot(epochs, acc,     color="steelblue", label="Train Accuracy",  linewidth=2)
    axes[0].plot(epochs, val_acc, color="orange",    label="Val Accuracy",    linewidth=2, linestyle="--")
    axes[0].set_title("Model Accuracy", fontsize=13)
    axes[0].set_xlabel("Epoch");  axes[0].set_ylabel("Accuracy")
    axes[0].legend();             axes[0].grid(True, alpha=0.3)
    axes[0].set_ylim([0, 1.05])

    axes[1].plot(epochs, loss,     color="steelblue", label="Train Loss",  linewidth=2)
    axes[1].plot(epochs, val_loss, color="orange",    label="Val Loss",    linewidth=2, linestyle="--")
    axes[1].set_title("Model Loss", fontsize=13)
    axes[1].set_xlabel("Epoch");   axes[1].set_ylabel("Loss")
    axes[1].legend();              axes[1].grid(True, alpha=0.3)

    plt.suptitle("LSTM Training History", fontsize=15)
    plt.tight_layout()
    if save_fig:
        plt.savefig(TRAINING_HISTORY_PLOT, dpi=150, bbox_inches="tight")
        logger.info(f"Training history saved → {TRAINING_HISTORY_PLOT}")
    plt.close()

    # ── 2. Accuracy-only plot ──────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(epochs, acc,     color="steelblue", label="Train Accuracy", linewidth=2)
    ax.plot(epochs, val_acc, color="orange",    label="Val Accuracy",   linewidth=2, linestyle="--")
    ax.fill_between(epochs, acc, val_acc, alpha=0.08, color="steelblue")
    ax.set_title("Accuracy Curve — LSTM Threat Detection", fontsize=13)
    ax.set_xlabel("Epoch");  ax.set_ylabel("Accuracy")
    ax.set_ylim([0, 1.05]);  ax.legend();  ax.grid(True, alpha=0.3)
    plt.tight_layout()
    if save_fig:
        plt.savefig(ACCURACY_CURVE_PLOT, dpi=150, bbox_inches="tight")
        logger.info(f"Accuracy curve saved  → {ACCURACY_CURVE_PLOT}")
    plt.close()

    # ── 3. Loss-only plot ──────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(epochs, loss,     color="crimson", label="Train Loss", linewidth=2)
    ax.plot(epochs, val_loss, color="tomato",  label="Val Loss",   linewidth=2, linestyle="--")
    ax.fill_between(epochs, loss, val_loss, alpha=0.08, color="crimson")
    ax.set_title("Loss Curve — LSTM Threat Detection", fontsize=13)
    ax.set_xlabel("Epoch");  ax.set_ylabel("Loss")
    ax.legend();             ax.grid(True, alpha=0.3)
    plt.tight_layout()
    if save_fig:
        plt.savefig(LOSS_CURVE_PLOT, dpi=150, bbox_inches="tight")
        logger.info(f"Loss curve saved      → {LOSS_CURVE_PLOT}")
    plt.close()
