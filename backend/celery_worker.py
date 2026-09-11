import os
import sys

# Ensure current directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.celery_app import celery_app

if __name__ == "__main__":
    celery_app.start()
