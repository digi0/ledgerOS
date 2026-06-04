.PHONY: help install up down logs api worker migrate revision shell fmt lint

help:
	@echo "make install     Install Python deps into .venv"
	@echo "make up          Start Postgres, Redis, MinIO (docker compose)"
	@echo "make down        Stop infra"
	@echo "make api         Run FastAPI dev server on :8000"
	@echo "make worker      Run a Celery worker"
	@echo "make migrate     Apply DB migrations"
	@echo "make revision m=\"msg\"  Autogenerate a migration"
	@echo "make fmt / lint  Format / lint with ruff"

install:
	python3.12 -m venv .venv
	. .venv/bin/activate && pip install -U pip && pip install -e ".[dev]"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

api:
	. .venv/bin/activate && uvicorn app.main:app --reload --port 8000

worker:
	. .venv/bin/activate && celery -A worker.celery_app worker --loglevel=info

migrate:
	. .venv/bin/activate && alembic upgrade head

revision:
	. .venv/bin/activate && alembic revision --autogenerate -m "$(m)"

fmt:
	. .venv/bin/activate && ruff format .

lint:
	. .venv/bin/activate && ruff check .
