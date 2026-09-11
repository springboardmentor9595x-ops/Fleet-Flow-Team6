import os
from pathlib import Path
from dotenv import load_dotenv

# BACKEND_DIR is the root directory of the backend application (.../fleetflow_db/backend)
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"


def load_backend_env():
    """
    Load backend/.env reliably regardless of current working directory
    (e.g., whether running from repo root or backend folder).
    """
    if ENV_PATH.exists():
        load_dotenv(dotenv_path=ENV_PATH, override=True)
    else:
        load_dotenv(override=True)


# Automatically load on import
load_backend_env()
