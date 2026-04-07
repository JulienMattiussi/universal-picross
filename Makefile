default: help

help: ## Display available commands
	@fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	npm install --legacy-peer-deps
	npx playwright install chromium

start: ## Start application in development
	npm run dev

build: ## Build application for production
	npm run build

preview: build ## Preview production build locally
	npm run preview

lint: ## Run ESLint
	npm run lint

format: ## Format code with Prettier
	npm run format

format-check: ## Check formatting with Prettier
	npm run format:check

typecheck: ## Run TypeScript type checker
	npx tsc -b --noEmit

test: test-unit test-e2e ## Run all tests (unit + component + e2e)

test-unit: ## Run unit and component tests
	npm run test

test-watch: ## Run unit and component tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

test-e2e: ## Run e2e tests with Playwright (starts dev server automatically)
	npm run test:e2e

test-e2e-ui: ## Run e2e tests with Playwright UI
	npm run test:e2e:ui

fix: format lint ## Format and lint all code

check: build lint typecheck test-unit ## Run all checks (build, lint, typecheck, unit tests)
	@echo "All checks passed!"

clean: ## Remove build artifacts and dependencies
	rm -rf dist node_modules
