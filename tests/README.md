# RUM Testing Architecture

This project uses a comprehensive 3-tier testing strategy to ensure robust coverage across different environments and use cases.

## Overview

### Tier 1: Unit Tests (`tests/unit/`)

**Purpose**: Test individual components in isolation with mocked dependencies

- **Environment**: Jest + JSDOM
- **Coverage**: Component logic, error handling, edge cases
- **Speed**: Fast (< 1s per test suite)
- **Dependencies**: All external dependencies mocked

**What we test:**

- Individual instrumentation logic
- Configuration validation
- Context management
- Utility functions
- Error boundaries and defensive programming

**Example**: Testing that `UserInteractions.ts` correctly identifies rage clicks without actually creating DOM events or OTLP spans.

### Tier 2: Integration Tests (`tests/integration/`)

**Purpose**: Test component interactions and RUM library behavior without network dependencies

- **Environment**: Jest + JSDOM
- **Coverage**: Cross-component behavior, initialization flows, graceful degradation
- **Speed**: Medium (1-3s per test suite)
- **Dependencies**: OTLP exporters avoided, DOM APIs simulated

**What we test:**

- RUM library initialization and shutdown
- Instrumentation registration and setup
- Console patching and event handling
- Navigation and user interaction flows
- Configuration validation and error handling
- No-throw policy compliance

**Example**: Verifying that `LogzioRUM.init()` successfully registers all instrumentations and handles invalid configurations gracefully.

### Tier 3: Browser Tests (`tests/browser/`)

**Purpose**: End-to-end testing with real browser APIs and OTLP data verification

- **Environment**: Playwright + Real Browser (Chromium)
- **Coverage**: Full integration with real Performance APIs, metrics collection, OTLP export verification
- **Speed**: Slower (3-10s per test suite)
- **Dependencies**: Real browser APIs, mock OTLP collector

**What we test:**

- Web Vitals metrics collection using real `PerformanceObserver`
- Frustration detection with real user interactions
- OTLP data format and content verification
- Session and view management across navigation
- Real network requests and timing
- Performance impact measurement

**Example**: Triggering actual rage clicks in a browser and verifying the exported OTLP metrics contain correct frustration attributes.

## Running Tests

### Run All Tests

```bash
npm run test
```

### Run by Tier

```bash
# Tier 1: Unit tests only
npm run test:unit

# Tier 2: Integration tests (JSDOM)
npm run test:integration

# Tier 3: Browser tests (requires test server)
npm run test:browser
```

### Development Workflow

```bash
# 1. Start browser test server (in separate terminal)
node tests/browser/helpers/testServer.js

# 2. Run specific test suites during development
npm run test:unit -- --watch
npm run test:integration -- tests/integration/specs/rum.simple.test.ts
npx playwright test tests/browser/specs/metrics.test.ts --headed
```

### Test Development Guidelines

- **Start with unit tests** for new functionality
- **Add integration tests** for cross-component behavior
- **Use browser tests** for metrics, performance, and real API verification
- **Avoid OTLP exporters in JSDOM** - use simple behavior verification instead
- **Mock external dependencies** in unit and integration tests
- **Use real APIs** only in browser tests

## 📊 Coverage Goals

- **Unit Tests**: 80%+ code coverage, focus on logic paths
- **Integration Tests**: Core behavior verification, no-throw compliance
- **Browser Tests**: End-to-end scenarios, real performance validation
