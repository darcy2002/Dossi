"""Shared logging setup — logs to stdout with timestamp, level, and message."""

import logging
import sys

logger = logging.getLogger("dossi")


def configure_logging(level: int = logging.INFO) -> logging.Logger:
    """Configure the shared 'dossi' logger to write to stdout.

    Safe to call multiple times (e.g. under uvicorn --reload): guards against
    attaching duplicate handlers.
    """
    logger.setLevel(level)
    logger.propagate = False

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
        logger.addHandler(handler)

    return logger
