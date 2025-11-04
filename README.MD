# Logz.io Real User Monitoring

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm](https://img.shields.io/npm/v/@logzio/browser)](https://www.npmjs.com/package/@logzio/browser)

> [!IMPORTANT]
> `LogzioRUM` is still in **beta** phase, breaking changes may be introduced.

This package wraps [OpenTelemetry JavaScript for web](https://opentelemetry.io/) and provides a simple API to collect and send real user monitoring data to Logz.io.

## Table of content

- [Setup](#setup)
  - [Configuration options](#configuration-options)
  - [Dynamic attributes inject](#dynamically-inject-attributes)
  - [Correlate with Backend Traces](#correlate-browser-traces-with-backend-traces)
- [Collected Metrics](#collected-metrics)
- [Changelog](./CHANGELOG.md)
- [Contributing](./CONTRIBUTING.md)

## Setup

Install the dependency:

```shell
npm install @logzio/browser
```

Call `LogzioRUM.init()` to initialize the RUM client. This should be done as early as possible in your application lifecycle.

```javascript
LogzioRUM.init({
  region: <<LOGZIO_REGION_CODE>>,
  tokens: {
    traces: <<LOGZIO_TRACES_TOKEN>>,
    logs: <<LOGZIO_LOGS_TOKEN>>, // Required unless enable.errorTracking, enable.consoleLogs, enable.viewEvents, and enable.webVitals are all set to false
  },
  endpoint: {
    url: "<<LOGZIO_RUM_URL>>",
  },
  service: {
    name: <<SERVICE_NAME>>,        // Optional
    version: <<SERVICE_VERSION>>,  // Optional
  },
  customAttributes: {
    //// Optional, extra fields containing user metadata to be sent with each event
    //// example:
    // user.name: user.name,
    // user.id: user.id,
    // "user.role": user.role,

    // recommended: add env field (prod, dev, staging...)
    env_id: "prod"
  },
});
```

### Configuration Options

| Parameter Name                             | Description                                                                                                                                                            | Required/Optional | Default                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------- |
| region                                     | The Logz.io account region code (e.g., `us`, `eu`, `au`, `uk`, `ca`)                                                                                                   | Required          | `us`                        |
| tokens.traces                              | The Logz.io traces shipping token                                                                                                                                      | Required          | -                           |
| tokens.logs                                | The Logz.io logs shipping token. **Required unless** `enable.errorTracking`, `enable.consoleLogs`, `enable.viewEvents`, and `enable.webVitals` are all set to `false`. | Required\*        | -                           |
| endpoint.url                               | Endpoint URL to send the collected data to in OTLP.                                                                                                                    | Required          | -                           |
| endpoint.addSuffix                         | Whether to append data type suffixes (`/traces`, `/logs`) to the endpoint URL.                                                                                         | Optional          | `false`                     |
| service.name                               | The name of the service being monitored.                                                                                                                               | Optional          | `""`                        |
| service.version                            | The version of the service being monitored.                                                                                                                            | Optional          | `""`                        |
| session.maxDurationMs                      | The maximum duration of a session in ms.                                                                                                                               | Optional          | `4 * 60 * 60 * 1000` (`4h`) |
| session.timeoutMs                          | If a user is inactive for this duration, the session will end.                                                                                                         | Optional          | `15 * 60 * 1000` (`15m`)    |
| enable.userActions                         | Enable user actions tracking.                                                                                                                                          | Optional          | `true`                      |
| enable.navigation                          | Enables SPA route change detection and treats them as new views.                                                                                                       | Optional          | `true`                      |
| enable.documentLoad                        | Enables the initial page load span.                                                                                                                                    | Optional          | `true`                      |
| enable.resourceLoad                        | Enable resource loading tracking such as XHR, fetch, scripts, images.                                                                                                  | Optional          | `true`                      |
| enable.errorTracking                       | Enable exceptions tracking.                                                                                                                                            | Optional          | `true`                      |
| enable.frustrationDetection                | Enable frustration detection such as rage clicks, dead clicks and heavy load times. Frustration signals will be marked on trace spans.                                 | Optional          | `true`                      |
| enable.webVitals                           | Enable web vitals tracking (FCP, LCP, CLS, INP, TTFB). Web vitals will be emitted as logs.                                                                             | Optional          | `true`                      |
| enable.viewEvents                          | Enable view end log event which contains the duration to indicate the current session state.                                                                           | Optional          | `false`                     |
| enable.consoleLogs                         | Enable console logs tracking. If turned off, no console logs will be sent.                                                                                             | Optional          | `false`                     |
| environmentData.collectOS                  | Enable collection of user operating system name, version and type information.                                                                                         | Optional          | `true`                      |
| environmentData.collectBrowser             | Enable collection of user browser name, version and engine                                                                                                             | Optional          | `true`                      |
| environmentData.collectDevice              | Enable collection of user device type and screen dimensions                                                                                                            | Optional          | `true`                      |
| environmentData.collectLanguage            | Enable collection of user language and timezone                                                                                                                        | Optional          | `true`                      |
| customAttributes                           | Extra fields containing data to be sent with each event. (such as user context)                                                                                        | Optional          | `{}`                        |
| propagateTraceHeaderCorsUrls               | A list of Backend URLs to propagate the trace header to.                                                                                                               | Optional          | `[]`                        |
| samplingRate                               | The rate in which spans are sampled.                                                                                                                                   | Optional          | `100`(%)                    |
| frustrationThresholds.rageClickCount       | The number of clicks within `rageClickIntervalMs` to consider a click as a rage click.                                                                                 | Optional          | `3`                         |
| frustrationThresholds.rageClickIntervalMs  | The time interval in milliseconds to consider for rage clicks.                                                                                                         | Optional          | `1000` (`1s`)               |
| frustrationThresholds.heavyLoadThresholdMs | The time in milliseconds to consider a page load as heavy.                                                                                                             | Optional          | `2000` (`2s`)               |
| logLevel                                   | The log level of the RUM library.                                                                                                                                      | Optional          | `'info'`                    |

<!-- prettier-ignore-start -->

### Dynamically inject attributes
You can dynamically inject attributes that will be added to all data generated by the library by using the `LogzioRUM.setAttributes()` method.
This allows you to add or update attributes at runtime, which can be useful for capturing user-specific data or application state.

```javascript
LogzioRUM.setAttributes({
  ...LogzioRUM.getAttributes(),
  theme: 'dark',
});
```

> [!NOTE]
> Please note that the `LogzioRUM.setAttributes()` method will override any existing attributes.

### Correlate Browser Traces with Backend Traces
To correlate browser traces with backend traces, you need to follow the below steps, to ensure that the `traceparent` header is sent with requests to your backend services.

#### Step 1
Configure the `propagateTraceHeaderCorsUrls` option with the URLs of your backend services.  This will ensure that the `traceparent` header is sent with requests to these services.
```javascript
LogzioRUM.init({
  // ... other options
  propagateTraceHeaderCorsUrls: [
    'https://api.example.com', 
    'https://backend.example.com'
  ]
});
```

#### Step 2
The `traceparent` header is not CORS-safelisted, so you need to configure your backend to accept it and use it in your backend tracing implementation.

<!-- prettier-ignore-end -->

## Collected Data

### Web Vitals (Logs)

When `enable.webVitals` is set to `true`, the SDK collects and emits the following web vitals as log events:

| Metric                              | Description                                         | Unit             |
| ----------------------------------- | --------------------------------------------------- | ---------------- |
| **FCP** (First Contentful Paint)    | Time to first visible paint                         | ms               |
| **LCP** (Largest Contentful Paint)  | Time until the largest visible element renders      | ms               |
| **CLS** (Cumulative Layout Shift)   | Visual stability across the session                 | score (unitless) |
| **INP** (Interaction to Next Paint) | Response time to next paint after user interactions | ms               |
| **TTFB** (Time to First Byte)       | Time from navigation start to first byte received   | ms               |

Each web vital log includes detailed attribution data to help diagnose performance issues.

### Frustration Signals (Traces)

When `enable.frustrationDetection` is set to `true`, the SDK detects and marks spans with frustration attributes:

| Frustration Type | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| Dead Click       | User clicks on an element that doesn't trigger any visible action  |
| Rage Click       | Multiple rapid clicks on the same element (configurable threshold) |
| Error Click      | Click followed immediately by an error                             |
| Heavy Load       | Page or navigation load exceeds threshold (configurable)           |

## Changelog

Please see [CHANGELOG.md](./CHANGELOG.md) for the latest changes.

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) ❤️
