"""
Celery configuration proxy to app.celery_app
"""
from app.celery_app import celery_app, REDIS_URL

__all__ = ["celery_app", "REDIS_URL"]
