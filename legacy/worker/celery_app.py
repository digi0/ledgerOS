from celery import Celery

from app.config import get_settings

_s = get_settings()

celery_app = Celery(
    "ledgeros",
    broker=_s.redis_url,
    backend=_s.redis_url,
    include=["worker.tasks"],
)

celery_app.conf.update(
    task_default_queue="default",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
)
