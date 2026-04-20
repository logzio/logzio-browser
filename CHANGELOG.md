# Changes by Version

<!-- next version -->

## 1.3.0

- **Breaking change**:
  - Web vitals are now only reported as traces (spans)
- Batch `MutationObserver` notifications with `requestAnimationFrame` to reduce DOM-churn overhead
- Add session level sampling via `SessionSampler`, which rerolls sampling decision on session renewal
- Reduce session activity writes to localStorage
- Optimize DOM interactivity checks

## 1.2.1

- Optimize batch export settings
  - Increase max batch size from `50` to `200` spans/logs per batch
  - Increase trace flush interval from `4s` to `15s`
  - Increase log flush interval from `1s` to `10s`
- Update dependencies versions

## 1.2.0

- Replace `ErrorTrackingInstrumentation` with OTEL's `instrumentation-web-exception`.
- Update dependencies versions

## 1.1.0

- **Breaking changes**
  - Removed metrics functunality
  - Web vitals are now only reported as logs
  - Frustration signal count metric is no longer generated

## 1.0.0

- Initial release
- Library for collecting Real user monitoring from browser applications and sending to Logzio
