.PHONY: setup lint test docs bench audit ci

# MVNLOCAL (set by the author's repoenv helper) keeps the Maven repository inside the repo; empty in CI.
MVN = mvn -B -q $(MVNLOCAL)

setup:
	cd js && npm ci

# javac -Werror, tsc --checkJs --strict, and generated docs and expected values must be current.
lint:
	cd java && $(MVN) -DskipTests compile
	cd js && npm run -s lint
	cd js && node src/cli.js docs --check && node src/cli.js expected --check

# JavaScript calculator tests, then Java recomputes all twelve cases and must match.
test:
	cd js && npm test
	cd java && $(MVN) verify

# Regenerate docs/cases/*.md (generated sections) and cases/expected/*.json from cases/*.json.
docs:
	cd js && node src/cli.js docs && node src/cli.js expected

bench:
	@echo "M2: prototypes for the critical path of each case, measured with k6 against the estimates"

# Known vulnerabilities in npm dependencies (Java: Dependabot alerts).
audit:
	cd js && npm audit --audit-level=high

ci: setup lint test
