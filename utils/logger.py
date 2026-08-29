"""
utils/logger.py
----------------
Cybersecurity-aware logging utility for the AI Threat Detection system.

Creates a structured log at logs/detection.log that records:
  - Preprocessing events  (data loaded, features encoded, files saved)
  - Training events       (epoch results, model saved, metrics)
  - Prediction events     (input file, prediction counts, threat alerts)
  - Error events          (exceptions with full context)

Usage:
    from utils.logger import get_logger
    logger = get_logger("preprocess")
    logger.info("Preprocessing started")
    logger.warning("Missing values found: 42")
    logger.error("Dataset file not found")
"""

import os
import sys
import logging
import logging.handlers
from datetime import datetime

# Import BASE_DIR and LOG paths from config
# Use a try/except to allow logger to work even if config import fails
try:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from config import LOGS_DIR, LOG_FILE
except ImportError:
    LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
    LOG_FILE = os.path.join(LOGS_DIR, "detection.log")


# ─────────────────────────────────────────────────────────────
# LOG FORMAT
# ─────────────────────────────────────────────────────────────
LOG_FORMAT = (
    "%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s"
)
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Maximum single log file size before rotation: 5 MB
MAX_BYTES    = 5 * 1024 * 1024
BACKUP_COUNT = 3   # Keep 3 rotated log files


def _ensure_log_dir():
    """Create the logs/ directory if it does not exist."""
    os.makedirs(LOGS_DIR, exist_ok=True)


def get_logger(name: str) -> logging.Logger:
    """
    Get a named logger that writes to both the console and detection.log.

    Parameters
    ----------
    name : str
        Logger name, typically the module name (e.g., "preprocess", "train").

    Returns
    -------
    logging.Logger
    """
    _ensure_log_dir()

    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers if logger already configured
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # ── File handler (rotating) ────────────────────────────────────────
    file_handler = logging.handlers.RotatingFileHandler(
        LOG_FILE,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # ── Console handler ────────────────────────────────────────────────
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    # Prevent propagation to the root logger (avoids duplicate output)
    logger.propagate = False

    return logger


def log_section(logger: logging.Logger, title: str):
    """
    Write a visual section separator to the log for readability.

    Parameters
    ----------
    logger : logging.Logger
    title  : str
    """
    sep = "=" * 55
    logger.info(sep)
    logger.info(f"  {title}")
    logger.info(sep)


def log_prediction_event(
    logger: logging.Logger,
    total: int,
    attacks: int,
    normals: int,
    source: str = "test_set",
):
    """
    Log a summary of a prediction run as a structured security event.

    Parameters
    ----------
    logger  : logging.Logger
    total   : int, total samples predicted
    attacks : int, samples classified as Attack
    normals : int, samples classified as Normal
    source  : str, description of the input source
    """
    threat_pct = 100 * attacks / total if total > 0 else 0.0
    logger.info(
        f"PREDICTION_EVENT | source={source} | total={total} | "
        f"normal={normals} | attack={attacks} | threat_rate={threat_pct:.2f}%"
    )
    if threat_pct > 50:
        logger.warning(
            f"HIGH THREAT RATE DETECTED: {threat_pct:.1f}% of traffic classified as attack "
            f"(source: {source})"
        )


def log_training_event(
    logger: logging.Logger,
    epoch: int,
    train_acc: float,
    val_acc: float,
    train_loss: float,
    val_loss: float,
):
    """
    Log metrics for a single training epoch.

    Parameters
    ----------
    logger     : logging.Logger
    epoch      : int
    train_acc  : float
    val_acc    : float
    train_loss : float
    val_loss   : float
    """
    logger.debug(
        f"EPOCH {epoch:03d} | train_acc={train_acc:.4f} val_acc={val_acc:.4f} "
        f"train_loss={train_loss:.4f} val_loss={val_loss:.4f}"
    )


def log_error(logger: logging.Logger, context: str, exc: Exception):
    """
    Log a detailed error with context and exception information.

    Parameters
    ----------
    logger  : logging.Logger
    context : str, description of what was being attempted
    exc     : Exception
    """
    logger.error(f"ERROR in [{context}]: {type(exc).__name__}: {exc}", exc_info=True)
