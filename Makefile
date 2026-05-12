.PHONY: test validate audit-imported eval-router cli-demo web web-dev web-build web-install

test:
	PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest

audit-imported:
	python3 persona_router/scripts/audit_imported_personas.py .

eval-router:
	python3 persona_router/scripts/run_router_evals.py .

validate:
	python3 -m persona_router.cli --json validate
	python3 persona_router/scripts/audit_imported_personas.py .
	python3 persona_router/scripts/run_router_evals.py .

cli-demo:
	python3 -m persona_router.cli --json session new

web-install:
	cd frontend && npm install

web-build:
	cd frontend && npm run build

web-dev:
	cd frontend && npm run dev

web:
	python3 -m uvicorn persona_router.api:app --reload --host 127.0.0.1 --port 8000
