# TravelTrace developer shortcuts. Docker is only required for `docker-*` targets.

PYTHON ?= .venv/Scripts/python.exe
ifeq ($(OS),)
PYTHON := .venv/bin/python
endif

.PHONY: help install backend frontend test test-backend test-frontend lint build docker-up docker-down demo seed screenshots

help:
	@echo "TravelTrace targets:"
	@echo "  install        Create .venv and install backend[dev] + frontend dependencies"
	@echo "  backend        Run the API with reload on :8000 (SQLite by default)"
	@echo "  frontend       Run the Vite dev server on :5173"
	@echo "  test           Backend + frontend unit tests"
	@echo "  lint           Ruff + ESLint + typecheck"
	@echo "  build          Production frontend build"
	@echo "  docker-up      Build and start the Docker Compose stack"
	@echo "  docker-down    Stop the stack"
	@echo "  seed           Seed the demo data into a running instance"
	@echo "  screenshots    Capture README screenshots (needs a seeded instance)"

install:
	python -m venv .venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -e "backend[dev]"
	cd frontend && npm install

backend:
	cd backend && ../$(PYTHON) -m uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	$(PYTHON) -m pytest

test-frontend:
	cd frontend && npm run test

lint:
	$(PYTHON) -m ruff check backend tests
	$(PYTHON) -m ruff format --check backend tests
	cd frontend && npm run lint && npm run typecheck

build:
	cd frontend && npm run build

docker-up:
	cp -n .env.example .env || true
	docker compose up -d --build

docker-down:
	docker compose down

seed:
	$(PYTHON) demo/seed.py --api http://localhost:8080/api/v1

screenshots:
	cd frontend && E2E_CHANNEL=chrome node scripts/screenshots.mjs
