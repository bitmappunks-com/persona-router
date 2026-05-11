.PHONY: test validate audit-community eval-router cli-demo web

test:
	PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest

audit-community:
	python3 scripts/audit_community_personas.py .

eval-router:
	python3 scripts/run_router_evals.py .

validate:
	python3 -m persona_router.cli --json validate
	python3 scripts/audit_community_personas.py .
	python3 scripts/run_router_evals.py .

cli-demo:
	python3 -m persona_router.cli --json session new

web:
	python3 -m uvicorn persona_router.api:app --reload --host 127.0.0.1 --port 8000
